// @noflow
import {
  decodeSettingsDocument,
  serializeSettingsDocument,
  registerSettingsTypes,
  resetSettingsTypes,
  formatSettingsDsl,
  getSettingsSchemas,
} from '.';

beforeEach(() => {
  resetSettingsTypes();
  registerSettingsTypes({
    behaviorTypes: [
      {
        type: 'Test::Move',
        properties: [{ name: 'speed', type: 'Number' }],
      },
    ],
  });
});
afterEach(resetSettingsTypes);

test('named attachments preserve order, special names, properties and metadata', () => {
  const payload = {
    name: 'Player',
    type: 'Sprite',
    behaviors: ['10', '2', 'Display Name', '__proto__'].map((name, i) => ({
      name,
      type: 'Test::Move',
      speed: i,
      isFolded: true,
      isMuted: false,
      isInheritedFromObjectType: true,
      quickCustomizationVisibility: 'visible',
      propertiesQuickCustomizationVisibilities: { speed: 'hidden' },
      overrides: { speed: i + 10 },
    })),
  };
  const source = serializeSettingsDocument('object', payload);
  expect(source).toContain('behaviors {');
  expect(source).not.toMatch(/\bbehavior \{/);
  expect(source).not.toContain('name = "Display Name"');
  expect(decodeSettingsDocument(source).payload).toEqual(payload);
  expect(formatSettingsDsl(formatSettingsDsl(source))).toBe(
    formatSettingsDsl(source)
  );
});

test.each(['scene', 'prefab', 'prefabVariant', 'externalLayout'])(
  'named instance overrides round trip in %s',
  kind => {
    const source = serializeSettingsDocument(
      kind,
      { name: 'Main' },
      {
        layout: { version: 1 },
        layers: [],
        effects: [],
        variables: [],
        instances: [
          {
            id: 'ef3ef49d-f20f-4450-b373-0ce43291a002',
            object: 'Player',
            layer: '',
            at: [0, 0],
          },
        ],
        behaviors: ['10', '2', 'Display Name'].map(name => ({
          instance: 'ef3ef49d-f20f-4450-b373-0ce43291a002',
          name,
          folded: true,
          muted: false,
          inherited: true,
          quick: 'visible',
          properties: { speed: 12 },
          overrides: { speed: 14 },
          property_visibility: { speed: 'hidden' },
        })),
      }
    );
    const decoded = decodeSettingsDocument(source);
    expect(decoded.layout.behaviors.map(b => b.name)).toEqual([
      '10',
      '2',
      'Display Name',
    ]);
    expect(
      serializeSettingsDocument(
        kind,
        { name: decoded.payload.name },
        decoded.layout
      )
    ).toBe(source);
  }
);

test.each([
  'behavior {\n name = "Move"\n type = Test::Move\n}',
  'behaviors = []',
  'behaviors {}\nbehaviors {}',
  'behaviors {\n Move {}\n Move {}\n}',
  'behaviors {\n Move {\n name = "Other"\n type = Test::Move\n}\n}',
  'behaviors {\n Move {\n type = Test::Unknown\n}\n}',
  'behaviors {\n Move {\n type = Test::Move\n properties {\n unknown = 1\n}\n}\n}',
])('rejects obsolete or invalid attachments: %s', body => {
  expect(() =>
    decodeSettingsDocument(
      `object {\n name = "Player"\n type = Sprite\n${body}\n}`
    )
  ).toThrow();
});

test('instance members reject name and type, and containers reject the wrong owner', () => {
  for (const field of ['name = Move', 'type = Test::Move']) {
    expect(() =>
      decodeSettingsDocument(
        `scene {\n name = "Main"\n instances {\n   instance {\n   object = Player\n   behaviors {\n   Move {\n  ${field}\n  }\n  }\n  }\n }\n}`
      )
    ).toThrow();
  }
  expect(() =>
    decodeSettingsDocument('behavior {\n name = "Health"\n behaviors {}\n}')
  ).toThrow();
  expect(
    decodeSettingsDocument('behavior {\n name = "Health"\n}').payload.name
  ).toBe('Health');
});

test('empty collections and catalog schemas have one canonical representation', () => {
  const payload = { name: 'Player', type: 'Sprite', behaviors: [] };
  const source = serializeSettingsDocument('object', payload);
  expect(source).toContain('behaviors {');
  expect(decodeSettingsDocument(source).payload).toEqual(payload);
  const schemas = getSettingsSchemas();
  for (const schema of [schemas.components.object, schemas.layout.instance]) {
    expect(schema.children.behavior).toBeUndefined();
    expect(schema.children.behaviors).toMatchObject({
      named: true,
      maximum: 1,
    });
    expect(
      schema.children.behaviors.schema.namedEntries.schema.fields.name
    ).toBeUndefined();
  }
});
