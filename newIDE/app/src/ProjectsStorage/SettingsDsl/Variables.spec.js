// @noflow
import {
  decodeSettingsDocument,
  serializeSettingsDocument,
  formatSettingsDsl,
  preserveVariableStructureOrder,
} from '.';
import { compileLayoutDocument } from '../LayoutDocument';
import { decodeVariableContainer, encodeVariableContainer } from './Variables';
import { parseSettingsSyntax } from './Syntax';

const scene = body =>
  `scene {\n name = "Main"\n background = "#000000"\n${body}\n}\n`;
const variables = body => `variables {\n${body}\n}`;
const scalar = (name, type, value, extra = '') =>
  `${name} {\n type = "${type}"\n value = ${JSON.stringify(
    value
  )}\n${extra}\n}`;
const complex = (name, type, body = '', extra = '') =>
  `${name} {\n type = "${type}"\n${extra}\n ${
    type === 'structure' ? 'members' : 'elements'
  } {\n${body}\n}\n}`;
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

test('typed descriptors preserve special and numeric names', () => {
  const names = [
    'Health',
    '10',
    '2',
    '__proto__',
    'constructor',
    'true',
    'Display Name',
  ];
  const { parsed } = roundTrip(
    scene(
      variables(
        names.map(name => scalar(JSON.stringify(name), 'number', 1)).join('\n')
      )
    )
  );
  expect(parsed.payload.variables.map(v => v.name)).toEqual(names);
});

test('recursive structures, heterogeneous arrays and empty containers round trip', () => {
  const source = complex(
    'Data',
    'structure',
    [
      scalar('value', 'number', 1),
      scalar('type', 'string', 'string'),
      complex('"10"', 'array'),
      complex('"2"', 'structure'),
      complex('__proto__', 'structure', scalar('constructor', 'boolean', true)),
      complex('members', 'structure', scalar('elements', 'number', 2)),
      complex(
        'Inventory',
        'array',
        [
          scalar('item', 'string', 'Sword'),
          complex(
            'item',
            'structure',
            scalar('Name', 'string', 'Shield') +
              '\n' +
              scalar('Count', 'number', 1)
          ),
          complex('item', 'array', scalar('item', 'boolean', false)),
          complex('item', 'array'),
        ].join('\n')
      ),
    ].join('\n')
  );
  const { parsed, printed } = roundTrip(scene(variables(source)));
  expect(parsed.payload.variables[0].children.map(v => v.name)).toEqual([
    'value',
    'type',
    '10',
    '2',
    '__proto__',
    'members',
    'Inventory',
  ]);
  const items = parsed.payload.variables[0].children[6].children;
  expect(items[0]).toEqual({ type: 'string', value: 'Sword' });
  expect(items[1].children[0].value).toBe('Shield');
  expect(items[2].children[0]).toEqual({ type: 'boolean', value: false });
  expect(printed).toContain('elements {');
  expect(printed).not.toMatch(/\b(?:json|metadata)\s*=/);
  expect({}.constructor).toBe(Object);
});

test('root and descendant enum/editing state stay on their own descriptors', () => {
  const source = complex(
    'State',
    'structure',
    [
      scalar(
        'Mode',
        'enum',
        'Idle',
        'values = ["Idle", "Run"]\nhasMixedValues = false'
      ),
      complex(
        '"a/b~c"',
        'array',
        [
          scalar(
            'item',
            'enum',
            'Run',
            'values = ["Idle", "Run"]\nfolded = false'
          ),
          complex(
            'item',
            'structure',
            scalar('Enabled', 'boolean', true, 'folded = false'),
            'folded = true'
          ),
        ].join('\n'),
        'folded = false'
      ),
    ].join('\n'),
    'folded = false\nhasMixedValues = false'
  );
  const { parsed } = roundTrip(scene(variables(source)));
  const root = parsed.payload.variables[0];
  expect(root).toMatchObject({ folded: false, hasMixedValues: false });
  expect(root.children[0]).toMatchObject({
    type: 'enum',
    values: ['Idle', 'Run'],
    hasMixedValues: false,
  });
  expect(root.children[1].children[0]).toEqual({
    type: 'enum',
    value: 'Run',
    values: ['Idle', 'Run'],
    folded: false,
  });
  expect(root.children[1].children[1].children[0].folded).toBe(false);
});

test.each([
  'Health = 10',
  'Position {\n X = 1\n}',
  'A {}',
  'A {\n value = 1\n}',
  'A {\n type = "number"\n value = "1"\n}',
  'A {\n type = "number"\n value = Counter\n}',
  'A {\n type = "number"\n value = [1]\n}',
  'A {\n type = "boolean"\n value = 1\n}',
  'A {\n type = "structure"\n json = "{}"\n}',
  'A {\n type = "array"\n json = "[]"\n}',
  'A {\n type = "structure"\n members {}\n metadata = "{}"\n}',
  'A {\n type = "structure"\n value = "{}"\n members {}\n}',
  'A {\n type = "structure"\n}',
  'A {\n type = "array"\n}',
  'A {\n type = "structure"\n elements {}\n}',
  'A {\n type = "array"\n members {}\n}',
  'A {\n type = "array"\n items {}\n}',
  'A {\n type = "array"\n elements {\n Other {\n type = "number"\n value = 1\n}\n}\n}',
  'A {\n type = "array"\n elements {\n item = 1\n}\n}',
  'A {\n type = "structure"\n members {\n X = 1\n}\n}',
  'A {\n type = "structure"\n members {}\n members {}\n}',
  'A {\n type = "structure"\n members {\n "" {\n type = "number"\n value = 1\n}\n}\n}',
  'A {\n type = "string"\n value = "x"\n members {}\n}',
  'A {\n type = "number"\n value = 1\n name = "Other"\n}',
  'A {\n type = "number"\n value = 1\n id = ""\n}',
  'A {\n type = "enum"\n value = "Idle"\n values = []\n}',
  'A {\n type = "enum"\n value = "Idle"\n values = ["Idle","Idle"]\n}',
  'A {\n type = "enum"\n value = "Idle"\n values = ["Run"]\n}',
  'A {\n type = "number"\n value = 1\n values = ["Idle"]\n}',
  'A {\n type = "number"\n value = 1\n folded = "false"\n}',
  scalar('A', 'number', 1) + '\n' + scalar('A', 'number', 2),
  complex(
    'A',
    'structure',
    scalar('X', 'number', 1) + '\n' + scalar('X', 'number', 2)
  ),
  complex('A', 'array', scalar('item', 'number', 1, 'metadata = "{}"')),
])('rejects old or invalid declarations: %s', source => {
  expect(() => decode(source)).toThrow();
});

test('nested errors point directly to the invalid GDL field, including CRLF', () => {
  for (const newline of ['\n', '\r\n']) {
    const source = scene(
      variables(complex('Data', 'array', scalar('item', 'number', 'invalid')))
    ).replace(/\n/g, newline);
    try {
      decodeSettingsDocument(source);
      throw new Error('Expected rejection');
    } catch (error) {
      expect(error.code).toBe('SETTINGS_INVALID_VARIABLE');
      expect(source.slice(error.offset, error.endOffset)).toBe('"invalid"');
      expect(error.line).toBe(source.slice(0, error.offset).split('\n').length);
    }
  }
});

test('recursive data obeys nesting and node budgets', () => {
  let body = scalar('item', 'number', 0);
  for (let index = 0; index < 101; index++)
    body = complex('item', 'array', body);
  expect(() => decode(body)).toThrow(/nesting budget/);
  const item = parseSettingsSyntax(variables(scalar('N', 'number', 0))).root
    .children[0];
  expect(() =>
    decodeVariableContainer({
      properties: {},
      children: Array(200001)
        .fill(null)
        .map((_, i) => ({ ...item, type: String(i) })),
    })
  ).toThrow(/node budget/);
});

test('extensions and instances use the same recursive variable contract', () => {
  const parsed = decodeSettingsDocument(
    `extension {\n name = "E"\n global_variables {\n${complex(
      'State',
      'structure'
    )}\n}\n scene_variables {\n${complex('State', 'array')}\n}\n}`
  );
  expect(parsed.payload.globalVariables[0].type).toBe('structure');
  expect(parsed.payload.sceneVariables[0].type).toBe('array');
  expect(
    decodeSettingsDocument(
      serializeSettingsDocument('extension', parsed.payload)
    ).payload
  ).toEqual(parsed.payload);
  const instance = decodeSettingsDocument(
    scene(
      `layers {\n base {\n  name = ""\n}\n}\ninstances {\n  instance {\n   id = "ef3ef49d-f20f-4450-b373-0ce43291a002"\n   object = Player\n   layer = "base"\n   position = [0,0]\n  ${variables(
        complex('Data', 'structure', '', 'folded = false')
      )}\n  }\n}`
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

test('native structure sorting restores source order recursively without changing root or array order', () => {
  const old = scene(
    variables(
      complex(
        'Data',
        'structure',
        [
          scalar('"10"', 'number', 1),
          scalar('"2"', 'number', 2),
          complex(
            'Nested',
            'structure',
            scalar('Z', 'number', 1) + '\n' + scalar('A', 'number', 2)
          ),
          complex(
            'Array',
            'array',
            complex(
              'item',
              'structure',
              scalar('Z', 'number', 1) + '\n' + scalar('A', 'number', 2)
            )
          ),
        ].join('\n')
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
          [
            scalar('"2"', 'number', 2),
            scalar('"10"', 'number', 1),
            scalar('New', 'number', 3),
            complex(
              'Array',
              'array',
              complex(
                'item',
                'structure',
                scalar('A', 'number', 2) + '\n' + scalar('Z', 'number', 1)
              ) +
                '\n' +
                scalar('item', 'number', 5)
            ),
            complex(
              'Nested',
              'structure',
              scalar('A', 'number', 2) + '\n' + scalar('Z', 'number', 1)
            ),
          ].join('\n')
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
  expect(result[1].children[3].children[0].children.map(v => v.name)).toEqual([
    'Z',
    'A',
  ]);
  expect(result[1].children[3].children[1].value).toBe(5);
});

test('nested string formatting preserves multiline values and comments', () => {
  const source = scene(
    variables(
      complex(
        'Data',
        'structure',
        scalar('Text', 'string', 'first\nsecond', '// keep\nfolded = false')
      )
    )
  );
  const formatted = formatSettingsDsl(source);
  expect(formatted).toContain('// keep');
  expect(formatted).toContain('value = """');
  roundTrip(source);
});

test('writer rejects invalid native data and omits identity at every depth', () => {
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
    {
      name: 'N',
      type: 'array',
      children: [{ name: 'bad', type: 'number', value: 1 }],
    },
    {
      name: 'N',
      type: 'array',
      children: [{ type: 'enum', value: 'Idle', values: ['Run'] }],
    },
  ])
    expect(() => encodeVariableContainer([variable])).toThrow();
  const printed = serializeSettingsDocument('scene', {
    name: 'Main',
    variables: [
      {
        name: 'Data',
        type: 'structure',
        id: '',
        children: [
          {
            name: 'Health',
            type: 'number',
            value: 10,
            persistentUuid: 'ignored',
            folded: false,
          },
        ],
      },
    ],
  });
  expect(printed).not.toMatch(/persistentUuid|\bid\s*=/);
  expect(
    decodeSettingsDocument(printed).payload.variables[0].children[0]
  ).toEqual({ name: 'Health', type: 'number', value: 10, folded: false });
});
