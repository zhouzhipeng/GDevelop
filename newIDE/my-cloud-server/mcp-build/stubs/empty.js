// Empty stub: rendering/UI modules not needed for headless MCP tool execution.
const noop = () => {};
const handler = { get: () => stub };
const stub = new Proxy(noop, handler);
module.exports = new Proxy(noop, {
  get: (t, prop) => (prop === '__esModule' ? true : (prop === 'default' ? stub : stub)),
});
