const http = require('http');
const {
  MCP_PROTOCOL_VERSION,
  JSON_RPC_ERROR_CODES,
  createJsonRpcResult,
  createJsonRpcError,
  getInitializeResult,
} = require('./McpProtocol');

const rendererBackedMethods = new Set([
  'tools/list',
  'tools/call',
  'resources/list',
  'resources/read',
  'prompts/list',
  'prompts/get',
]);

let activeServer = null;

const readRequestBody = request =>
  new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => {
      body += chunk;
    });
    request.on('error', reject);
    request.on('end', () => resolve(body));
  });

const normalizeParams = params =>
  params && typeof params === 'object' ? params : {};

const handleMcpJsonRpcRequest = async ({ request, sendRendererRequest }) => {
  const id =
    request && Object.prototype.hasOwnProperty.call(request, 'id')
      ? request.id
      : null;

  if (
    !request ||
    request.jsonrpc !== '2.0' ||
    typeof request.method !== 'string'
  ) {
    return createJsonRpcError(
      id,
      JSON_RPC_ERROR_CODES.invalidRequest,
      'Invalid JSON-RPC request.'
    );
  }

  if (request.method === 'initialize') {
    return createJsonRpcResult(id, getInitializeResult());
  }

  if (request.method === 'notifications/initialized') {
    return null;
  }

  if (request.method === 'ping') {
    return createJsonRpcResult(id, {});
  }

  if (!rendererBackedMethods.has(request.method)) {
    return createJsonRpcError(
      id,
      JSON_RPC_ERROR_CODES.methodNotFound,
      `Unknown MCP method: ${request.method}`
    );
  }

  try {
    const rendererResult = await sendRendererRequest({
      method: request.method,
      params: normalizeParams(request.params),
    });
    return createJsonRpcResult(id, rendererResult || {});
  } catch (error) {
    return createJsonRpcError(
      id,
      JSON_RPC_ERROR_CODES.internalError,
      error && error.message
        ? error.message
        : 'The GDevelop editor did not handle the MCP request.',
      error && error.data ? error.data : undefined
    );
  }
};

const writeJsonResponse = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  });
  response.end(JSON.stringify(payload));
};

const startMcpServer = ({ port, sendRendererRequest, getHealth }) =>
  new Promise((resolve, reject) => {
    let serverState = null;
    const server = http.createServer(async (request, response) => {
      if (request.method === 'GET' && request.url === '/health') {
        let health = {};
        try {
          health =
            typeof getHealth === 'function'
              ? getHealth({
                  port: serverState && serverState.port,
                  url: serverState && serverState.url,
                }) || {}
              : {};
        } catch (error) {
          health = {
            ok: false,
            error: error && error.message ? error.message : String(error),
          };
        }
        const rendererReady = health.rendererReady !== false;
        const serverUrl = serverState && serverState.url;
        writeJsonResponse(response, 200, {
          ok: health.ok !== false && rendererReady,
          server: 'gdevelop-editor',
          protocolVersion: MCP_PROTOCOL_VERSION,
          ...health,
          mcpUrl: health.mcpUrl || serverUrl,
        });
        return;
      }

      if (request.method === 'GET' && request.url === '/mcp') {
        response.writeHead(405, {
          Allow: 'POST',
        });
        response.end();
        return;
      }

      if (request.method !== 'POST' || request.url !== '/mcp') {
        response.writeHead(404);
        response.end();
        return;
      }

      let parsedBody;
      try {
        const body = await readRequestBody(request);
        parsedBody = body ? JSON.parse(body) : null;
      } catch (error) {
        writeJsonResponse(
          response,
          400,
          createJsonRpcError(
            null,
            JSON_RPC_ERROR_CODES.parseError,
            'Unable to parse MCP JSON request.'
          )
        );
        return;
      }

      const mcpResponse = await handleMcpJsonRpcRequest({
        request: parsedBody,
        sendRendererRequest,
      });

      if (!mcpResponse) {
        response.writeHead(202);
        response.end();
        return;
      }

      writeJsonResponse(response, 200, mcpResponse);
    });

    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject);
      const address = server.address();
      serverState = {
        server,
        port: address && typeof address === 'object' ? address.port : port,
        url: `http://127.0.0.1:${
          address && typeof address === 'object' ? address.port : port
        }/mcp`,
      };
      activeServer = serverState;
      resolve(serverState);
    });
  });

const stopMcpServer = serverState =>
  new Promise(resolve => {
    const serverToStop = serverState
      ? serverState.server
      : activeServer && activeServer.server;
    if (!serverToStop) {
      resolve();
      return;
    }

    serverToStop.close(() => {
      if (!serverState || activeServer === serverState) activeServer = null;
      resolve();
    });
  });

const getMcpServerState = () => activeServer;

module.exports = {
  handleMcpJsonRpcRequest,
  startMcpServer,
  stopMcpServer,
  getMcpServerState,
};
