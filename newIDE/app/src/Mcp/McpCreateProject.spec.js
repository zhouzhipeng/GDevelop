// @flow
import { createLocalProject } from './McpCreateProject';
import { openMultiFileProject } from '../ProjectsStorage/LocalFileStorageProvider/LocalMultiFileProject';

jest.mock('../ProjectCreation/LocalProjectTemplateFinder', () => ({
  findLocalProjectTemplatePath: () =>
    require('path').resolve(__dirname, '../../resources/gd-project-template'),
}));

const fs = require('fs-extra');
const os = require('os');
const path = require('path');

describe('createLocalProject', () => {
  let root;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-create-'));
  });
  afterEach(() => {
    fs.removeSync(root);
  });

  it('creates a loadable multi-file game with template files and catalogs', async () => {
    const result = await createLocalProject({
      project_directory: path.join(root, 'game'),
      project_name: 'My Game',
      width: 800,
      height: 600,
    });
    expect(result).toMatchObject({
      created: true,
      opened: false,
      sceneNames: ['Game'],
    });
    const loaded = await openMultiFileProject(result.projectFile);
    expect(loaded).toBeTruthy();
    for (const file of [
      'project.gdevelop',
      'resources.settings',
      'constants.toml',
      'AGENTS.md',
      'skills/gdevelop-project-files/SKILL.md',
      '.gdevelop/settings-catalog.json',
      '.gdevelop/instructions-catalog.json',
      '.gdevelop/project-api.d.ts',
    ]) {
      expect(fs.existsSync(path.join(root, 'game', file))).toBe(true);
    }
    const legacy = fs.readJsonSync(
      path.join(root, 'game', '.gdevelop/game.json')
    );
    expect(legacy.properties.name).toBe('My Game');
    expect(legacy.properties.windowWidth).toBe(800);
    expect(legacy.properties.windowHeight).toBe(600);
    expect(legacy.layouts[0].name).toBe('Game');
  });

  it('refuses existing directories without modifying files', async () => {
    fs.writeFileSync(path.join(root, 'keep.txt'), 'unchanged');
    await expect(
      createLocalProject({ project_directory: root, project_name: 'Game' })
    ).rejects.toThrow();
    expect(fs.readdirSync(root)).toEqual(['keep.txt']);
    expect(fs.readFileSync(path.join(root, 'keep.txt'), 'utf8')).toBe(
      'unchanged'
    );
  });

  it.each([
    { project_directory: 'relative', project_name: 'Game' },
    { project_name: '' },
    { project_name: 'Game', width: -1 },
    { project_name: 'Game', height: 1.5 },
  ])('rejects invalid inputs before writing: %p', async args => {
    await expect(
      createLocalProject({
        project_directory: path.join(root, 'game'),
        ...args,
      })
    ).rejects.toThrow();
    expect(fs.readdirSync(root)).toEqual([]);
  });
});
