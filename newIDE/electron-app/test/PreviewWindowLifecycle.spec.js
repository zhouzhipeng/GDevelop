const assert = require('assert');

const {
  createDebuggerPopOutCloseCoordinator,
} = require('../app/PreviewWindowLifecycle');

const coordinator = createDebuggerPopOutCloseCoordinator();

// A debugger window closed directly by the user must still cascade to its
// associated preview windows.
assert.strictEqual(coordinator.consumeClosingAfterLastPreview(10), false);

// When the last preview already initiated the debugger close, consuming the
// later BrowserWindow "closed" event prevents it from closing a replacement
// preview that may have opened in the meantime.
coordinator.markClosingAfterLastPreview(10);
assert.strictEqual(coordinator.consumeClosingAfterLastPreview(10), true);

// The marker is one-shot and scoped to the exact debugger window.
assert.strictEqual(coordinator.consumeClosingAfterLastPreview(10), false);
coordinator.markClosingAfterLastPreview(11);
assert.strictEqual(coordinator.consumeClosingAfterLastPreview(12), false);
assert.strictEqual(coordinator.consumeClosingAfterLastPreview(11), true);
