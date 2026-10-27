// @flow
const path = require('path');

jest.mock('../Utils/OptionalRequire', () => (moduleName, options) => {
  try {
    return require(moduleName);
  } catch (error) {
    if (options && options.rethrowException) throw error;
    return null;
  }
});
jest.mock('.', () => ({ loadExtension: () => ({ error: false }) }));
const makeExtensionsLoader = require('./LocalJsExtensionsLoader');

describe('desktop extension inventory', () => {
  test.each([true, false])(
    'matches the discovered bundled extensions (filterExamples=%s)',
    async filterExamples => {
      const loader = makeExtensionsLoader({
        gd: { JsPlatform: { get: () => ({}) } },
        objectsEditorService: null,
        objectsRenderingService: null,
        filterExamples,
        onFindGDJS: async () => ({
          gdjsRoot: path.resolve(__dirname, '../../resources/GDJS'),
        }),
      });
      const receipt = await loader.loadAllExtensions(value => value);
      expect(receipt.results.every(({ result }) => !result.error)).toBe(true);
      expect(receipt.results.length).toBe(
        receipt.expectedNumberOfJSExtensionModulesLoaded
      );
      expect(
        receipt.results.some(({ extensionModulePath }) =>
          extensionModulePath.includes(path.join('SvgUI', 'JsExtension.js'))
        )
      ).toBe(true);
    }
  );
});
