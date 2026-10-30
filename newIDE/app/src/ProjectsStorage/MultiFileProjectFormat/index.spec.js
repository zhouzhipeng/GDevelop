// @flow

import {
  MULTI_FILE_CONSTANTS_URI,
  MULTI_FILE_ENTRY_URI,
  MULTI_FILE_FORMAT_VERSION,
  MultiFileProjectError,
  areLegacyProjectsEquivalent,
  composeLegacyProjectFromFiles,
  decomposeLegacyProjectToFiles,
  encodeManagedName,
  getLegacyProjectFirstDifferenceDescription,
  parseConstantsFromToml,
  removeLegacyFolderStructuresFromProject,
  serializeConstantsToToml,
  validateGameUri,
} from './index';
import { decodeSettingsDocument } from '../SettingsDsl';
const standardEvent = () => ({
  type: 'BuiltinCommonInstructions::Standard',
  conditions: [],
  actions: [],
});

const functionObject = (name: string) => ({
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
  events: [standardEvent()],
});

const projectFixture = {
  gdVersion: { major: 5, minor: 6, build: 0, revision: 0 },
  properties: {
    name: 'Multi-file test',
    projectUuid: 'project-id',
    folderProject: false,
  },
  resources: {
    resources: [
      {
        file: 'assets/Player.png',
        kind: 'image',
        metadata: '',
        name: 'Player.png',
        smoothed: true,
        userAdded: true,
      },
    ],
    resourceFolders: [],
  },
  objects: [],
  objectsFolderStructure: { folderName: '__ROOT', children: [] },
  objectsGroups: [],
  variables: [],
  constants: {
    enabled: true,
    rawJson: { userOwned: 'kept' },
    sheet: {
      row: { column: 'ssdfs', column2: 'ss' },
      row2: { column: 'zzz', column2: 'ssfssdfsf' },
    },
  },
  firstLayout: 'Main',
  previewLayout: 'Main',
  layouts: [
    {
      name: 'Main',
      mangledName: 'Main',
      r: 12,
      v: 34,
      b: 56,
      title: 'Game',
      standardSortMethod: true,
      stopSoundsOnStartup: true,
      renderer3DWorldScale: 42.5,
      disableInputWhenNotFocused: true,
      variables: [],
      objectsGroups: [],
      behaviorsSharedData: [],
      uiSettings: { grid: false },
      objects: [],
      objectsFolderStructure: { folderName: '__ROOT', children: [] },
      instances: [],
      layers: [{ name: '', visibility: true, isLocked: false }],
      events: [standardEvent()],
    },
  ],
  externalEvents: [
    {
      name: 'Shared Combat',
      associatedLayout: 'Main',
      events: [standardEvent()],
    },
  ],
  externalLayouts: [
    {
      name: 'Shared Combat',
      associatedLayout: 'Main',
      instances: [],
      editionSettings: { grid: false },
    },
  ],
  eventsFunctionsExtensions: [
    {
      name: 'Combat',
      fullName: 'Combat',
      version: '1.0.0',
      description: ['Combat helpers'],
      eventsFunctionsFolderStructure: { folderName: '__ROOT', children: [] },
      eventsFunctions: [functionObject('CalculateDamage')],
      eventsBasedObjects: [
        {
          name: 'Enemy',
          fullName: 'Enemy',
          description: 'Enemy prefab',
          areaMinX: 0,
          areaMinY: 0,
          areaMinZ: 0,
          areaMaxX: 64,
          areaMaxY: 64,
          areaMaxZ: 64,
          objects: [],
          objectsFolderStructure: { folderName: '__ROOT', children: [] },
          objectsGroups: [],
          layers: [],
          instances: [],
          editionSettings: {},
          eventsFunctions: [functionObject('TakeDamage')],
          variants: [
            {
              name: 'Armored',
              assetStoreAssetId: '',
              areaMinX: 0,
              areaMinY: 0,
              areaMinZ: 0,
              areaMaxX: 96,
              areaMaxY: 96,
              areaMaxZ: 96,
              objects: [],
              objectsFolderStructure: {
                folderName: '__ROOT',
                children: [],
              },
              objectsGroups: [],
              layers: [],
              instances: [],
              editionSettings: {},
            },
          ],
        },
      ],
      eventsBasedBehaviors: [
        {
          name: 'Health',
          fullName: 'Health',
          description: 'Health behavior',
          eventsFunctions: [functionObject('Heal')],
        },
      ],
    },
  ],
};

describe('GDevelop Language (GDL) multi-file project format', () => {
  test('writes only DSL for every component and round trips the complete project', () => {
    const files = decomposeLegacyProjectToFiles(projectFixture);
    Object.entries(files)
      .filter(([uri]) => uri.endsWith('.gdl') || uri === MULTI_FILE_ENTRY_URI)
      .forEach(([uri, source]) => {
        const decoded = decodeSettingsDocument(source, uri);
        expect(decoded.kind).toBeTruthy();
        expect(source).not.toContain('settingsFormatVersion');
        expect(source).not.toContain('[layout]');
      });
    expect(
      areLegacyProjectsEquivalent(
        projectFixture,
        composeLegacyProjectFromFiles(files)
      )
    ).toBe(true);
    expect(
      decomposeLegacyProjectToFiles(composeLegacyProjectFromFiles(files))
    ).toEqual(files);
  });
  test('rejects TOML and an incorrect project format without fallback', () => {
    const files = decomposeLegacyProjectToFiles(projectFixture);
    for (const source of [
      'kind = "project"\nsettingsFormatVersion = 7\n',
      files[MULTI_FILE_ENTRY_URI].replace(
        'formatVersion = 14',
        'formatVersion = 11'
      ),
    ]) {
      expect(() =>
        composeLegacyProjectFromFiles({
          ...files,
          [MULTI_FILE_ENTRY_URI]: source,
        })
      ).toThrow();
    }
  });
  test('rejects arbitrary scene properties and nested layout wrappers', () => {
    const files = decomposeLegacyProjectToFiles(projectFixture);
    const uri = Object.keys(files).find(uri => uri.endsWith('/scene.gdl'));
    if (!uri) throw new Error('Scene settings fixture is missing.');
    for (const field of ['madeUp = 1', 'layout {}', 'settings {}'])
      expect(() =>
        composeLegacyProjectFromFiles({
          ...files,
          [uri]: files[uri].replace('scene {', `scene {\n  ${field}`),
        })
      ).toThrow();
  });
  test('keeps Constants TOML separate from the GDevelop Language (GDL)', () => {
    const constants = { sheet: { value: 42 }, enabled: true };
    expect(parseConstantsFromToml(serializeConstantsToToml(constants))).toEqual(
      constants
    );
  });

  test('decodes multiline gameplay test sources from the legacy serializer', () => {
    const project = {
      ...projectFixture,
      tests: [
        {
          name: 'New test',
          type: 'gameplay',
          description: '',
          source: ['await harness.stepFrames(1);', '// Done.', ''],
        },
      ],
    };

    const files = decomposeLegacyProjectToFiles(project);
    expect(files['game://tests/New%20test.js']).toBe(
      'await harness.stepFrames(1);\n// Done.\n'
    );
    expect(composeLegacyProjectFromFiles(files).tests[0].source).toBe(
      'await harness.stepFrames(1);\n// Done.\n'
    );
  });

  test('allocates deterministic flat names for normalized gameplay test collisions', () => {
    const project = {
      ...projectFixture,
      tests: [
        {
          name: 'Smoke',
          type: 'gameplay',
          description: '',
          source: 'first {}',
        },
        {
          name: 'smoke',
          type: 'gameplay',
          description: '',
          source: 'second {}',
        },
      ],
    };
    const files = decomposeLegacyProjectToFiles(project);
    const sourceUris = Object.keys(files).filter(uri =>
      uri.startsWith('game://tests/')
    );
    expect(sourceUris).toHaveLength(2);
    expect(
      sourceUris.every(uri =>
        /^game:\/\/tests\/[^/]+~[0-9a-f]{8}\.js$/.test(uri)
      )
    ).toBe(true);
    expect(
      areLegacyProjectsEquivalent(project, composeLegacyProjectFromFiles(files))
    ).toBe(true);
  });

  test('describes the first normalized verification difference without dumping large values', () => {
    const left = {
      ...projectFixture,
      layouts: [
        {
          ...projectFixture.layouts[0],
          title: 'A'.repeat(200),
        },
      ],
    };
    const right = {
      ...projectFixture,
      layouts: [
        {
          ...projectFixture.layouts[0],
          title: `${'A'.repeat(100)}B${'A'.repeat(99)}`,
        },
      ],
    };

    expect(getLegacyProjectFirstDifferenceDescription(left, right)).toBe(
      '$.layouts[0].title: strings differ at character 100 (original length 200, reconstructed length 200).'
    );
    expect(getLegacyProjectFirstDifferenceDescription(left, left)).toBeNull();
  });

  test('treats omitted and empty trailing instruction parameters as equivalent', () => {
    const withOmittedParameters = {
      ...projectFixture,
      layouts: [
        {
          ...projectFixture.layouts[0],
          events: [
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
          ],
        },
      ],
    };
    const withEmptyParameters = {
      ...withOmittedParameters,
      layouts: [
        {
          ...withOmittedParameters.layouts[0],
          events: [
            {
              ...withOmittedParameters.layouts[0].events[0],
              conditions: [
                {
                  ...withOmittedParameters.layouts[0].events[0].conditions[0],
                  parameters: ['Player', 'Platform', '', '', ''],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(
      getLegacyProjectFirstDifferenceDescription(
        withOmittedParameters,
        withEmptyParameters
      )
    ).toBeNull();
  });

  test('ignores configured code-only instruction parameters during verification', () => {
    const withRuntimeData = {
      ...projectFixture,
      layouts: [
        {
          ...projectFixture.layouts[0],
          events: [
            {
              type: 'BuiltinCommonInstructions::Standard',
              conditions: [],
              actions: [
                {
                  type: { value: 'Extension::Action' },
                  parameters: ['Object', 'stale runtime data', 'Value'],
                },
              ],
            },
          ],
        },
      ],
    };
    const withoutRuntimeData = JSON.parse(JSON.stringify(withRuntimeData));
    withoutRuntimeData.layouts[0].events[0].actions[0].parameters[1] = '';

    expect(
      getLegacyProjectFirstDifferenceDescription(
        withRuntimeData,
        withoutRuntimeData
      )
    ).not.toBeNull();
    expect(
      getLegacyProjectFirstDifferenceDescription(
        withRuntimeData,
        withoutRuntimeData,
        {
          instructionParameterIndicesToIgnoreByType: {
            'Extension::Action': [1],
          },
        }
      )
    ).toBeNull();
  });

  test('rejects missing or mutable lifecycle function identity', () => {
    const missingUpdate = decomposeLegacyProjectToFiles(projectFixture);
    delete missingUpdate['game://scenes/Main/functions/sceneUpdate.gdl'];
    delete missingUpdate['game://scenes/Main/functions/sceneUpdate.events'];
    expect(() => composeLegacyProjectFromFiles(missingUpdate)).toThrow(
      expect.objectContaining({ code: 'MULTIFILE_MISSING_FILE' })
    );

    const mutableRole = decomposeLegacyProjectToFiles(projectFixture);
    const settingsUri = 'game://scenes/Main/functions/sceneUpdate.gdl';
    mutableRole[settingsUri] = mutableRole[settingsUri].replace(
      'lifecycleRole = "sceneUpdate"',
      'lifecycleRole = "sceneLoad"'
    );
    expect(() => composeLegacyProjectFromFiles(mutableRole)).toThrow(
      expect.objectContaining({ code: 'MULTIFILE_IDENTITY_MISMATCH' })
    );
  });

  test('round-trips instances that start hidden through layout DSL', () => {
    const project = JSON.parse(JSON.stringify(projectFixture));
    project.layouts[0].objects = [
      { name: 'Player', type: 'Sprite', behaviors: [] },
    ];
    project.layouts[0].instances.push({
      name: 'Player',
      x: 10,
      y: 20,
      angle: 0,
      zOrder: 0,
      layer: '',
      customSize: false,
      width: 0,
      height: 0,
      hidden: true,
      persistentUuid: '00000000-0000-4000-8000-000000000001',
      numberProperties: [],
      stringProperties: [],
      initialVariables: [],
    });

    const files = decomposeLegacyProjectToFiles(project);
    expect(files['game://scenes/Main/scene.gdl']).toContain('hidden = true');

    const output = composeLegacyProjectFromFiles(files);
    expect(output.layouts[0].instances[0].hidden).toBe(true);
    expect(areLegacyProjectsEquivalent(project, output)).toBe(true);
  });

  test('discovers settings by fixed folders and restores locally owned order', () => {
    const project = JSON.parse(JSON.stringify(projectFixture));
    project.eventsFunctionsExtensions[0].eventsFunctions.push(
      functionObject('ResetCombat')
    );
    project.eventsFunctionsExtensions.push({
      name: 'Support',
      fullName: 'Support',
      version: '1.0.0',
      eventsFunctionsFolderStructure: {
        folderName: '__ROOT',
        children: [],
      },
      eventsFunctions: [functionObject('Help')],
      eventsBasedObjects: [],
      eventsBasedBehaviors: [],
    });

    const files = decomposeLegacyProjectToFiles(project);
    const reversedFiles = Object.fromEntries(Object.entries(files).reverse());
    const output = composeLegacyProjectFromFiles(reversedFiles);

    expect(
      output.eventsFunctionsExtensions.map(extension => extension.name)
    ).toEqual(['Combat', 'Support']);
    expect(
      output.eventsFunctionsExtensions[0].eventsFunctions.map(
        functionObject => functionObject.name
      )
    ).toEqual(['CalculateDamage', 'ResetCombat']);
    expect(files['game://extensions/Support/extension.gdl']).toContain(
      'order = 1'
    );
    expect(
      files['game://extensions/Combat/functions/ResetCombat.gdl']
    ).toContain('order = 1');
  });

  test('requires constants.toml and preserves an empty Constants document', () => {
    const withoutConstants = JSON.parse(JSON.stringify(projectFixture));
    delete withoutConstants.constants;
    const filesWithoutConstants = decomposeLegacyProjectToFiles(
      withoutConstants
    );
    expect(filesWithoutConstants[MULTI_FILE_CONSTANTS_URI]).toBeUndefined();
    expect(() => composeLegacyProjectFromFiles(filesWithoutConstants)).toThrow(
      expect.objectContaining({ code: 'MULTIFILE_MISSING_FILE' })
    );

    const withEmptyConstants = JSON.parse(JSON.stringify(projectFixture));
    withEmptyConstants.constants = {};
    const filesWithEmptyConstants = decomposeLegacyProjectToFiles(
      withEmptyConstants
    );
    expect(filesWithEmptyConstants[MULTI_FILE_CONSTANTS_URI]).toBe('\n');
    expect(
      composeLegacyProjectFromFiles(filesWithEmptyConstants).constants
    ).toEqual({});
  });

  test('writes Constants as unwrapped root TOML data', () => {
    const project = JSON.parse(JSON.stringify(projectFixture));
    project.constants = {
      sheet: {
        row: { column: 'ssdfs', column2: 'ss' },
        row2: { column: 'zzz', column2: 'ssfssdfsf' },
      },
    };

    const files = decomposeLegacyProjectToFiles(project);

    const expectedToml = `[sheet.row]
column = "ssdfs"
column2 = "ss"

[sheet.row2]
column = "zzz"
column2 = "ssfssdfsf"
`;
    expect(files[MULTI_FILE_CONSTANTS_URI]).toBe(expectedToml);
    expect(serializeConstantsToToml(project.constants)).toBe(expectedToml);
    expect(parseConstantsFromToml(expectedToml)).toEqual(project.constants);
    expect(composeLegacyProjectFromFiles(files).constants).toEqual(
      project.constants
    );
  });

  test('rejects a discovered child settings fragment without its owner', () => {
    const files = decomposeLegacyProjectToFiles(projectFixture);
    delete files['game://extensions/Combat/extension.gdl'];

    expect(() => composeLegacyProjectFromFiles(files)).toThrow(
      expect.objectContaining({ code: 'MULTIFILE_ORPHAN_SETTINGS' })
    );
  });

  test('uses physical sources instead of every legacy logical folder tree', () => {
    const project = JSON.parse(JSON.stringify(projectFixture));
    const folder = {
      folderName: '__ROOT',
      children: [{ folderName: 'Legacy group', children: [] }],
    };
    const extension = project.eventsFunctionsExtensions[0];
    const prefab = extension.eventsBasedObjects[0];
    const behavior = extension.eventsBasedBehaviors[0];

    project.objectsFolderStructure = folder;
    project.layouts[0].objectsFolderStructure = folder;
    extension.eventsFunctionsFolderStructure = folder;
    prefab.objectsFolderStructure = folder;
    prefab.eventsFunctionsFolderStructure = folder;
    prefab.propertiesFolderStructure = folder;
    prefab.variants[0].objectsFolderStructure = folder;
    behavior.eventsFunctionsFolderStructure = folder;
    behavior.propertiesFolderStructure = folder;
    behavior.sharedPropertiesFolderStructure = folder;

    const files = decomposeLegacyProjectToFiles(project);
    const output = composeLegacyProjectFromFiles(files);

    expect(
      Object.entries(files)
        .filter(([uri]) => uri.endsWith('.gdl'))
        .some(([, source]) => /FolderStructure/.test(source))
    ).toBe(false);
    expect(
      JSON.stringify(removeLegacyFolderStructuresFromProject(output))
    ).not.toMatch(/FolderStructure/);
    expect(areLegacyProjectsEquivalent(project, output)).toBe(true);
  });

  test('rejects malformed folder grouping values', () => {
    const project = JSON.parse(JSON.stringify(projectFixture));
    project.layouts[0].objects = [
      { name: 'Player', type: 'Sprite', behaviors: [] },
    ];
    const files = decomposeLegacyProjectToFiles(project);
    const objectUri = 'game://scenes/Main/objects/Player.gdl';
    files[objectUri] = files[objectUri].replace(
      'folder = []',
      'folder = "Actors"'
    );

    expect(() => composeLegacyProjectFromFiles(files)).toThrow(
      expect.objectContaining({ code: 'SETTINGS_INVALID_TYPE' })
    );
  });

  test('rejects invalid or stray owner-function source paths', () => {
    const files = decomposeLegacyProjectToFiles(projectFixture);
    const functionUri =
      'game://extensions/Combat/prefabs/Enemy/functions/TakeDamage.gdl';
    files[functionUri] +=
      'events = "game://extensions/Combat/prefabs/Enemy/TakeDamage.events"\n';
    expect(() => composeLegacyProjectFromFiles(files)).toThrow(
      expect.objectContaining({
        code: expect.stringMatching(
          /MULTIFILE_RETIRED_FUNCTION_SOURCE|SETTINGS_SYNTAX/
        ),
      })
    );

    const filesWithStraySettings = decomposeLegacyProjectToFiles(
      projectFixture
    );
    filesWithStraySettings[
      'game://extensions/Combat/behaviors/Health/functions/Recovery/Heal/function.gdl'
    ] = `kind = "function"\nsettingsFormatVersion = ${MULTI_FILE_FORMAT_VERSION}\n`;
    expect(() => composeLegacyProjectFromFiles(filesWithStraySettings)).toThrow(
      expect.objectContaining({
        code: expect.stringMatching(
          /MULTIFILE_RETIRED_FUNCTION_SOURCE|SETTINGS_SYNTAX/
        ),
      })
    );
  });

  test('saves partially initialized prefab editor settings', () => {
    const project = JSON.parse(JSON.stringify(projectFixture));
    project.eventsFunctionsExtensions[0].eventsBasedObjects[0].editionSettings = {
      gridWidth: 16,
      gridHeight: 24,
    };
    const files = decomposeLegacyProjectToFiles(project);
    expect(
      files['game://extensions/Combat/prefabs/Enemy/prefab.gdl']
    ).toContain('grid_size = [16, 24, 32]');
    expect(
      areLegacyProjectsEquivalent(project, composeLegacyProjectFromFiles(files))
    ).toBe(true);
  });

  test('saves custom-object variants with untouched empty editor settings', () => {
    const project = JSON.parse(JSON.stringify(projectFixture));
    const variant =
      project.eventsFunctionsExtensions[0].eventsBasedObjects[0].variants[0];

    // This is the representation emitted by libGD for some newly installed
    // asset-store custom-object variants (for example StarRatingBar).
    variant.editionSettings = [];

    const files = decomposeLegacyProjectToFiles(project);
    const output = composeLegacyProjectFromFiles(files);

    expect(
      output.eventsFunctionsExtensions[0].eventsBasedObjects[0].variants[0]
        .editionSettings
    ).toEqual({});
    expect(areLegacyProjectsEquivalent(project, output)).toBe(true);
  });

  test('rejects retired standalone layout sources without a compatibility path', () => {
    const files = decomposeLegacyProjectToFiles(projectFixture);
    const layoutUri = 'game://scenes/Main/Main.layout';
    files[layoutUri] = '<layout version=1 background=#000000></layout>\n';
    expect(() => composeLegacyProjectFromFiles(files)).toThrow(
      expect.objectContaining({ code: 'MULTIFILE_RETIRED_LAYOUT_SOURCE' })
    );
  });

  test('rejects Constant values that TOML cannot represent directly', () => {
    const withNull = JSON.parse(JSON.stringify(projectFixture));
    withNull.constants.nullable = null;
    expect(() => decomposeLegacyProjectToFiles(withNull)).toThrow(
      expect.objectContaining({ code: 'MULTIFILE_UNREPRESENTABLE_VALUE' })
    );

    const withMixedArray = JSON.parse(JSON.stringify(projectFixture));
    withMixedArray.constants.mixed = [1, 'two'];
    expect(() => decomposeLegacyProjectToFiles(withMixedArray)).toThrow(
      expect.objectContaining({ code: 'MULTIFILE_UNREPRESENTABLE_VALUE' })
    );
  });

  test('treats a Constants rawJson key as ordinary user data', () => {
    const files = decomposeLegacyProjectToFiles(projectFixture);
    expect(files[MULTI_FILE_CONSTANTS_URI]).toContain('[rawJson]');
    expect(files[MULTI_FILE_CONSTANTS_URI]).toContain('userOwned = "kept"');
    expect(composeLegacyProjectFromFiles(files).constants).toEqual(
      projectFixture.constants
    );
  });

  test('does not reinterpret an arbitrary Constants variables key', () => {
    const project = JSON.parse(JSON.stringify(projectFixture));
    project.constants.variables = {};
    const files = decomposeLegacyProjectToFiles(project);
    expect(files[MULTI_FILE_CONSTANTS_URI]).toContain('variables = { }');
    expect(composeLegacyProjectFromFiles(files).constants).toEqual(
      project.constants
    );
  });

  test('accepts Git-style CRLF line endings in every settings source', () => {
    const files = decomposeLegacyProjectToFiles(projectFixture);
    Object.keys(files).forEach(uri => {
      if (
        !uri.endsWith('.gdl') &&
        !uri.endsWith('.toml') &&
        !uri.endsWith('.layout')
      )
        return;
      files[uri] = files[uri].replace(/\n/g, '\r\n');
    });

    const output = composeLegacyProjectFromFiles(files);

    expect(areLegacyProjectsEquivalent(projectFixture, output)).toBe(true);
  });

  test('uses deterministic distinct files for case-colliding object names', () => {
    const project = JSON.parse(JSON.stringify(projectFixture));
    project.layouts[0].objects = [
      { name: 'getmoney', type: 'Sprite', behaviors: [] },
      { name: 'GetMoney', type: 'Sprite', behaviors: [] },
    ];
    const files = decomposeLegacyProjectToFiles(project);
    const objectUris = Object.keys(files).filter(uri =>
      uri.startsWith('game://scenes/Main/objects/')
    );

    expect(objectUris).toHaveLength(2);
    expect(new Set(objectUris.map(uri => uri.toLowerCase())).size).toBe(2);
    expect(
      composeLegacyProjectFromFiles(files).layouts[0].objects.map(
        object => object.name
      )
    ).toEqual(['getmoney', 'GetMoney']);
  });

  test('writes and reads external events with the fragment root', () => {
    const files = decomposeLegacyProjectToFiles(projectFixture);
    const uri = 'game://scenes/Main/external-events/Shared%20Combat.gdl';
    expect(files[uri]).toMatch(/^fragment\s*\{/);
    expect(composeLegacyProjectFromFiles(files).externalEvents).toMatchObject(
      projectFixture.externalEvents
    );

    files[uri] = files[uri].replace(/^fragment\b/, 'external_events');
    expect(() => composeLegacyProjectFromFiles(files)).toThrow();
  });

  test('writes and reads external layouts with the layout root', () => {
    const files = decomposeLegacyProjectToFiles(projectFixture);
    const uri = 'game://scenes/Main/external-layout/Shared%20Combat.gdl';
    expect(files[uri]).toMatch(/^layout\s*\{/);
    expect(composeLegacyProjectFromFiles(files).externalLayouts).toEqual(
      projectFixture.externalLayouts
    );

    files[uri] = files[uri].replace(/^layout\b/, 'external');
    expect(() => composeLegacyProjectFromFiles(files)).toThrow();
  });

  test('rejects an external layout whose linked scene was removed', () => {
    const project = JSON.parse(JSON.stringify(projectFixture));
    project.externalLayouts[0].associatedLayout = 'Removed Scene';
    expect(() => decomposeLegacyProjectToFiles(project)).toThrow(
      expect.objectContaining({ code: 'MULTIFILE_EXTERNAL_SCENE_REQUIRED' })
    );
  });

  test('rejects empty external scene associations and retired external settings', () => {
    const project = JSON.parse(JSON.stringify(projectFixture));
    project.externalEvents[0].associatedLayout = '';
    expect(() => decomposeLegacyProjectToFiles(project)).toThrow(
      expect.objectContaining({ code: 'MULTIFILE_EXTERNAL_SCENE_REQUIRED' })
    );

    const files = decomposeLegacyProjectToFiles(projectFixture);
    files['game://externals/external.gdl'] = 'not valid TOML';
    expect(() => composeLegacyProjectFromFiles(files)).toThrow(
      expect.objectContaining({
        code: 'MULTIFILE_RETIRED_EXTERNAL_SETTINGS',
      })
    );
  });

  test('derives external ownership from paths and preserves empty unreferenced fragments', () => {
    const project = JSON.parse(JSON.stringify(projectFixture));
    project.layouts.push({
      ...JSON.parse(JSON.stringify(project.layouts[0])),
      name: 'Secondary',
      objects: [],
      instances: [],
      events: [],
    });
    project.externalEvents.push({
      name: 'Secondary Logic',
      associatedLayout: 'Secondary',
      events: [],
    });
    const files = decomposeLegacyProjectToFiles(project);
    expect(
      composeLegacyProjectFromFiles(files).externalEvents.map(external => ({
        name: external.name,
        associatedLayout: external.associatedLayout,
      }))
    ).toEqual([
      { name: 'Shared Combat', associatedLayout: 'Main' },
      { name: 'Secondary Logic', associatedLayout: 'Secondary' },
    ]);

    expect(
      files['game://scenes/Secondary/external-events/Secondary%20Logic.gdl']
    ).toBeDefined();
    const reordered = Object.fromEntries(Object.entries(files).reverse());
    expect(composeLegacyProjectFromFiles(reordered).externalEvents).toEqual(
      composeLegacyProjectFromFiles(files).externalEvents
    );
  });

  test('rejects link metadata and external sources outside the owning scene folder', () => {
    const filesWithLinkMetadata = decomposeLegacyProjectToFiles(projectFixture);
    const ownerSettingsUri =
      'game://scenes/Main/external-events/Shared%20Combat/external-events.gdl';
    filesWithLinkMetadata[ownerSettingsUri] = `${
      filesWithLinkMetadata[ownerSettingsUri]
    }linkedScene = "Main"\n`;
    expect(() => composeLegacyProjectFromFiles(filesWithLinkMetadata)).toThrow(
      expect.objectContaining({ code: 'MULTIFILE_INVALID_EXTERNAL_SOURCE' })
    );

    const filesWithMovedSource = decomposeLegacyProjectToFiles(projectFixture);
    const canonicalUri =
      'game://scenes/Main/external-events/Shared%20Combat.events';
    const movedUri = 'game://scenes/Main/Shared%20Combat.events';
    filesWithMovedSource[movedUri] = filesWithMovedSource[canonicalUri];
    delete filesWithMovedSource[canonicalUri];
    expect(() => composeLegacyProjectFromFiles(filesWithMovedSource)).toThrow(
      expect.objectContaining({ code: 'SETTINGS_RETIRED_EVENTS_FILE' })
    );
  });

  test('rejects retired combined external directories and orphan events bodies', () => {
    const filesWithRetiredExternalPath = decomposeLegacyProjectToFiles(
      projectFixture
    );
    const retiredOwnerUri =
      'game://scenes/Main/externals/Shared%20Combat/external-events.gdl';
    filesWithRetiredExternalPath[retiredOwnerUri] = 'kind = "externalEvents"';
    Object.keys(filesWithRetiredExternalPath)
      .filter(uri => uri.includes('/external-events/Shared%20Combat/'))
      .forEach(uri => delete filesWithRetiredExternalPath[uri]);
    expect(() =>
      composeLegacyProjectFromFiles(filesWithRetiredExternalPath)
    ).toThrow(
      expect.objectContaining({ code: 'MULTIFILE_RETIRED_EXTERNAL_SOURCE' })
    );

    const filesWithOrphanEvents = decomposeLegacyProjectToFiles(projectFixture);
    filesWithOrphanEvents[
      'game://scenes/Main/external-events/Shared%20Combat/functions/sceneLoad.events'
    ] = '';
    expect(() => composeLegacyProjectFromFiles(filesWithOrphanEvents)).toThrow(
      expect.objectContaining({ code: 'SETTINGS_RETIRED_EVENTS_FILE' })
    );
  });

  test('uses canonical safe game URIs and encoded names', () => {
    expect(encodeManagedName('Shared Combat')).toBe('Shared%20Combat');
    expect(encodeManagedName('NUL')).toBe('%4EUL');
    expect(encodeManagedName('场景')).toBe('%E5%9C%BA%E6%99%AF');
    expect(
      validateGameUri('game://scenes/Main/externals/Shared%20Combat.events')
    ).toBe('scenes/Main/externals/Shared Combat.events');
    expect(validateGameUri('game://scenes/%4EUL/scene.gdl')).toBe(
      'scenes/NUL/scene.gdl'
    );
  });

  test.each([
    '../outside.events',
    'game://../outside.events',
    'game://scenes\\Main.events',
    'game://C:/game/project.gdl',
    'game://scenes/%2e%2e/file.events',
    'game://scenes/%ZZ/file.events',
  ])('rejects unsafe managed URI %s', uri => {
    expect(() => validateGameUri(uri)).toThrow(MultiFileProjectError);
  });

  test('round-trips canonical embedded layout DSL through the multi-file project', () => {
    const files = decomposeLegacyProjectToFiles(projectFixture);
    expect(files['game://scenes/Main/scene.gdl']).toMatch(/background = /);
    expect(
      areLegacyProjectsEquivalent(
        projectFixture,
        composeLegacyProjectFromFiles(files)
      )
    ).toBe(true);
  });

  test('round-trips encoded names and sorts independent of file enumeration', () => {
    const project = JSON.parse(JSON.stringify(projectFixture));
    const names = ['中文 片段', '100%', 'CON', 'ending.', 'Z', 'A'];
    project.externalEvents = names.map(name => ({
      name,
      associatedLayout: 'Main',
      events: [],
    }));
    const files = decomposeLegacyProjectToFiles(project);
    const fragmentUris = Object.keys(files).filter(uri =>
      uri.includes('/external-events/')
    );
    expect(fragmentUris).toHaveLength(names.length);
    names.forEach(name =>
      ['gdl'].forEach(extension =>
        expect(fragmentUris).toContain(
          `game://scenes/Main/external-events/${encodeManagedName(
            `${name}.${extension}`
          )}`
        )
      )
    );
    const reversed = Object.fromEntries(Object.entries(files).reverse());
    const result = composeLegacyProjectFromFiles(reversed);
    expect(result.externalEvents.map(fragment => fragment.name)).toEqual(
      names.slice().sort()
    );
    expect(areLegacyProjectsEquivalent(project, result)).toBe(true);
  });

  test.each([['Same', 'same'], ['é', 'e\u0301']])(
    'rejects ambiguous identities %s and %s',
    (left, right) => {
      const project = JSON.parse(JSON.stringify(projectFixture));
      project.externalEvents = [left, right].map(name => ({
        name,
        associatedLayout: 'Main',
        events: [],
      }));
      expect(() => decomposeLegacyProjectToFiles(project)).toThrow(
        /NFC normalized.*unique/i
      );
    }
  );
});

describe('ActionWithOperator parameter declarations', () => {
  [0, 1, 2].forEach(implicitCount => {
    it(`persists Value with ${implicitCount} implicit parameters`, () => {
      const project = JSON.parse(JSON.stringify(projectFixture));
      const getOwner = project => {
        const extension = project.eventsFunctionsExtensions[0];
        return implicitCount === 0
          ? extension
          : implicitCount === 1
          ? extension.eventsBasedObjects[0]
          : extension.eventsBasedBehaviors[0];
      };
      const owner = getOwner(project);
      const parameters = [
        { name: 'Object', type: 'object' },
        { name: 'Behavior', type: 'behavior' },
      ].slice(0, implicitCount);
      owner.eventsFunctions = [
        {
          ...functionObject('IdleAnimationName'),
          functionType: 'ExpressionAndCondition',
          expressionType: { type: 'string' },
          parameters: [...parameters, { name: 'Index', type: 'expression' }],
        },
        {
          ...functionObject('SetIdleAnimationName'),
          functionType: 'ActionWithOperator',
          getterName: 'IdleAnimationName',
          parameters,
        },
      ];
      const files = decomposeLegacyProjectToFiles(project);
      const uri = Object.keys(files).find(uri =>
        uri.endsWith('/SetIdleAnimationName.gdl')
      );
      expect(files[uri]).toContain('name = "Value"');
      const restored = composeLegacyProjectFromFiles(files);
      expect(getOwner(restored).eventsFunctions[1].parameters).toEqual([
        ...parameters,
        { name: 'Value', type: 'string' },
        { name: 'Index', type: 'expression' },
      ]);
      expect(areLegacyProjectsEquivalent(project, restored)).toBe(true);
      expect(decomposeLegacyProjectToFiles(restored)[uri]).toBe(files[uri]);
      expect(owner.eventsFunctions[1].parameters).toEqual(parameters);
    });
  });
});
