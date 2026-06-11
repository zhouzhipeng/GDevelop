// @ts-check
'use strict';

/**
 * Tests for the headless MCP host (/mcp). Reuses the real editor MCP stack via
 * libGD in Node. Skipped automatically if the MCP build artifacts
 * (mcp-build/McpEditorBridge.bundle.js + libGD.js) are not present — they are
 * produced by mcp-build/build-mcp-bundle.js, not committed.
 */

const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const { createStorage } = require('../src/storage');
const { createRequestHandler } = require('../src/core');

const MCP_BUILD = path.join(__dirname, '..', 'mcp-build');
const hasMcpBuild =
  fs.existsSync(path.join(MCP_BUILD, 'McpEditorBridge.bundle.js')) &&
  fs.existsSync(path.join(MCP_BUILD, 'libGD.js')) &&
  fs.existsSync(path.join(MCP_BUILD, 'libGD.wasm'));

// --- minimal store-method zip writer (single game.json entry) ---------------
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = b => {
  let c = ~0;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (~c) >>> 0;
};
const makeZip = (name, data) => {
  const nameBuf = Buffer.from(name);
  const comp = zlib.deflateRawSync(data);
  const crc = crc32(data);
  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0);
  lh.writeUInt16LE(20, 4);
  lh.writeUInt16LE(8, 8);
  lh.writeUInt16LE(0x21, 12);
  lh.writeUInt32LE(crc, 14);
  lh.writeUInt32LE(comp.length, 18);
  lh.writeUInt32LE(data.length, 22);
  lh.writeUInt16LE(nameBuf.length, 26);
  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0);
  ch.writeUInt16LE(20, 4);
  ch.writeUInt16LE(20, 6);
  ch.writeUInt16LE(8, 10);
  ch.writeUInt16LE(0x21, 12);
  ch.writeUInt32LE(crc, 16);
  ch.writeUInt32LE(comp.length, 20);
  ch.writeUInt32LE(data.length, 24);
  ch.writeUInt16LE(nameBuf.length, 28);
  ch.writeUInt32LE(0, 42);
  const off = lh.length + nameBuf.length + comp.length;
  const eo = Buffer.alloc(22);
  eo.writeUInt32LE(0x06054b50, 0);
  eo.writeUInt16LE(1, 8);
  eo.writeUInt16LE(1, 10);
  eo.writeUInt32LE(ch.length + nameBuf.length, 12);
  eo.writeUInt32LE(off, 16);
  return Buffer.concat([lh, nameBuf, comp, ch, nameBuf, eo]);
};

const request = (port, method, urlPath, { headers, body } = {}) =>
  new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, method, path: urlPath, headers: headers || {} },
      res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            json: () => JSON.parse(Buffer.concat(chunks).toString('utf8')),
          })
        );
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });

test('headless MCP host: initialize, tools/list, tools/call, auth', async t => {
  if (!hasMcpBuild) {
    t.skip('mcp-build artifacts not present (run mcp-build/build-mcp-bundle.js)');
    return;
  }
  // Build a real project game.json via libGD, store it, then drive /mcp.
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const initializeGDevelopJs = require(path.join(MCP_BUILD, 'libGD.js'));
  const gd = await initializeGDevelopJs({
    locateFile: f => path.join(MCP_BUILD, f),
  });
  const p = gd.ProjectHelper.createNewGDJSProject();
  p.setName('MCP Test Game');
  p.insertNewLayout('TestScene', 0);
  const el = new gd.SerializerElement();
  p.serializeTo(el);
  const json = gd.Serializer.toJSON(el);
  el.delete();
  p.delete();
  delete global.gd; // let the host initialize its own gd

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-test-'));
  const storage = createStorage(dataDir);
  const meta = await storage.createProject({ name: 'MCP Test Game' });
  await storage.writeArchive(meta.id, makeZip('game.json', Buffer.from(json)));

  // eslint-disable-next-line global-require
  const { createMcpHost } = require('../src/mcpHost');
  const mcpHost = createMcpHost({ storage, token: 'tok', projectId: meta.id });
  const handler = createRequestHandler({ storage, token: 'tok', mcpHost });
  const server = http.createServer((q, s) =>
    handler(q, s).catch(() => {
      s.writeHead(500);
      s.end();
    })
  );
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const auth = { Authorization: 'Bearer tok', 'Content-Type': 'application/json' };

  try {
    const init = await request(port, 'POST', '/mcp', {
      headers: auth,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
    });
    assert.equal(init.status, 200);
    assert.ok(init.json().result.serverInfo.name);

    const list = await request(port, 'POST', '/mcp', {
      headers: auth,
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
    });
    assert.ok(list.json().result.tools.length > 10, 'many tools advertised');

    const call = await request(port, 'POST', '/mcp', {
      headers: auth,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'gdevelop_get_project_summary', arguments: {} },
      }),
    });
    const summary = JSON.parse(call.json().result.content[0].text);
    assert.equal(summary.projectName, 'MCP Test Game');
    const sceneNames = summary.scenes.map(s => s.sceneName || s.name);
    assert.ok(sceneNames.includes('TestScene'));

    // Wrong token rejected by the transport.
    const denied = await request(port, 'POST', '/mcp', {
      headers: { Authorization: 'Bearer nope', 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tools/list' }),
    });
    assert.ok(denied.json().error, 'unauthorized returns a JSON-RPC error');
  } finally {
    server.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
