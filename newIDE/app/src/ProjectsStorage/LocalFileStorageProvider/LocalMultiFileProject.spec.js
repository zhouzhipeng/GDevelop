// @flow
import { withTestInstructionSemantics } from '../SettingsDsl/TestHelpers';
import { replaceEmbeddedEventBody } from '../SettingsDsl/TestHelpers';

// $FlowFixMe[cannot-resolve-module] Jest runs these filesystem tests in Node.
import fs from 'fs-extra';
// $FlowFixMe[cannot-resolve-module]
import os from 'os';
// $FlowFixMe[cannot-resolve-module]
import path from 'path';
import {
  MULTI_FILE_CONSTANTS_URI,
  decomposeLegacyProjectToFiles,
  areLegacyProjectsEquivalent,
} from '../MultiFileProjectFormat';
import {
  GAMEPLAY_TEST_RESULTS_RELATIVE_PATH,
  openMultiFileProject as openWithCatalog,
  readMultiFileSourceTree,
  recoverMultiFileTransactions,
  resolveGameUriToPath,
  writeGameplayTestResults,
  writeLegacyProjectAsMultiFile,
  writeMultiFileSourceTree,
} from './LocalMultiFileProject';
import {
  serializeInstructionCatalogFiles,
  assembleInstructionCatalogFiles,
  PROJECT_INSTRUCTION_CATALOG_PATHS,
} from '../SettingsDsl/InstructionCatalog';
import { onOpen } from './LocalProjectOpener';
import { getLocalProjectLastModifiedDate } from './LocalProjectFileModificationTime';
import {
  GENERATED_LEGACY_PROJECT_RELATIVE_PATH,
  getProjectLocation,
  onAutoSaveConstants,
  onSaveProject,
  writeProjectInstructionCatalog,
  writeProjectGdlCatalog,
  writeProjectSourceCatalogs,
} from './LocalProjectWriter';
import { ensureProjectHasDefaultScene } from '../../ProjectCreation/CreateProject';
import { insertNewEventsBasedBehavior } from '../../EventsFunctionsList/CreateEventsBasedBehavior';
import { reloadProjectEventsFunctionsExtensionMetadata } from '../../EventsFunctionsExtensionsLoader';
import {
  serializeToJSObject,
  unserializeFromJSObject,
} from '../../Utils/Serializer';

// Storage-only fixtures bootstrap without generated metadata. Catalog tests opt in.
const openMultiFileProject = (entryPath: string, options: Object = {}) =>
  openWithCatalog(entryPath, {
    ignoreInstructionCatalog: !Object.values(
      PROJECT_INSTRUCTION_CATALOG_PATHS
    ).some(file => fs.existsSync(path.join(path.dirname(entryPath), file))),
    ...options,
  });

const projectFixture = {
  gdVersion: { major: 5, minor: 6, build: 0, revision: 0 },
  properties: { name: 'Filesystem project', projectUuid: 'id' },
  resources: { resources: [], resourceFolders: [] },
  objects: [],
  objectsFolderStructure: { folderName: '__ROOT', children: [] },
  objectsGroups: [],
  variables: [],
  constants: {},
  layouts: [
    {
      name: 'Main',
      mangledName: 'Main',
      title: 'Original',
      r: 0,
      v: 0,
      b: 0,
      uiSettings: {},
      objects: [],
      objectsFolderStructure: { folderName: '__ROOT', children: [] },
      instances: [],
      layers: [],
      variables: [],
      objectsGroups: [],
      behaviorsSharedData: [],
      events: [],
    },
  ],
  externalEvents: [],
  externalLayouts: [],
  eventsFunctionsExtensions: [],
};

describe('Local multi-file project storage', () => {
  let temporaryDirectory;

  it('reads managed sources without waiting for asynchronous filesystem callbacks', async () => {
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    await writeLegacyProjectAsMultiFile(projectFixture, entryPath);
    const readdir = jest
      .spyOn(fs, 'readdir')
      .mockImplementation(() => new Promise(() => {}));
    const stat = jest
      .spyOn(fs, 'stat')
      .mockImplementation(() => new Promise(() => {}));
    const readFile = jest
      .spyOn(fs, 'readFile')
      .mockImplementation(() => new Promise(() => {}));
    try {
      const tree = await readMultiFileSourceTree(entryPath);
      expect(tree.files['game://project.gdl']).toBeDefined();
      expect(tree.files['game://scenes/Main/scene.gdl']).toBeDefined();
      expect(readdir).not.toHaveBeenCalled();
      expect(stat).not.toHaveBeenCalled();
      expect(readFile).not.toHaveBeenCalled();
    } finally {
      readdir.mockRestore();
      stat.mockRestore();
      readFile.mockRestore();
    }
  });

  beforeEach(() => {
    temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gdevelop-multifile-')
    );
  });

  afterEach(() => {
    const resolved = path.resolve(temporaryDirectory);
    if (!resolved.startsWith(path.resolve(os.tmpdir()))) {
      throw new Error(
        'Refusing to remove a directory outside the OS temp root.'
      );
    }
    fs.removeSync(resolved);
  });

  test('rejects old and component entry names and refuses conflicting entries before any write', async () => {
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    const oldPath = path.join(temporaryDirectory, 'project.gdevelop');
    const componentPath = path.join(temporaryDirectory, 'scene.gdl');
    for (const badPath of [oldPath, componentPath]) {
      await expect(readMultiFileSourceTree(badPath)).rejects.toMatchObject({
        code: 'MULTIFILE_INVALID_ENTRY',
      });
      await expect(onOpen({ fileIdentifier: badPath })).rejects.toMatchObject({
        code: 'MULTIFILE_INVALID_ENTRY',
      });
      await expect(
        writeMultiFileSourceTree({ entryPath: badPath, files: {} })
      ).rejects.toMatchObject({ code: 'MULTIFILE_INVALID_ENTRY' });
    }
    fs.writeFileSync(oldPath, 'original old project');
    fs.writeFileSync(entryPath, 'original current project');
    await expect(readMultiFileSourceTree(entryPath)).rejects.toMatchObject({
      code: 'MULTIFILE_RETIRED_ENTRY',
    });
    await expect(
      writeMultiFileSourceTree({ entryPath, files: {} })
    ).rejects.toMatchObject({ code: 'MULTIFILE_RETIRED_ENTRY' });
    expect(fs.readFileSync(oldPath, 'utf8')).toBe('original old project');
    expect(fs.readFileSync(entryPath, 'utf8')).toBe('original current project');
  });

  test('stores flat gameplay test sources and hydrates ignored run results', async () => {
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    const project: Object = {
      ...projectFixture,
      tests: [
        {
          name: 'Player can jump',
          type: 'gameplay',
          description: 'Smoke test',
          source: 'gameplayTest.wait(1);',
          lastRunStatus: 'passed',
          lastRunAt: 123,
          lastRunDurationMs: 45,
          lastRunFramesExecuted: 3,
        },
      ],
    };

    await writeLegacyProjectAsMultiFile(project, entryPath);

    const settingsSource = await fs.readFile(
      path.join(temporaryDirectory, 'tests.gdl'),
      'utf8'
    );
    expect(settingsSource).toContain('file = "tests/Player%20can%20jump.js"');
    expect(settingsSource).not.toContain('game://');
    expect(settingsSource).not.toContain('lastRun');
    expect(
      await fs.readFile(
        resolveGameUriToPath(
          temporaryDirectory,
          'game://tests/Player%20can%20jump.js'
        ),
        'utf8'
      )
    ).toBe('gameplayTest.wait(1);');
    expect(
      JSON.parse(
        await fs.readFile(
          path.join(
            temporaryDirectory,
            ...GAMEPLAY_TEST_RESULTS_RELATIVE_PATH.split('/')
          ),
          'utf8'
        )
      ).tests
    ).toEqual([
      {
        scope: 'project',
        name: 'Player can jump',
        lastRunStatus: 'passed',
        lastRunAt: 123,
        lastRunDurationMs: 45,
        lastRunFramesExecuted: 3,
      },
    ]);
    expect((await openMultiFileProject(entryPath)).tests[0]).toEqual(
      project.tests[0]
    );
  });

  test('updates only ignored gameplay test results after a run', async () => {
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    const project: Object = {
      ...projectFixture,
      tests: [
        {
          name: 'Smoke test',
          type: 'gameplay',
          description: '',
          source: 'gameplayTest.wait(1);',
        },
      ],
    };
    await writeLegacyProjectAsMultiFile(project, entryPath);
    const settingsPath = path.join(temporaryDirectory, 'tests.gdl');
    const scriptPath = resolveGameUriToPath(
      temporaryDirectory,
      'game://tests/Smoke%20test.js'
    );
    const settingsBefore = await fs.readFile(settingsPath, 'utf8');
    const scriptBefore = await fs.readFile(scriptPath, 'utf8');

    project.tests[0] = {
      ...project.tests[0],
      lastRunStatus: 'failed',
      lastRunAt: 999,
      lastRunDurationMs: 12,
      lastRunFramesExecuted: 1,
    };
    await writeGameplayTestResults(project, entryPath);

    expect(await fs.readFile(settingsPath, 'utf8')).toBe(settingsBefore);
    expect(await fs.readFile(scriptPath, 'utf8')).toBe(scriptBefore);
    expect((await openMultiFileProject(entryPath)).tests[0]).toMatchObject({
      lastRunStatus: 'failed',
      lastRunAt: 999,
      lastRunDurationMs: 12,
      lastRunFramesExecuted: 1,
    });

    await writeGameplayTestResults(
      {
        ...project,
        tests: [
          {
            ...project.tests[0],
            lastRunStatus: 'passed',
            lastRunAt: 100,
          },
        ],
      },
      entryPath,
      { preserveNewerExistingResults: true }
    );
    expect((await openMultiFileProject(entryPath)).tests[0]).toMatchObject({
      lastRunStatus: 'failed',
      lastRunAt: 999,
    });
  });

  test('ignores malformed and stale gameplay test result state when opening', async () => {
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    const project = {
      ...projectFixture,
      tests: [
        {
          name: 'Current test',
          type: 'gameplay',
          description: '',
          source: '',
        },
      ],
    };
    await writeLegacyProjectAsMultiFile(project, entryPath);
    const resultsPath = path.join(
      temporaryDirectory,
      ...GAMEPLAY_TEST_RESULTS_RELATIVE_PATH.split('/')
    );
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await fs.writeFile(resultsPath, '{ invalid', 'utf8');
      expect(
        (await openMultiFileProject(entryPath)).tests[0]
      ).not.toHaveProperty('lastRunStatus');

      await fs.writeJson(resultsPath, {
        format: 'gdevelop-gameplay-test-results',
        version: 1,
        tests: [
          {
            scope: 'project',
            name: 'Deleted test',
            lastRunStatus: 'passed',
            lastRunAt: 123,
            lastRunDurationMs: 45,
            lastRunFramesExecuted: 3,
          },
        ],
      });
      expect(
        (await openMultiFileProject(entryPath)).tests[0]
      ).not.toHaveProperty('lastRunStatus');
      expect(warning).toHaveBeenCalled();
    } finally {
      warning.mockRestore();
    }
  });

  test('rejects gameplay test subfolders and orphan direct scripts', async () => {
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    await writeLegacyProjectAsMultiFile(projectFixture, entryPath);
    await fs.ensureDir(path.join(temporaryDirectory, 'tests', 'nested'));
    await expect(openMultiFileProject(entryPath)).rejects.toMatchObject({
      code: 'MULTIFILE_INVALID_TEST_SOURCE',
    });

    await fs.remove(path.join(temporaryDirectory, 'tests', 'nested'));
    await fs.writeFile(
      path.join(temporaryDirectory, 'tests', 'orphan.js'),
      '',
      'utf8'
    );
    await expect(openMultiFileProject(entryPath)).rejects.toMatchObject({
      code: 'MULTIFILE_ORPHAN_TEST_SOURCE',
    });
  });

  test('rejects a noncanonical .gdevelop entry name', async () => {
    await expect(
      readMultiFileSourceTree(
        path.join(temporaryDirectory, 'OtherName.gdevelop')
      )
    ).rejects.toMatchObject({
      code: 'MULTIFILE_INVALID_ENTRY',
      message: 'The multi-file entry must be named project.gdl.',
    });
  });

  test('writes, verifies, and opens a source tree', async () => {
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    const files = decomposeLegacyProjectToFiles(projectFixture);
    const changed = await writeMultiFileSourceTree({ entryPath, files });

    expect(changed).toContain('game://project.gdl');
    expect(
      fs.existsSync(path.join(temporaryDirectory, '.gdevelop/transactions'))
    ).toBe(false);
    expect(fs.existsSync(entryPath)).toBe(true);
    expect(fs.existsSync(path.join(temporaryDirectory, 'resources.gdl'))).toBe(
      true
    );
    expect(fs.existsSync(path.join(temporaryDirectory, 'constants.toml'))).toBe(
      true
    );
    expect(fs.readFileSync(entryPath, 'utf8')).not.toContain(
      '[project.resources'
    );
    expect(fs.readFileSync(entryPath, 'utf8')).not.toContain(
      '[project.constants'
    );
    expect(
      fs.existsSync(
        path.join(temporaryDirectory, 'scenes/Main/functions/sceneUpdate.gdl')
      )
    ).toBe(true);
    expect(
      areLegacyProjectsEquivalent(
        projectFixture,
        await openMultiFileProject(entryPath)
      )
    ).toBe(true);
    const sourceTree = await readMultiFileSourceTree(entryPath);
    expect(new Set(Object.keys(sourceTree.files))).toEqual(
      new Set(Object.keys(files))
    );
  });

  test('discovers only fixed managed settings boundaries', async () => {
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    await writeLegacyProjectAsMultiFile(projectFixture, entryPath);
    const unrelatedSettingsPath = path.join(
      temporaryDirectory,
      'scenes/Main/notes/tool.gdl'
    );
    fs.ensureDirSync(path.dirname(unrelatedSettingsPath));
    fs.writeFileSync(unrelatedSettingsPath, 'not valid TOML', 'utf8');

    const sourceTree = await readMultiFileSourceTree(entryPath);

    expect(Object.keys(sourceTree.files)).not.toContain(
      'game://scenes/Main/notes/tool.gdl'
    );
    expect(
      areLegacyProjectsEquivalent(
        projectFixture,
        await openMultiFileProject(entryPath)
      )
    ).toBe(true);
  });

  test('reports a missing required lifecycle settings document as a managed source error', async () => {
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    await writeLegacyProjectAsMultiFile(projectFixture, entryPath);
    fs.unlinkSync(
      path.join(temporaryDirectory, 'scenes/Main/functions/sceneUpdate.gdl')
    );

    await expect(openMultiFileProject(entryPath)).rejects.toMatchObject({
      code: 'MULTIFILE_MISSING_FILE',
    });
  });

  test('discovers and rejects canonical retired layout and function sources', async () => {
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    await writeLegacyProjectAsMultiFile(projectFixture, entryPath);
    fs.writeFileSync(
      path.join(temporaryDirectory, 'scenes/Main/Main.layout'),
      '[layout]\nversion = 1\n',
      'utf8'
    );

    await expect(openMultiFileProject(entryPath)).rejects.toMatchObject({
      code: 'MULTIFILE_RETIRED_LAYOUT_SOURCE',
    });

    fs.unlinkSync(path.join(temporaryDirectory, 'scenes/Main/Main.layout'));
    const retiredFunctionDirectory = path.join(
      temporaryDirectory,
      'scenes/Main/functions/sceneUpdate'
    );
    fs.ensureDirSync(retiredFunctionDirectory);
    fs.copyFileSync(
      path.join(temporaryDirectory, 'scenes/Main/functions/sceneUpdate.gdl'),
      path.join(retiredFunctionDirectory, 'function.gdl')
    );

    await expect(openMultiFileProject(entryPath)).rejects.toMatchObject({
      code: 'MULTIFILE_RETIRED_FUNCTION_SOURCE',
    });
  });

  test('stores external sources below their owning scene folder', async () => {
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    const project = JSON.parse(JSON.stringify(projectFixture));
    project.externalEvents = [
      { name: 'Shared Combat', associatedLayout: 'Main', events: [] },
    ];
    project.externalLayouts = [
      {
        name: 'Shared Combat',
        associatedLayout: 'Main',
        instances: [],
        editionSettings: {},
      },
    ];

    await writeLegacyProjectAsMultiFile(project, entryPath);

    const sceneSettingsPath = path.join(
      temporaryDirectory,
      'scenes/Main/scene.gdl'
    );
    const sceneSettings = fs.readFileSync(sceneSettingsPath, 'utf8');
    expect(sceneSettings).not.toContain('externalEventFiles');
    expect(sceneSettings).not.toContain('externalLayoutFiles');
    expect(sceneSettings).not.toContain('sceneLifecycleFunctions');
    expect(
      fs.existsSync(
        path.join(
          temporaryDirectory,
          'scenes/Main/external-events/Shared Combat/external-events.gdl'
        )
      )
    ).toBe(false);
    expect(
      fs.existsSync(
        path.join(
          temporaryDirectory,
          'scenes/Main/external-events/Shared Combat.gdl'
        )
      )
    ).toBe(true);
    const fragmentSettingsPath = path.join(
      temporaryDirectory,
      'scenes/Main/external-events/Shared Combat.gdl'
    );
    expect(fs.readFileSync(fragmentSettingsPath, 'utf8')).toContain(
      'fragment {'
    );
    fs.writeFileSync(
      fragmentSettingsPath,
      fs
        .readFileSync(fragmentSettingsPath, 'utf8')
        .replace('description = ""', 'description = "Reusable combat"')
    );
    await writeLegacyProjectAsMultiFile(project, entryPath);
    expect(fs.readFileSync(fragmentSettingsPath, 'utf8')).toContain(
      'description = "Reusable combat"'
    );
    expect(
      fs.existsSync(
        path.join(
          temporaryDirectory,
          'scenes/Main/external-layout/Shared Combat.gdl'
        )
      )
    ).toBe(true);
    expect(fs.existsSync(path.join(temporaryDirectory, 'externals'))).toBe(
      false
    );
    expect(
      areLegacyProjectsEquivalent(
        project,
        await openMultiFileProject(entryPath)
      )
    ).toBe(true);
  });

  test('rejects an events body without a same-stem function settings file', async () => {
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    await writeLegacyProjectAsMultiFile(projectFixture, entryPath);
    const orphanEventsPath = path.join(
      temporaryDirectory,
      'scenes/Main/functions/orphan.events'
    );
    fs.writeFileSync(orphanEventsPath, '', 'utf8');

    await expect(openMultiFileProject(entryPath)).rejects.toMatchObject({
      code: 'SETTINGS_RETIRED_EVENTS_FILE',
    });
  });

  test('requires fragment settings and rejects nested function wrappers', async () => {
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    await writeLegacyProjectAsMultiFile(projectFixture, entryPath);
    const root = path.join(temporaryDirectory, 'scenes/Main/external-events');
    fs.ensureDirSync(root);
    fs.writeFileSync(path.join(root, 'New fragment.events'), '', 'utf8');
    await expect(openMultiFileProject(entryPath)).rejects.toMatchObject({
      code: 'SETTINGS_RETIRED_EVENTS_FILE',
    });
    fs.unlinkSync(path.join(root, 'New fragment.events'));
    fs.writeFileSync(
      path.join(root, 'New fragment.gdl'),
      'fragment {\n name = "New fragment"\n description = ""\n eventsLogic = ""\n}\n',
      'utf8'
    );
    const project = await openMultiFileProject(entryPath);
    expect(project.externalEvents).toEqual([
      { name: 'New fragment', associatedLayout: 'Main', events: [] },
    ]);
    fs.ensureDirSync(path.join(root, 'Old/functions'));
    await expect(openMultiFileProject(entryPath)).rejects.toMatchObject({
      code: 'MULTIFILE_INVALID_EXTERNAL_SOURCE',
    });
  });

  test('rejects retired external.gdl without parsing it', async () => {
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    await writeLegacyProjectAsMultiFile(projectFixture, entryPath);
    const retiredSettingsPath = path.join(
      temporaryDirectory,
      'externals/external.gdl'
    );
    fs.ensureDirSync(path.dirname(retiredSettingsPath));
    fs.writeFileSync(retiredSettingsPath, 'not valid TOML', 'utf8');

    await expect(openMultiFileProject(entryPath)).rejects.toMatchObject({
      code: 'MULTIFILE_RETIRED_EXTERNAL_SETTINGS',
    });
  });

  test('leaves an unowned root externals directory untouched', async () => {
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    await writeLegacyProjectAsMultiFile(projectFixture, entryPath);
    const userSourcePath = path.join(
      temporaryDirectory,
      'externals/notes.events'
    );
    fs.ensureDirSync(path.dirname(userSourcePath));
    fs.writeFileSync(userSourcePath, 'user-owned source', 'utf8');

    expect(
      areLegacyProjectsEquivalent(
        projectFixture,
        await openMultiFileProject(entryPath)
      )
    ).toBe(true);
    await writeLegacyProjectAsMultiFile(projectFixture, entryPath);
    expect(fs.readFileSync(userSourcePath, 'utf8')).toBe('user-owned source');
  });

  test('rejects retired keyed variable tables without rewriting files during open', async () => {
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    const project = JSON.parse(JSON.stringify(projectFixture));
    project.variables = [{ name: 'Score', type: 'number', value: 12 }];
    project.layouts[0].variables = [
      { name: 'State', type: 'string', value: 'Ready' },
    ];
    const files = decomposeLegacyProjectToFiles(project);
    await writeMultiFileSourceTree({ entryPath, files });

    const projectSource = fs
      .readFileSync(entryPath, 'utf8')
      .replace('variable {', 'invalidVariables {');
    const sceneSettingsPath = path.join(
      temporaryDirectory,
      'scenes/Main/scene.gdl'
    );
    const sceneSource = fs
      .readFileSync(sceneSettingsPath, 'utf8')
      .replace('variable {', 'invalidVariables {');
    fs.writeFileSync(entryPath, projectSource, 'utf8');
    fs.writeFileSync(sceneSettingsPath, sceneSource, 'utf8');
    const untouchedEventsPath = path.join(
      temporaryDirectory,
      'scenes/Main/functions/sceneUpdate.gdl'
    );
    const untouchedEvents = fs.readFileSync(untouchedEventsPath, 'utf8');

    await expect(openMultiFileProject(entryPath)).rejects.toEqual(
      expect.objectContaining({ code: 'SETTINGS_UNKNOWN_NODE' })
    );
    expect(fs.readFileSync(entryPath, 'utf8')).toBe(projectSource);
    expect(fs.readFileSync(sceneSettingsPath, 'utf8')).toBe(sceneSource);
    expect(fs.readFileSync(untouchedEventsPath, 'utf8')).toBe(untouchedEvents);
  });

  test('uses portable physical names for URI segments invalid on Windows', async () => {
    const project = JSON.parse(JSON.stringify(projectFixture));
    project.firstLayout = 'Extension: Health';
    project.previewLayout = 'Extension: Health';
    project.layouts[0].name = 'Extension: Health';
    project.layouts[0].mangledName = 'ExtensionHealth';
    const files = decomposeLegacyProjectToFiles(project);
    const entryPath = path.join(temporaryDirectory, 'project.gdl');

    await writeMultiFileSourceTree({ entryPath, files });

    expect(
      fs.existsSync(
        path.join(
          temporaryDirectory,
          'scenes',
          'Extension%3A%20Health',
          'scene.gdl'
        )
      )
    ).toBe(true);
    expect(
      areLegacyProjectsEquivalent(
        project,
        await openMultiFileProject(entryPath)
      )
    ).toBe(true);
  });

  test('opens a source tree after Git converts settings files to CRLF', async () => {
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    const files = decomposeLegacyProjectToFiles(projectFixture);
    await writeMultiFileSourceTree({ entryPath, files });
    Object.keys(files).forEach(uri => {
      if (!uri.endsWith('.gdl')) return;
      const filePath = resolveGameUriToPath(temporaryDirectory, uri);
      const source = fs.readFileSync(filePath, 'utf8');
      fs.writeFileSync(filePath, source.replace(/\n/g, '\r\n'), 'utf8');
    });

    expect(
      areLegacyProjectsEquivalent(
        projectFixture,
        await openMultiFileProject(entryPath)
      )
    ).toBe(true);
  });

  test('requires all three instruction files and identifies invalid JSON by path', async () => {
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    await writeMultiFileSourceTree({
      entryPath,
      files: decomposeLegacyProjectToFiles(projectFixture),
    });
    await expect(openWithCatalog(entryPath)).rejects.toMatchObject({
      code: 'MULTIFILE_INVALID_INSTRUCTION_CATALOG',
      message: expect.stringContaining('conditions-catalog.json'),
    });
    fs.outputFileSync(
      path.join(
        temporaryDirectory,
        PROJECT_INSTRUCTION_CATALOG_PATHS.condition
      ),
      '{broken'
    );
    await expect(openWithCatalog(entryPath)).rejects.toMatchObject({
      code: 'MULTIFILE_INVALID_INSTRUCTION_CATALOG',
      message: expect.stringContaining('conditions-catalog.json'),
    });
  });

  test('loads named Settings instructions through the generated catalog', async () => {
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    const files = decomposeLegacyProjectToFiles(projectFixture);
    files[
      'game://scenes/Main/functions/sceneUpdate.gdl'
    ] = replaceEmbeddedEventBody(
      files['game://scenes/Main/functions/sceneUpdate.gdl'],
      'function {\n\n  events {\n\n    event {\n\n      actions {\n\n        Network::Send { url="https://example.com" }\n      }\n    }\n  }\n}\n'
    );
    await writeMultiFileSourceTree({ entryPath, files });
    const catalog = withTestInstructionSemantics({
      format: 'gdevelop-gdl-instruction-catalog',
      formatVersion: 7,
      actions: [
        {
          kind: 'action',
          type: 'Network::Send',
          parameters: [
            {
              dslName: 'url',
              type: 'string',
              valueKind: 'text',
              isOptional: false,
              isCodeOnly: false,
            },
            {
              dslName: 'runtime',
              isOptional: false,
              isCodeOnly: true,
            },
          ],
        },
      ],
      conditions: [],
      expressions: [],
    });
    for (const [file, contents] of Object.entries(
      serializeInstructionCatalogFiles(catalog)
    )) {
      fs.outputFileSync(path.join(temporaryDirectory, file), contents);
    }
    const project = await openWithCatalog(entryPath);
    expect(project.layouts[0].events[0].actions[0]).toMatchObject({
      type: { value: 'Network::Send' },
      parameters: ['"https://example.com"', ''],
    });
  });

  test('bootstraps catalogs before compiling named events on first open', async () => {
    const gd: libGDevelop = global.gd;
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    const extensionName = 'FirstOpenCatalogTest';
    const project = gd.ProjectHelper.createNewGDJSProject();
    project.setName('First open catalog project');
    ensureProjectHasDefaultScene(project);
    const sceneName = project.getLayoutAt(0).getName();
    const extension = project.insertNewEventsFunctionsExtension(
      extensionName,
      0
    );
    extension.setFullName('First open catalog test');
    const action = extension
      .getEventsFunctions()
      .insertNewEventsFunction('Ping', 0);
    action.setFunctionType(gd.EventsFunction.Action);
    action.setFullName('Ping');

    const files = decomposeLegacyProjectToFiles({
      ...serializeToJSObject(project),
      constants: {},
    });
    files[
      `game://scenes/${sceneName}/functions/sceneUpdate.gdl`
    ] = replaceEmbeddedEventBody(
      files[`game://scenes/${sceneName}/functions/sceneUpdate.gdl`],
      'function {\n\n  events {\n\n    event {\n\n      conditions {\n\n        SceneJustBegins {}\n      }\n\n      actions {\n\n        FirstOpenCatalogTest::Ping {}\n      }\n    }\n  }\n}\n'
    );
    project.delete();
    await writeMultiFileSourceTree({ entryPath, files });

    const instructionCatalogPath = path.join(
      temporaryDirectory,
      '.gdevelop/actions-catalog.json'
    );
    expect(fs.existsSync(instructionCatalogPath)).toBe(false);

    const result = await onOpen({ fileIdentifier: entryPath });

    expect(result.fileMetadata.lastModifiedDate).toBe(
      await getLocalProjectLastModifiedDate(entryPath)
    );
    expect(result.content.constants).toBeUndefined();
    expect(result.constants).toEqual({});
    expect(result.content.layouts[0].events[0]).toMatchObject({
      conditions: [
        {
          type: { value: 'SceneJustBegins' },
        },
      ],
      actions: [
        {
          type: { value: 'FirstOpenCatalogTest::Ping' },
          parameters: ['', ''],
        },
      ],
    });
    expect(fs.existsSync(instructionCatalogPath)).toBe(true);
    expect(
      JSON.parse(fs.readFileSync(instructionCatalogPath, 'utf8')).entries
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'FirstOpenCatalogTest::Ping',
        }),
      ])
    );
    expect(
      fs.existsSync(path.join(temporaryDirectory, '.gdevelop/gdl-catalog.json'))
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(temporaryDirectory, '.gdevelop/layout-catalog.json')
      )
    ).toBe(false);
    expect(
      fs.existsSync(path.join(temporaryDirectory, '.gdevelop/runtime-api.d.ts'))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(temporaryDirectory, '.gdevelop/project-api.d.ts'))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(temporaryDirectory, '.gdevelop/harness-api.d.ts'))
    ).toBe(true);
  });

  test('rebuilds retired instruction catalogs while preserving current GDL sources', async () => {
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    const project = global.gd.ProjectHelper.createNewGDJSProject();
    ensureProjectHasDefaultScene(project);
    const files = decomposeLegacyProjectToFiles({
      ...serializeToJSObject(project),
      constants: {},
    });
    project.delete();
    await writeMultiFileSourceTree({ entryPath, files });
    await onOpen({ fileIdentifier: entryPath });
    const before = (await readMultiFileSourceTree(entryPath)).files;
    for (const name of [
      'instructions-catalog.json',
      'deprecated-instructions-catalog.json',
    ]) {
      const catalogPath = path.join(temporaryDirectory, '.gdevelop', name);
      fs.writeFileSync(catalogPath, '{"formatVersion":3}');
      await onOpen({ fileIdentifier: entryPath });
      expect(fs.existsSync(catalogPath)).toBe(
        name === 'deprecated-instructions-catalog.json'
      );
      expect(
        JSON.parse(
          fs.readFileSync(
            path.join(
              temporaryDirectory,
              PROJECT_INSTRUCTION_CATALOG_PATHS.action
            ),
            'utf8'
          )
        ).instructionCatalogVersion
      ).toBe(7);
      expect((await readMultiFileSourceTree(entryPath)).files).toEqual(before);
    }
    const refreshed = JSON.parse(
      fs.readFileSync(
        path.join(temporaryDirectory, '.gdevelop/actions-catalog.json'),
        'utf8'
      )
    );
    expect(refreshed.sourceFingerprint).toMatch(/^sha256:/);
  });

  test('rebuilds a stale behavior schema catalog and removes the retired layout catalog', async () => {
    const gd: libGDevelop = global.gd;
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    const project = gd.ProjectHelper.createNewGDJSProject();
    project.setName('Catalog upgrade project');
    ensureProjectHasDefaultScene(project);
    const files = decomposeLegacyProjectToFiles({
      ...serializeToJSObject(project),
      constants: {},
    });
    project.delete();
    await writeMultiFileSourceTree({ entryPath, files });
    await onOpen({ fileIdentifier: entryPath });

    const gdlCatalogPath = path.join(
      temporaryDirectory,
      '.gdevelop/gdl-catalog.json'
    );
    const retiredLayoutCatalogPath = path.join(
      temporaryDirectory,
      '.gdevelop/layout-catalog.json'
    );
    const staleGdlCatalog = JSON.parse(fs.readFileSync(gdlCatalogPath, 'utf8'));
    staleGdlCatalog.formatVersion = 11;
    staleGdlCatalog.layoutTables = staleGdlCatalog.layoutNodes.map(
      ({ node, ...schema }) => ({ table: node, node, ...schema })
    );
    delete staleGdlCatalog.layoutNodes;
    staleGdlCatalog.counts.layoutTables = staleGdlCatalog.counts.layoutNodes;
    delete staleGdlCatalog.counts.layoutNodes;
    const stalePlatformer = staleGdlCatalog.behaviorTypes.find(
      type => type.type === 'PlatformBehavior::PlatformerObjectBehavior'
    );
    stalePlatformer.serializedDefaults = {};
    stalePlatformer.serializedProperties = stalePlatformer.serializedProperties.filter(
      property => property.serializedKey !== 'useLegacyTrajectory'
    );
    fs.writeFileSync(gdlCatalogPath, JSON.stringify(staleGdlCatalog), 'utf8');
    fs.writeFileSync(retiredLayoutCatalogPath, '{"stale":true}\n', 'utf8');

    await onOpen({ fileIdentifier: entryPath });

    const rebuiltGdlCatalog = JSON.parse(
      fs.readFileSync(gdlCatalogPath, 'utf8')
    );
    expect(
      rebuiltGdlCatalog.behaviorTypes.find(
        type => type.type === 'PlatformBehavior::PlatformerObjectBehavior'
      ).serializedProperties
    ).toContainEqual({ serializedKey: 'useLegacyTrajectory', type: 'boolean' });
    expect(rebuiltGdlCatalog).toMatchObject({
      format: 'gdevelop-gdl-catalog',
      formatVersion: 12,
      layoutAuthoring: {
        storage: 'component-root',
        syntax: 'GDevelop Language (GDL)',
      },
    });
    expect(rebuiltGdlCatalog.layoutNodes.length).toBeGreaterThan(0);
    expect(rebuiltGdlCatalog.layoutTables).toBeUndefined();
    expect(rebuiltGdlCatalog.counts.layoutTables).toBeUndefined();
    expect(
      rebuiltGdlCatalog.layoutNodes.every(node => !('table' in node))
    ).toBe(true);
    expect(rebuiltGdlCatalog.layoutContexts).toHaveLength(1);
    expect(fs.existsSync(retiredLayoutCatalogPath)).toBe(false);
  });

  test('writes only changed owned components', async () => {
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    await writeLegacyProjectAsMultiFile(projectFixture, entryPath);
    expect(
      await writeLegacyProjectAsMultiFile(projectFixture, entryPath)
    ).toEqual([]);

    const changedProject = JSON.parse(JSON.stringify(projectFixture));
    changedProject.layouts[0].title = 'Changed';
    expect(
      await writeLegacyProjectAsMultiFile(changedProject, entryPath)
    ).toEqual(['game://scenes/Main/scene.gdl']);

    const changedObjectProject = JSON.parse(JSON.stringify(changedProject));
    changedObjectProject.layouts[0].objects.push({
      name: 'Player',
      type: 'Sprite',
      behaviors: [
        {
          name: 'PlatformerObject',
          type: 'PlatformBehavior::PlatformerObjectBehavior',
        },
      ],
    });
    changedObjectProject.layouts[0].objectsFolderStructure = {
      folderName: '__ROOT',
      children: [
        {
          folderName: 'Actors',
          children: [{ objectName: 'Player' }],
        },
      ],
    };
    expect(
      await writeLegacyProjectAsMultiFile(changedObjectProject, entryPath)
    ).toEqual(['game://scenes/Main/objects/Player.gdl']);

    const changedInstanceProject = JSON.parse(
      JSON.stringify(changedObjectProject)
    );
    changedInstanceProject.layouts[0].layers = [{ name: '' }];
    changedInstanceProject.layouts[0].instances.push({
      name: 'Player',
      persistentUuid: '00000000-0000-4000-8000-000000000001',
      x: 100,
      y: 200,
      angle: 0,
      layer: '',
      zOrder: 1,
      customSize: false,
      width: 0,
      height: 0,
      numberProperties: [],
      stringProperties: [],
      initialVariables: [],
    });
    expect(
      await writeLegacyProjectAsMultiFile(changedInstanceProject, entryPath)
    ).toEqual(['game://scenes/Main/scene.gdl']);

    const changedResourcesProject = JSON.parse(
      JSON.stringify(changedInstanceProject)
    );
    changedResourcesProject.resources.resources.push({
      file: 'assets/New.png',
      kind: 'image',
      metadata: '',
      name: 'New.png',
      smoothed: true,
      userAdded: true,
    });
    expect(
      await writeLegacyProjectAsMultiFile(changedResourcesProject, entryPath)
    ).toEqual(['game://resources.gdl']);

    const changedConstantsProject = JSON.parse(
      JSON.stringify(changedResourcesProject)
    );
    changedConstantsProject.constants.newSetting = true;
    expect(
      await writeLegacyProjectAsMultiFile(changedConstantsProject, entryPath)
    ).toEqual(['game://constants.toml']);

    const withoutConstantsProject = JSON.parse(
      JSON.stringify(changedConstantsProject)
    );
    delete withoutConstantsProject.constants;
    await expect(
      writeLegacyProjectAsMultiFile(withoutConstantsProject, entryPath)
    ).rejects.toMatchObject({ code: 'MULTIFILE_MISSING_FILE' });
    expect(fs.existsSync(path.join(temporaryDirectory, 'constants.toml'))).toBe(
      true
    );
  });

  test('serializes concurrent source writes for the same project', async () => {
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    const firstWrite = writeMultiFileSourceTree({
      entryPath,
      files: {
        [MULTI_FILE_CONSTANTS_URI]: '[sheet.row]\ncolumn = "first"\n',
      },
    });
    const secondWrite = writeMultiFileSourceTree({
      entryPath,
      files: {
        [MULTI_FILE_CONSTANTS_URI]: '[sheet.row]\ncolumn = "second"\n',
      },
    });

    await Promise.all([firstWrite, secondWrite]);

    expect(
      fs.readFileSync(path.join(temporaryDirectory, 'constants.toml'), 'utf8')
    ).toBe('[sheet.row]\ncolumn = "second"\n');
  });

  test('routes prefab definition and instance edits to their owning files', async () => {
    // $FlowFixMe[cannot-resolve-module] Load the runtime extension's current metadata.
    const tweenExtension = require('../../../../../Extensions/TweenBehavior/JsExtension').createExtension(
      message => message,
      global.gd
    );
    global.gd.JsPlatform.get().addNewExtension(tweenExtension);
    tweenExtension.delete();
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    const project = JSON.parse(JSON.stringify(projectFixture));
    project.eventsFunctionsExtensions = [
      {
        name: 'Local',
        eventsFunctions: [],
        eventsBasedBehaviors: [],
        eventsBasedObjects: [
          {
            name: 'Widget',
            areaMinX: 0,
            areaMinY: 0,
            areaMinZ: 0,
            areaMaxX: 64,
            areaMaxY: 64,
            areaMaxZ: 64,
            objects: [],
            objectsFolderStructure: {
              folderName: '__ROOT',
              children: [],
            },
            objectsGroups: [],
            layers: [],
            instances: [],
            editionSettings: {},
            eventsFunctions: [],
            variants: [],
          },
        ],
      },
    ];
    await writeLegacyProjectAsMultiFile(project, entryPath);

    const changedDefinition = JSON.parse(JSON.stringify(project));
    changedDefinition.eventsFunctionsExtensions[0].eventsBasedObjects[0].objects.push(
      {
        name: 'Body',
        type: 'Sprite',
        behaviors: [{ name: 'Tween', type: 'Tween::TweenBehavior' }],
      }
    );
    changedDefinition.eventsFunctionsExtensions[0].eventsBasedObjects[0].objectsFolderStructure = {
      folderName: '__ROOT',
      children: [
        {
          folderName: 'Parts',
          children: [{ objectName: 'Body' }],
        },
      ],
    };
    expect(
      await writeLegacyProjectAsMultiFile(changedDefinition, entryPath)
    ).toEqual(['game://extensions/Local/prefabs/Widget/objects/Body.gdl']);

    const changedInstance = JSON.parse(JSON.stringify(changedDefinition));
    changedInstance.eventsFunctionsExtensions[0].eventsBasedObjects[0].layers = [
      { name: '' },
    ];
    changedInstance.eventsFunctionsExtensions[0].eventsBasedObjects[0].instances.push(
      {
        name: 'Body',
        persistentUuid: '00000000-0000-4000-8000-000000000002',
        x: 0,
        y: 0,
        angle: 0,
        layer: '',
        zOrder: 0,
        customSize: false,
        width: 0,
        height: 0,
        numberProperties: [],
        stringProperties: [],
        initialVariables: [],
      }
    );
    expect(
      await writeLegacyProjectAsMultiFile(changedInstance, entryPath)
    ).toEqual(['game://extensions/Local/prefabs/Widget/prefab.gdl']);

    const movedDefinition = JSON.parse(JSON.stringify(changedInstance));
    movedDefinition.eventsFunctionsExtensions[0].eventsBasedObjects[0].objectsFolderStructure.children[0].folderName =
      'Visuals';
    expect(
      await writeLegacyProjectAsMultiFile(movedDefinition, entryPath)
    ).toEqual(['game://extensions/Local/prefabs/Widget/objects/Body.gdl']);
    expect(
      fs.existsSync(
        path.join(
          temporaryDirectory,
          'extensions/Local/prefabs/Widget/objects/Body.gdl'
        )
      )
    ).toBe(true);
  });

  test('stores global object grouping in its flat settings file', async () => {
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    const project = JSON.parse(JSON.stringify(projectFixture));
    project.objects = [
      {
        name: 'GlobalPlayer',
        type: 'Sprite',
        behaviors: [],
      },
    ];
    project.objectsFolderStructure = {
      folderName: '__ROOT',
      children: [
        {
          folderName: 'Actors',
          children: [{ objectName: 'GlobalPlayer' }],
        },
      ],
    };

    expect(await writeLegacyProjectAsMultiFile(project, entryPath)).toEqual(
      expect.arrayContaining(['game://objects/GlobalPlayer.gdl'])
    );
    expect((await openMultiFileProject(entryPath)).objects).toEqual(
      project.objects
    );

    const movedProject = JSON.parse(JSON.stringify(project));
    movedProject.objectsFolderStructure.children[0].folderName = 'Shared';
    expect(
      await writeLegacyProjectAsMultiFile(movedProject, entryPath)
    ).toEqual(['game://objects/GlobalPlayer.gdl']);
    expect(
      fs.existsSync(path.join(temporaryDirectory, 'objects/GlobalPlayer.gdl'))
    ).toBe(true);
  });

  test('writes the real libGD object-group shape with required behaviors', async () => {
    const gd: libGDevelop = global.gd;
    const project = gd.ProjectHelper.createNewGDJSProject();
    try {
      project.setName('Object group project');
      const globalObjects = project.getObjects();
      globalObjects.insertNewObject(project, 'Sprite', 'GlobalPlayer', 0);
      const group = globalObjects
        .getObjectGroups()
        .insertNew('Global Actors', 0);
      group.addObject('GlobalPlayer');
      group.addRequiredBehavior('Tween::TweenBehavior');

      const serializedProject = {
        ...serializeToJSObject(project, 'serializeTo'),
        constants: {},
      };
      expect(serializedProject.objectsGroups).toEqual([
        {
          name: 'Global Actors',
          objects: [{ name: 'GlobalPlayer' }],
          requiredBehaviors: [{ type: 'Tween::TweenBehavior' }],
        },
      ]);

      const entryPath = path.join(temporaryDirectory, 'project.gdl');
      await writeLegacyProjectAsMultiFile(serializedProject, entryPath);
      const projectSettings = fs.readFileSync(entryPath, 'utf8');
      expect(projectSettings).toContain('objectGroups {');
      expect(projectSettings).toContain('"Global Actors" = ["GlobalPlayer"]');
      expect(projectSettings).toContain('objectGroupRequiredBehaviors {');
      expect(projectSettings).toContain(
        '"Global Actors" = ["Tween::TweenBehavior"]'
      );
      expect(
        areLegacyProjectsEquivalent(
          serializedProject,
          await openMultiFileProject(entryPath)
        )
      ).toBe(true);
    } finally {
      project.delete();
    }
  });

  test('stores prefab and behavior function grouping in function settings', async () => {
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    const makeFunction = (name: string) => ({
      name,
      functionType: 'Action',
      fullName: name,
      description: '',
      sentence: '',
      group: '',
      private: false,
      async: false,
      parameters: [],
      objectGroups: [],
      events: [],
    });
    const project = JSON.parse(JSON.stringify(projectFixture));
    project.eventsFunctionsExtensions = [
      {
        name: 'Local',
        eventsFunctions: [],
        eventsBasedObjects: [
          {
            name: 'Widget',
            objects: [],
            objectsGroups: [],
            areaMinX: 0,
            areaMinY: 0,
            areaMinZ: 0,
            areaMaxX: 64,
            areaMaxY: 64,
            areaMaxZ: 64,
            layers: [],
            instances: [],
            editionSettings: {},
            eventsFunctions: [makeFunction('Initialize')],
            eventsFunctionsFolderStructure: {
              folderName: '__ROOT',
              children: [
                {
                  folderName: 'Lifecycle',
                  children: [{ functionName: 'Initialize' }],
                },
              ],
            },
            variants: [],
          },
        ],
        eventsBasedBehaviors: [
          {
            name: 'Health',
            eventsFunctions: [makeFunction('Heal')],
            eventsFunctionsFolderStructure: {
              folderName: '__ROOT',
              children: [
                {
                  folderName: 'Recovery',
                  children: [{ functionName: 'Heal' }],
                },
              ],
            },
          },
        ],
      },
    ];

    await writeLegacyProjectAsMultiFile(project, entryPath);
    expect(
      fs.existsSync(
        path.join(
          temporaryDirectory,
          'extensions/Local/prefabs/Widget/functions/Initialize.gdl'
        )
      )
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          temporaryDirectory,
          'extensions/Local/behaviors/Health/functions/Heal.gdl'
        )
      )
    ).toBe(true);
    const opened = await openMultiFileProject(entryPath);
    expect(
      opened.eventsFunctionsExtensions[0].eventsBasedObjects[0]
        .eventsFunctionsFolderStructure
    ).toEqual(
      project.eventsFunctionsExtensions[0].eventsBasedObjects[0]
        .eventsFunctionsFolderStructure
    );
    expect(
      opened.eventsFunctionsExtensions[0].eventsBasedBehaviors[0]
        .eventsFunctionsFolderStructure
    ).toEqual(
      project.eventsFunctionsExtensions[0].eventsBasedBehaviors[0]
        .eventsFunctionsFolderStructure
    );

    const moved = JSON.parse(JSON.stringify(project));
    moved.eventsFunctionsExtensions[0].eventsBasedObjects[0].eventsFunctionsFolderStructure.children[0].folderName =
      'Setup';
    moved.eventsFunctionsExtensions[0].eventsBasedBehaviors[0].eventsFunctionsFolderStructure.children[0].folderName =
      'State';
    const changed = await writeLegacyProjectAsMultiFile(moved, entryPath);
    expect(changed).toEqual([
      'game://extensions/Local/prefabs/Widget/functions/Initialize.gdl',
      'game://extensions/Local/behaviors/Health/functions/Heal.gdl',
    ]);
    expect(
      fs.existsSync(
        path.join(
          temporaryDirectory,
          'extensions/Local/prefabs/Widget/functions/Initialize.gdl'
        )
      )
    ).toBe(true);
    expect(
      areLegacyProjectsEquivalent(moved, await openMultiFileProject(entryPath))
    ).toBe(true);
  });

  test('removes only obsolete files owned by the previous manifest', async () => {
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    await writeLegacyProjectAsMultiFile(projectFixture, entryPath);
    const userFile = path.join(temporaryDirectory, 'scenes/Main/notes.txt');
    fs.writeFileSync(userFile, 'keep me', 'utf8');

    const withoutScene = JSON.parse(JSON.stringify(projectFixture));
    withoutScene.layouts = [];
    const changed = await writeLegacyProjectAsMultiFile(
      withoutScene,
      entryPath
    );

    expect(changed).toEqual(
      expect.arrayContaining([
        'game://scenes/Main/scene.gdl',
        'game://scenes/Main/functions/sceneUpdate.gdl',
        'game://scenes/Main/functions/sceneUpdate.gdl',
      ])
    );
    expect(
      fs.existsSync(
        path.join(temporaryDirectory, 'scenes/Main/functions/sceneUpdate.gdl')
      )
    ).toBe(false);
    expect(fs.readFileSync(userFile, 'utf8')).toBe('keep me');
    expect(fs.existsSync(path.dirname(userFile))).toBe(true);
  });

  test('renames all files owned by extension components and removes empty old folders', async () => {
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    const makeFunction = (name: string) => ({
      name,
      functionType: 'Action',
      fullName: name,
      description: '',
      sentence: '',
      group: '',
      private: false,
      async: false,
      parameters: [],
      objectGroups: [],
      events: [],
    });
    let project = JSON.parse(JSON.stringify(projectFixture));
    project.eventsFunctionsExtensions = [
      {
        name: 'Combat',
        fullName: 'Combat',
        eventsFunctionsFolderStructure: {
          folderName: '__ROOT',
          children: [],
        },
        eventsFunctions: [makeFunction('CalculateDamage')],
        eventsBasedObjects: [
          {
            name: 'Enemy',
            fullName: 'Enemy',
            objects: [],
            objectsFolderStructure: {
              folderName: '__ROOT',
              children: [],
            },
            objectsGroups: [],
            areaMinX: 0,
            areaMinY: 0,
            areaMinZ: 0,
            areaMaxX: 64,
            areaMaxY: 64,
            areaMaxZ: 0,
            layers: [],
            instances: [],
            editionSettings: {},
            eventsFunctions: [makeFunction('TakeDamage')],
            variants: [],
          },
        ],
        eventsBasedBehaviors: [
          {
            name: 'Health',
            fullName: 'Health',
            eventsFunctions: [makeFunction('Heal')],
          },
        ],
      },
    ];
    const exists = (relativePath: string) =>
      fs.existsSync(path.join(temporaryDirectory, ...relativePath.split('/')));

    await writeLegacyProjectAsMultiFile(project, entryPath);

    let renamed = JSON.parse(JSON.stringify(project));
    renamed.eventsFunctionsExtensions[0].eventsFunctions[0].name =
      'ComputeDamage';
    await writeLegacyProjectAsMultiFile(renamed, entryPath);
    expect(exists('extensions/Combat/functions/CalculateDamage')).toBe(false);
    expect(exists('extensions/Combat/functions/ComputeDamage.gdl')).toBe(true);
    expect(exists('extensions/Combat/functions/ComputeDamage.gdl')).toBe(true);
    project = renamed;

    renamed = JSON.parse(JSON.stringify(project));
    const renamedPrefab =
      renamed.eventsFunctionsExtensions[0].eventsBasedObjects[0];
    renamedPrefab.name = 'Boss';
    renamedPrefab.eventsFunctions[0].name = 'ReceiveDamage';
    await writeLegacyProjectAsMultiFile(renamed, entryPath);
    expect(exists('extensions/Combat/prefabs/Enemy')).toBe(false);
    expect(exists('extensions/Combat/prefabs/Boss/prefab.gdl')).toBe(true);
    expect(exists('extensions/Combat/prefabs/Boss/prefab.gdl')).toBe(true);
    expect(
      exists('extensions/Combat/prefabs/Boss/functions/ReceiveDamage.gdl')
    ).toBe(true);
    expect(
      exists('extensions/Combat/prefabs/Boss/functions/ReceiveDamage.gdl')
    ).toBe(true);
    const prefabSettings = fs.readFileSync(
      path.join(
        temporaryDirectory,
        'extensions/Combat/prefabs/Boss/prefab.gdl'
      ),
      'utf8'
    );
    expect(prefabSettings).toContain('bounds {');
    expect(prefabSettings).not.toContain('.functions.');
    expect(prefabSettings).not.toContain('ReceiveDamage.gdl');
    project = renamed;

    renamed = JSON.parse(JSON.stringify(project));
    const renamedBehavior =
      renamed.eventsFunctionsExtensions[0].eventsBasedBehaviors[0];
    renamedBehavior.name = 'Vitality';
    renamedBehavior.eventsFunctions[0].name = 'Restore';
    await writeLegacyProjectAsMultiFile(renamed, entryPath);
    expect(exists('extensions/Combat/behaviors/Health')).toBe(false);
    expect(exists('extensions/Combat/behaviors/Vitality/behavior.gdl')).toBe(
      true
    );
    expect(
      exists('extensions/Combat/behaviors/Vitality/functions/Restore.gdl')
    ).toBe(true);
    expect(
      exists('extensions/Combat/behaviors/Vitality/functions/Restore.gdl')
    ).toBe(true);
    project = renamed;

    renamed = JSON.parse(JSON.stringify(project));
    renamed.eventsFunctionsExtensions[0].name = 'Battle';
    await writeLegacyProjectAsMultiFile(renamed, entryPath);
    expect(exists('extensions/Combat')).toBe(false);
    expect(exists('extensions/Battle/extension.gdl')).toBe(true);
    expect(exists('extensions/Battle/functions/ComputeDamage.gdl')).toBe(true);
    expect(exists('extensions/Battle/prefabs/Boss/prefab.gdl')).toBe(true);
    expect(
      exists('extensions/Battle/behaviors/Vitality/functions/Restore.gdl')
    ).toBe(true);
    expect(
      areLegacyProjectsEquivalent(
        renamed,
        await openMultiFileProject(entryPath)
      )
    ).toBe(true);
  });

  test('rejects JSON project opening without migration', async () => {
    const legacyPath = path.join(temporaryDirectory, 'game.json');
    fs.writeFileSync(legacyPath, JSON.stringify(projectFixture));
    await expect(onOpen({ fileIdentifier: legacyPath })).rejects.toMatchObject({
      code: 'MULTIFILE_UNSUPPORTED_VERSION',
    });
    expect(fs.existsSync(path.join(temporaryDirectory, 'project.gdl'))).toBe(
      false
    );
  });

  test('resolves managed paths inside the project root', () => {
    expect(
      resolveGameUriToPath(temporaryDirectory, 'game://scenes/Main/Main.events')
    ).toBe(path.join(temporaryDirectory, 'scenes/Main/Main.events'));
    expect(() =>
      resolveGameUriToPath(temporaryDirectory, 'game://../escape.events')
    ).toThrow();
  });

  test('uses the generated folder as the local project root', () => {
    expect(
      getProjectLocation({
        projectName: 'My Game',
        saveAsLocation: null,
        newProjectsDefaultFolder: temporaryDirectory,
      }).fileIdentifier
    ).toBe(path.join(temporaryDirectory, 'project.gdl'));
  });

  test('writes exactly three instruction kind catalogs and removes retired files', async () => {
    const gd: libGDevelop = global.gd;
    const project = gd.ProjectHelper.createNewGDJSProject();
    for (const file of [
      'instructions-catalog.json',
      'deprecated-instructions-catalog.json',
    ])
      fs.outputFileSync(
        path.join(temporaryDirectory, '.gdevelop', file),
        'stale'
      );
    const catalog = await writeProjectInstructionCatalog(
      project,
      temporaryDirectory
    );
    const parts = Object.fromEntries(
      Object.entries(PROJECT_INSTRUCTION_CATALOG_PATHS).map(([kind, file]) => {
        const contents = fs.readFileSync(
          path.join(temporaryDirectory, file),
          'utf8'
        );
        const part = JSON.parse(contents);
        expect(part.kind).toBe(kind);
        expect(part.entries.every(entry => entry.kind === undefined)).toBe(
          true
        );
        expect(part.count).toBe(part.entries.length);
        expect(contents).not.toContain('serialized operand');
        return [file, part];
      })
    );
    parts['.gdevelop/deprecated-instructions-catalog.json'] = fs.readJsonSync(
      path.join(
        temporaryDirectory,
        '.gdevelop/deprecated-instructions-catalog.json'
      )
    );
    const loadedCounts = assembleInstructionCatalogFiles(parts).counts;
    for (const kind of ['actions', 'conditions', 'expressions'])
      expect(loadedCounts[kind]).toBeGreaterThanOrEqual(catalog.counts[kind]);
    expect(
      fs.readdirSync(path.join(temporaryDirectory, '.gdevelop')).sort()
    ).toEqual([
      'actions-catalog.json',
      'conditions-catalog.json',
      'deprecated-instructions-catalog.json',
      'expressions-catalog.json',
    ]);
    expect(catalog.counts.actions).toBeGreaterThan(100);
    project.delete();
  });

  test('writes one GDL catalog with embedded layout authoring data', async () => {
    const gd: libGDevelop = global.gd;
    const project = gd.ProjectHelper.createNewGDJSProject();
    project.setName('Catalog project');
    ensureProjectHasDefaultScene(project);
    const layout = project.getLayoutAt(0);
    layout.getObjects().insertNewObject(project, 'Sprite', 'Player', 0);

    const settingsPath = path.join(
      temporaryDirectory,
      '.gdevelop/gdl-catalog.json'
    );
    const layoutPath = path.join(
      temporaryDirectory,
      '.gdevelop/layout-catalog.json'
    );
    fs.ensureDirSync(path.dirname(layoutPath));
    fs.writeFileSync(layoutPath, '{"stale":true}\n', 'utf8');
    const gdlCatalog = await writeProjectGdlCatalog(
      project,
      temporaryDirectory
    );

    expect(fs.existsSync(settingsPath)).toBe(true);
    expect(fs.existsSync(layoutPath)).toBe(false);
    const persistedGdlCatalog = JSON.parse(
      fs.readFileSync(settingsPath, 'utf8')
    );
    expect(persistedGdlCatalog.counts).toEqual(gdlCatalog.counts);
    expect(JSON.stringify(persistedGdlCatalog.fileKinds)).not.toMatch(
      /FolderStructure/
    );
    expect(
      persistedGdlCatalog.fileKinds.every(
        fileKind =>
          fileKind.schema &&
          Array.isArray(fileKind.schema.rootFields) &&
          typeof fileKind.schema.childNodes === 'object'
      )
    ).toBe(true);
    expect(
      persistedGdlCatalog.fileKinds.find(
        fileKind => fileKind.kind === 'scene-lifecycle-function'
      )
    ).toEqual(
      expect.objectContaining({
        path: 'scenes/<Scene>/functions/<Role>.gdl',
        requiredFields: expect.arrayContaining(['order', 'lifecycleRole']),
      })
    );
    expect(
      persistedGdlCatalog.fileKinds.some(
        fileKind => fileKind.kind === 'externals'
      )
    ).toBe(false);
    expect(gdlCatalog.counts.fileKinds).toBe(17);
    expect(gdlCatalog.counts.objectTypes).toBeGreaterThan(5);
    expect(gdlCatalog.counts.behaviorTypes).toBeGreaterThan(5);
    expect(gdlCatalog.layoutContexts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'scene',
          owner: expect.objectContaining({
            scene: 'Game',
            settingsUri: 'game://scenes/Game/scene.gdl',
          }),
          objects: expect.arrayContaining([
            expect.objectContaining({ name: 'Player', type: 'Sprite' }),
          ]),
        }),
      ])
    );
    expect(gdlCatalog.behaviorOverrideSchemas.length).toBeGreaterThan(5);
    project.delete();
  });

  test('regenerates every project source catalog together', async () => {
    const gd: libGDevelop = global.gd;
    const project = gd.ProjectHelper.createNewGDJSProject();
    project.setName('Reloaded catalog project');
    ensureProjectHasDefaultScene(project);

    // A never-resolving asynchronous ensureDir reproduces the callback stall
    // that used to strand reload_project. Generated catalogs must use the
    // synchronous verified writer and never touch this async API.
    const ensureDirSpy = jest
      .spyOn(fs, 'ensureDir')
      .mockImplementation(() => new Promise(() => {}));
    const progressPhases = [];
    const cachedProgressPhases = [];

    let counts: Object;
    let cachedCounts: Object;
    let firstHarnessApi: string;
    try {
      counts = await writeProjectSourceCatalogs(project, temporaryDirectory, {
        reportProgress: phase => {
          progressPhases.push(phase);
        },
      });
      firstHarnessApi = fs.readFileSync(
        path.join(temporaryDirectory, '.gdevelop/harness-api.d.ts'),
        'utf8'
      );
      cachedCounts = await writeProjectSourceCatalogs(
        project,
        temporaryDirectory,
        {
          reportProgress: phase => {
            cachedProgressPhases.push(phase);
          },
        }
      );
    } finally {
      ensureDirSpy.mockRestore();
    }

    expect(ensureDirSpy).not.toHaveBeenCalled();
    expect(counts.instructions.actions).toBeGreaterThan(100);
    expect(counts.gdl.objectTypes).toBeGreaterThan(5);
    expect(counts.gdl.layoutContexts).toBe(1);
    expect(counts.javascript.counts.scenes).toBe(1);
    expect(cachedCounts).toEqual(counts);
    expect(counts.javascript.hashes.runtimeApi).toMatch(/^[0-9a-f]{64}$/);
    expect(counts.javascript.hashes.projectApi).toMatch(/^[0-9a-f]{64}$/);
    expect(counts.javascript.hashes.harnessApi).toMatch(/^[0-9a-f]{64}$/);
    expect(counts.tslMaterial.counts.symbols).toBeGreaterThan(20);
    expect(counts.tslMaterial.counts.examples).toBeGreaterThanOrEqual(6);
    expect(counts.tslMaterial.hashes.tslApi).toMatch(/^[0-9a-f]{64}$/);
    expect(counts.tslMaterial.hashes.tslCatalog).toMatch(/^[0-9a-f]{64}$/);
    expect(counts.javascript.paths).toEqual({
      runtimeApi: path.join(temporaryDirectory, '.gdevelop/runtime-api.d.ts'),
      projectApi: path.join(temporaryDirectory, '.gdevelop/project-api.d.ts'),
      harnessApi: path.join(temporaryDirectory, '.gdevelop/harness-api.d.ts'),
    });
    expect(counts.tslMaterial.paths).toEqual({
      tslApi: path.join(temporaryDirectory, '.gdevelop/tsl-api.d.ts'),
      tslCatalog: path.join(temporaryDirectory, '.gdevelop/tsl-catalog.json'),
    });
    expect(
      fs.existsSync(
        path.join(temporaryDirectory, '.gdevelop/actions-catalog.json')
      )
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(temporaryDirectory, '.gdevelop/conditions-catalog.json')
      )
    ).toBe(true);
    expect(
      fs.existsSync(path.join(temporaryDirectory, '.gdevelop/gdl-catalog.json'))
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(temporaryDirectory, '.gdevelop/layout-catalog.json')
      )
    ).toBe(false);
    expect(
      fs.existsSync(path.join(temporaryDirectory, '.gdevelop/runtime-api.d.ts'))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(temporaryDirectory, '.gdevelop/project-api.d.ts'))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(temporaryDirectory, '.gdevelop/harness-api.d.ts'))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(temporaryDirectory, '.gdevelop/tsl-api.d.ts'))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(temporaryDirectory, '.gdevelop/tsl-catalog.json'))
    ).toBe(true);
    expect(
      fs.readFileSync(
        path.join(temporaryDirectory, '.gdevelop/runtime-api.d.ts'),
        'utf8'
      )
    ).not.toContain('_instances');
    const harnessApi = fs.readFileSync(
      path.join(temporaryDirectory, '.gdevelop/harness-api.d.ts'),
      'utf8'
    );
    expect(harnessApi).toBe(firstHarnessApi);
    expect(harnessApi).toContain(
      'declare const harness: GDevelopGameplayTests.GameplayTestHarness'
    );
    expect(harnessApi).not.toContain('_runtimeGame');
    expect(progressPhases).toEqual([
      'catalog-project-serializing',
      'catalog-project-serialized',
      'catalog-instruction-signature-building',
      'catalog-instruction-signature-built',
      'catalog-instructions-building',
      'catalog-instructions-built',
      'catalog-deprecated-instructions-building',
      'catalog-deprecated-instructions-built',
      'catalog-instructions-cache-hit',
      'catalog-instructions-writing',
      'catalog-instructions-written',
      'catalog-gdl-building',
      'catalog-gdl-built',
      'catalog-gdl-writing',
      'catalog-gdl-written',
      'catalog-javascript-api-building',
      'catalog-harness-api-building',
      'catalog-javascript-api-built',
      'catalog-runtime-api-writing',
      'catalog-runtime-api-written',
      'catalog-project-api-writing',
      'catalog-project-api-written',
      'catalog-harness-api-writing',
      'catalog-harness-api-verifying',
      'catalog-harness-api-verified',
      'catalog-harness-api-written',
      'catalog-tsl-api-building',
      'catalog-tsl-api-built',
      'catalog-tsl-api-writing',
      'catalog-tsl-api-verifying',
      'catalog-tsl-api-verified',
      'catalog-tsl-api-written',
      'catalog-tsl-catalog-writing',
      'catalog-tsl-catalog-verifying',
      'catalog-tsl-catalog-verified',
      'catalog-tsl-catalog-written',
    ]);
    expect(cachedProgressPhases).toContain('catalog-instructions-cache-hit');
    expect(cachedProgressPhases).toContain(
      'catalog-deprecated-instructions-cache-hit'
    );
    expect(cachedProgressPhases).not.toContain('catalog-instructions-building');
    expect(cachedProgressPhases).not.toContain(
      'catalog-deprecated-instructions-building'
    );
    project.delete();
  });

  test('accepts identical catalog bytes written by a competing renderer', async () => {
    const gd: libGDevelop = global.gd;
    const project = gd.ProjectHelper.createNewGDJSProject();
    ensureProjectHasDefaultScene(project);
    const target = path.join(
      temporaryDirectory,
      '.gdevelop/actions-catalog.json'
    );
    fs.removeSync(target);
    const realMoveSync = fs.moveSync;
    let raced = false;
    const moveSpy = jest
      .spyOn(fs, 'moveSync')
      .mockImplementation((src, dest, options) => {
        if (!raced && dest === target) {
          raced = true;
          fs.writeFileSync(dest, fs.readFileSync(src));
          const error: any = new Error('Destination was written concurrently.');
          error.code = 'EEXIST';
          throw error;
        }
        return realMoveSync(src, dest, options);
      });
    try {
      await writeProjectInstructionCatalog(project, temporaryDirectory);
      expect(raced).toBe(true);
      expect(JSON.parse(fs.readFileSync(target, 'utf8')).kind).toBe('action');
    } finally {
      moveSpy.mockRestore();
      project.delete();
    }
  });

  test('regenerates project source catalogs with scene signal events', async () => {
    const gd: libGDevelop = global.gd;
    const project = gd.ProjectHelper.createNewGDJSProject();
    const legacyProject = JSON.parse(JSON.stringify(projectFixture));
    legacyProject.properties.platforms = [{ name: 'GDevelop JS platform' }];
    legacyProject.properties.currentPlatform = 'GDevelop JS platform';
    legacyProject.layouts[0].sceneSignalEvents = [
      {
        type: 'BuiltinCommonInstructions::Standard',
        conditions: [],
        actions: [],
        events: [],
      },
    ];

    try {
      unserializeFromJSObject(project, legacyProject);
      const counts = await writeProjectSourceCatalogs(
        project,
        temporaryDirectory
      );
      expect(counts.javascript.counts.scenes).toBe(1);
    } finally {
      project.delete();
    }
  });

  test('writes the generated legacy game.json on every multi-file save', async () => {
    const gd: libGDevelop = global.gd;
    const project = gd.ProjectHelper.createNewGDJSProject();
    project.setName('Generated compatibility project');
    project.setConstantsJson(
      JSON.stringify({ sheet: { row: { column: 'editor only' } } })
    );
    const gameplayTest = project
      .getTests()
      .insertNewTest('Generated smoke test', 0);
    gameplayTest.setSource(
      'await harness.stepFrames(1);\nconsole.log("Saved");\n'
    );
    gameplayTest.setLastRunStatus('passed');
    gameplayTest.setLastRunAt(123);
    gameplayTest.setLastRunDurationMs(45);
    gameplayTest.setLastRunFramesExecuted(3);
    const entryPath = path.join(temporaryDirectory, 'project.gdl');

    await onSaveProject(
      project,
      ({
        fileIdentifier: entryPath,
        name: project.getName(),
        gameId: project.getProjectUuid(),
        lastModifiedDate: 0,
      }: any),
      undefined,
      {
        showAlert: jest.fn(),
        showConfirmation: jest.fn(),
      }
    );

    const generatedPath = path.join(
      temporaryDirectory,
      ...GENERATED_LEGACY_PROJECT_RELATIVE_PATH.split('/')
    );
    expect(fs.existsSync(generatedPath)).toBe(true);
    const moduleMap = JSON.parse(
      fs.readFileSync(
        path.join(temporaryDirectory, '.gdevelop/project-module-map.json'),
        'utf8'
      )
    );
    expect(moduleMap).toMatchObject({
      format: 'gdevelop-project-module-map',
      sourceFormatVersion: 13,
      project: { name: 'Generated compatibility project' },
    });
    const generatedProject = JSON.parse(fs.readFileSync(generatedPath, 'utf8'));
    expect(generatedProject.properties.name).toBe(
      'Generated compatibility project'
    );
    expect(generatedProject.constants).toBeUndefined();
    expect(generatedProject.tests[0]).not.toHaveProperty('lastRunStatus');
    expect(generatedProject.tests[0]).not.toHaveProperty('lastRunAt');
    expect(generatedProject.tests[0]).not.toHaveProperty('lastRunDurationMs');
    expect(generatedProject.tests[0]).not.toHaveProperty(
      'lastRunFramesExecuted'
    );
    expect(
      fs.readFileSync(
        resolveGameUriToPath(
          temporaryDirectory,
          'game://tests/Generated%20smoke%20test.js'
        ),
        'utf8'
      )
    ).toBe('await harness.stepFrames(1);\nconsole.log("Saved");\n');
    expect(
      JSON.parse(
        fs.readFileSync(
          path.join(
            temporaryDirectory,
            ...GAMEPLAY_TEST_RESULTS_RELATIVE_PATH.split('/')
          ),
          'utf8'
        )
      ).tests[0]
    ).toMatchObject({
      name: 'Generated smoke test',
      lastRunStatus: 'passed',
    });
    expect(
      fs.readFileSync(path.join(temporaryDirectory, 'constants.toml'), 'utf8')
    ).toBe(`[sheet.row]
column = "editor only"
`);
    expect(fs.readFileSync(generatedPath, 'utf8')).not.toMatch(
      /(?:eventsFunctions|objects|properties|sharedProperties)FolderStructure/
    );
    expect(
      fs.existsSync(path.join(temporaryDirectory, '.gdevelop/gdl-catalog.json'))
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(temporaryDirectory, '.gdevelop/layout-catalog.json')
      )
    ).toBe(false);
    expect(
      fs.existsSync(path.join(temporaryDirectory, '.gdevelop/runtime-api.d.ts'))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(temporaryDirectory, '.gdevelop/project-api.d.ts'))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(temporaryDirectory, '.gdevelop/harness-api.d.ts'))
    ).toBe(true);
    project.delete();
  });

  test('normalizes local resource files while preserving legacy resource names on save', async () => {
    const gd: libGDevelop = global.gd;
    const project = gd.ProjectHelper.createNewGDJSProject();
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    const legacyResourceName = 'assets\\models\\model.glb';
    const resource = new gd.Model3DResource();
    resource.setName(legacyResourceName);
    resource.setFile('assets\\models\\model.glb');
    project.getResourcesManager().addResource(resource);
    resource.delete();

    await onSaveProject(
      project,
      ({
        fileIdentifier: entryPath,
        name: project.getName(),
        gameId: project.getProjectUuid(),
        lastModifiedDate: 0,
      }: any),
      undefined,
      {
        showAlert: jest.fn(),
        showConfirmation: jest.fn(),
      }
    );

    expect(project.getResourcesManager().hasResource(legacyResourceName)).toBe(
      true
    );
    expect(
      project
        .getResourcesManager()
        .getResource(legacyResourceName)
        .getFile()
    ).toBe('assets/models/model.glb');

    const reopened = await openMultiFileProject(entryPath);
    expect(reopened.resources.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: legacyResourceName,
          file: 'assets/models/model.glb',
        }),
      ])
    );
    const generatedProject = JSON.parse(
      fs.readFileSync(
        path.join(
          temporaryDirectory,
          ...GENERATED_LEGACY_PROJECT_RELATIVE_PATH.split('/')
        ),
        'utf8'
      )
    );
    expect(generatedProject.resources.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: legacyResourceName,
          file: 'assets/models/model.glb',
        }),
      ])
    );
    project.delete();
  });

  test('auto-saves Constants directly to constants.toml', async () => {
    const gd: libGDevelop = global.gd;
    const project = gd.ProjectHelper.createNewGDJSProject();
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    const originalEntrySource = '[project]\nname = "Auto-save test"\n';
    fs.writeFileSync(entryPath, originalEntrySource);
    project.setConstantsJson(
      JSON.stringify({
        sheet: {
          row: { column: 'sd', column2: 'sdf' },
          row2: { column: 'zz', column2: '333' },
        },
      })
    );

    await expect(
      onAutoSaveConstants(
        JSON.parse(project.getConstantsJson()),
        ({ fileIdentifier: entryPath }: any)
      )
    ).resolves.toBe(true);

    expect(
      fs.readFileSync(path.join(temporaryDirectory, 'constants.toml'), 'utf8')
    ).toBe(`[sheet.row]
column = "sd"
column2 = "sdf"

[sheet.row2]
column = "zz"
column2 = "333"
`);
    expect(fs.readFileSync(entryPath, 'utf8')).toBe(originalEntrySource);
    project.delete();
  });

  test('preserves authored structure field order across a native editor save', async () => {
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    const source = {
      ...projectFixture,
      properties: {
        ...projectFixture.properties,
        platforms: [{ name: 'GDevelop JS platform' }],
        currentPlatform: 'GDevelop JS platform',
      },
      variables: [
        {
          name: 'Data',
          type: 'structure',
          children: [
            { name: 'Z', type: 'number', value: 1 },
            { name: 'A', type: 'number', value: 2 },
          ],
        },
      ],
    };
    await writeLegacyProjectAsMultiFile(source, entryPath);
    const project = global.gd.ProjectHelper.createNewGDJSProject();
    try {
      unserializeFromJSObject(project, await openMultiFileProject(entryPath));
      expect(
        serializeToJSObject(project).variables[0].children.map(
          child => child.name
        )
      ).toEqual(['A', 'Z']);
      // Opening the variable editor can assign ids to existing declarations;
      // name-based fallback must still preserve their authored field order.
      project.getVariables().ensurePersistentUuids();
      await onSaveProject(project, { fileIdentifier: entryPath }, undefined, {
        showAlert: jest.fn(),
        showConfirmation: jest.fn(),
      });
      expect(
        (await openMultiFileProject(entryPath)).variables[0].children.map(
          child => child.name
        )
      ).toEqual(['Z', 'A']);
    } finally {
      project.delete();
    }
  });

  test.each([false, true])(
    'saves and reopens a platformer template with trajectory flag %s',
    async useLegacyTrajectory => {
      const project = global.gd.ProjectHelper.createNewGDJSProject();
      const entryPath = path.join(temporaryDirectory, 'project.gdl');
      try {
        unserializeFromJSObject(project, {
          ...projectFixture,
          properties: {
            ...projectFixture.properties,
            platforms: [{ name: 'GDevelop JS platform' }],
            currentPlatform: 'GDevelop JS platform',
          },
        });
        const player = project
          .getLayoutAt(0)
          .getObjects()
          .insertNewObject(project, 'Sprite', 'Player', 0);
        const behavior = player.addNewBehavior(
          project,
          'PlatformBehavior::PlatformerObjectBehavior',
          'PlatformerObject'
        );
        if (!behavior)
          throw new Error('Expected platformer behavior to be created.');
        behavior.updateProperty(
          'UseLegacyTrajectory',
          useLegacyTrajectory ? '1' : '0'
        );
        await onSaveProject(project, { fileIdentifier: entryPath }, undefined, {
          showAlert: jest.fn(),
          showConfirmation: jest.fn(),
        });
        const source = fs.readFileSync(
          path.join(temporaryDirectory, 'scenes/Main/objects/Player.gdl'),
          'utf8'
        );
        expect(source).toContain(
          `useLegacyTrajectory = ${useLegacyTrajectory}`
        );
        expect(source).not.toContain('UseLegacyTrajectory =');
        const reopened = await openMultiFileProject(entryPath);
        expect(
          reopened.layouts[0].objects[0].behaviors.find(
            b => b.name === 'PlatformerObject'
          )
        ).toMatchObject({ useLegacyTrajectory, useRepeatedJump: false });
      } finally {
        project.delete();
      }
    }
  );

  test('saves a platformer collision with its optional boolean default omitted', async () => {
    const gd: libGDevelop = global.gd;
    const project = gd.ProjectHelper.createNewGDJSProject();
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    const legacyProject = JSON.parse(JSON.stringify(projectFixture));
    legacyProject.properties.name = 'Platformer collision regression';
    legacyProject.properties.platforms = [{ name: 'GDevelop JS platform' }];
    legacyProject.properties.currentPlatform = 'GDevelop JS platform';
    legacyProject.layouts[0].objects = [
      { name: 'Player', type: 'Sprite', behaviors: [] },
      { name: 'Platform', type: 'Sprite', behaviors: [] },
    ];
    legacyProject.layouts[0].events = [
      {
        type: 'BuiltinCommonInstructions::Standard',
        conditions: [
          {
            type: { value: 'CollisionNP' },
            parameters: ['Player', 'Platform', ''],
          },
        ],
        actions: [],
      },
    ];
    try {
      unserializeFromJSObject(project, legacyProject);
      await onSaveProject(
        project,
        ({
          fileIdentifier: entryPath,
          name: project.getName(),
          gameId: project.getProjectUuid(),
          lastModifiedDate: 0,
        }: any),
        undefined,
        {
          showAlert: jest.fn(),
          showConfirmation: jest.fn(),
        }
      );

      const eventsSource = fs.readFileSync(
        path.join(temporaryDirectory, 'scenes/Main/functions/sceneUpdate.gdl'),
        'utf8'
      );
      expect(eventsSource).toMatch(
        /collision\s+\{\s+first_object\s+=\s+"Player"\s+second_object\s+=\s+"Platform"/
      );
      expect(eventsSource).not.toContain(
        'ignore_objects_that_are_touching_each_other'
      );
      const reopened = await openMultiFileProject(entryPath);
      expect(reopened.layouts[0].events[0].conditions[0]).toMatchObject({
        type: { value: 'CollisionNP' },
        parameters: ['Player', 'Platform', '', '', ''],
      });
    } finally {
      project.delete();
    }
  });

  test('saves and reopens the Physics2 template instruction whose type contains whitespace', async () => {
    const gd: libGDevelop = global.gd;
    // $FlowFixMe[cannot-resolve-module] The extension is loaded by the app in production.
    const physics2ExtensionModule = require('../../../../../Extensions/Physics2Behavior/JsExtension');
    const physics2Extension = physics2ExtensionModule.createExtension(
      message => message,
      gd
    );
    gd.JsPlatform.get().addNewExtension(physics2Extension);
    physics2Extension.delete();
    const project = gd.ProjectHelper.createNewGDJSProject();
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    const legacyProject = JSON.parse(JSON.stringify(projectFixture));
    legacyProject.properties.name = 'Physics template regression';
    legacyProject.properties.platforms = [{ name: 'GDevelop JS platform' }];
    legacyProject.properties.currentPlatform = 'GDevelop JS platform';
    legacyProject.layouts[0].behaviorsSharedData = [
      {
        name: 'Physics2',
        type: 'Physics2::Physics2Behavior',
        gravityX: 0,
        gravityY: 9.8,
        worldScale: 100,
        scaleX: 120,
        scaleY: 80,
      },
    ];
    legacyProject.layouts[0].objects = [
      {
        name: 'Body',
        type: 'Sprite',
        behaviors: [
          {
            name: 'Physics2',
            type: 'Physics2::Physics2Behavior',
            angularDamping: 0.1,
            bodyType: 'Dynamic',
            bullet: false,
            canSleep: true,
            density: 1,
            fixedRotation: false,
            friction: 0.3,
            gravityScale: 1,
            layers: 3,
            linearDamping: 0.1,
            masks: 5,
            restitution: 0.1,
            shape: 'Box',
          },
        ],
      },
    ];
    legacyProject.layouts[0].events = [
      {
        type: 'BuiltinCommonInstructions::Standard',
        conditions: [],
        actions: [
          {
            type: { value: 'Physics2::Remove joint' },
            parameters: ['Object', 'PhysicsBehavior', 'MouseJointID'],
          },
        ],
      },
    ];
    try {
      unserializeFromJSObject(project, legacyProject);
      await onSaveProject(
        project,
        ({
          fileIdentifier: entryPath,
          name: project.getName(),
          gameId: project.getProjectUuid(),
          lastModifiedDate: 0,
        }: any),
        undefined,
        {
          showAlert: jest.fn(),
          showConfirmation: jest.fn(),
        }
      );

      const eventsSource = fs.readFileSync(
        path.join(temporaryDirectory, 'scenes/Main/functions/sceneUpdate.gdl'),
        'utf8'
      );
      expect(eventsSource).toContain('removeJoint');
      expect(eventsSource).not.toContain('@exact');
      const objectSource = fs.readFileSync(
        path.join(temporaryDirectory, 'scenes/Main/objects/Body.gdl'),
        'utf8'
      );
      expect(objectSource).toContain('layers = 3');
      expect(objectSource).toContain('masks = 5');
      const sceneSource = fs.readFileSync(
        path.join(temporaryDirectory, 'scenes/Main/scene.gdl'),
        'utf8'
      );
      expect(sceneSource).toContain('scaleX = 120');
      expect(sceneSource).toContain('scaleY = 80');
      const reopened = await openMultiFileProject(entryPath);
      expect(reopened.layouts[0].behaviorsSharedData).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'Physics2::Physics2Behavior',
            scaleX: 120,
            scaleY: 80,
          }),
        ])
      );
      expect(reopened.layouts[0].events[0].actions[0]).toMatchObject({
        type: { value: 'Physics2::Remove joint' },
        parameters: ['Object', 'PhysicsBehavior', 'MouseJointID'],
      });
      expect(reopened.layouts[0].objects[0].behaviors[0]).toMatchObject({
        type: 'Physics2::Physics2Behavior',
        layers: 3,
        masks: 5,
      });
    } finally {
      project.delete();
      gd.JsPlatform.get().removeExtension('Physics2');
    }
  });

  test('preserves registered Physics3D fields in DSL and generated game data', async () => {
    const gd: libGDevelop = global.gd;
    const hiddenPhysics3DProperties = [
      ['meshShapeResourceName', 'PrivateCollider.glb', 'PrivateCollider.glb'],
      ['shapeOffsetX', '12', 12],
      ['shapeOffsetY', '13', 13],
      ['shapeOffsetZ', '14', 14],
      ['massCenterOffsetX', '34', 34],
      ['massCenterOffsetY', '35', 35],
      ['massCenterOffsetZ', '36', 36],
    ];
    // $FlowFixMe[cannot-resolve-module] The extension is loaded by the app in production.
    const physics3DExtensionModule = require('../../../../../Extensions/Physics3DBehavior/JsExtension');
    const physics3DExtension = physics3DExtensionModule.createExtension(
      message => message,
      gd
    );
    gd.JsPlatform.get().addNewExtension(physics3DExtension);
    physics3DExtension.delete();
    const project = gd.ProjectHelper.createNewGDJSProject();
    const entryPath = path.join(temporaryDirectory, 'project.gdl');
    const legacyProject = JSON.parse(JSON.stringify(projectFixture));
    legacyProject.properties.name = 'Physics3D hidden property regression';
    legacyProject.properties.platforms = [{ name: 'GDevelop JS platform' }];
    legacyProject.properties.currentPlatform = 'GDevelop JS platform';
    legacyProject.layouts[0].objects = [
      {
        name: 'Body',
        type: 'Sprite',
        behaviors: [
          {
            name: 'Physics3D',
            type: 'Physics3D::Physics3DBehavior',
            angularDamping: 0.1,
            bodyType: 'Static',
            bullet: false,
            density: 1,
            fixedRotation: false,
            friction: 0.3,
            gravityScale: 1,
            layers: 5,
            linearDamping: 0.1,
            massOverride: 0,
            masks: 9,
            object3D: '',
            restitution: 0.1,
            shape: 'Box',
            shapeOrientation: 'Z',
          },
        ],
      },
    ];
    try {
      unserializeFromJSObject(project, legacyProject);
      const behavior = project
        .getLayout('Main')
        .getObjects()
        .getObject('Body')
        .getBehavior('Physics3D');
      const beforePropertyRead = serializeToJSObject(project, 'serializeTo')
        .layouts[0].objects[0].behaviors[0];
      behavior.getProperties();
      const afterPropertyRead = serializeToJSObject(project, 'serializeTo')
        .layouts[0].objects[0].behaviors[0];
      expect(afterPropertyRead).toEqual(beforePropertyRead);
      hiddenPhysics3DProperties.forEach(([propertyName, propertyValue]) => {
        expect(behavior.updateProperty(propertyName, propertyValue)).toBe(true);
      });
      await onSaveProject(
        project,
        ({
          fileIdentifier: entryPath,
          name: project.getName(),
          gameId: project.getProjectUuid(),
          lastModifiedDate: 0,
        }: any),
        undefined,
        {
          showAlert: jest.fn(),
          showConfirmation: jest.fn(),
        }
      );

      const objectSource = fs.readFileSync(
        path.join(temporaryDirectory, 'scenes/Main/objects/Body.gdl'),
        'utf8'
      );
      const gdlCatalog = JSON.parse(
        fs.readFileSync(
          path.join(temporaryDirectory, '.gdevelop/gdl-catalog.json'),
          'utf8'
        )
      );
      const generatedGameJson = JSON.parse(
        fs.readFileSync(
          path.join(temporaryDirectory, GENERATED_LEGACY_PROJECT_RELATIVE_PATH),
          'utf8'
        )
      );
      const generatedBehavior =
        generatedGameJson.layouts[0].objects[0].behaviors[0];
      expect(objectSource).toContain('bodyType = "Static"');
      expect(
        gdlCatalog.behaviorTypes
          .find(t => t.type === 'Physics3D::Physics3DBehavior')
          .serializedProperties.map(p => p.serializedKey)
      ).toContain('layers');
      expect(
        gdlCatalog.behaviorTypes
          .find(t => t.type === 'Physics3D::Physics3DBehavior')
          .serializedProperties.map(p => p.serializedKey)
      ).toContain('masks');
      expect(objectSource).toContain('layers = 5');
      expect(objectSource).toContain('masks = 9');
      expect(generatedBehavior).toMatchObject({ layers: 5, masks: 9 });
      hiddenPhysics3DProperties.forEach(([propertyName, , serializedValue]) => {
        expect(
          gdlCatalog.behaviorTypes
            .find(t => t.type === 'Physics3D::Physics3DBehavior')
            .serializedProperties.map(p => p.serializedKey)
        ).toContain(propertyName);
        expect(objectSource).toContain(propertyName);
        expect(generatedBehavior).toHaveProperty(propertyName, serializedValue);
      });
    } finally {
      project.delete();
      gd.JsPlatform.get().removeExtension('Physics3D');
    }
  });

  test('writes the default scene sources on the first project save', async () => {
    const gd: libGDevelop = global.gd;
    const project = gd.ProjectHelper.createNewGDJSProject();
    project.setName('New game');
    ensureProjectHasDefaultScene(project);

    await onSaveProject(
      project,
      ({
        fileIdentifier: path.join(temporaryDirectory, 'project.gdl'),
        name: project.getName(),
        gameId: project.getProjectUuid(),
        lastModifiedDate: 0,
      }: any),
      undefined,
      {
        showAlert: jest.fn(),
        showConfirmation: jest.fn(),
      }
    );

    const sceneDirectory = path.join(temporaryDirectory, 'scenes', 'Game');
    expect(fs.existsSync(path.join(sceneDirectory, 'scene.gdl'))).toBe(true);
    expect(
      fs.readFileSync(path.join(sceneDirectory, 'scene.gdl'), 'utf8')
    ).toContain('layer {');
    expect(
      fs.readFileSync(path.join(sceneDirectory, 'scene.gdl'), 'utf8')
    ).not.toContain('sceneLifecycleFunctions');
    expect(
      fs.existsSync(path.join(sceneDirectory, 'functions/sceneUpdate.gdl'))
    ).toBe(true);
    project.delete();
  });

  test('rejects an unregistered behavior property without compatibility preservation', async () => {
    const gd: libGDevelop = global.gd;
    const project = gd.ProjectHelper.createNewGDJSProject();
    const extensionName = 'LegacyJoystickPropertyTest';
    project.setName('Legacy joystick property');
    ensureProjectHasDefaultScene(project);

    const extension = project.insertNewEventsFunctionsExtension(
      extensionName,
      0
    );
    const behaviorDefinition = insertNewEventsBasedBehavior(extension);
    behaviorDefinition.setName('MultitouchJoystick');
    behaviorDefinition.setFullName('Multitouch joystick');
    behaviorDefinition
      .getPropertyDescriptors()
      .insertNew('ControllerIdentifier', 0)
      .setType('Number')
      .setValue('1');
    reloadProjectEventsFunctionsExtensionMetadata(
      project,
      extension,
      ({
        getIncludeFileFor: () => 'generated.js',
        writeFunctionCode: async () => {},
        writeBehaviorCode: async () => {},
        writeObjectCode: async () => {},
      }: any),
      ({ _: value => (typeof value === 'string' ? value : value.id) }: any)
    );

    const object = project
      .getLayoutAt(0)
      .getObjects()
      .insertNewObject(project, 'Sprite', 'Border', 0);
    const behavior = object.addNewBehavior(
      project,
      `${extensionName}::MultitouchJoystick`,
      'MultitouchJoystick'
    );
    if (!behavior) throw new Error('Expected the behavior to be created.');
    const legacyProject = serializeToJSObject(project, 'serializeTo');
    legacyProject.layouts[0].objects[0].behaviors[0].FloatingEnabled = false;
    unserializeFromJSObject(project, legacyProject);
    expect(
      serializeToJSObject(project, 'serializeTo').layouts[0].objects[0]
        .behaviors[0]
    ).toHaveProperty('FloatingEnabled', false);

    try {
      const entryPath = path.join(temporaryDirectory, 'project.gdl');
      await expect(
        onSaveProject(project, { fileIdentifier: entryPath }, undefined, {
          showAlert: jest.fn(),
          showConfirmation: jest.fn(),
        })
      ).rejects.toMatchObject({ code: 'SETTINGS_UNKNOWN_FIELD' });
    } finally {
      project.delete();
      gd.JsPlatform.get().removeExtension(extensionName);
    }
  });

  test('rolls back an interrupted staged transaction', async () => {
    const target = path.join(temporaryDirectory, 'scenes/Main/Main.events');
    fs.ensureDirSync(path.dirname(target));
    fs.writeFileSync(target, 'new content', 'utf8');
    const transactionRoot = path.join(
      temporaryDirectory,
      '.gdevelop/transactions/interrupted'
    );
    const backup = path.join(transactionRoot, 'backup/scenes/Main/Main.events');
    fs.ensureDirSync(path.dirname(backup));
    fs.writeFileSync(backup, 'old content', 'utf8');
    fs.writeFileSync(
      path.join(transactionRoot, 'journal.json'),
      JSON.stringify({
        version: 1,
        state: 'staged',
        changedUris: ['game://scenes/Main/Main.events'],
      }),
      'utf8'
    );

    await recoverMultiFileTransactions(temporaryDirectory);
    expect(fs.readFileSync(target, 'utf8')).toBe('old content');
    expect(fs.existsSync(transactionRoot)).toBe(false);
    expect(fs.existsSync(path.dirname(transactionRoot))).toBe(false);
  });
});
