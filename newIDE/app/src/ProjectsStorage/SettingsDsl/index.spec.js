// @noflow
import {
  parseSettingsSyntax,
  decodeSettingsDocument,
  serializeSettingsDocument,
  formatSettingsDsl,
  registerLocalSettingsDefinitions,
  registerLocalSettingsSources,
} from '.';
import { compileLayoutDocument } from '../LayoutDocument';

describe('GDevelop Language (GDL)', () => {
  test.each(['project', 'scene', 'function', 'prefab'])(
    'omits empty objectGroups when saving %s and retains declared groups',
    kind => {
      const source = serializeSettingsDocument(kind, {
        ...(kind === 'project' ? { formatVersion: 13 } : {}),
        name: 'Example',
        objectGroups: {},
      });
      expect(source).not.toContain('objectGroups');
      expect(decodeSettingsDocument(source).payload.objectGroups).toEqual({});
      const populated = { Empty: [], Actors: ['Player'] };
      const populatedSource = serializeSettingsDocument(kind, {
        ...(kind === 'project' ? { formatVersion: 13 } : {}),
        name: 'Example',
        objectGroups: populated,
      });
      expect(
        decodeSettingsDocument(populatedSource).payload.objectGroups
      ).toEqual(populated);
    }
  );
  test('round trips declared prefab child overrides, including nested prefabs and source-only registration', () => {
    const extension = {
      name: 'OverrideTest',
      eventsBasedObjects: [
        {
          name: 'Inner',
          objects: [{ name: 'Background image', type: 'Sprite' }],
        },
        {
          name: 'Outer',
          objects: [{ name: 'Nested', type: 'OverrideTest::Inner' }],
        },
      ],
    };
    registerLocalSettingsDefinitions([extension]);
    const payload = {
      name: 'Dialog',
      type: 'OverrideTest::Outer',
      variant: '',
      content: {},
      childrenContent: {
        Nested: {
          variant: '',
          content: {},
          childrenContent: { 'Background image': { animations: [] } },
        },
      },
    };
    const source = serializeSettingsDocument('object', payload);
    expect(source).toContain('name = "Background image"');
    expect(decodeSettingsDocument(source).payload).toEqual(payload);
    const files = {};
    extension.eventsBasedObjects.forEach(prefab => {
      const prefix = `game://extensions/OverrideTest/prefabs/${prefab.name}`;
      files[`${prefix}/prefab.gdl`] = serializeSettingsDocument('prefab', {
        name: prefab.name,
      });
      prefab.objects.forEach(object => {
        files[
          `${prefix}/objects/${encodeURIComponent(object.name)}.gdl`
        ] = serializeSettingsDocument('object', object);
      });
    });
    registerLocalSettingsSources(files);
    expect(decodeSettingsDocument(source).payload).toEqual(payload);
    expect(() =>
      serializeSettingsDocument('object', {
        ...payload,
        childrenContent: { Unknown: { animations: [] } },
      })
    ).toThrow('Unknown child configuration');
    expect(() =>
      decodeSettingsDocument(
        source.replace('name = "Nested"', 'name = "Unknown"')
      )
    ).toThrow('Unknown or duplicate child');
    expect(() =>
      decodeSettingsDocument(source.replace('animations = []', 'typo = 1'))
    ).toThrow('Unknown property');
  });
  test('preserves object-group insertion order and maps native animation looping', () => {
    const scene = {
      name: 'Main',
      objectGroups: { Zombies: ['Enemy'], Actors: ['Player'] },
    };
    expect(
      Object.keys(
        decodeSettingsDocument(serializeSettingsDocument('scene', scene))
          .payload.objectGroups
      )
    ).toEqual(['Zombies', 'Actors']);
    registerLocalSettingsDefinitions([
      { name: 'AnimatedTest', eventsBasedObjects: [{ name: 'Button' }] },
    ]);
    const payload = {
      name: 'Button',
      type: 'AnimatedTest::Button',
      variant: '',
      content: {},
      animatable: {
        animations: [
          {
            name: 'Idle',
            directions: [
              { looping: true, timeBetweenFrames: 0.1, sprites: [] },
            ],
          },
        ],
      },
    };
    const source = serializeSettingsDocument('object', payload);
    expect(source).toContain('loop = true');
    expect(decodeSettingsDocument(source).payload).toEqual(payload);
  });
  test('parses comments, strings and CRLF with source locations', () => {
    const source =
      '// heading\r\nscene {\r\n name = "中文 // text"\r\n layer {\r\n  id = "world"\r\n  name = "World"\r\n }\r\n}\r\n';
    const syntax = parseSettingsSyntax(source);
    expect(syntax.root.properties.name.value).toBe('中文 // text');
    expect(syntax.root.children[0].location.line).toBe(4);
    expect(formatSettingsDsl(source)).toContain('// heading');
  });
  test.each([
    'name = "Main"',
    '[layout]\nversion = 1',
    'scene "Main" {}',
    'scene { name = "Main" }',
    'scene {\n name = "A"\n name = "B"\n}\n',
    'scene {\n name = null\n}\n',
    'scene {\n n = NaN\n}\n',
    'scene {\n x = 01\n}\n',
    'scene {\n x = 9007199254740992\n}\n',
    'scene {\n variables = 1\n variables {}\n}\n',
    'scene {}\nscene {}\n',
    'scene {\n name = "a\\q"\n}\n',
  ])('rejects unsupported syntax %s', source =>
    expect(() => parseSettingsSyntax(source)).toThrow()
  );
  test('round trips an instance and its variables through the shared layout validator', () => {
    const source = `scene {
 name = "Main"
 background = "#101820"
 variable {
  name = "Score"
  value = 0
 }
 layer {
  id = "base"
  name = ""
 }
 instance {
  id = "ef3ef49d-f20f-4450-b373-0ce43291a002"
  object = "Player"
  layer = "base"
  position = [10, 20, 3]
  variable {
   name = "Health"
   value = 100
  }
 }
}
`;
    const parsed = decodeSettingsDocument(source);
    const layout = compileLayoutDocument(parsed.layout, {
      kind: 'scene',
      objectNames: ['Player'],
      locations: parsed.locations,
    });
    expect(layout.instances[0].x).toBe(10);
    expect(parsed.payload.variables[0].value).toBe(0);
    const payload = { ...parsed.payload };
    delete payload.layout;
    expect(
      decodeSettingsDocument(
        serializeSettingsDocument(parsed.kind, payload, parsed.layout)
      ).layout
    ).toEqual(parsed.layout);
  });
  test('rejects unknown metadata, wrappers and old per-file markers', () => {
    for (const body of [
      'madeUp = 1',
      'settings {}',
      'layout {}',
      'version = 1',
      'instance {\n instance {}\n}',
    ])
      expect(() =>
        decodeSettingsDocument(`scene {\n name = "Main"\n ${body}\n}\n`)
      ).toThrow();
  });
  test('quotes user-defined names safely and rejects prototype-shaped unknown fields', () => {
    const parsed = decodeSettingsDocument(
      'scene {\n name = "Main"\n variable {\n  name = "__proto__"\n  value = 3\n }\n variable {\n  name = "Display Name"\n  value = "Knight"\n }\n}\n'
    );
    expect(parsed.payload.variables.map(v => v.name)).toEqual([
      '__proto__',
      'Display Name',
    ]);
    expect(() => decodeSettingsDocument('constructor {}\n')).toThrow();
    expect(() =>
      decodeSettingsDocument('scene {\n name = "Main"\n constructor = 1\n}\n')
    ).toThrow();
    expect({}.polluted).toBeUndefined();
  });
  test('formats comments without changing values and is idempotent', () => {
    const source =
      '// doc\nscene {\n // identity\n name="Main" // label\n layer {\n id="base"\n name=""\n }\n}\n// tail\n';
    const formatted = formatSettingsDsl(source);
    expect(formatSettingsDsl(formatted)).toBe(formatted);
    expect(formatted).toContain('// label');
    expect(formatted).toContain('// tail');
    expect(parseSettingsSyntax(formatted).root.properties.name.value).toBe(
      'Main'
    );
  });
  test('enforces nesting budgets and reports a value source range', () => {
    expect(() =>
      parseSettingsSyntax(
        'scene {\n' + 'node {\n'.repeat(102) + '}\n'.repeat(103)
      )
    ).toThrow();
    try {
      decodeSettingsDocument(
        'scene {\n name = "Main"\n unknown = 42\n}\n',
        'game://scene.gdl'
      );
    } catch (error) {
      expect(error).toMatchObject({
        fileUri: 'game://scene.gdl',
        line: 3,
        column: 12,
        endColumn: 14,
        path: 'scene.unknown',
      });
    }
  });
  test('handles a large scene without regrouping instance order', () => {
    const layout = {
      layout: { version: 1, background: '#101820' },
      layers: [{ id: 'base', name: '' }],
      instances: [],
      variables: [],
      behaviors: [],
    };
    for (let i = 0; i < 1200; i++) {
      const id = `00000000-0000-4000-8000-${i.toString(16).padStart(12, '0')}`;
      layout.instances.push({
        id,
        object: 'Player',
        layer: 'base',
        at: [i, i / 2, 0],
      });
      layout.variables.push({
        instance: id,
        name: 'Health',
        type: 'number',
        value: 100,
      });
    }
    const started = Date.now();
    const source = serializeSettingsDocument(
      'scene',
      { name: 'Large' },
      layout
    );
    const serialized = Date.now();
    const decoded = decodeSettingsDocument(source);
    const parsed = Date.now();
    const compiled = compileLayoutDocument(decoded.layout, {
      kind: 'scene',
      objectNames: ['Player'],
    });
    expect(compiled.instances.map(i => i.persistentUuid)).toEqual(
      layout.instances.map(i => i.id)
    );
    expect(compiled.instances[1199].initialVariables[0].value).toBe(100);
    console.info(
      'GDevelop Language (GDL) large-scene measurement',
      JSON.stringify({
        instances: 1200,
        characters: source.length,
        serializeIncludingSelfCheckMs: serialized - started,
        parseMs: parsed - serialized,
        validateMs: Date.now() - parsed,
      })
    );
  });
});
