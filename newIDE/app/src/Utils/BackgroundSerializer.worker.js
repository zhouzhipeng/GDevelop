/* eslint-env worker */
// @flow

let modulePromise /*: ?Promise<libGDevelop>*/ = null;

const log = (message /*: string */) => {
  console.log(`[BackgroundSerializerWorker] ${message}`);
};

const getLibGDevelop = (versionWithHash /*: string */) => {
  if (modulePromise) return modulePromise;

  modulePromise = new Promise((resolve, reject) => {
    try {
      // Version is in the filename (not a query string) so the URL is
      // CDN-cacheable. See scripts/import-libGD.js.
      const url = `/libGD.${versionWithHash}.js`;
      // Load libGD.js in the worker context.
      // eslint-disable-next-line no-undef
      importScripts(url);

      /* eslint-disable no-undef */
      // $FlowFixMe[incompatible-type]
      // $FlowFixMe[cannot-resolve-name]
      if (typeof initializeGDevelopJs !== 'function') {
        /* eslint-enable no-undef */
        reject(new Error('Missing initializeGDevelopJs in worker'));
        return;
      }

      /* eslint-disable no-undef */
      // $FlowFixMe[cannot-resolve-name]
      initializeGDevelopJs({
        /* eslint-enable no-undef */
        // Override the resolved URL for the .wasm file, pointing to the
        // version-in-filename copy so it stays CDN-cacheable.
        locateFile: (path /*: string */, prefix /*: string */) => {
          // This function is called by Emscripten to locate the .wasm file only.
          // `path` is "libGD.wasm"; rewrite it to the hashed filename, served
          // from the root of the public folder.
          return `/libGD.${versionWithHash}.wasm`;
        },
      })
        .then(module => {
          resolve(module);
        })
        .catch(reject);
    } catch (error) {
      reject(error);
      return;
    }
  });

  return modulePromise;
};

const unserializeBinarySnapshotToJson = (
  gd /*: libGDevelop */,
  binary /*: Uint8Array */
) => {
  const binaryArray =
    binary instanceof Uint8Array ? binary : new Uint8Array(binary);
  const binarySize = binaryArray.byteLength || binaryArray.length;

  // Allocate memory in Emscripten heap and copy binary data
  const binaryPtr = gd._malloc(binarySize);
  gd.HEAPU8.set(binaryArray, binaryPtr);

  const element = gd.BinarySerializer.deserializeBinarySnapshot(
    binaryPtr,
    binarySize
  );

  // Free the input buffer
  gd._free(binaryPtr);

  if (element.ptr === 0) {
    throw new Error('Failed to deserialize binary snapshot.');
  }

  const json = gd.Serializer.toJSON(element);
  element.delete();
  return json;
};

// eslint-disable-next-line no-restricted-globals
self.onmessage = async (event /*: MessageEvent */) => {
  // $FlowFixMe[incompatible-type]
  // $FlowFixMe[prop-missing]
  // $FlowFixMe[incompatible-use]
  const { type, binary, requestId, versionWithHash } = event.data || {};

  const startTime = Date.now();

  // $FlowFixMe[incompatible-type]
  log(`Request #${requestId} received (${type}).`);
  if (type !== 'SERIALIZE_TO_JSON' && type !== 'SERIALIZE_TO_JS_OBJECT') return;

  try {
    // $FlowFixMe[incompatible-type]
    const gd = await getLibGDevelop(versionWithHash);

    // $FlowFixMe[incompatible-type]
    const json = unserializeBinarySnapshotToJson(gd, binary);
    const result = type === 'SERIALIZE_TO_JSON' ? json : JSON.parse(json);

    // $FlowFixMe[incompatible-type]
    log(`Request #${requestId} done in ${Date.now() - startTime}ms.`);

    // eslint-disable-next-line no-restricted-globals
    self.postMessage({
      type: 'DONE',
      result,
      requestId,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    // eslint-disable-next-line no-restricted-globals
    self.postMessage({
      type: 'ERROR',
      requestId,
      message: error.message,
    });
  }
};
