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

const getParentWindowIdsWithPreviewOrDebugger = (
  previewParentWindowIds,
  debuggerParentWindowIds
) =>
  Array.from(new Set([...previewParentWindowIds, ...debuggerParentWindowIds]));

module.exports = {
  createDebuggerPopOutCloseCoordinator,
  getParentWindowIdsWithPreviewOrDebugger,
};
