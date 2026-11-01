// @noflow
import { generateGdlJavaScript } from './McpGdlJavaScript';
import { createMcpEditorBridge } from './McpEditorBridge';
import { serializeToJSObject } from '../Utils/Serializer';
import { decomposeLegacyProjectToFiles } from '../ProjectsStorage/MultiFileProjectFormat';
import { writeMultiFileSourceTree } from '../ProjectsStorage/LocalFileStorageProvider/LocalMultiFileProject';
import { replaceEmbeddedEventBody } from '../ProjectsStorage/SettingsDsl/TestHelpers';
import * as Generation from '../EventsSheet/GenerateEventsCode';
import * as SourceTree from '../ProjectsStorage/LocalFileStorageProvider/LocalMultiFileProject';
import {
  reloadProjectEventsFunctionsExtensionMetadata,
  unloadProjectEventsFunctionsExtension,
} from '../EventsFunctionsExtensionsLoader';
import { getSettingsSchemas } from '../ProjectsStorage/SettingsDsl';

const fs = require('fs');
const os = require('os');
const path = require('path');
const gd = global.gd;
const sceneFile = 'scenes/Game/functions/sceneUpdate.gdl';

// Exercise real disk composition, catalogs, native generation and MCP routing.
// Editor memory deliberately has empty events while disk has a JS sentinel.
describe('generate_gdl_javascript', () => {
  let directory, project, bridge, files;
  const call = async (name, args = {}) => {
    const response = await bridge.handleRendererMcpRequest({
      method: 'tools/call',
      params: { name, arguments: args },
    });
    const result = JSON.parse(response.content[0].text);
    if (response.isError) throw new Error(JSON.stringify(result));
    return result;
  };
  beforeEach(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gdl-js-review-'));
    project = gd.ProjectHelper.createNewGDJSProject();
    project.setProjectFile(path.join(directory, 'project.gdl'));
    project.insertNewLayout('Game', 0);
    const extension = project.insertNewEventsFunctionsExtension(
      'ReviewTest',
      0
    );
    extension
      .getEventsFunctions()
      .insertNewEventsFunction('Run', 0)
      .setFunctionType(gd.EventsFunction.Action);
    const behavior = extension
      .getEventsBasedBehaviors()
      .insertNew('Movement', 0);
    behavior
      .getEventsFunctions()
      .insertNewEventsFunction('Step', 0)
      .setFunctionType(gd.EventsFunction.Action);
    const object = extension.getEventsBasedObjects().insertNew('Actor', 0);
    object
      .getEventsFunctions()
      .insertNewEventsFunction('Step', 0)
      .setFunctionType(gd.EventsFunction.Action);
    files = decomposeLegacyProjectToFiles({
      ...serializeToJSObject(project),
      constants: JSON.parse(project.getConstantsJson()),
    });
    files['game://' + sceneFile] = replaceEmbeddedEventBody(
      files['game://' + sceneFile],
      `function {
  events {
    javascript {
      strict = true
      code = "globalThis.diskReviewSentinel = 42;"
    }
  }
}`
    );
    await writeMultiFileSourceTree({
      entryPath: project.getProjectFile(),
      files,
    });
    bridge = createMcpEditorBridge({
      getProject: () => project,
      getPermissions: () => ({
        allowWriteTools: false,
        allowCommandTools: false,
      }),
      i18n: { _: message => message.id },
      editorCallbacks: {},
      processEditorFunctionCalls: jest.fn(),
      triggerUnsavedChanges: jest.fn(),
      runCommand: jest.fn(),
    });
    await call('generate-catalogs');
  });
  afterEach(() => {
    jest.restoreAllMocks();
    project.delete();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  it('routes through MCP, generates current disk code and preserves sources, catalogs and editor state', async () => {
    const source = fs.readFileSync(path.join(directory, sceneFile), 'utf8');
    const catalog = fs.readFileSync(
      path.join(directory, '.gdevelop/actions-catalog.json'),
      'utf8'
    );
    const before = serializeToJSObject(project);
    const settings = getSettingsSchemas();
    const result = await call('generate_gdl_javascript', { file: sceneFile });
    expect(result).toMatchObject({
      success: true,
      generatedScope: 'scene',
      owner: { scene: 'Game' },
      includesOtherFunctions: true,
      runtimeVerified: false,
      mode: 'runtime',
    });
    const code = fs.readFileSync(result.artifacts[0].path, 'utf8');
    expect(code).toContain('diskReviewSentinel = 42');
    expect(result.artifacts[0].characters).toBe(code.length);
    expect(result.artifacts[0].path).toContain('tmp/gdl-javascript-review/');
    expect(fs.readFileSync(path.join(directory, sceneFile), 'utf8')).toBe(
      source
    );
    expect(
      fs.readFileSync(
        path.join(directory, '.gdevelop/actions-catalog.json'),
        'utf8'
      )
    ).toBe(catalog);
    expect(serializeToJSObject(project)).toEqual(before);
    expect(getSettingsSchemas()).toEqual(settings);
    const second = await generateGdlJavaScript(project, { file: sceneFile });
    expect(second.sourceSnapshot).toBe(result.sourceSnapshot);
    fs.writeFileSync(
      path.join(directory, sceneFile),
      source.replace('= 42;', '= 43;')
    );
    const changed = await generateGdlJavaScript(project, { file: sceneFile });
    expect(changed.sourceSnapshot).not.toBe(result.sourceSnapshot);
    expect(fs.readFileSync(changed.artifacts[0].path, 'utf8')).toContain(
      'diskReviewSentinel = 43'
    );
  });
  it.each([
    ['extensions/ReviewTest/functions/Run.gdl', 'function'],
    ['extensions/ReviewTest/behaviors/Movement/functions/Step.gdl', 'behavior'],
    ['extensions/ReviewTest/prefabs/Actor/functions/Step.gdl', 'object'],
  ])('generates real native code for %s', async (file, generatedScope) => {
    const result = await generateGdlJavaScript(project, { file });
    expect(result.generatedScope).toBe(generatedScope);
    expect(
      fs.readFileSync(result.artifacts[0].path, 'utf8').length
    ).toBeGreaterThan(20);
    expect(gd.JsPlatform.get().isExtensionLoaded('ReviewTest')).toBe(false);
  });
  it('generates picking and loop fixtures through the disk-file tool', async () => {
    const serialized = { ...serializeToJSObject(project), constants: {} };
    serialized.eventsFunctionsExtensions = [];
    serialized.layouts[0].name = 'Main';
    fs.rmSync(path.join(directory, 'scenes/Game'), {
      recursive: true,
      force: true,
    });
    serialized.layouts[0].objects = ['Player', 'Coin', 'Enemy'].map(name => ({
      name,
      type: 'Sprite',
      variables: [],
      behaviors: [],
    }));
    serialized.layouts[0].variables = [
      { name: 'Score', type: 'number', value: 0 },
    ];
    files = decomposeLegacyProjectToFiles(serialized);
    const file = 'scenes/Main/functions/sceneUpdate.gdl';
    const source = files['game://' + file];
    const actions = `actions {
  deleteObject {
    object = Coin
  }
  setNumberVariable {
    variable = "Score"
    modification_sign = "+"
    value = 1
  }
}`;
    const filter = `conditions {
  collision {
    first_object = Player
    second_object = Coin
  }
}`;
    const cases = [
      {
        name: 'tool-multi-delete-single-score',
        body: `event {\n${filter}\n${actions}\n}`,
        score: 1,
      },
      {
        name: 'tool-post-filter-for-each',
        body: `event {\n${filter}\nfor_each {\nobject = Coin\n${actions}\n}\n}`,
        score: 2,
      },
      {
        name: 'tool-parent-pick-all-child-selection',
        body: `event {\n${filter}\nactions {\npickAllInstances {\nobject = Coin\n}\n}\nevent {\n${actions}\n}\n}`,
        score: 1,
        coins: 0,
      },
    ];
    const fixtures = [];
    for (const fixture of cases) {
      files['game://' + file] = replaceEmbeddedEventBody(
        source,
        `function {\n events {\n${fixture.body}\n}\n}`
      );
      await writeMultiFileSourceTree({
        entryPath: project.getProjectFile(),
        files,
      });
      await call('generate-catalogs');
      const result = await generateGdlJavaScript(project, { file });
      const code = fs.readFileSync(result.artifacts[0].path, 'utf8');
      expect(code).toContain('Coin');
      expect(code).toContain('.add(1)');
      fixtures.push({
        ...fixture,
        coins: fixture.coins === undefined ? 1 : fixture.coins,
        code,
      });
    }
    if (process.env.GDEVELOP_UNIFIED_RUNTIME_FIXTURE)
      fs.appendFileSync(
        process.env.GDEVELOP_UNIFIED_RUNTIME_FIXTURE,
        `window.__gdlToolFixtures = ${JSON.stringify(fixtures)};\n`
      );
  });
  it('requires real caller context for fragments and supports transitive and cross-scene callers', async () => {
    const serialized = { ...serializeToJSObject(project), constants: {} };
    serialized.layouts.push({ ...serialized.layouts[0], name: 'Other' });
    serialized.externalEvents = [
      { name: 'Combat', associatedLayout: 'Game', events: [] },
      { name: 'Wrapper', associatedLayout: 'Game', events: [] },
    ];
    files = decomposeLegacyProjectToFiles(serialized);
    const combat = 'scenes/Game/external-events/Combat.gdl';
    const wrapper = 'scenes/Game/external-events/Wrapper.gdl';
    const other = 'scenes/Other/functions/sceneUpdate.gdl';
    const body = target =>
      `function {\n  events {\n    link {\n      target = "${target}"\n    }\n  }\n}`;
    files['game://' + sceneFile] = replaceEmbeddedEventBody(
      files['game://' + sceneFile],
      body('Wrapper')
    );
    files['game://' + other] = replaceEmbeddedEventBody(
      files['game://' + other],
      body('Combat')
    );
    files['game://' + wrapper] = replaceEmbeddedEventBody(
      files['game://' + wrapper],
      body('Combat')
    );
    await writeMultiFileSourceTree({
      entryPath: project.getProjectFile(),
      files,
    });
    await call('generate-catalogs');
    await expect(
      generateGdlJavaScript(project, { file: combat })
    ).rejects.toMatchObject({ code: 'context-required' });
    await expect(
      generateGdlJavaScript(project, {
        file: combat,
        context_file: 'extensions/ReviewTest/functions/Run.gdl',
      })
    ).rejects.toMatchObject({ code: 'invalid-context' });
    const result = await generateGdlJavaScript(project, {
      file: combat,
      context_file: sceneFile,
    });
    expect(result.owner).toEqual({ scene: 'Game' });
    const crossScene = await generateGdlJavaScript(project, {
      file: combat,
      context_file: other,
    });
    expect(crossScene.owner).toEqual({ scene: 'Other' });
    const source = files['game://' + wrapper];
    fs.writeFileSync(
      path.join(directory, wrapper),
      replaceEmbeddedEventBody(source, body('Wrapper'))
    );
    await expect(
      generateGdlJavaScript(project, { file: combat, context_file: sceneFile })
    ).rejects.toMatchObject({ code: 'invalid-link' });
    fs.writeFileSync(
      path.join(directory, wrapper),
      replaceEmbeddedEventBody(source, 'function {\n  events {}\n}')
    );
    await expect(
      generateGdlJavaScript(project, { file: combat, context_file: sceneFile })
    ).rejects.toMatchObject({ code: 'invalid-context' });
  });
  it('rejects configuration, unmanaged paths, stale catalogs and pending transactions', async () => {
    await expect(
      generateGdlJavaScript(project, { file: 'scenes/Game/scene.gdl' })
    ).rejects.toMatchObject({ code: 'unsupported-file-kind' });
    for (const file of [
      '../outside.gdl',
      path.join(directory, sceneFile),
      'scenes/Game/functions/missing.gdl',
    ])
      await expect(
        generateGdlJavaScript(project, { file })
      ).rejects.toMatchObject({ code: 'invalid-file' });
    const entry = path.join(directory, 'project.gdl');
    const source = fs.readFileSync(entry, 'utf8');
    fs.writeFileSync(
      entry,
      source.replace(/name = "[^"]*"/, 'name = "Changed"')
    );
    await expect(
      generateGdlJavaScript(project, { file: sceneFile })
    ).rejects.toMatchObject({ code: 'catalog-stale' });
    fs.mkdirSync(path.join(directory, '.gdevelop/transactions/pending'), {
      recursive: true,
    });
    await expect(
      generateGdlJavaScript(project, { file: sceneFile })
    ).rejects.toMatchObject({ code: 'MULTIFILE_PENDING_TRANSACTION' });
    expect(
      fs.existsSync(path.join(directory, '.gdevelop/transactions/pending'))
    ).toBe(true);
  });
  it('rejects a symlink cache without writing outside the project', async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'gdl-js-outside-'));
    try {
      fs.symlinkSync(outside, path.join(directory, 'tmp'), 'dir');
      await expect(
        generateGdlJavaScript(project, { file: sceneFile })
      ).rejects.toMatchObject({ code: 'invalid-cache-path' });
      expect(fs.readdirSync(outside)).toEqual([]);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });
  it('restores loaded editor extension metadata even when native generation fails', async () => {
    const extension = project.getEventsFunctionsExtension('ReviewTest');
    reloadProjectEventsFunctionsExtensionMetadata(
      project,
      extension,
      {
        getIncludeFileFor: name => `/editor-live/${name}.js`,
        writeFunctionCode: async () => {},
        writeBehaviorCode: async () => {},
        writeObjectCode: async () => {},
      },
      { _: value => (typeof value === 'string' ? value : value.id) }
    );
    const platform = gd.JsPlatform.get();
    const includes = () =>
      gd.MetadataProvider.getActionMetadata(platform, 'ReviewTest::Run')
        .getIncludeFiles()
        .toJSArray();
    const original = includes();
    try {
      const generate = jest.spyOn(Generation, 'generateEventsCodeForScope');
      generate.mockImplementation(() => {
        expect(includes()).not.toEqual(original);
        throw new Error('native failure');
      });
      await expect(
        generateGdlJavaScript(project, { file: sceneFile })
      ).rejects.toThrow('native failure');
      expect(includes()).toEqual(original);
    } finally {
      unloadProjectEventsFunctionsExtension(project, 'ReviewTest');
    }
  });
  it('reports compiler and generated-JS errors without publishing artifacts', async () => {
    const spy = jest
      .spyOn(Generation, 'generateEventsCodeForScope')
      .mockReturnValue({ error: 'compiler failed', code: null });
    await expect(
      generateGdlJavaScript(project, { file: sceneFile })
    ).rejects.toThrow('compiler failed');
    spy.mockReturnValue({ code: 'const = ;', diagnostics: [] });
    await expect(
      generateGdlJavaScript(project, { file: sceneFile })
    ).rejects.toThrow();
    spy.mockReturnValue({
      code: 'true;',
      diagnostics: [{ message: 'invalid expression' }],
    });
    await expect(
      generateGdlJavaScript(project, { file: sceneFile })
    ).rejects.toMatchObject({ code: 'generation-failed' });
    spy.mockReturnValue({
      code: ' '.repeat(16 * 1024 * 1024 + 1),
      diagnostics: [],
    });
    await expect(
      generateGdlJavaScript(project, { file: sceneFile })
    ).rejects.toMatchObject({ code: 'resource-limit' });
    expect(
      fs.existsSync(path.join(directory, 'tmp/gdl-javascript-review'))
    ).toBe(false);
  });
  it('rejects mixed source snapshots and concurrent generation', async () => {
    const read = SourceTree.readMultiFileSourceTree;
    let count = 0;
    jest
      .spyOn(SourceTree, 'readMultiFileSourceTree')
      .mockImplementation(async (...args) => {
        const result = await read(...args);
        if (++count === 2)
          result.files['game://' + sceneFile] += '\n// changed\n';
        return result;
      });
    const first = generateGdlJavaScript(project, { file: sceneFile });
    await expect(
      generateGdlJavaScript(project, { file: sceneFile })
    ).rejects.toMatchObject({ code: 'busy' });
    await expect(first).rejects.toMatchObject({ code: 'stale' });
  });
});
