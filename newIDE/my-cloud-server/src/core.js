// @ts-check
'use strict';

/**
 * Transport-agnostic request handler for the self-hosted "My Cloud" GDevelop
 * server. Modeled on electron-app/app/Mcp/McpServer.js: a single
 * `createRequestHandler` returns an (req, res) function usable both by the
 * standalone `server.js` and the Electron-embedded wrapper.
 *
 * REST API (all under /api, token-protected when a token is configured):
 *   GET    /api/health
 *   GET    /api/projects
 *   POST   /api/projects                      { name, gameId? }
 *   GET    /api/projects/:id
 *   PATCH  /api/projects/:id                  { name?, gameId? }
 *   DELETE /api/projects/:id
 *   GET    /api/projects/:id/archive          -> application/zip
 *   POST   /api/projects/:id/archive          raw zip bytes -> { version }
 *   POST   /api/projects/:id/resources        raw bytes ?filename=&sha= -> { url }
 *   POST   /api/projects/:id/export           raw zip bytes (HTML5 build) -> { ok }
 *
 * Public (no token — these are shareable):
 *   GET /resources/:id/:storedName
 *   GET /share/:id
 *   GET /download/:id
 *   GET /play/:id/*
 */

const { renderLandingPage, renderNotFoundPage } = require('./share');

const SERVER_VERSION = '1.0.0';
const MAX_BODY_BYTES = 200 * 1000 * 1000; // 200 MB ceiling for a project/export upload.

const sendJson = (res, statusCode, payload, extraHeaders) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...(extraHeaders || {}),
  });
  res.end(JSON.stringify(payload));
};

const sendError = (res, statusCode, message) =>
  sendJson(res, statusCode, { error: message });

const sendHtml = (res, statusCode, html) => {
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(html);
};

const sendBuffer = (res, statusCode, buffer, mimeType, extraHeaders) => {
  res.writeHead(statusCode, {
    'Content-Type': mimeType || 'application/octet-stream',
    'Content-Length': buffer.length,
    ...(extraHeaders || {}),
  });
  res.end(buffer);
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};

const readBody = (req, maxBytes) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error('Payload too large.'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('error', reject);
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });

const readJsonBody = async req => {
  const buffer = await readBody(req, 10 * 1000 * 1000);
  if (!buffer.length) return {};
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch (error) {
    throw Object.assign(new Error('Invalid JSON body.'), { statusCode: 400 });
  }
};

const getBearerToken = authorizationHeader => {
  if (!authorizationHeader || typeof authorizationHeader !== 'string') return null;
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
};

/**
 * @param {{ storage: any, token?: ?string, auth?: any, mcpHost?: any, getPublicBaseUrl?: (req:any)=>string }} options
 * @returns {(req:any, res:any) => void}
 */
const createRequestHandler = ({ storage, token, auth, mcpHost, getPublicBaseUrl }) => {
  const sharedTokenRequired = !!token;

  // Resolve the principal for an /api request. Returns one of:
  //   { kind: 'shared' }                 -> the shared MY_CLOUD_TOKEN was used
  //   { kind: 'user', user }             -> a valid user JWT was presented
  //   { kind: 'anonymous' }              -> no/invalid credentials
  // The bearer value can be EITHER the shared token or a user JWT.
  const resolvePrincipal = async req => {
    const bearer = getBearerToken(req.headers.authorization);
    if (token && bearer === token) return { kind: 'shared' };
    if (auth && bearer) {
      const user = await auth.getUserFromToken(bearer);
      if (user) return { kind: 'user', user };
    }
    return { kind: 'anonymous' };
  };

  // Whether a principal may access the /api project routes at all.
  const isAuthorized = principal => {
    if (principal.kind === 'user') return true; // logged-in users always allowed
    if (principal.kind === 'shared') return true; // shared token allowed
    // Anonymous: only allowed when no shared token is configured AND accounts
    // are not in use (pure open/localhost mode).
    return !sharedTokenRequired && !auth;
  };

  // The ownerId to scope project listing/creation to (null = no scoping).
  const ownerIdFor = principal =>
    principal.kind === 'user' ? principal.user.id : null;

  // Whether a principal may read/write a specific project.
  const canAccessProject = (principal, project) => {
    if (!project) return false;
    if (principal.kind === 'shared') return true; // admin/shared sees all
    if (principal.kind === 'user') {
      // Owner, or a legacy project with no owner.
      return !project.ownerId || project.ownerId === principal.user.id;
    }
    // Anonymous (only reachable in open mode): allow.
    return true;
  };

  // Build the absolute base url used to compose resource urls returned to the
  // IDE, e.g. http://host:port or https://host/my-cloud . A configured
  // MY_CLOUD_BASE_URL wins; otherwise it is derived from the request, honoring
  // reverse-proxy X-Forwarded-* headers (proto + path prefix).
  const publicBaseUrl = req => {
    if (getPublicBaseUrl) return getPublicBaseUrl(req).replace(/\/+$/, '');
    const host = req.headers.host || '127.0.0.1';
    const proto =
      req.headers['x-forwarded-proto'] ||
      (req.socket && req.socket.encrypted ? 'https' : 'http');
    const prefix = (req.headers['x-forwarded-prefix'] || '').replace(/\/+$/, '');
    return `${proto}://${host}${prefix}`;
  };

  return async (req, res) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(req.url, 'http://placeholder');
    } catch (error) {
      sendError(res, 400, 'Bad request URL.');
      return;
    }
    const pathname = decodeURIComponent(parsedUrl.pathname);
    const method = req.method || 'GET';

    // CORS preflight for the web IDE.
    if (method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    // Apply permissive CORS to every response (safe: API itself is token-gated).
    Object.keys(CORS_HEADERS).forEach(key => res.setHeader(key, CORS_HEADERS[key]));

    try {
      // ---- Public share routes (no token) -------------------------------
      if (method === 'GET' && pathname.startsWith('/share/')) {
        const id = pathname.slice('/share/'.length);
        const project = await storage.getProject(id);
        if (!project) {
          sendHtml(res, 404, renderNotFoundPage());
          return;
        }
        sendHtml(
          res,
          200,
          renderLandingPage({
            project,
            hasExport: storage.hasExport(id),
            baseUrl: publicBaseUrl(req),
          })
        );
        return;
      }

      if (method === 'GET' && pathname.startsWith('/download/')) {
        const id = pathname.slice('/download/'.length);
        const project = await storage.getProject(id);
        if (!project) {
          sendError(res, 404, 'Project not found.');
          return;
        }
        const buffer = await storage.readArchive(id);
        if (!buffer) {
          sendError(res, 404, 'This project has no saved content yet.');
          return;
        }
        const safeName = (project.name || 'project').replace(/[^a-z0-9_\-]+/gi, '_');
        sendBuffer(res, 200, buffer, 'application/zip', {
          'Content-Disposition': `attachment; filename="${safeName}.zip"`,
        });
        return;
      }

      if (method === 'GET' && pathname.startsWith('/play/')) {
        const rest = pathname.slice('/play/'.length);
        const slash = rest.indexOf('/');
        const id = slash === -1 ? rest : rest.slice(0, slash);
        const relativePath = slash === -1 ? '' : rest.slice(slash + 1);
        if (!id) {
          sendError(res, 404, 'Project not found.');
          return;
        }
        const file = await storage.readExportFile(id, relativePath);
        if (!file) {
          sendHtml(res, 404, renderNotFoundPage());
          return;
        }
        sendBuffer(res, 200, file.buffer, file.mimeType);
        return;
      }

      if (method === 'GET' && pathname.startsWith('/resources/')) {
        const rest = pathname.slice('/resources/'.length);
        const slash = rest.indexOf('/');
        if (slash === -1) {
          sendError(res, 404, 'Resource not found.');
          return;
        }
        const id = rest.slice(0, slash);
        const storedName = rest.slice(slash + 1);
        const buffer = await storage.readResource(id, storedName);
        if (!buffer) {
          sendError(res, 404, 'Resource not found.');
          return;
        }
        sendBuffer(res, 200, buffer, storage.getMimeTypeForFile(storedName), {
          'Cache-Control': 'public, max-age=31536000, immutable',
        });
        return;
      }

      // ---- Health (no token, so the IDE can probe before auth) ----------
      if (method === 'GET' && pathname === '/api/health') {
        sendJson(res, 200, {
          ok: true,
          authRequired: sharedTokenRequired,
          accountsEnabled: !!auth,
          version: SERVER_VERSION,
          product: 'gdevelop-my-cloud',
        });
        return;
      }

      // ---- MCP host (reuses the real editor MCP stack, headless) --------
      // JSON-RPC over POST /mcp. The transport validates the Bearer token
      // itself (shared My Cloud token). GET returns 405 like the editor server.
      if (mcpHost && pathname === '/mcp') {
        if (method === 'GET') {
          res.writeHead(405, { ...CORS_HEADERS, Allow: 'POST' });
          res.end();
          return;
        }
        if (method !== 'POST') {
          sendError(res, 404, 'Not found.');
          return;
        }
        let parsed;
        try {
          const body = await readBody(req, 10 * 1000 * 1000);
          parsed = body.length ? JSON.parse(body.toString('utf8')) : null;
        } catch (error) {
          sendJson(res, 400, {
            jsonrpc: '2.0',
            id: null,
            error: { code: -32700, message: 'Unable to parse MCP JSON request.' },
          });
          return;
        }
        const mcpResponse = await mcpHost.handleRequest(
          parsed,
          req.headers.authorization || null
        );
        if (!mcpResponse) {
          res.writeHead(202, CORS_HEADERS);
          res.end();
          return;
        }
        sendJson(res, 200, mcpResponse);
        return;
      }

      // ---- Auth routes (no prior authorization needed) ------------------
      if (auth && pathname.startsWith('/api/auth/')) {
        const action = pathname.slice('/api/auth/'.length);
        if (action === 'register' && method === 'POST') {
          const body = await readJsonBody(req);
          const result = await auth.register({
            email: body.email,
            password: body.password,
            username: body.username,
          });
          sendJson(res, 201, result);
          return;
        }
        if (action === 'login' && method === 'POST') {
          const body = await readJsonBody(req);
          const result = await auth.login({
            email: body.email,
            password: body.password,
          });
          sendJson(res, 200, result);
          return;
        }
        if (action === 'me' && method === 'GET') {
          const principal = await resolvePrincipal(req);
          if (principal.kind !== 'user') {
            sendError(res, 401, 'Not authenticated.');
            return;
          }
          sendJson(res, 200, { user: principal.user });
          return;
        }
        sendError(res, 404, 'Unknown auth route.');
        return;
      }

      // ---- Everything else under /api requires authorization ------------
      if (pathname.startsWith('/api/')) {
        const principal = await resolvePrincipal(req);
        if (!isAuthorized(principal)) {
          sendError(res, 401, 'Missing or invalid access token.');
          return;
        }
        const ownerId = ownerIdFor(principal);

        // Helper: load a project and enforce access, or send 404 and return null.
        const loadAccessibleProject = async id => {
          const project = await storage.getProject(id);
          if (!canAccessProject(principal, project)) {
            sendError(res, 404, 'Project not found.');
            return null;
          }
          return project;
        };

        // /api/projects collection
        if (pathname === '/api/projects') {
          if (method === 'GET') {
            sendJson(res, 200, await storage.listProjects(ownerId));
            return;
          }
          if (method === 'POST') {
            const body = await readJsonBody(req);
            const project = await storage.createProject({
              name: body.name,
              gameId: body.gameId,
              ownerId,
            });
            sendJson(res, 201, project);
            return;
          }
          sendError(res, 405, 'Method not allowed.');
          return;
        }

        // /api/projects/:id and sub-routes
        if (pathname.startsWith('/api/projects/')) {
          const rest = pathname.slice('/api/projects/'.length);
          const segments = rest.split('/').filter(Boolean);
          const id = segments[0];
          const sub = segments[1];

          if (!id) {
            sendError(res, 404, 'Project not found.');
            return;
          }

          // /api/projects/:id
          if (!sub) {
            if (method === 'GET') {
              const project = await loadAccessibleProject(id);
              if (!project) return;
              sendJson(res, 200, project);
              return;
            }
            if (method === 'PATCH') {
              if (!(await loadAccessibleProject(id))) return;
              const body = await readJsonBody(req);
              const project = await storage.updateProject(id, {
                name: body.name,
                gameId: body.gameId,
              });
              sendJson(res, 200, project);
              return;
            }
            if (method === 'DELETE') {
              if (!(await loadAccessibleProject(id))) return;
              await storage.deleteProject(id);
              sendJson(res, 200, { ok: true });
              return;
            }
            sendError(res, 405, 'Method not allowed.');
            return;
          }

          // /api/projects/:id/archive
          if (sub === 'archive') {
            if (method === 'GET') {
              if (!(await loadAccessibleProject(id))) return;
              const buffer = await storage.readArchive(id);
              if (!buffer) {
                sendError(res, 404, 'No saved content for this project.');
                return;
              }
              sendBuffer(res, 200, buffer, 'application/zip');
              return;
            }
            if (method === 'POST') {
              if (!(await loadAccessibleProject(id))) return;
              const buffer = await readBody(req, MAX_BODY_BYTES);
              const version = await storage.writeArchive(id, buffer);
              sendJson(res, 200, { version });
              return;
            }
            sendError(res, 405, 'Method not allowed.');
            return;
          }

          // /api/projects/:id/resources
          if (sub === 'resources') {
            if (method === 'POST') {
              if (!(await loadAccessibleProject(id))) return;
              const filename = parsedUrl.searchParams.get('filename') || 'file';
              const sha = parsedUrl.searchParams.get('sha') || '';
              const buffer = await readBody(req, MAX_BODY_BYTES);
              const storedName = await storage.writeResource(id, {
                sha,
                filename,
                buffer,
              });
              if (!storedName) {
                sendError(res, 404, 'Project not found or invalid filename.');
                return;
              }
              const url = `${publicBaseUrl(req)}/resources/${id}/${encodeURIComponent(
                storedName
              )}`;
              sendJson(res, 200, { url, storedName });
              return;
            }
            sendError(res, 405, 'Method not allowed.');
            return;
          }

          // /api/projects/:id/export  (upload a play-build HTML5 export zip)
          if (sub === 'export') {
            if (method === 'POST') {
              if (!(await loadAccessibleProject(id))) return;
              const buffer = await readBody(req, MAX_BODY_BYTES);
              const ok = await storage.writeExport(id, buffer);
              sendJson(res, 200, {
                ok: true,
                playUrl: `${publicBaseUrl(req)}/play/${id}/`,
              });
              return;
            }
            sendError(res, 405, 'Method not allowed.');
            return;
          }

          sendError(res, 404, 'Unknown project route.');
          return;
        }

        sendError(res, 404, 'Unknown API route.');
        return;
      }

      // Root: a tiny status page.
      if (method === 'GET' && (pathname === '/' || pathname === '')) {
        sendJson(res, 200, {
          ok: true,
          product: 'gdevelop-my-cloud',
          version: SERVER_VERSION,
          authRequired: sharedTokenRequired,
          accountsEnabled: !!auth,
        });
        return;
      }

      sendError(res, 404, 'Not found.');
    } catch (error) {
      const statusCode = error && error.statusCode ? error.statusCode : 500;
      sendError(res, statusCode, (error && error.message) || 'Internal server error.');
    }
  };
};

module.exports = {
  createRequestHandler,
  getBearerToken,
  SERVER_VERSION,
  MAX_BODY_BYTES,
};
