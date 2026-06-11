// @ts-check
'use strict';

/**
 * Headless MCP host for the self-hosted My Cloud server — NO Electron, NO editor.
 *
 * It reuses the REAL editor MCP stack:
 *   - transport: ../mcp-build/transport/McpServer.js + McpProtocol.js (verbatim
 *     copies of electron-app/app/Mcp/*), via handleMcpJsonRpcRequest.
 *   - tools: ../mcp-build/McpEditorBridge.bundle.js — the real app/src/Mcp
 *     McpEditorBridge bundled for Node (React/Three/Pixi/UI stubbed; the tools
 *     only serialize results to text, so rendering is never needed).
 *
 * libGD (the WASM engine) runs in Node (libGD.js-for-node). On each MCP request
 * we load the configured project's stored game.json into a gdProject and answer
 * tools/list & tools/call against it — exactly like the editor does, but the
 * "open project" is loaded from My Cloud storage instead of a renderer.
 *
 * Enabled when MY_CLOUD_MCP=on and a project id is configured (MY_CLOUD_MCP_PROJECT).
 */

const path = require('path');
const {
  handleMcpJsonRpcRequest,
} = require('../mcp-build/transport/McpServer');

const BUNDLE_PATH = path.join(__dirname, '..', 'mcp-build', 'McpEditorBridge.bundle.js');
const LIBGD_PATH = path.join(__dirname, '..', 'mcp-build', 'libGD.js');

/**
 * Create the MCP host. Returns { handleRequest } where handleRequest(req, body)
 * answers a single MCP JSON-RPC POST (body already parsed) and returns the
 * response object (or null for notifications).
 *
 * @param {{ storage:any, token:?string, projectId:?string, permissions?:object }} options
 */
const createMcpHost = ({ storage, token, projectId, permissions }) => {
  let gdPromise = null;
  let bridge = null;

  const ensureLibGD = () => {
    if (gdPromise) return gdPromise;
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const initializeGDevelopJs = require(LIBGD_PATH);
    gdPromise = initializeGDevelopJs({
      // The wasm sits next to libGD.js in mcp-build/.
      locateFile: (file) => path.join(__dirname, '..', 'mcp-build', file),
    }).then((gd) => {
      global.gd = gd;
      // Bundle reads global.gd at module-eval, so require it only after gd is set.
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const { createMcpEditorBridge } = require(BUNDLE_PATH);
      bridge = createMcpEditorBridge({
        getProject: () => currentProject,
        getPermissions: () =>
          permissions || { allowWriteTools: false, allowCommandTools: false },
      });
      return gd;
    });
    return gdPromise;
  };

  // The project the MCP host operates on. The bridge's getProject() reads this.
  // Reloaded fresh for each tools/call so it reflects the latest saved version.
  let currentProject = null;

  const loadProject = async (gd) => {
    if (!projectId) {
      throw new Error('No MCP project configured (set MY_CLOUD_MCP_PROJECT).');
    }
    const game = await storage.readProjectJson(projectId);
    if (!game) {
      throw new Error(`MCP project "${projectId}" has no saved content yet.`);
    }
    const element = gd.Serializer.fromJSON(JSON.stringify(game));
    const project = gd.ProjectHelper.createNewGDJSProject();
    project.unserializeFrom(element);
    element.delete();
    return project;
  };

  // Serialize requests: libGD/WASM is single-threaded and we mutate the shared
  // global.gd + currentProject, so concurrent tool calls must not interleave.
  let queue = Promise.resolve();

  const runExclusive = (task) => {
    const run = queue.then(task);
    queue = run.then(() => undefined, () => undefined);
    return run;
  };

  const sendRendererRequest = ({ method, params }) =>
    runExclusive(async () => {
      const gd = await ensureLibGD();
      // Metadata-only methods (list/prompts/resources) don't need a project.
      const needsProject = method === 'tools/call';
      let project = null;
      if (needsProject) {
        project = await loadProject(gd);
        currentProject = project;
      }
      try {
        return await bridge.handleRendererMcpRequest({ method, params });
      } finally {
        currentProject = null;
        if (project && project.delete) {
          try {
            project.delete();
          } catch (e) {
            // ignore WASM free errors
          }
        }
      }
    });

  return {
    /**
     * Handle a parsed MCP JSON-RPC request object. `authorizationHeader` is the
     * raw header; the transport validates it against `token`.
     */
    handleRequest: (request, authorizationHeader) =>
      handleMcpJsonRpcRequest({
        request,
        authorizationHeader,
        token,
        sendRendererRequest,
      }),
  };
};

module.exports = { createMcpHost };
