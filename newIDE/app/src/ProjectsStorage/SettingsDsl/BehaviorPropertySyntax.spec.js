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
    'name="Height" modification_sign="+" value={{2 + getProperty(name="Height")}}',
    ['Object', 'Behavior', '+', '2 + Object.Behavior::PropertyHeight()'],
  ],
  ['name="Title" value="Hello"', ['Object', 'Behavior', '=', '"Hello"']],
  [
    'name="Title" value={{getProperty(name="Title") + "!"}}',
    ['Object', 'Behavior', '=', 'Object.Behavior::PropertyTitle() + "!"'],
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
  const events = compile(`event {
    type = "repeat"
    count = {{max(1, getProperty(name="Height"))}}
    conditions {
      getProperty { name="Fresh"
 flags {
inverted = true
} }
      getProperty { name="Height" comparison_sign=">" value=2 }
    }
    actions { setProperty { name="Fresh" value=false
 flags {
disabled = true
} } }
    event { actions { setProperty { name="Height" value={{getProperty(name="Height") + 1}} } } }
  }`);
  expect(events[0].repeatExpression).toBe(
    'max(1, Object.Behavior::PropertyHeight())'
  );
  expect(events[0].conditions[0].type).toMatchObject({
    value: 'Camera::Follow::PropertyFresh',
    inverted: true,
  });
  const written = appendSettingsEvents('function {}', events, options, uri);
  expect(written).toMatch(/setProperty \{\s+name = "Fresh"/);
  expect(written).toContain('getProperty(name="Height")');
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
  ['setProperty { name="Missing" value=1 }', 'Unknown action property'],
  ['setProperty { name={{"Height"}} value=1 }', 'literal identifier'],
  ['setProperty { name="Height" value="12" }', 'semantic number'],
  ['setProperty { name="Fresh" value="false" }', 'semantic boolean'],
  ['setProperty { name="Fresh" }', 'requires value'],
  ['setProperty { name="Height" value=1 typo=2 }', 'Unknown property argument'],
  [
    'setProperty { name="Fresh" value=false modification_sign="+" }',
    'has no parameter',
  ],
  [
    'setProperty { name="Height" value={{getProperty(name="Fresh")}} }',
    'Boolean properties',
  ],
  [
    'setProperty { name="Height" value={{getProperty(name="Missing")}} }',
    'Unknown action property',
  ],
  [
    'setProperty { name="Height" value={{getProperty(name="Height" extra=1)}} }',
    'accepts only name',
  ],
])('rejects invalid property access %s', (source, message) => {
  expect(() => action(source)).toThrow(message);
});

test('rejects aliases outside behavior scope and reports source location', () => {
  expect(() =>
    compile(
      'event { actions { setProperty { name="Height" value=1 } } }',
      'game://scenes/Main/functions/update.gdl'
    )
  ).toThrow('require a behavior function');
  try {
    action('setProperty { name="Missing" value=1 }');
  } catch (error) {
    expect(error.fileUri).toBe(uri);
    expect(error.code).toBe('SETTINGS_INSTRUCTION_ARGUMENT');
  }
});

test('does not rewrite quoted text or similarly named member calls', () => {
  const expression =
    '"getProperty(name=\\"Missing\\")" + getProperty(name="Title")';
  expect(
    action(`setProperty { name="Title" value={{${expression}}} }`).parameters[3]
  ).toBe(
    '"getProperty(name=\\"Missing\\")" + Object.Behavior::PropertyTitle()'
  );
  expect(
    options.resolveInstruction.resolvePropertyExpression(
      'Other.getProperty("Missing") + Other . getProperty("Missing") + forgetProperty()',
      uri
    )
  ).toBe(
    'Other.getProperty("Missing") + Other . getProperty("Missing") + forgetProperty()'
  );
  const nativeText =
    '"Object.Behavior::PropertyTitle()" + Object.Behavior::PropertyTitle()';
  expect(
    options.formatInstruction.formatPropertyExpression(nativeText, uri)
  ).toBe('"Object.Behavior::PropertyTitle()" + getProperty(name="Title")');
});

test('native instruction names remain accepted; missing legacy slots remain lossless', () => {
  const legacy = action(
    'Camera::Follow::SetPropertyFresh { object="Object" behavior="Behavior" }'
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
      'function {\n events {\n event {\n conditions {\n getProperty { name="Fresh" }\n }\n actions {\n setProperty { name="Height" value=1 }\n }\n }\n }\n}',
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
      instruction: action('setProperty { name="Height" value=1 }'),
      fileUri: uri,
    })
  ).toBe('setProperty { name="Height" value=1 }');
});

test.each([
  [
    'Camera::Follow::SetPropertyHeight { object="Object" behavior="Behavior" value=1 }',
  ],
  [
    'Camera::Follow::SetPropertyHeight { object="Object" behavior="Behavior" modification_sign="=" }',
  ],
  ['Camera::Follow::SetPropertyFresh { new_value_to_set=true }'],
])('preserves legacy omitted slots: %s', source => {
  const original = action(source);
  const written = options.formatInstruction({
    kind: 'action',
    instruction: original,
    fileUri: uri,
  });
  expect(action(written)).toEqual(original);
});
