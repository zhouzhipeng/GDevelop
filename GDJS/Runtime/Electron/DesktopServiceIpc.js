const desktopServiceChannel = 'gdevelop-desktop-service:invoke';

const gameDocumentUrl = url => {
  const document = new URL(url);
  document.hash = '';
  document.search = '';
  return document.href;
};

const isDesktopServiceSender = (event, webContents, gameUrl) =>
  event.sender === webContents &&
  !!event.senderFrame &&
  event.senderFrame === webContents.mainFrame &&
  !!event.senderFrame.url &&
  gameDocumentUrl(event.senderFrame.url) === gameDocumentUrl(gameUrl);

const createDesktopServiceIpc = (child, timeoutMs = 30000) => {
  let nextId = 0;
  let spawned = false;
  let unavailable = false;
  const pending = new Map();

  const settle = (id, complete) => {
    const request = pending.get(id);
    if (!request) return;
    pending.delete(id);
    clearTimeout(request.timer);
    complete(request);
  };

  const send = (id, request) => {
    try {
      child.postMessage(request.message);
    } catch (error) {
      settle(id, request => request.reject(error));
    }
  };

  child.once('spawn', () => {
    spawned = true;
    for (const [id, request] of pending) send(id, request);
  });
  child.on('message', message => {
    if (!message || message.type !== 'gdevelop-desktop-service:response')
      return;
    settle(message.id, request => {
      if (message.ok === true) request.resolve(message.result);
      else if (message.ok === false)
        request.reject(
          new Error(String(message.error || 'Desktop service request failed.'))
        );
      else request.reject(new Error('Invalid desktop service response.'));
    });
  });

  const disconnect = () => {
    unavailable = true;
    for (const id of pending.keys()) {
      settle(id, request =>
        request.reject(new Error('Desktop service disconnected.'))
      );
    }
  };
  child.once('exit', disconnect);
  child.on('error', disconnect);

  return (method, params) => {
    if (unavailable) throw new Error('Desktop service is unavailable.');
    if (typeof method !== 'string' || !method.trim()) {
      throw new Error('A desktop service method is required.');
    }
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => {
        settle(id, request =>
          request.reject(new Error('Desktop service request timed out.'))
        );
      }, timeoutMs);
      const request = {
        resolve,
        reject,
        timer,
        message: {
          type: 'gdevelop-desktop-service:request',
          id,
          method,
          params,
        },
      };
      pending.set(id, request);
      if (spawned) send(id, request);
    });
  };
};

module.exports = {
  createDesktopServiceIpc,
  desktopServiceChannel,
  isDesktopServiceSender,
};
