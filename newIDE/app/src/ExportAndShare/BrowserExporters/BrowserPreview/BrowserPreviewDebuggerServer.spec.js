/** @jest-environment jsdom */
/** @jest-environment-options {"url":"https://editor.example/"} */
// @noflow
import {
  browserPreviewDebuggerServer,
  registerNewPreviewWindow,
} from './BrowserPreviewDebuggerServer';

const previewOrigin = 'https://preview.example';

const sendPreviewResponse = (previewWindow, response) => {
  const event = new MessageEvent('message', {
    data: JSON.stringify(response),
    origin: previewOrigin,
  });
  Object.defineProperty(event, 'source', { value: previewWindow });
  window.dispatchEvent(event);
};

describe('BrowserPreviewDebuggerServer targeted responses', () => {
  beforeAll(async () => {
    await browserPreviewDebuggerServer.startServer({ origin: previewOrigin });
  });

  afterEach(() => {
    browserPreviewDebuggerServer.closeAllPreviewConnections();
  });

  it('registers the response before sending and targets only one debugger', async () => {
    const firstWindow = {
      closed: false,
      close: jest.fn(),
      postMessage: jest.fn(message => {
        sendPreviewResponse(firstWindow, {
          command: 'status',
          messageId: message.messageId,
          payload: { isPaused: true },
        });
      }),
    };
    const secondWindow = {
      closed: false,
      close: jest.fn(),
      postMessage: jest.fn(),
    };
    const firstId = registerNewPreviewWindow(firstWindow);
    registerNewPreviewWindow(secondWindow);

    const response = await browserPreviewDebuggerServer.sendMessageToDebuggerWithResponse(
      firstId,
      { command: 'pause' },
      100
    );

    expect(response.payload.isPaused).toBe(true);
    expect(firstWindow.postMessage).toHaveBeenCalledTimes(1);
    expect(secondWindow.postMessage).not.toHaveBeenCalled();
  });

  it('rejects a pending targeted request when its preview disconnects', async () => {
    const previewWindow = {
      closed: false,
      close: jest.fn(),
      postMessage: jest.fn(),
    };
    const debuggerId = registerNewPreviewWindow(previewWindow);
    const responsePromise = browserPreviewDebuggerServer.sendMessageToDebuggerWithResponse(
      debuggerId,
      { command: 'pause' },
      1000
    );

    browserPreviewDebuggerServer.closeAllPreviewConnections();

    await expect(responsePromise).rejects.toThrow('disconnected');
  });
});
