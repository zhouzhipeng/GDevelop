// @noflow
import { withTestInstructionSemantics } from './TestHelpers';
import { appendSettingsEvents, compileSettingsEvents } from './Events';
import {
  createCatalogInstructionResolver,
  createCatalogInstructionFormatter,
} from './InstructionCatalog';
import { behaviorTypeFromFileUri } from './BehaviorPropertySyntax';
import { analyzeGdlEvents } from '../../EventsSemantics/AnalyzeEvents';

const uri = 'game://extensions/Camera/behaviors/Follow/functions/update.gdl';
const owner = { extension: 'Camera', behaviorType: 'Camera::Follow' };
const target = [
  { dslName: 'object', valueKind: 'object', type: 'object' },
  { dslName: 'behavior', valueKind: 'behavior', type: 'behavior' },
];
const property = (kind, name, valueKind) => ({
  type: `Camera::Follow::${
    kind === 'action' ? 'SetProperty' : 'Property'
  }${name}`,
  owner,
  parameters: [
    ...target,
    ...(valueKind === 'boolean'
      ? kind === 'action'
        ? [{ dslName: 'new_value_to_set', valueKind, type: 'yesorno' }]
        : []
      : [
          {
            dslName:
              kind === 'action' ? 'modification_sign' : 'comparison_sign',
            valueKind: 'name',
            acceptedValues: ['=', '+', '>'],
          },
          {
            dslName: 'value',
            valueKind,
            type: valueKind === 'text' ? 'string' : 'number',
          },
        ]),
  ],
});
const catalog = withTestInstructionSemantics({
  format: 'gdevelop-gdl-instruction-catalog',
  formatVersion: 7,
  actions: ['action'].flatMap(kind =>
    ['Height', 'Title', 'Fresh'].map((name, index) =>
      property(kind, name, ['number', 'text', 'boolean'][index])
    )
  ),
  conditions: ['Height', 'Title', 'Fresh'].map((name, index) =>
    property('condition', name, ['number', 'text', 'boolean'][index])
  ),
  expressions: [],
});
const options = {
  resolveInstruction: createCatalogInstructionResolver(catalog),
  formatInstruction: createCatalogInstructionFormatter(catalog),
};
const compile = (body, file = uri) =>
  compileSettingsEvents(
    `function { events { ${body}\n}\n}`
      .replace(
        / (?=(?:object|behavior|value|comparison_sign|modification_sign|name)=)/g,
        '\n'
      )
      .replace(/(?<!\{)\{(?!\{)\s*/g, '{\n')
      .replace(/\s*(?<!\})\}(?!\})/g, '\n}'),
    options,
    file
  );
const action = source =>
  compile(`event { actions { ${source}\n}\n}`)[0].actions[0];

test('behavior context supports canonical, encoded, and absolute paths', () => {
  expect(behaviorTypeFromFileUri(uri)).toBe('Camera::Follow');
  expect(
    behaviorTypeFromFileUri(
      'C:\\game\\extensions\\Camera\\behaviors\\Follow\\functions\\update.gdl'
    )
  ).toBe('Camera::Follow');
  expect(
    behaviorTypeFromFileUri(
      '/game/extensions/My%20Camera/behaviors/Follow/functions/update.gdl'
    )
  ).toBe('My Camera::Follow');
  expect(
    behaviorTypeFromFileUri('game://scenes/Camera/functions/update.gdl')
  ).toBeNull();
});

test.each([
  ['name="Height" value=12', ['Object', 'Behavior', '=', '12']],
  [
    'name="Height" modification_sign="+" value={{2 + Height}}',
    ['Object', 'Behavior', '+', '2 + Height'],
  ],
  ['name="Title" value="Hello"', ['Object', 'Behavior', '=', '"Hello"']],
  [
    'name="Title" value={{Title + "!"}}',
    ['Object', 'Behavior', '=', 'Title + "!"'],
  ],
  ['name="Fresh" value=false', ['Object', 'Behavior', 'no']],
  ['name="Fresh" value=true', ['Object', 'Behavior', 'yes']],
  [
    'name="Height" object="Other" behavior="OtherFollow" value=3',
    ['Other', 'OtherFollow', '=', '3'],
  ],
])('lowers typed setter %s', (source, parameters) => {
  expect(action(`setProperty { ${source} }`).parameters).toEqual(parameters);
});

test('conditions, flags, nested events and loop expressions round trip', () => {
  const events = compile(`repeat {
    count = {{max(1, Height)}}
    conditions {
      getProperty { name="Fresh"
 flags {
inverted = true
} }
      getProperty {
  name = "Height"
  comparison_sign = ">"
  value = 2
}
    }
    actions { setProperty { name="Fresh" value=false
 flags {
disabled = true
} } }
    event { actions { setProperty {
  name = "Height"
  value = {{ Height + 1 }}
} } }
  }`);
  expect(events[0].repeatExpression).toBe('max(1, Height)');
  expect(events[0].conditions[0].type).toMatchObject({
    value: 'Camera::Follow::PropertyFresh',
    inverted: true,
  });
  const written = appendSettingsEvents('function {}', events, options, uri);
  expect(written).toMatch(/setProperty \{\s+name = "Fresh"/);
  expect(written).toContain('Height');
  expect(compileSettingsEvents(written, options, uri)).toEqual(events);
  expect(
    appendSettingsEvents(
      'function {}',
      compileSettingsEvents(written, options, uri),
      options,
      uri
    )
  ).toBe(written);
});

test.each([
  [
    'setProperty {\n  name = "Missing"\n  value = 1\n}',
    'Unknown action property',
  ],
  [
    'setProperty {\n  name = {{ "Height" }}\n  value = 1\n}',
    'literal identifier',
  ],
  ['setProperty {\n  name = "Height"\n  value = "12"\n}', 'semantic number'],
  ['setProperty {\n  name = "Fresh"\n  value = "false"\n}', 'semantic boolean'],
  ['setProperty {\n  name = "Fresh"\n}', 'requires value'],
  [
    'setProperty {\n  name = "Height"\n  value = 1\n  typo = 2\n}',
    'Unknown property argument',
  ],
  [
    'setProperty {\n  name = "Fresh"\n  value = false\n  modification_sign = "+"\n}',
    'has no parameter',
  ],
  [
    'setProperty {\n  name = "Height"\n  value = {{ getProperty(name="Fresh") }}\n}',
    'no longer supported',
  ],
  [
    'setProperty {\n  name = "Height"\n  value = {{ getProperty(name="Missing") }}\n}',
    'no longer supported',
  ],
  [
    'setProperty {\n  name = "Height"\n  value = {{ getProperty(name="Height" extra=1) }}\n}',
    'no longer supported',
  ],
])('rejects invalid property access %s', (source, message) => {
  expect(() => action(source)).toThrow(message);
});

test('rejects aliases outside behavior scope and reports source location', () => {
  expect(() =>
    compile(
      'event { actions { setProperty {\n  name = "Height"\n  value = 1\n} } }',
      'game://scenes/Main/functions/update.gdl'
    )
  ).toThrow('require a behavior function');
  try {
    action('setProperty {\n  name = "Missing"\n  value = 1\n}');
  } catch (error) {
    expect(error.fileUri).toBe(uri);
    expect(error.code).toBe('SETTINGS_INSTRUCTION_ARGUMENT');
  }
});

test('does not rewrite quoted text or similarly named member calls', () => {
  const expression = '"getProperty(name=\\"Missing\\")" + Title';
  expect(
    action(`setProperty { name="Title" value={{${expression}}} }`).parameters[3]
  ).toBe('"getProperty(name=\\"Missing\\")" + Title');
  expect(
    options.resolveInstruction.resolvePropertyExpression(
      'Other.getProperty("Missing") + Other . getProperty("Missing") + forgetProperty()',
      uri
    )
  ).toBe(
    'Other.getProperty("Missing") + Other . getProperty("Missing") + forgetProperty()'
  );
  const nativeText = '"Object.Behavior::PropertyTitle()" + Title';
  expect(
    options.formatInstruction.formatPropertyExpression(nativeText, uri)
  ).toBe(nativeText);
});

test('native instruction names remain accepted; missing legacy slots remain lossless', () => {
  const legacy = action(
    'Camera::Follow::SetPropertyFresh {\n  object = "Object"\n  behavior = "Behavior"\n}'
  );
  const written = options.formatInstruction({
    kind: 'action',
    instruction: legacy,
    fileUri: uri,
  });
  expect(written).toContain('Camera::Follow::SetPropertyFresh');
  expect(action(written)).toEqual(legacy);
});

test('semantic analysis resolves aliases to their native metadata', () => {
  const result = analyzeGdlEvents({
    source:
      'function {\n events {\n event {\n conditions {\n getProperty {\n  name = "Fresh"\n}\n }\n actions {\n setProperty {\n  name = "Height"\n  value = 1\n}\n }\n }\n }\n}',
    file: uri,
    catalog,
    symbols: { Object: { id: 'behavior:Object' } },
    owner: {
      kind: 'behavior',
      identity: 'Camera::Follow',
      functionName: 'update',
      variables: {},
    },
    detail: 'steps',
  });
  expect(result.success).toBe(true);
  expect(JSON.stringify(result)).toContain('Camera::Follow::SetPropertyHeight');
});

test('canonical setters omit implicit target and assignment operator', () => {
  expect(
    options.formatInstruction({
      kind: 'action',
      instruction: action('setProperty {\nname="Height"\nvalue=1\n}'),
      fileUri: uri,
    })
  ).toBe('setProperty {\nname="Height"\nvalue=1\n}');
});

test.each([
  [
    'Camera::Follow::SetPropertyHeight {\n  object = "Object"\n  behavior = "Behavior"\n  value = 1\n}',
  ],
  [
    'Camera::Follow::SetPropertyHeight {\n  object = "Object"\n  behavior = "Behavior"\n  modification_sign = "="\n}',
  ],
  ['Camera::Follow::SetPropertyFresh {\n  new_value_to_set = true\n}'],
])('preserves legacy omitted slots: %s', source => {
  const original = action(source);
  const written = options.formatInstruction({
    kind: 'action',
    instruction: original,
    fileUri: uri,
  });
  expect(action(written)).toEqual(original);
});

test('resolves and formats property aliases from generated behavior parameter metadata without owner', () => {
  const generatedCatalog = {
    ...catalog,
    actions: catalog.actions.map(({ owner: ignored, ...entry }) => ({
      ...entry,
      parameters: entry.parameters.map(parameter =>
        parameter.valueKind === 'behavior'
          ? { ...parameter, extraInfo: 'Camera::Follow' }
          : parameter
      ),
    })),
    conditions: catalog.conditions.map(({ owner: ignored, ...entry }) => ({
      ...entry,
      parameters: entry.parameters.map(parameter =>
        parameter.valueKind === 'behavior'
          ? { ...parameter, extraInfo: 'Camera::Follow' }
          : parameter
      ),
    })),
  };
  const resolver = createCatalogInstructionResolver(generatedCatalog);
  const formatter = createCatalogInstructionFormatter(generatedCatalog);
  for (const [kind, source] of [
    ['condition', 'getProperty {\n  name = "Fresh"\n}'],
    ['action', 'setProperty {\n  name = "Fresh"\n  value = false\n}'],
    [
      'action',
      'setProperty {\n  name = "Height"\n  value = {{ Height + 2 }}\n}',
    ],
  ]) {
    const instruction = resolver({ kind, source, fileUri: uri });
    const formatted = formatter({ kind, instruction, fileUri: uri });
    expect(formatted).toContain(
      kind === 'condition' ? 'getProperty {' : 'setProperty {'
    );
    expect(resolver({ kind, source: formatted, fileUri: uri })).toEqual(
      instruction
    );
  }
});

test('ordinary user function calls are not mistaken for the removed named-argument alias', () => {
  expect(
    options.resolveInstruction.resolvePropertyExpression(
      'getProperty(Height) + MyExtension::getProperty(Title)',
      uri
    )
  ).toBe('getProperty(Height) + MyExtension::getProperty(Title)');
});
