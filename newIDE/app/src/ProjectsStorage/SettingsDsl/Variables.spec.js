// @noflow
import {
  decodeSettingsDocument,
  serializeSettingsDocument,
  formatSettingsDsl,
  preserveVariableStructureOrder,
} from '.';
import { compileLayoutDocument } from '../LayoutDocument';

const scene = body =>
  `scene {\n name = "Main"\n background = "#000000"\n${body}\n}\n`;
const variables = body => `variables {\n${body}\n}`;
const scalar = (name, type, value) =>
  `${name} {\n type = "${type}"\n value = ${JSON.stringify(value)}\n}`;
const complex = (name, type, json, extra = '') =>
  `${name} {\n type = "${type}"\n json = """\n${json}\n"""\n${extra}\n}`;
const decode = body =>
  decodeSettingsDocument(scene(variables(body))).payload.variables;
const roundTrip = source => {
  const parsed = decodeSettingsDocument(source);
  const { layout, ...payload } = parsed.payload;
  const printed = serializeSettingsDocument('scene', payload, parsed.layout);
  expect(decodeSettingsDocument(printed).payload).toEqual(parsed.payload);
  expect(formatSettingsDsl(formatSettingsDsl(source))).toBe(
    formatSettingsDsl(source)
  );
  return { parsed, printed };
};

test('every variable is a typed named descriptor, preserving special and numeric names', () => {
  const { parsed, printed } = roundTrip(
    scene(
      variables(
        [
          scalar('Health', 'number', 10),
          scalar('Name', 'string', 'Player'),
          scalar('Enabled', 'boolean', true),
          scalar('"10"', 'number', 10),
          scalar('"2"', 'boolean', false),
          scalar('__proto__', 'string', 'safe'),
          scalar('constructor', 'number', 1),
          scalar('"true"', 'number', 2),
          scalar('"Display Name"', 'string', 'Knight'),
        ].join('\n')
      )
    )
  );
  expect(parsed.payload.variables.map(v => v.name)).toEqual([
    'Health',
    'Name',
    'Enabled',
    '10',
    '2',
    '__proto__',
    'constructor',
    'true',
    'Display Name',
  ]);
  expect(printed).toMatch(/Health \{\n\s+type = "number"\n\s+value = 10/);
  expect(printed).not.toContain('Health =');
});

test('JSON supports business value/type keys, recursive heterogeneous arrays and empty containers', () => {
  const { parsed, printed } = roundTrip(
    scene(
      variables(
        [
          complex(
            'Data',
            'structure',
            '{"value":1,"type":"string","10":[],"2":{},"__proto__":{"constructor":true}}'
          ),
          complex(
            'Enemies',
            'array',
            '[{"Name":"Slime","HP":10},[false,"text",{}],[]]'
          ),
          complex('Empty', 'structure', '{}'),
        ].join('\n')
      )
    )
  );
  expect(parsed.payload.variables[0].children.map(v => v.name)).toEqual([
    'value',
    'type',
    '10',
    '2',
    '__proto__',
  ]);
  expect(parsed.payload.variables[1].children[0].children[0].value).toBe(
    'Slime'
  );
  expect(printed).toContain('json = """');
  expect(printed).not.toMatch(/\bitems\s*\{|\bitem\s*\{/);
  expect({}.constructor).toBe(Object);
});

test('root and descendant enum/editing state survive JSON Pointer metadata round trips', () => {
  const metadata = JSON.stringify({
    '/Mode': { type: 'enum', values: ['Idle', 'Run'], hasMixedValues: false },
    '/a~1b~0c/0/Enabled': { folded: false },
    '/a~1b~0c': { folded: true },
  });
  const { parsed } = roundTrip(
    scene(
      variables(
        complex(
          'State',
          'structure',
          '{"Mode":"Idle","a/b~c":[{"Enabled":true}]}',
          `folded = false\nhasMixedValues = false\nmetadata = ${JSON.stringify(
            metadata
          )}`
        )
      )
    )
  );
  const variable = parsed.payload.variables[0];
  expect(variable).toMatchObject({ folded: false, hasMixedValues: false });
  expect(variable.children[0]).toEqual({
    name: 'Mode',
    type: 'enum',
    value: 'Idle',
    values: ['Idle', 'Run'],
    hasMixedValues: false,
  });
  expect(variable.children[1].children[0].children[0].folded).toBe(false);
});

test('nested metadata supports array elements, including enums', () => {
  const source = scene(
    variables(
      complex(
        'Items',
        'array',
        '["Idle",[]]',
        'metadata = "{\\"/0\\":{\\"type\\":\\"enum\\",\\"values\\":[\\"Idle\\"]},\\"/1\\":{\\"folded\\":false}}"'
      )
    )
  );
  const { parsed } = roundTrip(source);
  expect(parsed.payload.variables[0].children[0].type).toBe('enum');
});

test.each([
  'Health = 10',
  'Position {\n X = 1\n}',
  'A {}',
  'A {\n value = 1\n}',
  'A {\n type = "number"\n value = "1"\n}',
  'A {\n type = "boolean"\n value = 1\n}',
  'A {\n type = "number"\n value = {{ 1 }}\n}',
  'A {\n type = "number"\n value = [1]\n}',
  'A {\n type = "structure"\n value = "{}"\n}',
  'A {\n type = "structure"\n variables {}\n}',
  'A {\n type = "array"\n items {}\n}',
  'A {\n type = "array"\n json = "[]"\n value = 1\n}',
  'A {\n type = "string"\n value = "x"\n json = "{}"\n}',
  'A {\n type = "string"\n value = "x"\n metadata = "{}"\n}',
  'A {\n type = "number"\n value = 1\n name = "Other"\n}',
  'A {\n type = "number"\n value = 1\n id = ""\n}',
  'A {\n type = "enum"\n value = "Idle"\n values = []\n}',
  'A {\n type = "enum"\n value = "Idle"\n values = ["Idle","Idle"]\n}',
  'A {\n type = "number"\n value = 1\n values = ["Idle"]\n}',
  'A {\n type = "number"\n value = 1\n folded = "false"\n}',
  scalar('A', 'number', 1) + '\n' + scalar('A', 'number', 2),
])('rejects old/invalid variable declarations: %s', source => {
  expect(() => decode(source)).toThrow();
});

test.each([
  ['structure', '[]'],
  ['array', '{}'],
  ['structure', '{"X":null}'],
  ['structure', '{"X":1,"X":2}'],
  ['structure', '{"":1}'],
  ['array', '[9007199254740992]'],
  ['array', '[1e400]'],
  ['array', '[1,]'],
  ['structure', '{"X":1,}'],
  ['structure', '{/*x*/}'],
  ['array', '[01]'],
  ['array', '[true false]'],
  ['array', '[NaN]'],
  ['array', '["\\q"]'],
  ['array', '["unterminated]'],
  ['array', '[]junk'],
])('rejects invalid %s JSON: %s', (type, json) => {
  expect(() => decode(complex('Data', type, json))).toThrow();
});

test.each([
  { '': { folded: true } },
  { '/Missing': { folded: true } },
  { '/a~2': { folded: true } },
  { '/Values/00': { folded: true } },
  { '/Values/2': { folded: true } },
  { '/Mode': { type: 'number' } },
  { '/Values': { type: 'enum', values: ['Idle'] } },
  { '/Mode': { values: ['Idle'] } },
  { '/Mode': { type: 'enum' } },
  { '/Mode': { type: 'enum', values: ['Run'] } },
  { '/Mode': { folded: 'true' } },
  { '/Mode': { name: 'New' } },
  { '/Mode': [] },
  { '/Mode': { id: '' } },
])('rejects invalid nested metadata: %j', metadata => {
  expect(() =>
    decode(
      complex(
        'State',
        'structure',
        '{"Mode":"Idle","Values":[true]}',
        `metadata = ${JSON.stringify(JSON.stringify(metadata))}`
      )
    )
  ).toThrow();
});

test('duplicate metadata paths and fields are rejected by the same strict parser', () => {
  for (const metadata of [
    '{"/Mode":{},"/Mode":{}}',
    '{"/Mode":{"folded":true,"folded":false}}',
  ])
    expect(() =>
      decode(
        complex(
          'State',
          'structure',
          '{"Mode":"Idle"}',
          `metadata = ${JSON.stringify(metadata)}`
        )
      )
    ).toThrow(/Duplicate JSON key/);
});

test('JSON errors locate raw CRLF and escaped GDL strings at the original source character', () => {
  for (const source of [
    scene(
      variables(complex('Data', 'structure', '{\n"X": 1,\n"X": 2\n}'))
    ).replace(/\n/g, '\r\n'),
    scene(
      variables(
        'Data {\n type = "structure"\n json = "{\\"X\\":1,\\"X\\":2}"\n}'
      )
    ),
  ]) {
    try {
      decodeSettingsDocument(source);
      throw new Error('Expected rejection');
    } catch (error) {
      expect(error.code).toBe('SETTINGS_INVALID_VARIABLE_JSON');
      expect(source.slice(error.offset, error.offset + 2)).toMatch(/^("X|\\")/);
      expect(error.line).toBe(source.slice(0, error.offset).split('\n').length);
    }
  }
});

test('JSON depth and node budgets apply inside a single raw token', () => {
  expect(() =>
    decode(complex('Data', 'array', '['.repeat(101) + '0' + ']'.repeat(101)))
  ).toThrow(/nesting budget/);
  expect(() =>
    decode(complex('Data', 'array', '[' + '0,'.repeat(200000) + '0]'))
  ).toThrow(/node budget/);
});

test('extensions retain independent global/scene defaults and instance metadata', () => {
  const source = `extension {\n name = "E"\n global_variables {\n${scalar(
    'State',
    'number',
    1
  )}\n}\n scene_variables {\n${scalar('State', 'number', 2)}\n}\n}`;
  const parsed = decodeSettingsDocument(source);
  expect(parsed.payload.globalVariables[0].value).toBe(1);
  expect(parsed.payload.sceneVariables[0].value).toBe(2);
  expect(
    decodeSettingsDocument(
      serializeSettingsDocument('extension', parsed.payload)
    ).payload
  ).toEqual(parsed.payload);
  const instance = decodeSettingsDocument(
    scene(
      `layer {\n id = "base"\n name = ""\n}\ninstance {\n id = "ef3ef49d-f20f-4450-b373-0ce43291a002"\n object = "Player"\n layer = "base"\n position = [0,0]\n${variables(
        complex('Data', 'structure', '{}', 'folded = false')
      )}\n}`
    )
  );
  expect(
    compileLayoutDocument(instance.layout, {
      kind: 'scene',
      objectNames: ['Player'],
      locations: instance.locations,
    }).instances[0].initialVariables[0].folded
  ).toBe(false);
});

test('structure order restores numeric keys recursively while current array and root order remain authoritative', () => {
  const old = scene(
    variables(
      complex(
        'Data',
        'structure',
        '{"10":1,"2":2,"Nested":{"Z":1,"A":2},"Array":[{"Z":1,"A":2}]}'
      ) +
        '\n' +
        scalar('Last', 'number', 3)
    )
  );
  const incoming = scene(
    variables(
      scalar('Last', 'number', 4) +
        '\n' +
        complex(
          'Data',
          'structure',
          '{"2":2,"10":1,"New":3,"Array":[{"A":2,"Z":1},5],"Nested":{"A":2,"Z":1}}'
        )
    )
  );
  const result = decodeSettingsDocument(
    preserveVariableStructureOrder(incoming, old)
  ).payload.variables;
  expect(result.map(v => v.name)).toEqual(['Last', 'Data']);
  expect(result[1].children.map(v => v.name)).toEqual([
    '10',
    '2',
    'Nested',
    'Array',
    'New',
  ]);
  expect(result[1].children[2].children.map(v => v.name)).toEqual(['Z', 'A']);
  expect(result[1].children[3].children[1].value).toBe(5);
});

test('formatting preserves JSON body, comments, raw delimiters and newline string values', () => {
  const source = scene(
    variables(
      complex(
        'Data',
        'structure',
        '{"text":"\\n\\"\\"\\" {{}}", "line": "hello"}',
        '// keep metadata comment\nfolded = false'
      )
    )
  );
  const formatted = formatSettingsDsl(source);
  expect(formatted).toContain('{"text":"\\n\\"\\"\\" {{}}", "line": "hello"}');
  expect(formatted).toContain('// keep metadata comment');
  expect(formatSettingsDsl(formatted)).toBe(formatted);
  roundTrip(source);
});

test('writer rejects invalid native values and ignores identity without losing nested metadata', () => {
  for (const variable of [
    { name: 'N', type: 'number', value: Infinity },
    { name: 'N', type: 'number', value: 9007199254740992 },
    {
      name: 'N',
      type: 'structure',
      children: [
        { name: 'X', type: 'number', value: 1 },
        { name: 'X', type: 'number', value: 2 },
      ],
    },
  ])
    expect(() =>
      serializeSettingsDocument('scene', {
        name: 'Main',
        variables: [variable],
      })
    ).toThrow();
  const printed = serializeSettingsDocument('scene', {
    name: 'Main',
    variables: [
      {
        name: 'Health',
        type: 'number',
        value: 10,
        persistentUuid: 'ignored',
        id: '',
      },
    ],
  });
  expect(printed).not.toMatch(/persistentUuid|\bid\s*=|Health\s*=/);
  expect(decodeSettingsDocument(printed).payload.variables[0]).toEqual({
    name: 'Health',
    type: 'number',
    value: 10,
  });
  expect(
    decodeSettingsDocument(
      serializeSettingsDocument('scene', { name: 'Main', variables: [] })
    ).payload.variables
  ).toEqual([]);
});
