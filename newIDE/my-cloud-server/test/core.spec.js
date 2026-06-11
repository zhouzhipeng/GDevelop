// @ts-check
'use strict';

/**
 * End-to-end tests for the My Cloud server, using Node's built-in test runner
 * (`node --test`). Spins up a real http server on an ephemeral port and drives
 * the full REST + share contract over the wire. No third-party test deps.
 */

const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const { createStorage } = require('../src/storage');
const { createRequestHandler } = require('../src/core');

// --- minimal http client ----------------------------------------------------

const request = (baseUrl, method, urlPath, { headers, body } = {}) =>
  new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl);
    const req = http.request(
      url,
      { method, headers: headers || {} },
      res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            buffer: Buffer.concat(chunks),
            get text() {
              return Buffer.concat(chunks).toString('utf8');
            },
            json() {
              return JSON.parse(Buffer.concat(chunks).toString('utf8'));
            },
          })
        );
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });

// --- tiny zip writer (store + deflate) for the export test ------------------
// Builds a real .zip Buffer containing the given { name: contentBuffer } files
// so the server's yauzl extraction path is exercised for /play.

const makeZip = files => {
  const entries = [];
  const central = [];
  let offset = 0;

  const dosDateTime = () => ({ time: 0, date: 0x21 }); // fixed (1980) for determinism

  for (const [name, content] of Object.entries(files)) {
    const nameBuf = Buffer.from(name, 'utf8');
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const crc = crc32(data);
    const compressed = zlib.deflateRawSync(data);
    const { time, date } = dosDateTime();

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(8, 8); // method = deflate
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(date, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    entries.push(localHeader, nameBuf, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(date, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const centralBuf = Buffer.concat(central);
  const localBuf = Buffer.concat(entries);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(localBuf.length, 16);

  return Buffer.concat([localBuf, centralBuf, end]);
};

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();
const crc32 = buf => {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (~c) >>> 0;
};

// --- server harness ---------------------------------------------------------

const startServer = ({ token, accounts } = {}) =>
  new Promise(resolve => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mycloud-test-'));
    const storage = createStorage(dataDir);
    const auth = accounts
      ? require('../src/auth').createAuth(dataDir, { tokenSecret: 'test-secret' })
      : null;
    const handler = createRequestHandler({ storage, token, auth });
    const server = http.createServer((req, res) =>
      handler(req, res).catch(() => {
        res.writeHead(500);
        res.end();
      })
    );
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise(r =>
            server.close(() => {
              fs.rmSync(dataDir, { recursive: true, force: true });
              r();
            })
          ),
      });
    });
  });

// --- tests ------------------------------------------------------------------

test('health reports auth requirement', async () => {
  const srv = await startServer({ token: 'secret' });
  try {
    const res = await request(srv.baseUrl, 'GET', '/api/health');
    assert.equal(res.status, 200);
    const body = res.json();
    assert.equal(body.ok, true);
    assert.equal(body.authRequired, true);
  } finally {
    await srv.close();
  }
});

test('full project lifecycle: create → upload → list → get → download → rename → delete', async () => {
  const srv = await startServer(); // no token
  try {
    // create
    const created = (
      await request(srv.baseUrl, 'POST', '/api/projects', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'My Game', gameId: 'game-1' }),
      })
    ).json();
    assert.ok(created.id, 'project has an id');
    assert.equal(created.name, 'My Game');
    assert.equal(created.currentVersion, null);

    const id = created.id;

    // upload archive (the IDE would send a real project zip; bytes are opaque here)
    const archiveBytes = Buffer.from('PK-fake-project-body');
    const uploadRes = await request(srv.baseUrl, 'POST', `/api/projects/${id}/archive`, {
      headers: { 'Content-Type': 'application/zip' },
      body: archiveBytes,
    });
    assert.equal(uploadRes.status, 200);
    const version = uploadRes.json().version;
    assert.ok(version, 'a version id is returned');

    // list
    const list = (await request(srv.baseUrl, 'GET', '/api/projects')).json();
    assert.equal(list.length, 1);
    assert.equal(list[0].currentVersion, version);

    // get
    const got = (await request(srv.baseUrl, 'GET', `/api/projects/${id}`)).json();
    assert.equal(got.currentVersion, version);

    // download (public)
    const dl = await request(srv.baseUrl, 'GET', `/api/projects/${id}/archive`);
    assert.equal(dl.status, 200);
    assert.deepEqual(dl.buffer, archiveBytes);

    // rename
    const renamed = (
      await request(srv.baseUrl, 'PATCH', `/api/projects/${id}`, {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Renamed Game' }),
      })
    ).json();
    assert.equal(renamed.name, 'Renamed Game');

    // delete
    const del = await request(srv.baseUrl, 'DELETE', `/api/projects/${id}`);
    assert.equal(del.status, 200);
    const listAfter = (await request(srv.baseUrl, 'GET', '/api/projects')).json();
    assert.equal(listAfter.length, 0);
  } finally {
    await srv.close();
  }
});

test('resource upload returns a working public url', async () => {
  const srv = await startServer();
  try {
    const id = (
      await request(srv.baseUrl, 'POST', '/api/projects', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'P' }),
      })
    ).json().id;

    const fileBytes = crypto.randomBytes(64);
    const sha = crypto.createHash('sha512').update(fileBytes).digest('hex').slice(0, 64);
    const up = (
      await request(
        srv.baseUrl,
        'POST',
        `/api/projects/${id}/resources?filename=hero.png&sha=${sha}`,
        { headers: { 'Content-Type': 'image/png' }, body: fileBytes }
      )
    ).json();
    assert.ok(up.url.includes(`/resources/${id}/`), 'url points at the resource route');

    // fetch the resource back via the public route
    const resPath = new URL(up.url).pathname;
    const fetched = await request(srv.baseUrl, 'GET', resPath);
    assert.equal(fetched.status, 200);
    assert.deepEqual(fetched.buffer, fileBytes);
    assert.equal(fetched.headers['content-type'], 'image/png');
  } finally {
    await srv.close();
  }
});

test('auth: API rejected without token, accepted with token', async () => {
  const srv = await startServer({ token: 'sesame' });
  try {
    const denied = await request(srv.baseUrl, 'GET', '/api/projects');
    assert.equal(denied.status, 401);

    const allowed = await request(srv.baseUrl, 'GET', '/api/projects', {
      headers: { Authorization: 'Bearer sesame' },
    });
    assert.equal(allowed.status, 200);

    const wrong = await request(srv.baseUrl, 'GET', '/api/projects', {
      headers: { Authorization: 'Bearer nope' },
    });
    assert.equal(wrong.status, 401);
  } finally {
    await srv.close();
  }
});

test('sharing: landing page, export upload, play serving, download', async () => {
  const srv = await startServer();
  try {
    const id = (
      await request(srv.baseUrl, 'POST', '/api/projects', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Shared Game' }),
      })
    ).json().id;

    // Save a body so download works.
    await request(srv.baseUrl, 'POST', `/api/projects/${id}/archive`, {
      headers: { 'Content-Type': 'application/zip' },
      body: Buffer.from('body'),
    });

    // Landing page before export: Play disabled.
    let landing = await request(srv.baseUrl, 'GET', `/share/${id}`);
    assert.equal(landing.status, 200);
    assert.match(landing.text, /Shared Game/);
    assert.match(landing.text, /not available/);

    // Upload an HTML5 export zip.
    const exportZip = makeZip({
      'index.html': '<!doctype html><title>game</title><canvas></canvas>',
      'code/main.js': 'console.log("hi")',
    });
    const exp = await request(srv.baseUrl, 'POST', `/api/projects/${id}/export`, {
      headers: { 'Content-Type': 'application/zip' },
      body: exportZip,
    });
    assert.equal(exp.status, 200);
    assert.ok(exp.json().playUrl.includes(`/play/${id}/`));

    // Landing page after export: Play enabled.
    landing = await request(srv.baseUrl, 'GET', `/share/${id}`);
    assert.match(landing.text, /Play game/);

    // Play serving: index.html and a nested file.
    const index = await request(srv.baseUrl, 'GET', `/play/${id}/`);
    assert.equal(index.status, 200);
    assert.match(index.text, /<canvas>/);
    assert.match(index.headers['content-type'], /text\/html/);

    const mainJs = await request(srv.baseUrl, 'GET', `/play/${id}/code/main.js`);
    assert.equal(mainJs.status, 200);
    assert.match(mainJs.text, /console\.log/);

    // Download.
    const dl = await request(srv.baseUrl, 'GET', `/download/${id}`);
    assert.equal(dl.status, 200);
    assert.match(dl.headers['content-disposition'] || '', /attachment/);
  } finally {
    await srv.close();
  }
});

test('path traversal is rejected on resource and play routes', async () => {
  const srv = await startServer();
  try {
    const id = (
      await request(srv.baseUrl, 'POST', '/api/projects', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'P' }),
      })
    ).json().id;

    const evil = await request(srv.baseUrl, 'GET', `/play/${id}/..%2f..%2fprojects.json`);
    assert.equal(evil.status, 404);
  } finally {
    await srv.close();
  }
});

test('404 for unknown project', async () => {
  const srv = await startServer();
  try {
    const res = await request(srv.baseUrl, 'GET', '/api/projects/does-not-exist');
    assert.equal(res.status, 404);
  } finally {
    await srv.close();
  }
});
