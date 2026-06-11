#!/usr/bin/env node
// @ts-check
'use strict';

/**
 * Standalone entry point for the self-hosted "My Cloud" GDevelop server.
 *
 * Deploy this on any machine (VPS, Docker, home server) to act as a shared
 * cloud for GDevelop projects. The GDevelop desktop app also runs the same
 * core embedded on localhost (see electron-app/app/MyCloudServer.js).
 *
 * Environment variables:
 *   PORT               Port to listen on (default 3030).
 *   HOST               Interface to bind (default 0.0.0.0 for remote access).
 *   MY_CLOUD_TOKEN     Shared access token. If unset, the server is OPEN
 *                      (only do this on a trusted/localhost network).
 *   MY_CLOUD_DATA_DIR  Where to store projects (default ./data).
 *   MY_CLOUD_BASE_URL  Public base url used to build resource links
 *                      (e.g. https://cloud.example.com). Defaults to the
 *                      incoming request Host, which is fine behind a proxy
 *                      that sets X-Forwarded-Proto.
 */

const http = require('http');
const path = require('path');
const { createStorage } = require('./src/storage');
const { createAuth } = require('./src/auth');
const { createRequestHandler, SERVER_VERSION } = require('./src/core');

const port = parseInt(process.env.PORT || '', 10) || 3030;
const host = process.env.HOST || '0.0.0.0';
const token = process.env.MY_CLOUD_TOKEN || null;
const dataDir = process.env.MY_CLOUD_DATA_DIR
  ? path.resolve(process.env.MY_CLOUD_DATA_DIR)
  : path.join(process.cwd(), 'data');
const baseUrlOverride = process.env.MY_CLOUD_BASE_URL
  ? process.env.MY_CLOUD_BASE_URL.replace(/\/+$/, '')
  : null;

// User accounts (register/login, per-user private projects). Enabled by default;
// set MY_CLOUD_ACCOUNTS=off to run in single shared-token mode instead.
const accountsEnabled =
  (process.env.MY_CLOUD_ACCOUNTS || 'on').toLowerCase() !== 'off';

const storage = createStorage(dataDir);
const auth = accountsEnabled
  ? createAuth(dataDir, { tokenSecret: process.env.MY_CLOUD_AUTH_SECRET || null })
  : null;

// Headless MCP host (reuses the real editor MCP stack via libGD in Node — no
// Electron). Enabled with MY_CLOUD_MCP=on; operates on the project configured
// by MY_CLOUD_MCP_PROJECT, sharing the My Cloud access token. Requires the
// prebuilt mcp-build/ assets (libGD.js + bundle), shipped by the deploy script.
const mcpEnabled =
  (process.env.MY_CLOUD_MCP || 'off').toLowerCase() === 'on';
let mcpHost = null;
if (mcpEnabled) {
  try {
    // eslint-disable-next-line global-require
    const { createMcpHost } = require('./src/mcpHost');
    mcpHost = createMcpHost({
      storage,
      token,
      projectId: process.env.MY_CLOUD_MCP_PROJECT || null,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize MCP host (is mcp-build present?):', error.message);
  }
}

const handler = createRequestHandler({
  storage,
  token,
  auth,
  mcpHost,
  getPublicBaseUrl: baseUrlOverride ? () => baseUrlOverride : undefined,
});

const server = http.createServer((req, res) => {
  handler(req, res).catch(error => {
    try {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (error && error.message) || 'error' }));
    } catch (e) {
      // Response already sent.
    }
  });
});

server.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[my-cloud-server v${SERVER_VERSION}] listening on http://${host}:${port}\n` +
      `  data dir : ${dataDir}\n` +
      `  token    : ${token ? 'shared token required' : 'no shared token'}\n` +
      `  accounts : ${accountsEnabled ? 'enabled (register/login)' : 'disabled'}\n` +
      `  mcp      : ${
        mcpHost
          ? `enabled (/mcp, project ${process.env.MY_CLOUD_MCP_PROJECT || '(unset!)'})`
          : 'disabled'
      }\n` +
      `  base url : ${baseUrlOverride || '(derived from request Host header)'}`
  );
});

const shutdown = () => {
  server.close(() => process.exit(0));
  // Force-exit if connections linger.
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
