// @noflow
import {
  decodeSettingsDocument,
  serializeSettingsDocument,
  getComponentSettingsSchema,
} from '.';

test.each(['scene', 'prefab', 'prefabVariant', 'externalLayout'])(
  '%s preserves independent layer and global instance order in containers',
  kind => {
    const layout = {
      layout: { version: 1 },
      layers: [{ id: 'world', name: 'World' }, { id: 'hud', name: 'HUD' }],
      instances: ['world', 'hud', 'world'].map((layer, i) => ({
        id: `instance-${i}`,
        object: 'Player',
        layer,
        at: [i, 0],
      })),
    };
    const source = serializeSettingsDocument(kind, { name: 'Example' }, layout);
    expect(source.match(/\blayers \{/g)).toHaveLength(1);
    expect(source.match(/\binstances \{/g)).toHaveLength(1);
    const decoded = decodeSettingsDocument(source).layout;
    expect(decoded.layers.map(layer => layer.id)).toEqual(['world', 'hud']);
    expect(decoded.instances.map(instance => instance.layer)).toEqual([
      'world',
      'hud',
      'world',
    ]);
    expect(serializeSettingsDocument(kind, { name: 'Example' }, decoded)).toBe(
      source
    );
    const schema = getComponentSettingsSchema(kind);
    expect(schema.children.layers.named).toBe(true);
    expect(schema.children.layers.schema.namedEntries.nameField).toBe('id');
    expect(
      schema.children.layers.schema.namedEntries.schema.fields.id
    ).toBeUndefined();
    expect(schema.children.instances.schema.children.instance.repeated).toBe(
      true
    );
    expect(schema.children.layer).toBeUndefined();
  }
);

test('empty layout collections are explicit in canonical output', () => {
  const source = serializeSettingsDocument(
    'scene',
    { name: 'Empty' },
    { layout: { version: 1 } }
  );
  const root = decodeSettingsDocument(source).syntax.root;
  expect(root.children.map(child => child.type)).toEqual([
    'layers',
    'instances',
  ]);
  expect(
    decodeSettingsDocument('scene {\n name = "Empty"\n}').layout.instances
  ).toEqual([]);
});

test.each([
  'layer {}',
  'instance {}',
  'layers {}\n layers {}',
  'instances {}\n instances {}',
  'instances {\n layer {}\n}',
  'layers {\n unexpected = true\n}',
  'instances {\n unexpected = true\n}',
  'layers {\n layer {\n instance {}\n}\n}',
])('rejects invalid layout container structure: %s', body => {
  expect(() =>
    decodeSettingsDocument(`scene {\n name = "Main"\n ${body}\n}`)
  ).toThrow();
});

test('layer IDs are named nodes, including quoted names and reserved node words', () => {
  const ids = [
    'world',
    'HUD overlay',
    '123-world',
    '中文',
    'layer',
    'instance',
    'quote"slash\\',
  ];
  const source = serializeSettingsDocument(
    'scene',
    { name: 'Named' },
    {
      layout: { version: 1 },
      layers: ids.map((id, i) => ({ id, name: `Layer ${i}` })),
      instances: ids.map((layer, i) => ({
        id: `uuid-${i}`,
        object: 'Player',
        layer,
        at: [i, 0],
      })),
    }
  );
  expect(source).not.toContain('id = "world"');
  expect(source).toContain('"HUD overlay" {');
  const decoded = decodeSettingsDocument(source).layout;
  expect(decoded.layers.map(layer => layer.id)).toEqual(ids);
  expect(decoded.layers.map(layer => layer.name)).toEqual(
    ids.map((_, i) => `Layer ${i}`)
  );
  expect(decoded.instances.map(instance => instance.layer)).toEqual(ids);
});

test.each([
  'world {}\n world {}',
  'world {}\n "world" {}',
  'world {\n id = "other"\n}',
  'layer {\n id = "world"\n name = "World"\n}',
  '"" {}',
])('rejects invalid or old named layer syntax: %s', body => {
  expect(() =>
    decodeSettingsDocument(`scene {\n name = "Main"\n layers {\n ${body}\n}\n}`)
  ).toThrow();
});

test('external layouts retain their restricted named-layer schema', () => {
  expect(() =>
    decodeSettingsDocument(
      'layout {\n name = "External"\n layers {\n world {\n rendering = "2d"\n}\n}\n}'
    )
  ).toThrow();
});
