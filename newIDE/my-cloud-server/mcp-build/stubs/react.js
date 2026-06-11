// Minimal React stub for headless MCP bundling. MCP tools build JSX only to
// produce human-readable messages which are serialized to text, never rendered.
const createElement = (type, props, ...children) => ({
  $$typeof: 'react.element',
  type,
  props: Object.assign({}, props, children.length ? { children } : {}),
});
const Fragment = 'Fragment';
module.exports = {
  __esModule: true,
  default: { createElement, Fragment },
  createElement,
  Fragment,
  // Hooks/other APIs are not used at tool-call time, but provide no-ops:
  useState: () => [undefined, () => {}],
  useEffect: () => {},
  useCallback: fn => fn,
  useMemo: fn => fn(),
  useContext: () => ({}),
  createContext: () => ({ Provider: 'Provider', Consumer: 'Consumer' }),
  memo: c => c,
  forwardRef: c => c,
};
