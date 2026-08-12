const createDebuggerPopOutCloseCoordinator = () => {
  const debuggerWindowIdsClosingAfterLastPreview = new Set();

  return {
    markClosingAfterLastPreview: debuggerWindowId => {
      debuggerWindowIdsClosingAfterLastPreview.add(debuggerWindowId);
    },
    consumeClosingAfterLastPreview: debuggerWindowId =>
      debuggerWindowIdsClosingAfterLastPreview.delete(debuggerWindowId),
  };
};

module.exports = {
  createDebuggerPopOutCloseCoordinator,
};
