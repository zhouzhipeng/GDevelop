// @ts-check
'use strict';

/**
 * Tests for My Cloud user accounts: register/login, JWT auth, and per-user
 * project isolation. Uses Node's built-in test runner.
 */

const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');

const { createStorage } = require('../src/storage');
const { createAuth } = require('../src/auth');
const { createRequestHandler } = require('../src/core');

const request = (baseUrl, method, urlPath, { headers, body } = {}) =>
  new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl);
    const req = http.request(url, { method, headers: headers || {} }, res => {
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
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });

const startServer = ({ token } = {}) =>
  new Promise(resolve => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mycloud-auth-test-'));
    const storage = createStorage(dataDir);
    const auth = createAuth(dataDir, { tokenSecret: 'test-secret' });
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

const bearer = token => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });

test('health advertises accountsEnabled', async () => {
  const srv = await startServer();
  try {
    const h = (await request(srv.baseUrl, 'GET', '/api/health')).json();
    assert.equal(h.accountsEnabled, true);
  } finally {
    await srv.close();
  }
});

test('register returns a token and rejects duplicates / bad input', async () => {
  const srv = await startServer();
  try {
    const ok = await request(srv.baseUrl, 'POST', '/api/auth/register', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'secret123', username: 'Al' }),
    });
    assert.equal(ok.status, 201);
    const body = ok.json();
    assert.ok(body.token, 'token returned');
    assert.equal(body.user.email, 'a@b.com');
    assert.ok(!('passwordHash' in body.user), 'no secrets leaked');

    // duplicate
    const dup = await request(srv.baseUrl, 'POST', '/api/auth/register', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'secret123' }),
    });
    assert.equal(dup.status, 409);

    // bad email
    const bad = await request(srv.baseUrl, 'POST', '/api/auth/register', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nope', password: 'secret123' }),
    });
    assert.equal(bad.status, 400);

    // short password
    const short = await request(srv.baseUrl, 'POST', '/api/auth/register', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'c@d.com', password: '123' }),
    });
    assert.equal(short.status, 400);
  } finally {
    await srv.close();
  }
});

test('login works and rejects wrong password', async () => {
  const srv = await startServer();
  try {
    await request(srv.baseUrl, 'POST', '/api/auth/register', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'u@v.com', password: 'rightpass' }),
    });
    const ok = await request(srv.baseUrl, 'POST', '/api/auth/login', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'u@v.com', password: 'rightpass' }),
    });
    assert.equal(ok.status, 200);
    assert.ok(ok.json().token);

    const wrong = await request(srv.baseUrl, 'POST', '/api/auth/login', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'u@v.com', password: 'wrongpass' }),
    });
    assert.equal(wrong.status, 401);

    const noUser = await request(srv.baseUrl, 'POST', '/api/auth/login', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ghost@v.com', password: 'whatever' }),
    });
    assert.equal(noUser.status, 401);
  } finally {
    await srv.close();
  }
});

test('/api/auth/me resolves the token', async () => {
  const srv = await startServer();
  try {
    const token = (
      await request(srv.baseUrl, 'POST', '/api/auth/register', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'me@x.com', password: 'secret123' }),
      })
    ).json().token;
    const me = await request(srv.baseUrl, 'GET', '/api/auth/me', {
      headers: bearer(token),
    });
    assert.equal(me.status, 200);
    assert.equal(me.json().user.email, 'me@x.com');

    const anon = await request(srv.baseUrl, 'GET', '/api/auth/me');
    assert.equal(anon.status, 401);
  } finally {
    await srv.close();
  }
});

test('per-user project isolation: users only see their own projects', async () => {
  const srv = await startServer();
  try {
    const reg = async email =>
      (
        await request(srv.baseUrl, 'POST', '/api/auth/register', {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: 'secret123' }),
        })
      ).json().token;

    const alice = await reg('alice@x.com');
    const bob = await reg('bob@x.com');

    // Alice creates a project.
    const aliceProject = (
      await request(srv.baseUrl, 'POST', '/api/projects', {
        headers: bearer(alice),
        body: JSON.stringify({ name: "Alice's game" }),
      })
    ).json();
    assert.ok(aliceProject.id);

    // Bob creates a project.
    await request(srv.baseUrl, 'POST', '/api/projects', {
      headers: bearer(bob),
      body: JSON.stringify({ name: "Bob's game" }),
    });

    // Alice lists -> only her project.
    const aliceList = (
      await request(srv.baseUrl, 'GET', '/api/projects', { headers: bearer(alice) })
    ).json();
    assert.equal(aliceList.length, 1);
    assert.equal(aliceList[0].name, "Alice's game");

    // Bob lists -> only his project.
    const bobList = (
      await request(srv.baseUrl, 'GET', '/api/projects', { headers: bearer(bob) })
    ).json();
    assert.equal(bobList.length, 1);
    assert.equal(bobList[0].name, "Bob's game");

    // Bob cannot GET / PATCH / DELETE Alice's project (404, not 403, to avoid leaking existence).
    const bobGet = await request(srv.baseUrl, 'GET', `/api/projects/${aliceProject.id}`, {
      headers: bearer(bob),
    });
    assert.equal(bobGet.status, 404);

    const bobDelete = await request(srv.baseUrl, 'DELETE', `/api/projects/${aliceProject.id}`, {
      headers: bearer(bob),
    });
    assert.equal(bobDelete.status, 404);

    // Alice can still access her own.
    const aliceGet = await request(srv.baseUrl, 'GET', `/api/projects/${aliceProject.id}`, {
      headers: bearer(alice),
    });
    assert.equal(aliceGet.status, 200);
  } finally {
    await srv.close();
  }
});

test('shared token (admin) sees all projects across users', async () => {
  const srv = await startServer({ token: 'admintoken' });
  try {
    const alice = (
      await request(srv.baseUrl, 'POST', '/api/auth/register', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'alice2@x.com', password: 'secret123' }),
      })
    ).json().token;
    await request(srv.baseUrl, 'POST', '/api/projects', {
      headers: bearer(alice),
      body: JSON.stringify({ name: 'A' }),
    });

    // Anonymous (no token) is rejected because a shared token is configured.
    const anon = await request(srv.baseUrl, 'GET', '/api/projects');
    assert.equal(anon.status, 401);

    // Shared token sees everything.
    const all = await request(srv.baseUrl, 'GET', '/api/projects', {
      headers: bearer('admintoken'),
    });
    assert.equal(all.status, 200);
    assert.ok(all.json().length >= 1);
  } finally {
    await srv.close();
  }
});
