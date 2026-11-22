// @flow
const fileWatcher = require('chokidar');
const fs = require('fs');
const path = require('path');

const stabilityThreshold = 250;

let subscriptionCancelers = {};
let newSubscriptionId = 1;

const getNewSubscriptionId = () => {
  const id = newSubscriptionId++;
  return id.toString();
};

const normalizePath = path => {
  if (!path) return ''; // Safety check

  return path.replace(/\\/g, '/');
};

const watchMacFolder = (folderPath, ignored, onChange) => {
  const pendingChanges = new Map();
  const watcher = fs.watch(
    folderPath,
    { recursive: true },
    (eventType, relativePath) => {
      if (!relativePath) return;
      const filePath = path.join(folderPath, relativePath);
      if (ignored(filePath)) return;

      clearTimeout(pendingChanges.get(filePath));
      pendingChanges.set(
        filePath,
        setTimeout(() => {
          pendingChanges.delete(filePath);
          // A missing path can be a removed resource.
          let stat;
          try {
            stat = fs.statSync(filePath, { throwIfNoEntry: false });
          } catch (error) {
            console.warn('Cannot inspect changed project path:', error);
            return;
          }
          if (stat ? stat.isFile() : eventType === 'rename') {
            onChange(filePath);
          }
        }, stabilityThreshold)
      );
    }
  );
  watcher.on('error', error =>
    console.warn('Project folder watcher failed:', error)
  );
  return () => {
    watcher.close();
    pendingChanges.forEach(timeout => clearTimeout(timeout));
    pendingChanges.clear();
  };
};

const setupWatcher = (folderPath, fileWiseCallback, serializedOptions) => {
  const options = JSON.parse(serializedOptions);
  const newSubscriptionId = getNewSubscriptionId();
  const ignoredPaths = (options.ignore || []).map(normalizePath);
  // Exclude dependencies and Git metadata for every caller.
  ignoredPaths.push('/node_modules', '/.git');
  const ignored = candidatePath => {
    const normalizedCandidatePath = normalizePath(candidatePath);
    return ignoredPaths.some(ignore =>
      normalizedCandidatePath.includes(ignore)
    );
  };

  // macOS supports a single recursive watch. Chokidar opens a descriptor for
  // each file there, which can prevent Electron from starting child processes.
  if (process.platform === 'darwin') {
    subscriptionCancelers[newSubscriptionId] = watchMacFolder(
      folderPath,
      ignored,
      fileWiseCallback
    );
    return newSubscriptionId;
  }

  const watcher = fileWatcher
    .watch(folderPath, {
      ignored,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold,
        pollInterval: 100,
      },
    })
    .on(
      'change',
      // TODO: Is it safe to let it like that since the OS could for some reason
      // do never-ending operations on the folder or its children, making the debounce
      // never ending.
      fileWiseCallback
    )
    .on('unlink', fileWiseCallback)
    .on('add', fileWiseCallback);

  subscriptionCancelers[newSubscriptionId] = () => watcher.close();

  return newSubscriptionId;
};

const disableWatcher = id => {
  const subscriptionCanceler = subscriptionCancelers[id];
  if (!subscriptionCanceler) {
    console.log('No watcher subscription to disable.');
    return;
  }
  subscriptionCanceler();
  delete subscriptionCancelers[id];
};

module.exports = {
  setupWatcher,
  disableWatcher,
};
