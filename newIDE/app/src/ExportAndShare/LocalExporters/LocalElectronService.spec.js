// @flow
import fs from 'fs-extra';
// $FlowFixMe[cannot-resolve-module]
import os from 'os';
// $FlowFixMe[cannot-resolve-module]
import path from 'path';
import {
  exportLocalElectronService,
  getLocalElectronServicePreview,
} from './LocalElectronService';

describe('exportLocalElectronService', () => {
  let root;
  let project;
  let output;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'gdevelop-desktop-service-'));
    project = path.join(root, 'project');
    output = path.join(root, 'export');
    fs.ensureDirSync(project);
    fs.outputJsonSync(path.join(output, 'package.json'), { build: {} });
  });

  afterEach(() => fs.removeSync(root));

  const exportService = () =>
    exportLocalElectronService(path.join(project, 'project.gdl'), output);

  test('does not change the export without a manifest', () => {
    exportService();
    expect(fs.readJsonSync(path.join(output, 'package.json'))).toEqual({
      build: {},
    });
  });

  test('stages declared files and configures Electron Builder', () => {
    fs.outputJsonSync(path.join(output, 'package.json'), {
      build: { extraResources: ['LICENSE.GDevelop.txt'] },
    });
    fs.outputFileSync(path.join(project, 'tools', 'service.mjs'), 'export {};');
    fs.outputFileSync(path.join(project, 'constants.toml'), '# configuration');
    fs.outputFileSync(path.join(project, 'private.pem'), 'not included');
    fs.outputJsonSync(path.join(project, 'desktop-service.json'), {
      entry: 'tools/service.mjs',
      files: ['constants.toml'],
    });
    exportService();
    const staged = path.join(output, 'gdevelop-desktop-service');
    expect(fs.readdirSync(staged).sort()).toEqual(['constants.toml', 'tools']);
    expect(
      fs.readFileSync(path.join(staged, 'tools', 'service.mjs'), 'utf8')
    ).toBe('export {};');
    expect(fs.readJsonSync(path.join(output, 'package.json'))).toEqual({
      gdevelopDesktopService: 'tools/service.mjs',
      build: {
        extraResources: [
          'LICENSE.GDevelop.txt',
          {
            from: 'gdevelop-desktop-service',
            to: 'gdevelop-desktop-service',
            filter: ['tools/service.mjs', 'constants.toml'],
          },
        ],
      },
    });
  });

  test('rejects paths outside the project', () => {
    fs.outputJsonSync(path.join(project, 'desktop-service.json'), {
      entry: '../service.mjs',
      files: [],
    });
    expect(exportService).toThrow('Invalid desktop-service.json');
  });

  test('resolves a configured preview readiness check', () => {
    fs.outputFileSync(path.join(project, 'service.mjs'), 'export {};');
    fs.outputJsonSync(path.join(project, 'desktop-service.json'), {
      entry: 'service.mjs',
      files: [],
      preview: { port: 18746, path: '/account', method: 'OPTIONS' },
    });
    const realProject = fs.realpathSync(project);
    expect(
      getLocalElectronServicePreview(path.join(project, 'project.gdl'))
    ).toEqual({
      entry: path.join(realProject, 'service.mjs'),
      cwd: realProject,
      port: 18746,
      path: '/account',
      method: 'OPTIONS',
    });
  });

  test('rejects an entry symlink pointing outside the project', () => {
    fs.outputFileSync(path.join(root, 'external.mjs'), 'export {};');
    fs.symlinkSync(
      path.join(root, 'external.mjs'),
      path.join(project, 'service.mjs')
    );
    fs.outputJsonSync(path.join(project, 'desktop-service.json'), {
      entry: 'service.mjs',
      files: [],
    });
    expect(exportService).toThrow('must be inside the project');
  });
});
