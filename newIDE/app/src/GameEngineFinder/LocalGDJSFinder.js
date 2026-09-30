// @flow
// Note: this file don't use export/imports nor Flow to allow its usage from Node.js

const optionalRequire = require('../Utils/OptionalRequire');
const remote = optionalRequire('@electron/remote');
const app = remote ? remote.app : null;
const fs = optionalRequire('fs');
const path = optionalRequire('path');
const process = optionalRequire('process');
var isDarwin = process && /^darwin/.test(process.platform);

const canReadPath = path => {
  try {
    // Keep the lookup on the renderer's JS turn. An asynchronous fs callback
    // can be lost when an Electron debugger pop-out is being destroyed,
    // leaving preview preparation waiting forever.
    fs.accessSync(path, fs.constants.R_OK);
    return true;
  } catch (error) {
    return false;
  }
};

const findGDJS = () /*: Promise<{|gdjsRoot: string|}> */ => {
  if (!path || !process || !fs) return Promise.reject(new Error('Unsupported'));

  const appPath = app ? app.getAppPath() : process.cwd();

  // The app path is [...]/*.app/Contents/Resources/app.asar on macOS
  // and [...]/resources/app.asar on other OSes.
  const pathToRoot = isDarwin ? '../../../../' : path.join('..', '..');
  const rootPath = path.join(appPath, pathToRoot);

  const candidates = [
    // newIDE inside IDE.
    path.join(rootPath, '..', 'JsPlatform'),
    // Standalone newIDE.
    path.join(appPath, '..', 'GDJS'),
    // Electron development.
    path.join(appPath, '..', '..', 'app', 'resources', 'GDJS'),
  ];
  const gdjsRoot = candidates.find(canReadPath);
  return gdjsRoot
    ? Promise.resolve({ gdjsRoot })
    : Promise.reject(new Error('Could not find GDJS'));
};

module.exports = {
  findGDJS,
};
