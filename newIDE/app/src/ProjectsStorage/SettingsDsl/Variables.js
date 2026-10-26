// @noflow
import {
  SettingsDslError,
  MAX_SETTINGS_DEPTH,
  parseSettingsSyntax,
  printSettingsSyntax,
} from './Syntax';

const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const metaKeys = ['type', 'values', 'id', 'folded', 'hasMixedValues'];
const types = ['string', 'number', 'boolean', 'structure', 'array', 'enum'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const fail = (message, at, fileUri, path) => {
  throw new SettingsDslError(
    'SETTINGS_INVALID_VARIABLE',
    message,
    fileUri,
    at && (at.location || at),
    path
  );
};
const fields = node =>
  Object.fromEntries(
    Object.entries(node.properties).map(([key, item]) => [key, item.value])
  );
const inferredType = value =>
  Array.isArray(value)
    ? 'array'
    : value && typeof value === 'object'
    ? 'structure'
    : typeof value;

const applyVariableFields = (variable, data, at, fileUri, path, instance) => {
  if (data.type !== undefined) {
    if (
      !types.includes(data.type) ||
      (data.type === 'enum'
        ? variable.type !== 'string'
        : data.type !== variable.type)
    )
      fail('Variable type does not match its value.', at, fileUri, path);
    variable.type = data.type;
  }
  for (const key of ['folded', 'hasMixedValues']) {
    if (own(data, key)) {
      if (typeof data[key] !== 'boolean')
        fail(`${key} must be boolean.`, at.properties[key], fileUri, path);
      variable[key] = data[key];
    }
  }
  if (own(data, 'id')) {
    if (typeof data.id !== 'string' || (data.id !== '' && !uuid.test(data.id)))
      fail(
        'Variable identity must be an empty string or lowercase UUIDv4.',
        at.properties.id,
        fileUri,
        path
      );
    variable[instance ? 'id' : 'persistentUuid'] = data.id;
  }
  if (own(data, 'values')) {
    if (variable.type !== 'enum')
      fail(
        'values is only allowed on enum variables.',
        at.properties.values,
        fileUri,
        path
      );
    variable.values = data.values;
  }
  if (
    variable.type === 'enum' &&
    (!Array.isArray(variable.values) ||
      !variable.values.length ||
      variable.values.some(value => typeof value !== 'string') ||
      new Set(variable.values).size !== variable.values.length ||
      !variable.values.includes(variable.value))
  )
    fail(
      'Enum choices must be nonempty, unique strings containing the current value.',
      at.properties.values || at,
      fileUri,
      path
    );
};

export const decodeVariableNode = (
  node,
  fileUri,
  path,
  instance = false,
  parentType = null,
  depth = 0
) => {
  if (depth > MAX_SETTINGS_DEPTH)
    fail('Settings nesting budget exceeded.', node, fileUri, path);
  const data = fields(node);
  for (const key of Object.keys(data)) {
    if (
      ![
        'name',
        'value',
        ...metaKeys,
        ...(parentType ? [] : ['scope']),
      ].includes(key)
    )
      fail(
        `Unknown variable field ${key}.`,
        node.properties[key],
        fileUri,
        path
      );
  }
  if (parentType === 'array' && own(data, 'name'))
    fail(
      'Array children cannot have names.',
      node.properties.name,
      fileUri,
      path
    );
  if (parentType !== 'array' && (typeof data.name !== 'string' || !data.name))
    fail(
      'Variable name must be a nonempty string.',
      node.properties.name || node,
      fileUri,
      path
    );

  const decodeValue = (item, depth) => {
    if (item.expression)
      fail(
        'Expressions are not allowed in variable values.',
        item,
        fileUri,
        path
      );
    if (depth > MAX_SETTINGS_DEPTH)
      fail('Settings nesting budget exceeded.', item, fileUri, path);
    const type = inferredType(item.value);
    if (!types.includes(type) || item.value === null)
      fail('Unsupported variable value.', item, fileUri, path);
    if (type === 'structure') {
      // The ordered AST entries preserve even numeric-string field names.
      return {
        type,
        children: item.entries.map(entry => {
          if (!entry.key)
            fail(
              'Structure field name must be nonempty.',
              entry.keyLocation,
              fileUri,
              path
            );
          return { name: entry.key, ...decodeValue(entry, depth + 1) };
        }),
      };
    }
    if (type === 'array')
      return {
        type,
        children: item.items.map(entry => decodeValue(entry, depth + 1)),
      };
    return { type, value: item.value };
  };
  let result;
  if (own(data, 'value')) {
    if (node.children.length)
      fail(
        'Variable cannot combine value and child declarations.',
        node.children[0],
        fileUri,
        path
      );
    result = decodeValue(node.properties.value, depth);
  } else {
    if (!['structure', 'array'].includes(data.type))
      fail(
        'Variable requires value or an explicit container type.',
        node,
        fileUri,
        path
      );
    const names = new Set();
    result = {
      type: data.type,
      children: node.children.map(child => {
        if (child.type !== 'variable')
          fail(
            'Only variable declarations may be nested in variable; metadata is not supported.',
            child,
            fileUri,
            path
          );
        const decoded = decodeVariableNode(
          child,
          fileUri,
          path,
          instance,
          data.type,
          depth + 1
        );
        if (data.type === 'structure') {
          if (names.has(decoded.name))
            fail(
              'Duplicate structure child name.',
              child.properties.name,
              fileUri,
              path
            );
          names.add(decoded.name);
        }
        return decoded;
      }),
    };
  }
  if (parentType !== 'array') result = { name: data.name, ...result };
  applyVariableFields(result, data, node, fileUri, path, instance);
  return result;
};

export const encodeVariableNode = (variable, scope, fileUri) => {
  if (typeof variable.name !== 'string' || !variable.name)
    fail('Variable name must be nonempty.', {}, fileUri, 'variable');

  const encodedValues = new WeakMap();
  const encodeValue = (entry, path) => {
    if (path.length > MAX_SETTINGS_DEPTH)
      fail('Settings nesting budget exceeded.', {}, fileUri, variable.name);
    for (const key of Object.keys(entry))
      if (
        ![
          'name',
          'type',
          'value',
          'children',
          'persistentUuid',
          ...metaKeys,
        ].includes(key)
      )
        fail(
          `Unknown variable serializer field ${key}.`,
          {},
          fileUri,
          variable.name
        );
    if (!types.includes(entry.type))
      fail('Unknown variable type.', {}, fileUri, variable.name);
    const metadata = {};
    if (entry.type === 'enum') {
      if (
        !Array.isArray(entry.values) ||
        !entry.values.length ||
        entry.values.some(value => typeof value !== 'string') ||
        new Set(entry.values).size !== entry.values.length ||
        !entry.values.includes(entry.value)
      )
        fail('Invalid enum choices.', {}, fileUri, variable.name);
      metadata.type = 'enum';
      metadata.values = entry.values;
    } else if (entry.values !== undefined)
      fail(
        'values is only allowed on enum variables.',
        {},
        fileUri,
        variable.name
      );
    for (const key of ['folded', 'hasMixedValues'])
      if (own(entry, key)) metadata[key] = entry[key];
    if (own(entry, 'id') && own(entry, 'persistentUuid'))
      fail(
        'Variable identity may only be specified once.',
        {},
        fileUri,
        variable.name
      );
    if (own(entry, 'id') || own(entry, 'persistentUuid'))
      metadata.id = own(entry, 'id') ? entry.id : entry.persistentUuid;
    let literal;
    if (entry.type === 'structure' || entry.type === 'array') {
      if (
        own(entry, 'value') ||
        (entry.children !== undefined && !Array.isArray(entry.children))
      )
        fail('Invalid container variable.', {}, fileUri, variable.name);
      const children = entry.children || [];
      if (entry.type === 'array') {
        if (children.some(child => own(child, 'name')))
          fail('Array children cannot have names.', {}, fileUri, variable.name);
        const items = children.map(
          (child, index) => encodeValue(child, [...path, index]).literal
        );
        literal = { value: items.map(item => item.value), items };
      } else {
        const names = new Set();
        const entries = children.map(child => {
          if (
            typeof child.name !== 'string' ||
            !child.name ||
            names.has(child.name)
          )
            fail(
              'Invalid or duplicate structure child name.',
              {},
              fileUri,
              variable.name
            );
          names.add(child.name);
          return {
            key: child.name,
            ...encodeValue(child, [...path, child.name]).literal,
          };
        });
        literal = {
          value: Object.fromEntries(
            entries.map(item => [item.key, item.value])
          ),
          entries,
        };
      }
    } else {
      const expected = entry.type === 'enum' ? 'string' : entry.type;
      if (typeof entry.value !== expected || entry.children !== undefined)
        fail(
          'Variable value does not match its type.',
          {},
          fileUri,
          variable.name
        );
      literal = { value: entry.value };
    }
    const expanded = (entry.children || []).some(
      child => encodedValues.get(child).needsDeclaration
    );
    const encoded = {
      literal,
      metadata,
      expanded,
      needsDeclaration: Object.keys(metadata).length > 0 || expanded,
    };
    encodedValues.set(entry, encoded);
    return encoded;
  };
  // Keep ordinary values compact. If a descendant needs its own declaration,
  // expand this container so identity and constraints travel with each value.
  encodeValue(variable, []);
  const encodeNode = (entry, parentType) => {
    const { literal, metadata, expanded } = encodedValues.get(entry);
    return {
      type: 'variable',
      properties: {
        ...(!parentType && scope ? { scope: { value: scope } } : {}),
        ...(parentType !== 'array' ? { name: { value: entry.name } } : {}),
        ...(expanded ? { type: { value: entry.type } } : {}),
        ...Object.fromEntries(
          Object.entries(metadata).map(([key, value]) => [key, { value }])
        ),
        ...(!expanded ? { value: literal } : {}),
      },
      children: expanded
        ? entry.children.map(child => encodeNode(child, entry.type))
        : [],
    };
  };
  return encodeNode(variable, null);
};

// Native structure variables use std::map, so a native round trip sorts their
// fields. Preserve the previous authoring order when writing back through the
// editor, while leaving root declarations and array element order authoritative.
export const preserveVariableStructureOrder = (
  source,
  previousSource,
  fileUri
) => {
  const syntax = parseSettingsSyntax(source, fileUri);
  const previous = parseSettingsSyntax(previousSource, fileUri);
  const alignValue = (current, old) => {
    if (!current || !old) return;
    if (current.entries && old.entries) {
      const positions = new Map(
        old.entries.map((entry, index) => [entry.key, index])
      );
      const oldByKey = new Map(old.entries.map(entry => [entry.key, entry]));
      current.entries.sort(
        (left, right) =>
          (positions.has(left.key) ? positions.get(left.key) : positions.size) -
          (positions.has(right.key) ? positions.get(right.key) : positions.size)
      );
      current.entries.forEach(entry =>
        alignValue(entry, oldByKey.get(entry.key))
      );
    } else if (current.items && old.items)
      current.items.forEach((entry, index) =>
        alignValue(entry, old.items[index])
      );
  };
  const identity = (node, field) =>
    JSON.stringify([
      node.type,
      node.properties.scope && node.properties.scope.value,
      node.properties[field] && node.properties[field].value,
    ]);
  const literalChildren = literal => {
    const entries = literal.entries || literal.items || [];
    return entries.map(entry => ({
      type: 'variable',
      properties: {
        ...(own(entry, 'key') ? { name: { value: entry.key } } : {}),
        value: entry,
        type: { value: inferredType(entry.value) },
      },
      children: [],
    }));
  };
  const alignNode = (current, old) => {
    if (!old) return;
    if (
      current.type === 'variable' &&
      current.children.length &&
      old.properties.value
    )
      old = { ...old, children: literalChildren(old.properties.value) };
    if (current.type === 'variable')
      alignValue(current.properties.value, old.properties.value);
    if (
      current.type === 'variable' &&
      current.properties.type &&
      current.properties.type.value === 'structure' &&
      old.children.length
    ) {
      const positions = new Map(
        old.children.map((child, index) => [identity(child, 'name'), index])
      );
      const rank = child =>
        positions.has(identity(child, 'name'))
          ? positions.get(identity(child, 'name'))
          : positions.size;
      current.children.sort((left, right) => rank(left) - rank(right));
    }
    const byName = new Map(
      old.children.map(child => [identity(child, 'name'), child])
    );
    const byId = new Map(
      old.children
        .filter(child => child.properties.id && child.properties.id.value)
        .map(child => [identity(child, 'id'), child])
    );
    current.children.forEach((child, index) =>
      alignNode(
        child,
        (child.properties.id && byId.get(identity(child, 'id'))) ||
          (current.type === 'variable' &&
          current.properties.type &&
          current.properties.type.value === 'array'
            ? old.children[index]
            : byName.get(identity(child, 'name')))
      )
    );
  };
  alignNode(syntax.root, previous.root);
  return printSettingsSyntax(syntax.root, syntax.comments);
};
