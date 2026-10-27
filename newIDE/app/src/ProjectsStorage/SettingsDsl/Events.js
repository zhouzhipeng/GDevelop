// @noflow
import { parse as parseJavaScript } from 'acorn';
import {
  SettingsDslError,
  parseSettingsSyntax,
  printSettingsSyntax,
  MAX_SETTINGS_DEPTH,
} from './Syntax';
import { decodeVariableNode, encodeVariableNode } from './Variables';

const native = name => `BuiltinCommonInstructions::${name}`;
export const EVENT_TYPES = {
  standard: native('Standard'),
  else: native('Else'),
  repeat: native('Repeat'),
  while: native('While'),
  for_each: native('ForEach'),
  for_each_child: native('ForEachChildVariable'),
  javascript: native('JsCode'),
  group: native('Group'),
  comment: native('Comment'),
  link: native('Link'),
};
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const fields = n =>
  Object.fromEntries(
    Object.entries(n.properties).map(([k, v]) => [k, v.value])
  );
const make = (type, data = {}, children = []) => ({
  type,
  properties: Object.fromEntries(
    Object.entries(data).map(([k, value]) => [
      k,
      {
        value,
        ...(expressionFields.includes(k) &&
        value &&
        typeof value.expression === 'string'
          ? { expression: true }
          : {}),
      },
    ])
  ),
  children,
});
const error = (message, node, fileUri, code = 'SETTINGS_EVENT_CONTEXT') => {
  throw new SettingsDslError(code, message, fileUri, node.location, node.type);
};
const common = ['disabled', 'folded', 'aiGeneratedEventId'];
const bodyTypes = [
  'standard',
  'else',
  'repeat',
  'while',
  'for_each',
  'for_each_child',
];
const extra = {
  standard: {},
  else: {},
  repeat: { count: 'repeatExpression', index: 'loopIndexVariable' },
  while: {
    infiniteLoopWarning: 'infiniteLoopWarning',
    index: 'loopIndexVariable',
  },
  for_each: {
    object: 'object',
    index: 'loopIndexVariable',
    order_by: 'orderBy',
    order: 'order',
    limit: 'limit',
  },
  for_each_child: {
    iterable: 'iterableVariableName',
    index: 'loopIndexVariable',
    value: 'valueIteratorVariableName',
    key: 'keyIteratorVariableName',
  },
  javascript: {
    strict: 'useStrict',
    objects: 'parameterObjects',
    expanded: 'eventsSheetExpanded',
  },
  group: {
    name: 'name',
    source: 'source',
    creationTime: 'creationTime',
    parameters: 'parameters',
  },
  comment: { text: 'comment', secondaryText: 'comment2' },
  link: { target: 'target' },
};
const expressionFields = ['count', 'order_by', 'limit'];
const booleans = [
  'disabled',
  'folded',
  'strict',
  'expanded',
  'infiniteLoopWarning',
];
const check = (n, allowed, uri) => {
  for (const [key, property] of Object.entries(n.properties)) {
    if (!allowed.includes(key))
      error(`Unknown ${n.type} field ${key}.`, property, uri);
    if (booleans.includes(key) && typeof property.value !== 'boolean')
      error(`${key} must be boolean.`, property, uri);
  }
};
const color = (value, fallback, node, uri) => {
  const result = value === undefined ? fallback : value;
  if (
    !Array.isArray(result) ||
    result.length !== 3 ||
    result.some(v => !Number.isInteger(v) || v < 0 || v > 255)
  )
    error('Color requires three integers in 0..255.', node, uri);
  return result;
};
const normCode = text => {
  if (Array.isArray(text)) text = text.join('\n');
  if (typeof text !== 'string')
    throw new Error('JavaScript inlineCode must be text.');
  const normalized = text.replace(/\r\n?/g, '\n');
  return normalized && !normalized.endsWith('\n')
    ? `${normalized}\n`
    : normalized;
};

const decodeInstruction = (n, kind, options, uri, depth) => {
  if (depth > MAX_SETTINGS_DEPTH)
    error('Instruction nesting budget exceeded.', n, uri);
  if (!n.instruction) error('Expected a catalog instruction.', n, uri);
  const allowed =
    kind === 'condition' ? ['disabled', 'inverted'] : ['disabled', 'awaited'];
  check(n, allowed, uri);
  const flags = fields(n);
  if (Object.values(flags).some(v => typeof v !== 'boolean'))
    error('Instruction flags must be boolean.', n, uri);
  if (!options.resolveInstruction)
    error(
      'A project instruction catalog is required.',
      n,
      uri,
      'SETTINGS_INSTRUCTION_UNKNOWN'
    );
  let result;
  try {
    result = options.resolveInstruction({
      kind,
      source: n.source,
      fileUri: uri,
      line: n.location ? n.location.line : 1,
    });
  } catch (cause) {
    const argument = n.arguments[cause.parameterName];
    const location = argument
      ? cause.code === 'GDL_CATALOG_UNKNOWN_PARAMETER'
        ? argument.keyLocation
        : argument.location
      : n.location;
    error(
      cause.message,
      { ...n, location },
      uri,
      cause.code === 'GDL_CATALOG_UNKNOWN_INSTRUCTION'
        ? 'SETTINGS_INSTRUCTION_UNKNOWN'
        : 'SETTINGS_INSTRUCTION_ARGUMENT'
    );
  }
  // Keep the author spelling and locations, while analysis can follow aliases
  // to the exact catalog instruction that was validated.
  Object.defineProperty(n, 'resolvedInstructionType', {
    value: result.type.value,
  });
  const capabilities = result.catalogCapabilities;
  if (capabilities && n.children.length && !capabilities.canHaveSubInstructions)
    error(
      'Instruction does not support children.',
      n,
      uri,
      'SETTINGS_INSTRUCTION_CHILDREN'
    );
  if (
    capabilities &&
    flags.awaited &&
    !(capabilities.isAsync || capabilities.isOptionallyAsync)
  )
    error('Action is not asynchronous.', n, uri, 'SETTINGS_INSTRUCTION_FLAGS');
  result = {
    ...result,
    type: { ...result.type },
    subInstructions: n.children.map(c =>
      decodeInstruction(c, kind, options, uri, depth + 1)
    ),
  };
  if (own(flags, 'disabled')) result.disabled = flags.disabled;
  if (own(flags, 'inverted')) result.type.inverted = flags.inverted;
  if (own(flags, 'awaited')) result.type.await = flags.awaited;
  if (options.validateInstructionCapabilities)
    options.validateInstructionCapabilities({
      kind,
      instruction: result,
      node: n,
      fileUri: uri,
    });
  return result;
};
export const decodeEventList = (
  container,
  options = {},
  uri,
  depth = 0,
  identities = new Set()
) => {
  if (depth > MAX_SETTINGS_DEPTH)
    error('Event nesting budget exceeded.', container, uri);
  check(container, [], uri);
  let previous;
  return container.children.map(n => {
    const data = fields(n);
    const kind =
      n.type === 'event'
        ? own(data, 'type')
          ? data.type
          : 'standard'
        : n.type;
    if (
      typeof kind !== 'string' ||
      !own(EVENT_TYPES, kind) ||
      (n.type === 'event'
        ? ['group', 'comment', 'link'].includes(kind)
        : !['group', 'comment', 'link'].includes(kind))
    )
      error(
        `Unsupported event node/type ${n.type}/${kind}.`,
        n,
        uri,
        'SETTINGS_EVENT_TYPE'
      );
    check(
      n,
      [
        ...common,
        ...(n.type === 'event' ? ['type'] : []),
        ...Object.keys(extra[kind]),
        ...(kind === 'comment'
          ? ['background', 'color']
          : kind === 'group'
          ? ['color']
          : []),
      ],
      uri
    );
    const result = {
      type: EVENT_TYPES[kind],
      disabled: !!data.disabled,
      folded: !!data.folded,
    };
    if (data.aiGeneratedEventId !== undefined) {
      if (typeof data.aiGeneratedEventId !== 'string')
        error('aiGeneratedEventId must be text.', n, uri);
      if (data.aiGeneratedEventId && identities.has(data.aiGeneratedEventId))
        error(
          'Duplicate aiGeneratedEventId in event document.',
          n,
          uri,
          'SETTINGS_EVENT_ID'
        );
      if (data.aiGeneratedEventId) identities.add(data.aiGeneratedEventId);
      result.aiGeneratedEventId = data.aiGeneratedEventId;
    }
    for (const [key, nativeKey] of Object.entries(extra[kind])) {
      if (!own(data, key)) continue;
      const value = data[key];
      if (expressionFields.includes(key)) {
        if (typeof value !== 'number' && !n.properties[key].expression)
          error(`${key} requires a number or {{...}}.`, n, uri);
        result[nativeKey] =
          typeof value === 'number'
            ? String(value)
            : options.resolveInstruction &&
              options.resolveInstruction.resolvePropertyExpression
            ? (() => {
                try {
                  return options.resolveInstruction.resolvePropertyExpression(
                    value.expression,
                    uri
                  );
                } catch (cause) {
                  error(
                    cause.message,
                    n.properties[key],
                    uri,
                    'SETTINGS_INSTRUCTION_ARGUMENT'
                  );
                }
              })()
            : value.expression;
      } else if (booleans.includes(key)) result[nativeKey] = value;
      else if (key === 'creationTime') {
        if (!Number.isFinite(value))
          error('creationTime must be finite.', n, uri);
        result[nativeKey] = value;
      } else if (key === 'parameters') {
        if (!Array.isArray(value) || value.some(v => typeof v !== 'string'))
          error('Group parameters must be a string array.', n, uri);
        result[nativeKey] = value;
      } else {
        if (typeof value !== 'string') error(`${key} must be text.`, n, uri);
        result[nativeKey] = value;
      }
    }
    const body = bodyTypes.includes(kind);
    const children = [];
    const names = new Set();
    const singleton = new Set();
    if (body)
      Object.assign(result, {
        conditions: [],
        actions: [],
        variables: [],
        events: [],
      });
    if (kind === 'group') result.events = [];
    if (kind === 'while') result.whileConditions = [];
    for (const child of n.children) {
      if (
        body &&
        ['conditions', 'actions', 'while_conditions'].includes(child.type)
      ) {
        if (
          singleton.has(child.type) ||
          (child.type === 'while_conditions' && kind !== 'while')
        )
          error(
            `Invalid or duplicate ${child.type}.`,
            child,
            uri,
            'SETTINGS_EVENT_CONTAINER'
          );
        singleton.add(child.type);
        check(child, [], uri);
        result[
          child.type === 'while_conditions' ? 'whileConditions' : child.type
        ] = child.children.map(c =>
          decodeInstruction(
            c,
            child.type === 'actions' ? 'action' : 'condition',
            options,
            uri,
            depth + 1
          )
        );
      } else if (body && child.type === 'variable') {
        const variable = decodeVariableNode(child, uri, 'event.variable');
        if (names.has(variable.name))
          error('Duplicate local variable.', child, uri);
        names.add(variable.name);
        result.variables.push(variable);
      } else if (
        (body || kind === 'group') &&
        ['event', 'group', 'comment', 'link'].includes(child.type)
      )
        children.push(child);
      else if (
        kind === 'javascript' &&
        child.type === 'code' &&
        typeof child.code === 'string' &&
        !singleton.has('code')
      ) {
        singleton.add('code');
        try {
          parseJavaScript(child.code, {
            ecmaVersion: 2022,
            allowReturnOutsideFunction: true,
            allowAwaitOutsideFunction: true,
          });
        } catch (cause) {
          error(
            `Invalid JavaScript: ${cause.message}`,
            {
              type: 'code',
              location: {
                ...child.contentLocation,
                line: child.contentLocation.line + cause.loc.line - 1,
                column: cause.loc.column + 1,
                offset: child.contentLocation.offset + cause.pos,
              },
            },
            uri,
            'SETTINGS_JAVASCRIPT'
          );
        }
        result.inlineCode = child.code;
      } else
        error(
          `Invalid ${child.type} inside ${kind}.`,
          child,
          uri,
          'SETTINGS_EVENT_CONTAINER'
        );
    }
    if (body || kind === 'group')
      result.events = decodeEventList(
        make('events', {}, children),
        options,
        uri,
        depth + 1,
        identities
      );
    if (
      kind === 'else' &&
      (!previous ||
        ![EVENT_TYPES.standard, EVENT_TYPES.else].includes(previous.type) ||
        (previous.type === EVENT_TYPES.standard && !previous.conditions.length))
    )
      error(
        'Else requires an adjacent conditional event.',
        n,
        uri,
        'SETTINGS_ELSE_TARGET'
      );
    if (kind === 'repeat' && !own(data, 'count'))
      error('repeat requires count.', n, uri);
    if (
      kind === 'for_each' &&
      (!data.object ||
        (data.order !== undefined && !['asc', 'desc'].includes(data.order)))
    )
      error('Invalid for_each object/order.', n, uri);
    if (kind === 'for_each_child' && !data.iterable)
      error('for_each_child requires iterable.', n, uri);
    if (kind === 'javascript') {
      if (!singleton.has('code'))
        error(
          'JavaScript requires a multiline code block.',
          n,
          uri,
          'SETTINGS_CODE_BLOCK'
        );
      result.parameterObjects = result.parameterObjects || '';
      result.useStrict = !!result.useStrict;
      result.eventsSheetExpanded = !!result.eventsSheetExpanded;
    }
    if (kind === 'link') {
      if (!data.target) error('Link requires target.', n, uri);
      result.include = { includeConfig: 0 };
    }
    if (kind === 'group') {
      if (typeof data.name !== 'string') error('Group requires name.', n, uri);
      const c = color(data.color, [74, 176, 228], n, uri);
      Object.assign(result, {
        colorR: c[0],
        colorG: c[1],
        colorB: c[2],
        source: result.source || '',
        creationTime: result.creationTime || 0,
        parameters: result.parameters || [],
      });
    }
    if (kind === 'comment') {
      const b = color(data.background, [0, 0, 0], n, uri),
        c = color(data.color, [0, 0, 0], n, uri);
      result.color = {
        r: b[0],
        g: b[1],
        b: b[2],
        textR: c[0],
        textG: c[1],
        textB: c[2],
      };
      result.comment = result.comment || '';
      result.comment2 = result.comment2 || '';
    }
    previous = result;
    return result;
  });
};

export const encodeEventList = (events, options = {}, uri, depth = 0) => {
  if (!Array.isArray(events) || depth > MAX_SETTINGS_DEPTH)
    error('Invalid event list or nesting budget.', {}, uri);
  const encodeInstruction = (instruction, kind, d) => {
    if (d > MAX_SETTINGS_DEPTH)
      error('Instruction nesting budget exceeded.', {}, uri);
    if (!options.formatInstruction)
      error('A project instruction catalog is required.', {}, uri);
    Object.keys(instruction).forEach(key => {
      if (!['type', 'disabled', 'parameters', 'subInstructions'].includes(key))
        error(`Unknown instruction field ${key}.`, {}, uri);
    });
    Object.keys(instruction.type).forEach(key => {
      if (!['value', 'inverted', 'await'].includes(key))
        error(`Unknown instruction type field ${key}.`, {}, uri);
    });
    if (
      (kind === 'action' && instruction.type.inverted) ||
      (kind === 'condition' && instruction.type.await)
    )
      error(
        'Instruction flag is not valid for its kind.',
        {},
        uri,
        'SETTINGS_INSTRUCTION_FLAGS'
      );
    const text = options.formatInstruction({ kind, instruction, fileUri: uri });
    const parsed = parseSettingsSyntax(
      `function {\n events {\n event {\n ${
        kind === 'action' ? 'actions' : 'conditions'
      } {\n${text}\n}\n}\n}\n}\n`,
      uri
    );
    const n = parsed.root.children[0].children[0].children[0].children[0];
    for (const [key, value] of Object.entries({
      disabled: instruction.disabled,
      ...(kind === 'condition'
        ? { inverted: instruction.type.inverted }
        : { awaited: instruction.type.await }),
    }))
      if (value) n.properties[key] = { value };
    n.children = (instruction.subInstructions || []).map(c =>
      encodeInstruction(c, kind, d + 1)
    );
    return n;
  };
  return make(
    'events',
    {},
    events.map(event => {
      const kind = Object.keys(EVENT_TYPES).find(
        key => EVENT_TYPES[key] === event.type
      );
      if (!kind) error(`Unsupported native event ${event.type}.`, {}, uri);
      const data = {},
        children = [];
      if (!['standard', 'group', 'comment', 'link'].includes(kind))
        data.type = kind;
      common.forEach(key => {
        if (event[key]) data[key] = event[key];
      });
      const allowed = new Set([
        'type',
        ...common,
        ...Object.values(extra[kind]),
        ...(bodyTypes.includes(kind)
          ? ['conditions', 'actions', 'variables', 'events']
          : []),
        ...(kind === 'while' ? ['whileConditions'] : []),
        ...(kind === 'group' ? ['colorR', 'colorG', 'colorB', 'events'] : []),
        ...(kind === 'comment' ? ['color'] : []),
        ...(kind === 'link' ? ['include'] : []),
        ...(kind === 'javascript' ? ['inlineCode'] : []),
      ]);
      Object.keys(event).forEach(key => {
        if (!allowed.has(key))
          error(`Unknown native event field ${key}.`, {}, uri);
      });
      Object.entries(extra[kind]).forEach(([key, nativeKey]) => {
        if (event[nativeKey] === undefined) return;
        const value = event[nativeKey];
        if (expressionFields.includes(key)) {
          if (value !== '')
            data[key] =
              /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(
                String(value)
              ) && Number.isFinite(Number(value))
                ? Number(value)
                : {
                    expression:
                      options.formatInstruction &&
                      options.formatInstruction.formatPropertyExpression
                        ? options.formatInstruction.formatPropertyExpression(
                            String(value),
                            uri
                          )
                        : String(value),
                  };
        } else data[key] = value;
      });
      if (kind === 'group')
        data.color = [
          event.colorR ?? 74,
          event.colorG ?? 176,
          event.colorB ?? 228,
        ];
      if (kind === 'comment') {
        const c = event.color || {};
        data.background = [c.r || 0, c.g || 0, c.b || 0];
        data.color = [c.textR || 0, c.textG || 0, c.textB || 0];
      }
      if (kind === 'link' && event.include && event.include.includeConfig !== 0)
        error('Link supports only entire fragments.', {}, uri);
      if (kind === 'javascript')
        children.push({
          ...make('code'),
          code: normCode(event.inlineCode || ''),
        });
      if (bodyTypes.includes(kind)) {
        (event.variables || []).forEach(v =>
          children.push(encodeVariableNode(v, null, uri))
        );
        [
          ['whileConditions', 'while_conditions'],
          ['conditions', 'conditions'],
          ['actions', 'actions'],
        ].forEach(([key, type]) => {
          if (event[key] && event[key].length)
            children.push(
              make(
                type,
                {},
                event[key].map(i =>
                  encodeInstruction(
                    i,
                    key === 'actions' ? 'action' : 'condition',
                    depth + 1
                  )
                )
              )
            );
        });
      }
      if (bodyTypes.includes(kind) || kind === 'group')
        children.push(
          ...encodeEventList(event.events || [], options, uri, depth + 1)
            .children
        );
      return make(
        ['group', 'comment', 'link'].includes(kind) ? kind : 'event',
        data,
        children
      );
    })
  );
};
export const extractSettingsJavaScriptBlocks = (source, fileUri) => {
  const syntax = parseSettingsSyntax(source, fileUri),
    blocks = [];
  const visit = n => {
    if (n.type === 'event' && fields(n).type === 'javascript') {
      const code = n.children.find(c => c.type === 'code');
      if (code)
        blocks.push({
          code: code.code,
          source: code.code,
          line: code.contentLocation.line,
          startLine: code.contentLocation.line,
          endLine: code.location.endLine - 1,
          inlineCode: code.code,
          bodyLine: code.contentLocation.line,
          headerLine: n.location.line,
          parameterObjects: fields(n).objects || '',
          objects: fields(n).objects || '',
          useStrict: !!fields(n).strict,
        });
    }
    n.children.forEach(visit);
  };
  visit(syntax.root);
  return blocks;
};
const compileParsedSettingsEvents = (syntax, options, fileUri) => {
  if (!['function', 'external_events'].includes(syntax.root.type))
    error(
      'Only functions and external fragments own events.',
      syntax.root,
      fileUri
    );
  const containers = syntax.root.children.filter(c => c.type === 'events');
  if (containers.length > 1)
    error('Duplicate events container.', containers[1], fileUri);
  return containers.length
    ? decodeEventList(containers[0], options, fileUri)
    : [];
};
export const compileSettingsEvents = (source, options = {}, fileUri) =>
  compileParsedSettingsEvents(
    parseSettingsSyntax(source, fileUri),
    options,
    fileUri
  );

// A companion API keeps source metadata outside the persisted native model.
export const compileSettingsEventsWithSyntax = (
  source,
  options = {},
  fileUri
) => {
  const syntax = parseSettingsSyntax(source, fileUri);
  return {
    events: compileParsedSettingsEvents(syntax, options, fileUri),
    syntax,
  };
};

export const appendSettingsEvents = (source, events, options = {}, uri) => {
  const syntax = parseSettingsSyntax(source, uri);
  syntax.root.children = syntax.root.children.filter(c => c.type !== 'events');
  syntax.root.children.push(encodeEventList(events, options, uri));
  return printSettingsSyntax(syntax.root, syntax.comments);
};

export const EVENT_SCHEMAS = Object.fromEntries(
  Object.keys(EVENT_TYPES).map(kind => [
    kind,
    {
      node: ['group', 'comment', 'link'].includes(kind) ? kind : 'event',
      nativeType: EVENT_TYPES[kind],
      fields: {
        ...(!['group', 'comment', 'link'].includes(kind)
          ? {
              type: {
                type: 'enum',
                values: [kind],
                ...(kind === 'standard'
                  ? { default: 'standard' }
                  : { required: true }),
              },
            }
          : {}),
        ...Object.fromEntries(
          [
            ...common,
            ...Object.keys(extra[kind]),
            ...(['group', 'comment'].includes(kind) ? ['color'] : []),
            ...(kind === 'comment' ? ['background'] : []),
          ].map(name => [
            name,
            {
              ...((kind === 'group' && name === 'name') ||
              (kind === 'link' && name === 'target') ||
              (kind === 'repeat' && name === 'count') ||
              (kind === 'for_each' && name === 'object') ||
              (kind === 'for_each_child' && name === 'iterable')
                ? { required: true }
                : {}),
              type: booleans.includes(name)
                ? 'boolean'
                : expressionFields.includes(name)
                ? 'number or expression'
                : ['color', 'background'].includes(name)
                ? 'RGB integer array'
                : name === 'creationTime'
                ? 'number'
                : name === 'parameters'
                ? 'string array'
                : 'string',
            },
          ])
        ),
      },
      containers: bodyTypes.includes(kind)
        ? {
            variable: { repeated: true, schemaRef: 'variableSchemas.variable' },
            conditions: { kind: 'condition', maximum: 1 },
            actions: { kind: 'action', maximum: 1 },
            ...(kind === 'while'
              ? { while_conditions: { kind: 'condition', maximum: 1 } }
              : {}),
          }
        : kind === 'javascript'
        ? {
            code: {
              required: true,
              maximum: 1,
              syntax: 'raw multiline JavaScript block',
              ecmaVersion: 2022,
            },
          }
        : {},
      children:
        bodyTypes.includes(kind) || kind === 'group'
          ? ['event', 'group', 'comment', 'link']
          : [],
    },
  ])
);
export const EVENTS_CONTAINER_SCHEMA = {
  fields: {},
  children: Object.fromEntries(
    ['event', 'group', 'comment', 'link'].map(type => [
      type,
      {
        repeated: true,
        schemaRef: type === 'event' ? 'eventSchemas' : `eventSchemas.${type}`,
        ...(type === 'event'
          ? {
              discriminator: 'type',
              defaultType: 'standard',
              variants: Object.keys(EVENT_TYPES).filter(
                kind => !['group', 'comment', 'link'].includes(kind)
              ),
            }
          : {}),
      },
    ])
  ),
};
