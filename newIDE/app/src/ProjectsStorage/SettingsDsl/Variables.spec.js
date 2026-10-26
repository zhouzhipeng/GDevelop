// @noflow
import {
  decodeSettingsDocument,
  serializeSettingsDocument,
  formatSettingsDsl,
  parseSettingsSyntax,
} from '.';
import { compileLayoutDocument } from '../LayoutDocument';
const scene = body =>
  `scene {\n name = "Main"\n background = "#000000"\n${body}\n}\n`;
const variable = body => ` variable {\n${body}\n }`;

describe('Direct variable declarations and literal values', () => {
  test('compiles the requested CoinPitch and Controllers examples without wrappers', () => {
    const source = scene(
      variable(' name = "CoinPitch"\n value = 1') +
        '\n' +
        variable(
          ' name = "Controllers"\n value = [{ Buttons = [{ State = "Idle" }]\n Joystick = {} }]'
        )
    );
    const parsed = decodeSettingsDocument(source);
    expect(parsed.payload.variables).toEqual([
      { name: 'CoinPitch', type: 'number', value: 1 },
      {
        name: 'Controllers',
        type: 'array',
        children: [
          {
            type: 'structure',
            children: [
              {
                name: 'Buttons',
                type: 'array',
                children: [
                  {
                    type: 'structure',
                    children: [
                      { name: 'State', type: 'string', value: 'Idle' },
                    ],
                  },
                ],
              },
              { name: 'Joystick', type: 'structure', children: [] },
            ],
          },
        ],
      },
    ]);
    const printed = serializeSettingsDocument(
      'scene',
      Object.fromEntries(
        Object.entries(parsed.payload).filter(([key]) => key !== 'layout')
      ),
      parsed.layout
    );
    expect(printed).not.toMatch(
      /\b(?:variables|sceneVariables|globalVariables)\s*\{/
    );
    expect(printed).not.toMatch(/\bid =/);
    expect(decodeSettingsDocument(printed).payload).toEqual(parsed.payload);
  });
  test('preserves numeric-string and prototype keys, heterogeneous values, empties and declaration order', () => {
    const parsed = decodeSettingsDocument(
      scene(
        variable(
          ' name = "Data"\n value = { "10" = [], "2" = {}, "__proto__" = [0.2, false, "x"], constructor = true }'
        )
      )
    );
    expect(
      parsed.payload.variables[0].children.map(child => child.name)
    ).toEqual(['10', '2', '__proto__', 'constructor']);
    const printed = serializeSettingsDocument(
      'scene',
      Object.fromEntries(
        Object.entries(parsed.payload).filter(([key]) => key !== 'layout')
      ),
      parsed.layout
    );
    expect(decodeSettingsDocument(printed).payload).toEqual(parsed.payload);
    expect({}.polluted).toBeUndefined();
  });
  test('round trips root and descendant identities, enum and false editor flags through path metadata', () => {
    const uuid = 'a9ab811d-91cf-4b76-95a3-81d9cd86156b';
    const source = scene(
      variable(
        `name = "Data"\n id = ""\n folded = false\n hasMixedValues = false\n value = [{ State = "Idle", Joystick = {} }]\n metadata {\n path = [0, "State"]\n type = "enum"\n values = ["Idle", "Pressed"]\n id = "${uuid}"\n }\n metadata {\n path = [0, "Joystick"]\n folded = true\n id = ""\n }`
      )
    );
    const parsed = decodeSettingsDocument(source);
    const data = parsed.payload.variables[0];
    expect(data).toMatchObject({
      persistentUuid: '',
      folded: false,
      hasMixedValues: false,
    });
    expect(data.children[0].children[0]).toMatchObject({
      type: 'enum',
      values: ['Idle', 'Pressed'],
      persistentUuid: uuid,
    });
    const printed = serializeSettingsDocument(
      'scene',
      Object.fromEntries(
        Object.entries(parsed.payload).filter(([key]) => key !== 'layout')
      ),
      parsed.layout
    );
    expect(printed).toContain('metadata {');
    expect(printed).not.toContain('persistentUuid =');
    expect(decodeSettingsDocument(printed).payload).toEqual(parsed.payload);
  });
  test('requires scope only for extension defaults and isolates duplicate names by scope', () => {
    const source =
      'extension {\n name = "Controls"\n' +
      variable('scope = "scene"\n name = "State"\n value = {}') +
      '\n' +
      variable('scope = "global"\n name = "State"\n value = []') +
      '\n}\n';
    const parsed = decodeSettingsDocument(source);
    expect(parsed.payload.sceneVariables[0].type).toBe('structure');
    expect(parsed.payload.globalVariables[0].type).toBe('array');
    expect(
      decodeSettingsDocument(
        serializeSettingsDocument('extension', parsed.payload)
      ).payload
    ).toEqual(parsed.payload);
    expect(() =>
      decodeSettingsDocument(source.replace('scope = "scene"', ''))
    ).toThrow('scope');
    expect(() =>
      decodeSettingsDocument(
        scene(variable('scope = "scene"\n name = "State"\n value = 0'))
      )
    ).toThrow('scope');
  });
  test('preserves instance descendants and editing flags through the native layout adapter', () => {
    const source = scene(
      'layer {\n id = "base"\n name = ""\n}\n instance {\n id = "ef3ef49d-f20f-4450-b373-0ce43291a002"\n object = "Player"\n layer = "base"\n position = [0, 0]\n' +
        variable(
          'name = "Tree"\n id = ""\n folded = false\n hasMixedValues = false\n value = { Z = [], A = {} }\n metadata {\n path = ["Z"]\n id = ""\n folded = true\n }'
        ) +
        '\n}'
    );
    const parsed = decodeSettingsDocument(source);
    const native = compileLayoutDocument(parsed.layout, {
      kind: 'scene',
      objectNames: ['Player'],
      locations: parsed.locations,
    });
    expect(native.instances[0].initialVariables[0]).toMatchObject({
      persistentUuid: '',
      folded: false,
      hasMixedValues: false,
      children: [
        {
          name: 'Z',
          type: 'array',
          children: [],
          persistentUuid: '',
          folded: true,
        },
        { name: 'A', type: 'structure', children: [] },
      ],
    });
  });
  test('formats nested comments and literals idempotently', () => {
    const source = scene(
      variable(
        'name = "Data"\n value = [\n // first\n {\n "10" = 1\n // next key\n "2" = {\n // empty\n }\n }\n ]'
      )
    );
    const formatted = formatSettingsDsl(source);
    expect(formatSettingsDsl(formatted)).toBe(formatted);
    expect(formatted).toContain('// first');
    expect(formatted).toContain('// next key');
    expect(formatted).toContain('// empty');
    expect(decodeSettingsDocument(formatted).payload).toEqual(
      decodeSettingsDocument(source).payload
    );
  });
  test.each([
    'variables {}',
    'sceneVariables {}',
    'globalVariables {}',
    'variables = []',
    variable('name = "A"\n type = "number"\n value = "1"'),
    variable(
      'name = "A"\n value = []\n variable {\n type = "number"\n value = 1\n }'
    ),
    variable('name = "A"\n type = "enum"\n value = "Idle"\n values = []'),
    variable(
      'name = "A"\n type = "enum"\n value = "Idle"\n values = ["Other"]'
    ),
    variable('name = "A"\n value = 1\n persistentUuid = ""'),
    variable(
      'name = "A"\n value = {}\n metadata {\n path = []\n folded = true\n }'
    ),
    variable(
      'name = "A"\n value = { "0" = 1 }\n metadata {\n path = [0]\n id = ""\n }'
    ),
    variable(
      'name = "A"\n value = [1]\n metadata {\n path = [0]\n id = ""\n }\n metadata {\n path = [0]\n folded = false\n }'
    ),
    variable(
      'name = "A"\n value = [1]\n metadata {\n path = [0]\n value = 2\n }'
    ),
    variable('name = "A"\n value = 1') +
      '\n' +
      variable('name = "A"\n value = 2'),
    'title = {}',
  ])('rejects invalid or retired variable declarations: %s', body => {
    expect(() => decodeSettingsDocument(scene(body))).toThrow();
  });
  test('applies the shared depth budget to literal nesting as well as node nesting', () => {
    const source = scene(
      variable(
        'name = "Deep"\n value = ' + '['.repeat(100) + '0' + ']'.repeat(100)
      )
    );
    expect(() => parseSettingsSyntax(source)).toThrow('nesting budget');
  });
  test('reports duplicate structure keys and the exact invalid path component', () => {
    expect(() =>
      parseSettingsSyntax(
        scene(variable('name = "A"\n value = { K = 1, K = 2 }'))
      )
    ).toThrow('Duplicate structure key');
    const source = scene(
      variable(
        'name = "A"\n value = [{}]\n metadata {\n path = [0, "Missing"]\n folded = true\n }'
      )
    );
    try {
      decodeSettingsDocument(source);
      throw new Error('Expected rejection');
    } catch (error) {
      expect(error.code).toBe('SETTINGS_INVALID_VARIABLE');
      expect(source.slice(error.offset, error.endOffset)).toBe('"Missing"');
    }
  });
});
