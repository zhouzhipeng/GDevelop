// @noflow
import fs from 'fs';
import path from 'path';

describe('PixiResourcesLoader', () => {
  it('can clear parsed 3D models without disposing live renderer assets', () => {
    const source = fs
      .readFileSync(path.join(__dirname, 'PixiResourcesLoader.js'), 'utf8')
      .replace(/\r\n/g, '\n');
    const clearMethodStart = source.indexOf('static burst3DModelCache()');
    const clearMethodEnd = source.indexOf(
      'static burstCache()',
      clearMethodStart
    );
    const clearMethodSource = source.slice(clearMethodStart, clearMethodEnd);

    expect(clearMethodSource).toContain('loadedOrLoading3DModelPromises = {};');
    expect(clearMethodSource).not.toContain('.dispose()');
    expect(source).toContain('PixiResourcesLoader.burst3DModelCache();');
  });
});
