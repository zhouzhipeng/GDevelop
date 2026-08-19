// @flow
import LocalFileSystem from './LocalFileSystem';
import fs from 'fs-extra';
// $FlowFixMe[cannot-resolve-module]
import os from 'os';
// $FlowFixMe[cannot-resolve-module]
import path from 'path';

describe('LocalFileSystem', () => {
  describe('file content storing and reading', () => {
    test('it can mark files to be copied from an URL as to be downloaded', () => {
      const localFileSystem = new LocalFileSystem({
        downloadUrlsToLocalFiles: true,
      });

      localFileSystem.copyFile(
        'http://file.com/from/url',
        '/folder/downloaded-file'
      );
      expect(localFileSystem.getAllUrlFilesIn('/')).toEqual([
        {
          filePath: '/folder/downloaded-file',
          url: 'http://file.com/from/url',
        },
      ]);
      expect(localFileSystem.getAllUrlFilesIn('/folder/')).toEqual([
        {
          filePath: '/folder/downloaded-file',
          url: 'http://file.com/from/url',
        },
      ]);
      expect(localFileSystem.getAllUrlFilesIn('/another-folder/')).toEqual([]);

      // Check that backslashes are normalized to slashes, so that paths can be using both on Windows:
      expect(localFileSystem.getAllUrlFilesIn('\\')).toEqual([
        {
          filePath: '/folder/downloaded-file',
          url: 'http://file.com/from/url',
        },
      ]);
      expect(localFileSystem.getAllUrlFilesIn('/folder\\')).toEqual([
        {
          filePath: '/folder/downloaded-file',
          url: 'http://file.com/from/url',
        },
      ]);
    });

    test('skips unchanged local files when requested', () => {
      const temporaryDirectory = fs.mkdtempSync(
        path.join(os.tmpdir(), 'gdevelop-preview-copy-')
      );
      try {
        const source = path.join(temporaryDirectory, 'source.glb');
        const destination = path.join(
          temporaryDirectory,
          'preview',
          'source.glb'
        );
        fs.outputFileSync(source, 'unchanged content');
        fs.outputFileSync(destination, 'unchanged content');

        const destinationTime = new Date(Date.now() + 1000);
        fs.utimesSync(destination, destinationTime, destinationTime);
        const destinationModificationTime = fs.statSync(destination).mtimeMs;
        const localFileSystem = new LocalFileSystem({
          downloadUrlsToLocalFiles: false,
          skipUnchangedFiles: true,
        });

        expect(localFileSystem.copyFile(source, destination)).toBe(true);
        expect(fs.statSync(destination).mtimeMs).toBe(
          destinationModificationTime
        );
      } finally {
        fs.removeSync(temporaryDirectory);
      }
    });

    test('copies a local file when its source changed', () => {
      const temporaryDirectory = fs.mkdtempSync(
        path.join(os.tmpdir(), 'gdevelop-preview-copy-')
      );
      try {
        const source = path.join(temporaryDirectory, 'source.glb');
        const destination = path.join(
          temporaryDirectory,
          'preview',
          'source.glb'
        );
        fs.outputFileSync(source, 'old content');
        fs.outputFileSync(destination, 'old content');

        const sourceTime = new Date(Date.now() + 2000);
        fs.outputFileSync(source, 'new content');
        fs.utimesSync(source, sourceTime, sourceTime);
        const localFileSystem = new LocalFileSystem({
          downloadUrlsToLocalFiles: false,
          skipUnchangedFiles: true,
        });

        expect(localFileSystem.copyFile(source, destination)).toBe(true);
        expect(fs.readFileSync(destination, 'utf8')).toBe('new content');
      } finally {
        fs.removeSync(temporaryDirectory);
      }
    });
  });

  describe('file path manipulation', () => {
    test('it can make a path relative to another', () => {
      const localFileSystem = new LocalFileSystem({
        downloadUrlsToLocalFiles: true,
      });

      expect(localFileSystem.makeRelative('/folder/file1', '/folder')).toBe(
        'file1'
      );
      expect(localFileSystem.makeRelative('/folder/file1', '/')).toBe(
        'folder/file1'
      );
    });
    test('it does not make URL relative to another one (on the same domain)', () => {
      const localFileSystem = new LocalFileSystem({
        downloadUrlsToLocalFiles: true,
      });

      expect(
        localFileSystem.makeRelative(
          'http://test.com/path/to/file1',
          'http://test.com/path/'
        )
      ).toBe('http://test.com/path/to/file1');
    });
    test('it does not make URL relative to another one (not on the same domain)', () => {
      const localFileSystem = new LocalFileSystem({
        downloadUrlsToLocalFiles: true,
      });

      expect(
        localFileSystem.makeRelative(
          'http://test.com/url1',
          'http://test2.com/url1'
        )
      ).toBe('http://test.com/url1');
    });
    test('it can make a path absolute', () => {
      const localFileSystem = new LocalFileSystem({
        downloadUrlsToLocalFiles: true,
      });

      expect(localFileSystem.makeAbsolute('subfolder/file1', '/folder')).toBe(
        path.resolve('/folder', 'subfolder/file1').replace(/\\/g, '/')
      );
      expect(localFileSystem.makeAbsolute('/folder/file2', '/')).toBe(
        path.resolve('/', '/folder/file2').replace(/\\/g, '/')
      );
    });
  });
});
