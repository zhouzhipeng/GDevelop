// @noflow
// Native event model validation, independent of any author syntax.
import { SettingsDslError } from './Syntax';
const fail = (code, message) => {
  throw new SettingsDslError(code, message);
};
const EVENT_TYPES = {
  standard: 'BuiltinCommonInstructions::Standard',
  else: 'BuiltinCommonInstructions::Else',
  while: 'BuiltinCommonInstructions::While',
  repeat: 'BuiltinCommonInstructions::Repeat',
  forEach: 'BuiltinCommonInstructions::ForEach',
  forEachChild: 'BuiltinCommonInstructions::ForEachChildVariable',
  group: 'BuiltinCommonInstructions::Group',
  comment: 'BuiltinCommonInstructions::Comment',
  link: 'BuiltinCommonInstructions::Link',
  js: 'BuiltinCommonInstructions::JsCode',
};

const COMMON_EVENT_KEYS = new Set([
  'type',
  'disabled',
  'folded',
  'aiGeneratedEventId',
]);

const EVENT_KEYS = {
  [EVENT_TYPES.standard]: new Set([
    ...COMMON_EVENT_KEYS,
    'conditions',
    'actions',
    'events',
    'variables',
  ]),
  [EVENT_TYPES.else]: new Set([
    ...COMMON_EVENT_KEYS,
    'conditions',
    'actions',
    'events',
    'variables',
  ]),
  [EVENT_TYPES.while]: new Set([
    ...COMMON_EVENT_KEYS,
    'infiniteLoopWarning',
    'whileConditions',
    'conditions',
    'actions',
    'events',
    'variables',
    'loopIndexVariable',
  ]),
  [EVENT_TYPES.repeat]: new Set([
    ...COMMON_EVENT_KEYS,
    'repeatExpression',
    'conditions',
    'actions',
    'events',
    'variables',
    'loopIndexVariable',
  ]),
  [EVENT_TYPES.forEach]: new Set([
    ...COMMON_EVENT_KEYS,
    'object',
    'conditions',
    'actions',
    'events',
    'variables',
    'loopIndexVariable',
    'orderBy',
    'order',
    'limit',
  ]),
  [EVENT_TYPES.forEachChild]: new Set([
    ...COMMON_EVENT_KEYS,
    'iterableVariableName',
    'valueIteratorVariableName',
    'keyIteratorVariableName',
    'conditions',
    'actions',
    'events',
    'variables',
    'loopIndexVariable',
  ]),
  [EVENT_TYPES.group]: new Set([
    ...COMMON_EVENT_KEYS,
    'name',
    'source',
    'creationTime',
    'colorR',
    'colorG',
    'colorB',
    'parameters',
    'events',
  ]),
  [EVENT_TYPES.comment]: new Set([
    ...COMMON_EVENT_KEYS,
    'color',
    'comment',
    'comment2',
  ]),
  [EVENT_TYPES.link]: new Set([...COMMON_EVENT_KEYS, 'target', 'include']),
  [EVENT_TYPES.js]: new Set([
    ...COMMON_EVENT_KEYS,
    'inlineCode',
    'parameterObjects',
    'useStrict',
    'eventsSheetExpanded',
  ]),
};

const asObject = (value: any, label: string): Object => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('SETTINGS_EVENT_INVALID_JSON', `${label} must be an object.`);
  }
  return value;
};

const asArray = (value: any, label: string): Array<any> => {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    fail('SETTINGS_EVENT_INVALID_JSON', `${label} must be an array.`);
  }
  return value;
};

// SerializerElement stores strings containing newlines as an array of lines in
// project JSON. Reproduce GetMultilineStringValue here instead of coercing the
// array with String(), which would insert commas into JavaScript source code.
const normalizeMultilineString = (value: any, label: string): string => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (!Array.isArray(value) || !value.every(line => typeof line === 'string')) {
    fail(
      'SETTINGS_EVENT_INVALID_JSON',
      `${label} must be a string or an array of strings.`
    );
  }

  return value.join('\n');
};

const assertOnlyKeys = (
  object: Object,
  allowed: Set<string>,
  label: string
) => {
  Object.keys(object).forEach(key => {
    if (!allowed.has(key)) {
      fail(
        'SETTINGS_EVENT_UNSUPPORTED_FIELD',
        `${label} contains unsupported field ${JSON.stringify(key)}.`
      );
    }
  });
};

const normalizeInstruction = (value: any, label: string): Object => {
  const instruction = asObject(value, label);
  assertOnlyKeys(
    instruction,
    new Set(['type', 'disabled', 'parameters', 'subInstructions']),
    label
  );
  const type = asObject(instruction.type, `${label}.type`);
  assertOnlyKeys(
    type,
    new Set(['value', 'inverted', 'await']),
    `${label}.type`
  );
  if (typeof type.value !== 'string' || !type.value) {
    fail(
      'SETTINGS_EVENT_INVALID_JSON',
      `${label}.type.value must be a non-empty string.`
    );
  }
  const parameters = asArray(instruction.parameters, `${label}.parameters`);
  if (!parameters.every(parameter => typeof parameter === 'string')) {
    fail(
      'SETTINGS_EVENT_INVALID_JSON',
      `${label}.parameters must contain strings.`
    );
  }
  return {
    type: {
      value: type.value,
      inverted: !!type.inverted,
      await: !!type.await,
    },
    disabled: !!instruction.disabled,
    parameters: [...parameters],
    subInstructions: asArray(
      instruction.subInstructions,
      `${label}.subInstructions`
    ).map((child, index) =>
      normalizeInstruction(child, `${label}.subInstructions[${index}]`)
    ),
  };
};

const normalizeVariable = (
  value: any,
  label: string,
  requireName: boolean = true
): Object => {
  const variable = asObject(value, label);
  const allowed = new Set([
    'name',
    'type',
    'folded',
    'persistentUuid',
    'value',
    'values',
    'children',
    'hasMixedValues',
  ]);
  assertOnlyKeys(variable, allowed, label);
  if (requireName && typeof variable.name !== 'string') {
    fail('SETTINGS_EVENT_INVALID_JSON', `${label} requires a string name.`);
  }
  const type =
    variable.type === undefined
      ? variable.children !== undefined
        ? 'structure'
        : 'string'
      : variable.type;
  if (typeof type !== 'string')
    fail('SETTINGS_EVENT_INVALID_JSON', `${label}.type must be a string.`);
  const result = {
    ...(typeof variable.name === 'string' ? { name: variable.name } : {}),
    type,
    folded: !!variable.folded,
    persistentUuid: String(variable.persistentUuid || ''),
    hasMixedValues: !!variable.hasMixedValues,
  };
  if (['string', 'enum', 'number', 'boolean'].includes(type)) {
    result.value =
      variable.value !== undefined
        ? variable.value
        : type === 'string'
        ? '0'
        : type === 'enum'
        ? ''
        : type === 'number'
        ? 0
        : false;
    if (type === 'enum')
      result.values = asArray(variable.values, `${label}.values`).map(String);
  } else if (type === 'structure' || type === 'array') {
    result.children = asArray(variable.children, `${label}.children`).map(
      (child, index) =>
        normalizeVariable(
          child,
          `${label}.children[${index}]`,
          type === 'structure'
        )
    );
  } else if (type !== 'mixed') {
    fail(
      'SETTINGS_EVENT_UNSUPPORTED_FIELD',
      `${label} has unknown type ${type}.`
    );
  }
  return result;
};

const normalizeCommon = (event: Object): Object => {
  const common = {
    type: event.type,
    disabled: !!event.disabled,
    folded: !!event.folded,
  };
  if (event.aiGeneratedEventId)
    common.aiGeneratedEventId = String(event.aiGeneratedEventId);
  return common;
};

const normalizeEvent = (value: any, label: string): Object => {
  const event = asObject(value, label);
  const type = event.type;
  if (typeof type !== 'string' || !EVENT_KEYS[type]) {
    fail(
      'SETTINGS_EVENT_UNSUPPORTED_EVENT',
      `${label} has unsupported event type ${JSON.stringify(type)}.`
    );
  }
  assertOnlyKeys(event, EVENT_KEYS[type], label);
  const common = normalizeCommon(event);
  const instructions = key =>
    asArray(event[key], `${label}.${key}`).map((item, index) =>
      normalizeInstruction(item, `${label}.${key}[${index}]`)
    );
  const children = () =>
    asArray(event.events, `${label}.events`).map((item, index) =>
      normalizeEvent(item, `${label}.events[${index}]`)
    );
  const variables = () =>
    asArray(event.variables, `${label}.variables`).map((item, index) =>
      normalizeVariable(item, `${label}.variables[${index}]`)
    );
  if (type === EVENT_TYPES.standard || type === EVENT_TYPES.else) {
    return {
      ...common,
      conditions: instructions('conditions'),
      actions: instructions('actions'),
      events: children(),
      variables: variables(),
    };
  }
  if (type === EVENT_TYPES.while) {
    return {
      ...common,
      infiniteLoopWarning: !!event.infiniteLoopWarning,
      whileConditions: instructions('whileConditions'),
      conditions: instructions('conditions'),
      actions: instructions('actions'),
      events: children(),
      variables: variables(),
      loopIndexVariable: String(event.loopIndexVariable || ''),
    };
  }
  if (type === EVENT_TYPES.repeat) {
    return {
      ...common,
      repeatExpression: String(event.repeatExpression || ''),
      conditions: instructions('conditions'),
      actions: instructions('actions'),
      events: children(),
      variables: variables(),
      loopIndexVariable: String(event.loopIndexVariable || ''),
    };
  }
  if (type === EVENT_TYPES.forEach) {
    return {
      ...common,
      object: String(event.object || ''),
      conditions: instructions('conditions'),
      actions: instructions('actions'),
      events: children(),
      variables: variables(),
      loopIndexVariable: String(event.loopIndexVariable || ''),
      orderBy: String(event.orderBy || ''),
      order: String(event.order || 'asc'),
      limit: String(event.limit || ''),
    };
  }
  if (type === EVENT_TYPES.forEachChild) {
    return {
      ...common,
      iterableVariableName: String(event.iterableVariableName || ''),
      valueIteratorVariableName: String(event.valueIteratorVariableName || ''),
      keyIteratorVariableName: String(event.keyIteratorVariableName || ''),
      conditions: instructions('conditions'),
      actions: instructions('actions'),
      events: children(),
      variables: variables(),
      loopIndexVariable: String(event.loopIndexVariable || ''),
    };
  }
  if (type === EVENT_TYPES.group) {
    return {
      ...common,
      name: String(event.name || ''),
      source: String(event.source || ''),
      creationTime: Number(event.creationTime || 0),
      colorR: Number(event.colorR == null ? 74 : event.colorR),
      colorG: Number(event.colorG == null ? 176 : event.colorG),
      colorB: Number(event.colorB == null ? 228 : event.colorB),
      parameters: asArray(event.parameters, `${label}.parameters`).map(String),
      events: children(),
    };
  }
  if (type === EVENT_TYPES.comment) {
    const color = asObject(event.color || {}, `${label}.color`);
    assertOnlyKeys(
      color,
      new Set(['r', 'g', 'b', 'textR', 'textG', 'textB']),
      `${label}.color`
    );
    return {
      ...common,
      color: {
        r: Number(color.r || 0),
        g: Number(color.g || 0),
        b: Number(color.b || 0),
        textR: Number(color.textR || 0),
        textG: Number(color.textG || 0),
        textB: Number(color.textB || 0),
      },
      comment: String(event.comment || ''),
      comment2: String(event.comment2 || ''),
    };
  }
  if (type === EVENT_TYPES.link) {
    const include = asObject(
      event.include || { includeConfig: 0 },
      `${label}.include`
    );
    assertOnlyKeys(include, new Set(['includeConfig']), `${label}.include`);
    if (Number(include.includeConfig || 0) !== 0) {
      fail(
        'SETTINGS_EVENT_INVALID_JSON',
        `${label}.include must include all events.`
      );
    }
    return {
      ...common,
      target: String(event.target || ''),
      include: { includeConfig: 0 },
    };
  }
  return {
    ...common,
    inlineCode: (() => {
      const code = normalizeMultilineString(
        event.inlineCode,
        `${label}.inlineCode`
      ).replace(/\r\n?/g, '\n');
      return code && !code.endsWith('\n') ? `${code}\n` : code;
    })(),
    parameterObjects: String(event.parameterObjects || ''),
    useStrict: !!event.useStrict,
    eventsSheetExpanded: !!event.eventsSheetExpanded,
  };
};

export const parseLegacyEventsJson = (json: string): Array<Object> => {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    fail(
      'SETTINGS_EVENT_INVALID_JSON',
      `Invalid events JSON: ${String(error.message || error)}`
    );
  }
  return asArray(parsed, 'Events JSON').map((event, index) =>
    normalizeEvent(event, `events[${index}]`)
  );
};
