// The same IPC protocol is used by the exported Electron runtime.
const path = require('node:path');
const isPackaged =
  process.versions.electron && require('electron').app.isPackaged;

module.exports = require(path.join(
  isPackaged
    ? path.join(process.resourcesPath, 'GDJS')
    : path.join(__dirname, '..', '..', '..', 'GDJS'),
  'Runtime',
  'Electron',
  'DesktopServiceIpc.js'
));
