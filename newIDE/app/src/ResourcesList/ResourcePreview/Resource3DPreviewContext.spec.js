// @noflow
import fs from 'fs';
import path from 'path';

describe('Resource3DPreviewContext', () => {
  const getSource = () =>
    fs
      .readFileSync(path.join(__dirname, 'Resource3DPreviewContext.js'), 'utf8')
      .replace(/\r\n/g, '\n');

  it('clears generated previews and invalidates mounted consumers', () => {
    const source = getSource();

    expect(source).toContain('clearResourcePreviews: () => void');
    expect(source).toContain(
      'Object.values(previewCache.current).forEach(revokeGeneratedPreview);'
    );
    expect(source).toContain('previewCache.current = {};');
    expect(source).toContain('workerManagerRef.current.terminate();');
    expect(source).toContain(
      'workerManagerRef.current = new Resource3DPreviewWorkerManager();'
    );
    expect(source).toContain(
      'setPreviewCacheVersion(previewCacheVersionRef.current);'
    );
  });

  it('does not let an in-flight render repopulate a cleared cache', () => {
    const source = getSource();

    expect(source).toContain(
      'processingPreviewCacheVersion !== previewCacheVersionRef.current'
    );
    expect(source).toContain('if (dataUrl) revokeGeneratedPreview(dataUrl);');
    expect(source).toContain("cache: 'no-store'");
  });
});
