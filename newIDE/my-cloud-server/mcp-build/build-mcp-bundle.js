// @ts-check
'use strict';

/**
 * Build the headless MCP tool bundle for the My Cloud server.
 *
 * It bundles the REAL editor MCP tools (newIDE/app/src/Mcp/McpEditorBridge.js
 * and its dependency tree) into a single CommonJS file that runs in plain Node
 * (no Electron, no browser). React / Three / Pixi / UI components are aliased to
 * lightweight stubs because the MCP tools only build message JSX that is
 * serialized to text — nothing is ever rendered.
 *
 * Also copies libGD.js + libGD.wasm (the Node build) next to the bundle.
 *
 * Run from the GDevelop repo with the app's node_modules available:
 *   node newIDE/my-cloud-server/mcp-build/build-mcp-bundle.js
 *
 * Requires: esbuild, @babel/core, @babel/preset-flow, @babel/preset-react,
 * and the class-properties / optional-chaining / nullish plugins — all present
 * in newIDE/app/node_modules.
 */

const path = require('path');
const fs = require('fs');

const MCP_BUILD_DIR = __dirname;
const APP_DIR = path.resolve(MCP_BUILD_DIR, '..', '..', 'app');
const APP_NODE_MODULES = path.join(APP_DIR, 'node_modules');

// Resolve build tools from the app's node_modules.
const appRequire = modulePath =>
  // eslint-disable-next-line import/no-dynamic-require, global-require
  require(require.resolve(modulePath, { paths: [APP_NODE_MODULES] }));

const esbuild = appRequire('esbuild');
const babel = appRequire('@babel/core');

const reactStub = path.join(MCP_BUILD_DIR, 'stubs', 'react.js');
const emptyStub = path.join(MCP_BUILD_DIR, 'stubs', 'empty.js');

const flowPlugin = {
  name: 'flow',
  setup(build) {
    // Alias heavy/browser-only deps to stubs (never used for text tool output).
    build.onResolve({ filter: /^react$/ }, () => ({ path: reactStub }));
    build.onResolve({ filter: /^react-dom$/ }, () => ({ path: emptyStub }));
    build.onResolve({ filter: /^(three|pixi\.js|pixi-spine)(\/.*)?$/ }, () => ({
      path: emptyStub,
    }));
    build.onResolve({ filter: /^@pixi\// }, () => ({ path: emptyStub }));
    build.onResolve({ filter: /ObjectsRendering\/PixiResourcesLoader$/ }, () => ({
      path: emptyStub,
    }));
    build.onResolve({ filter: /\/UI\// }, () => ({ path: emptyStub }));

    build.onLoad({ filter: /\.(js|jsx)$/ }, async args => {
      if (args.path.includes(`${path.sep}node_modules${path.sep}`)) return;
      if (args.path === reactStub || args.path === emptyStub) return;
      const src = await fs.promises.readFile(args.path, 'utf8');
      const result = await babel.transformAsync(src, {
        filename: args.path,
        babelrc: false,
        configFile: false,
        presets: [
          appRequire('@babel/preset-flow'),
          [appRequire('@babel/preset-react'), { runtime: 'classic' }],
        ],
        plugins: [
          appRequire('@babel/plugin-proposal-class-properties'),
          appRequire('@babel/plugin-proposal-optional-chaining'),
          appRequire('@babel/plugin-proposal-nullish-coalescing-operator'),
        ],
      });
      return { contents: result.code, loader: 'jsx' };
    });
  },
};

const copyLibGD = () => {
  const libGdDir = path.join(APP_NODE_MODULES, 'libGD.js-for-tests-only');
  const jsSrc = path.join(libGdDir, 'index.js');
  const wasmSrc = path.join(libGdDir, 'libGD.wasm');
  if (!fs.existsSync(jsSrc) || !fs.existsSync(wasmSrc)) {
    throw new Error(
      `libGD.js-for-tests-only not found in ${libGdDir}. Run the app's import-resources first.`
    );
  }
  fs.copyFileSync(jsSrc, path.join(MCP_BUILD_DIR, 'libGD.js'));
  fs.copyFileSync(wasmSrc, path.join(MCP_BUILD_DIR, 'libGD.wasm'));
  console.log('Copied libGD.js + libGD.wasm into mcp-build/.');
};

const main = async () => {
  await esbuild.build({
    entryPoints: [path.join(APP_DIR, 'src', 'Mcp', 'McpEditorBridge.js')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: path.join(MCP_BUILD_DIR, 'McpEditorBridge.bundle.js'),
    external: ['electron'],
    plugins: [flowPlugin],
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    inject: [reactStub],
    logLevel: 'error',
    logLimit: 25,
  });
  const sizeKb = Math.round(
    fs.statSync(path.join(MCP_BUILD_DIR, 'McpEditorBridge.bundle.js')).size / 1024
  );
  console.log(`Built McpEditorBridge.bundle.js (${sizeKb} KB).`);
  copyLibGD();
  console.log('MCP bundle ready.');
};

main().catch(error => {
  console.error('MCP bundle build failed:', error.message || error);
  process.exit(1);
});
