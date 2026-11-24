# Electron desktop service IPC

A local Electron export can run a project-owned Node.js service and exchange
asynchronous requests and responses with it without opening a network port.
The editor's standalone Electron preview window can use the same protocol.

## Configure the project

Create `desktop-service.json` next to `project.gdl`.

```json
{
  "entry": "tools/service.mjs",
  "files": [],
  "preview": { "transport": "ipc" }
}
```

- `entry` is the project-relative `.mjs` entry point.
- `files` lists additional project-relative files the service needs in the
  export, including any local modules it imports. The entry itself is included
  automatically.
- `preview.transport` selects IPC for the standalone Electron preview.
  It is optional for local Electron export. Existing HTTP preview descriptors
  use `port`, `path`, and an optional `method`.

IPC is available to the top-level game document in the Electron window.
Browser, network, and embedded editor previews need a different transport
if they must call the service.

## Call from the Electron renderer

The following is the runtime call for a GDL `javascript` event running in
Electron. GDL's strict JavaScript validator rejects `require`. There is
currently no generated strict GDL API for this channel, so this example cannot
pass validation in a `strict = true` block.

```js
const { ipcRenderer } = require('electron');

ipcRenderer
  .invoke('gdevelop-desktop-service:invoke', 'echo', { text: 'hello' })
  .then(result => console.log(result.text))
  .catch(error => console.error(error.message));
```

Trigger the request once per intended action. Consume the result in a promise
callback or in later game logic after storing the response in game state.

## Handle requests in the service

The service receives messages through `process.parentPort`. Reply with the
same request ID so concurrent requests can complete in any order.

```js
const port = process.parentPort;

port.on('message', ({ data }) => {
  if (data?.type !== 'gdevelop-desktop-service:request') return;

  const response = {
    type: 'gdevelop-desktop-service:response',
    id: data.id,
  };

  if (data.method === 'echo' && typeof data.params?.text === 'string') {
    port.postMessage({ ...response, ok: true, result: { text: data.params.text } });
    return;
  }

  port.postMessage({ ...response, ok: false, error: 'Unsupported request' });
});
```

Use structured-cloneable values for parameters and results. The renderer
promise rejects when the service returns an error response, disconnects, or
takes more than 30 seconds to respond. Timing out a request does not cancel
work in the service.
