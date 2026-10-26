// @noflow
import { compileLayoutDocument, decompileLayoutDocument } from '.';
import {
  decodeSettingsDocument,
  serializeSettingsDocument,
} from '../SettingsDsl';
const ids = [
  'ef3ef49d-f20f-4450-b373-0ce43291a002',
  '4a1e5377-cbe7-4078-9a51-96a1e9956411',
  '01fce651-91cd-4d11-bd56-ef1370807527',
];
const context = {
  kind: 'scene',
  objectNames: ['Player'],
  behaviorTypesByObject: { Player: { Movement: 'MovementType' } },
  behaviorPropertySchemasByType: {
    MovementType: {
      keySpace: 'serialized',
      unknownPropertyPolicy: 'error',
      properties: [
        { authoringKey: 'Speed', serializedKey: 'speed', type: 'Number' },
      ],
    },
  },
};
const document = () => ({
  layout: { version: 1, background: '#123456' },
  layers: [{ id: 'world', name: 'World' }, { id: 'hud', name: 'HUD' }],
  instances: ids.map((id, i) => ({
    id,
    object: 'Player',
    layer: i === 1 ? 'hud' : 'world',
    at: [i, 2, 3],
  })),
});

describe('shared layout data validation through GDevelop Language (GDL)', () => {
  test('preserves interleaved global order, inactive dimensions, camera modes and 3D fields', () => {
    const data = document();
    Object.assign(data.layers[0], {
      camera_type: 'perspective',
      near: 1,
      far: 1000,
      fov: 60,
      cameras: [
        {
          size: { default: [640, 360] },
          viewport: { default: [0, 0, 0.5, 1] },
        },
      ],
    });
    Object.assign(data.instances[0], {
      rotation: [10, 20, 30],
      auto_size: [64, 32],
      depth: 4,
      opacity: 200,
      hidden: true,
      flip: ['x', 'z'],
    });
    const original = compileLayoutDocument(data, context);
    const canonical = decompileLayoutDocument(original, context);
    const source = serializeSettingsDocument(
      'scene',
      { name: 'Battle', order: 0 },
      canonical
    );
    expect(source).toContain('stored_size = [640, 360]');
    expect(source).not.toContain('layout {');
    const parsed = decodeSettingsDocument(source);
    expect(compileLayoutDocument(parsed.layout, context)).toEqual(original);
    expect(original.instances.map(i => i.persistentUuid)).toEqual(ids);
  });
  test('keeps per-instance variable trees and serialized-key behavior overrides', () => {
    const data = document();
    data.variables = [
      {
        instance: ids[0],
        name: 'Stats',
        type: 'structure',
        children: [{ name: 'Armor', type: 'number', value: 20 }],
      },
      {
        instance: ids[0],
        name: 'Path',
        type: 'array',
        children: [
          { type: 'string', value: 'A' },
          { type: 'string', value: 'B' },
        ],
      },
    ];
    data.behaviors = [
      { instance: ids[0], name: 'Movement', properties: { speed: 500 } },
    ];
    const original = compileLayoutDocument(data, context);
    const canonical = decompileLayoutDocument(original, context);
    const source = serializeSettingsDocument(
      'scene',
      { name: 'Battle', order: 0 },
      canonical
    );
    expect(
      compileLayoutDocument(decodeSettingsDocument(source).layout, context)
    ).toEqual(original);
    expect(source).not.toContain('instance =');
  });
  test.each(['prefab', 'prefab-variant'])(
    'round trips bounded %s layouts',
    kind => {
      const data = document();
      data.layout = {
        version: 1,
        bounds: { min: [0, 0, 0], max: [128, 96, 64] },
      };
      const config = { ...context, kind };
      const original = compileLayoutDocument(data, config);
      expect(
        compileLayoutDocument(decompileLayoutDocument(original, config), config)
      ).toEqual(original);
    }
  );
  test('external layouts only reference linked scene layers', () => {
    const data = document();
    data.layout = { version: 1 };
    const config = {
      ...context,
      kind: 'external',
      layerNames: ['World', 'HUD'],
    };
    const original = compileLayoutDocument(data, config);
    expect(
      compileLayoutDocument(decompileLayoutDocument(original, config), config)
    ).toEqual(original);
    expect(() =>
      compileLayoutDocument(data, { ...config, layerNames: ['World'] })
    ).toThrow();
    data.layers[0].visible = true;
    expect(() => compileLayoutDocument(data, config)).toThrow();
  });
  test.each([
    d => (d.instances[0].id = 'player'),
    d => (d.instances[1].id = ids[0]),
    d => (d.instances[0].object = 'Missing'),
    d => (d.instances[0].layer = 'missing'),
    d => (d.instances[0].at = [1]),
    d => (d.instances[0].opacity = 256),
    d => {
      d.instances[0].size = [1, 2];
      d.instances[0].auto_size = [1, 2];
    },
    d => (d.layers[0].fov = 181),
    d => {
      d.layers[0].near = 10;
      d.layers[0].far = 1;
    },
    d => {
      d.layers[0].rendering = '3d';
      d.layers[0].lighting = true;
    },
    d =>
      (d.behaviors = [
        { instance: ids[0], name: 'Movement', properties: { Speed: 100 } },
      ]),
    d =>
      (d.variables = [
        { instance: ids[0], name: 'Health', type: 'number', value: 'bad' },
      ]),
  ])('rejects invalid model data (%#)', mutate => {
    const data = document();
    mutate(data);
    expect(() => compileLayoutDocument(data, context)).toThrow();
  });
});
