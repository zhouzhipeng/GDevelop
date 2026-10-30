// @noflow
import {
  buildProjectGdlCatalog,
  validateProjectGdlCatalog,
  serializeProjectGdlCatalog,
  buildBehaviorPropertySchemasByType,
} from './ProjectSourceCatalog';
import { serializeToJSObject } from '../Utils/Serializer';
import {
  decodeSettingsDocument,
  serializeSettingsDocument,
  getLayoutTypeContext,
} from './SettingsDsl';

const gd = global.gd;
describe('GDevelop Language (GDL) authoring catalogs', () => {
  let project;
  beforeEach(() => {
    project = gd.ProjectHelper.createNewGDJSProject();
  });
  afterEach(() => project.delete());
  const catalogFor = project =>
    buildProjectGdlCatalog({
      project,
      serializedProject: serializeToJSObject(project),
    });
  test('publishes the same strict node schemas used by the current parser', () => {
    const catalog = catalogFor(project);
    expect(catalog.formatVersion).toBe(13);
    expect(catalog.layoutNodes.map(entry => entry.node)).toEqual(
      expect.arrayContaining([
        'editor',
        'camera',
        'effect',
        'behavior',
        'layer',
        'instance',
      ])
    );
    expect(catalog.counts.layoutNodes).toBe(catalog.layoutNodes.length);
    const assertCurrentSchema = value => {
      if (!value || typeof value !== 'object') return;
      Object.entries(value).forEach(([key, child]) => {
        expect([
          'layoutTables',
          'table',
          'childTables',
          'header',
          'emptyForm',
        ]).not.toContain(key);
        assertCurrentSchema(child);
      });
    };
    assertCurrentSchema(catalog);
    const variableSchema = catalog.variableSchemas.variable;
    expect(variableSchema.children.metadata).toBeUndefined();
    expect(variableSchema.children.variable).toMatchObject({
      repeated: true,
      recursive: true,
      schemaRef: 'variableSchemas.variable',
    });
    expect(JSON.parse(JSON.stringify(catalog)).variableSchemas).toEqual(
      catalog.variableSchemas
    );
    expect(catalog.fileKinds).toHaveLength(17);
    expect(
      catalog.fileKinds.every(
        k =>
          k.root &&
          k.schema.childNodes &&
          k.schema.rootFields.every(
            f => !['kind', 'settingsFormatVersion'].includes(f.name)
          )
      )
    ).toBe(true);
    expect(catalog.layoutAuthoring).toMatchObject({
      storage: 'component-root',
      syntax: 'GDevelop Language (GDL)',
    });
    expect(
      catalog.objectTypes.every(
        t =>
          t.schema.fields &&
          t.schema.children &&
          t.unknownPropertyPolicy === 'error'
      )
    ).toBe(true);
    expect(JSON.stringify(catalog)).not.toContain('[[layout');
    expect(JSON.parse(serializeProjectGdlCatalog(catalog))).toEqual(catalog);
    expect(validateProjectGdlCatalog(catalog)).toBe(catalog);
  });
  test('registers hidden and deprecated effect parameters without advertising them as public editor properties', () => {
    const platform = gd.JsPlatform.get();
    project.addPlatform(platform);
    const extension = new gd.PlatformExtension();
    extension.setExtensionInformation(
      'EffectSchemaTest',
      'Effect schema test',
      '',
      '',
      ''
    );
    const effect = extension.addEffect('Light');
    const properties = effect.getProperties();
    properties
      .getOrCreate('intensity')
      .setType('number')
      .setValue('1');
    properties
      .getOrCreate('frustumSize')
      .setType('number')
      .setValue('4000')
      .setDeprecated(true);
    properties
      .getOrCreate('internalColor')
      .setType('string')
      .setValue('255;255;255')
      .setHidden(true);
    platform.addNewExtension(extension);
    extension.delete();
    try {
      const catalog = catalogFor(project);
      const entry = catalog.effectTypes.find(
        type => type.type === 'EffectSchemaTest::Light'
      );
      expect(entry.parameters.map(parameter => parameter.name)).toEqual([
        'intensity',
      ]);
      expect(entry.serializedParameters).toEqual(
        expect.arrayContaining([
          { name: 'frustumSize', type: 'number' },
          { name: 'internalColor', type: 'string' },
        ])
      );
      expect(
        getLayoutTypeContext().effectParameterTypesByType[entry.type]
      ).toMatchObject({ frustumSize: 'number', internalColor: 'string' });
      expect(() =>
        validateProjectGdlCatalog({
          ...catalog,
          effectTypes: [{ ...entry, serializedParameters: null }],
        })
      ).toThrow('serializedParameters');
    } finally {
      platform.removeExtension('EffectSchemaTest');
    }
  });
  test('rejects stale catalogs, duplicate types and missing node contracts', () => {
    const catalog = catalogFor(project);
    expect(() =>
      validateProjectGdlCatalog({ ...catalog, formatVersion: 11 })
    ).toThrow();
    ['', null, 42].forEach(node => {
      expect(() =>
        validateProjectGdlCatalog({ ...catalog, layoutNodes: [{ node }] })
      ).toThrow('identity');
    });
    expect(() =>
      validateProjectGdlCatalog({
        ...catalog,
        layoutNodes: [catalog.layoutNodes[0], catalog.layoutNodes[0]],
      })
    ).toThrow('Duplicate layout node');
    expect(() =>
      validateProjectGdlCatalog({
        ...catalog,
        objectTypes: [...catalog.objectTypes, catalog.objectTypes[0]],
      })
    ).toThrow();
    expect(() =>
      validateProjectGdlCatalog({
        ...catalog,
        fileKinds: [{ ...catalog.fileKinds[0], schema: null }],
      })
    ).toThrow();
  });
  test('supports typed Sprite geometry without inline objects or raw JSON', () => {
    catalogFor(project);
    const object = {
      name: 'Player',
      type: 'Sprite',
      order: 0,
      folder: [],
      behaviors: [],
      animations: [
        {
          name: 'Idle',
          useMultipleDirections: false,
          directions: [
            {
              looping: true,
              timeBetweenFrames: 0.1,
              sprites: [
                {
                  image: 'player.png',
                  hasCustomCollisionMask: true,
                  originPoint: { name: 'Origin', x: 0, y: 0 },
                  centerPoint: {
                    name: 'Center',
                    x: 16,
                    y: 16,
                    automatic: true,
                  },
                  points: [{ name: 'Hand', x: 24, y: 12 }],
                  customCollisionMask: [
                    [{ x: 0, y: 0 }, { x: 32, y: 0 }, { x: 0, y: 32 }],
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const source = serializeSettingsDocument('object', object);
    expect(source).toContain('polygon {');
    expect(source).toContain('resource = "player.png"');
    expect(decodeSettingsDocument(source).payload).toEqual(object);
    expect(() =>
      decodeSettingsDocument(source.replace('loop = true', 'invented = true'))
    ).toThrow();
  });
  test('publishes behavior keys in serialized space with strict unknown-field policy', () => {
    const catalog = catalogFor(project);
    const schemas = buildBehaviorPropertySchemasByType(catalog);
    expect(
      Object.values(schemas).every(s => s.unknownPropertyPolicy === 'error')
    ).toBe(true);
    expect(Object.values(schemas).some(s => s.properties.length)).toBe(true);
  });
  test.each([false, true])(
    'preserves the platformer trajectory flag (%s) without accepting editor-key aliases',
    legacy => {
      const scene = project.insertNewLayout('Main', 0);
      const player = scene
        .getObjects()
        .insertNewObject(project, 'Sprite', 'Player', 0);
      const behavior = player.addNewBehavior(
        project,
        'PlatformBehavior::PlatformerObjectBehavior',
        'PlatformerObject'
      );
      behavior.updateProperty('UseLegacyTrajectory', legacy ? '1' : '0');
      const object = { ...serializeToJSObject(player), order: 0, folder: [] };
      delete object.variables; // Empty collections have no declarations in the current format.
      const catalog = catalogFor(project);
      const type = catalog.behaviorTypes.find(
        t => t.type === 'PlatformBehavior::PlatformerObjectBehavior'
      );
      expect(type.serializedProperties).toContainEqual({
        serializedKey: 'useLegacyTrajectory',
        type: 'boolean',
      });
      expect(
        type.serializedProperties.some(
          p => p.serializedKey === 'UseLegacyTrajectory'
        )
      ).toBe(false);
      const source = serializeSettingsDocument('object', object);
      expect(source).toContain(`useLegacyTrajectory = ${legacy}`);
      expect(decodeSettingsDocument(source).payload).toEqual(object);
      expect(() =>
        decodeSettingsDocument(
          source.replace('useLegacyTrajectory =', 'UseLegacyTrajectory =')
        )
      ).toThrow();
    }
  );

  test('inspecting initialized behavior defaults preserves borrowed metadata state', () => {
    const metadata = gd.MetadataProvider.getBehaviorMetadata(
      project.getCurrentPlatform(),
      'PlatformBehavior::PlatformerObjectBehavior'
    );
    const prototype = metadata.get();
    const before = serializeToJSObject(prototype);
    const catalog = catalogFor(project);
    expect(serializeToJSObject(prototype)).toEqual(before);
    const type = catalog.behaviorTypes.find(
      t => t.type === 'PlatformBehavior::PlatformerObjectBehavior'
    );
    expect(type.serializedDefaults.useLegacyTrajectory).toBe(false);
    expect(type.serializedDefaults.useRepeatedJump).toBe(false);
    expect(
      type.properties.some(p => p.authoringKey === 'UseLegacyTrajectory')
    ).toBe(false);
    for (const behavior of catalog.behaviorTypes) {
      const keys = new Set(
        behavior.serializedProperties.map(p => p.serializedKey)
      );
      for (const key of Object.keys(behavior.serializedDefaults))
        expect(keys.has(key)).toBe(true);
    }
  });
});
