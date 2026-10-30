// @noflow
import {
  SettingsDslError,
  MAX_SETTINGS_DEPTH,
  parseSettingsSyntax,
  printSettingsSyntax,
} from './Syntax';
import {
  parseVariableJson,
  printVariableJson,
  variableJsonLocation,
  jsonPointerSegment,
} from './VariableJson';

const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const types = ['string', 'number', 'boolean', 'structure', 'array', 'enum'];
const metadataKeys = ['values', 'folded', 'hasMixedValues'];
const fail = (message, at, fileUri, path) => {
  throw new SettingsDslError(
    'SETTINGS_INVALID_VARIABLE',
    message,
    fileUri,
    at && (at.location || at),
    path
  );
};
const containerType = type => ['structure', 'array'].includes(type);
const checkNumber = value =>
  Number.isFinite(value) &&
  (!Number.isInteger(value) || Number.isSafeInteger(value));
const checkMetadata = (variable, data, at, fileUri, path) => {
  for (const key of ['folded', 'hasMixedValues']) {
    if (own(data, key)) {
      if (typeof data[key] !== 'boolean')
        fail(
          `${key} must be boolean.`,
          at.properties?.[key] || at,
          fileUri,
          path
        );
      variable[key] = data[key];
    }
  }
  if (own(data, 'values')) {
    if (variable.type !== 'enum')
      fail(
        'values is only allowed on enum variables.',
        at.properties?.values || at,
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
      at,
      fileUri,
      path
    );
};
const nativeJson = node =>
  containerType(node.type)
    ? {
        type: node.type,
        ...(own(node, 'name') ? { name: node.name } : {}),
        children: node.children.map(nativeJson),
      }
    : {
        ...(own(node, 'name') ? { name: node.name } : {}),
        type: node.type,
        value: node.value,
      };
const jsonValue = node =>
  node.type === 'array'
    ? node.children.map(jsonValue)
    : node.type === 'structure'
    ? Object.fromEntries(
        node.children.map(child => [child.name, jsonValue(child)])
      )
    : node.value;

const applyNestedMetadata = (variable, item, fileUri, path, depth) => {
  const tree = parseVariableJson(item, fileUri, path, depth);
  const at = node => ({
    location: variableJsonLocation(item, node.offset, node.endOffset),
  });
  if (tree.type !== 'structure')
    fail(
      'metadata must be a JSON object of JSON Pointer records.',
      at(tree),
      fileUri,
      path
    );
  const targets = new Map();
  const index = (parent, pointer) => {
    (parent.children || []).forEach((child, position) => {
      const childPointer =
        pointer +
        '/' +
        jsonPointerSegment(parent.type === 'array' ? position : child.name);
      targets.set(childPointer, child);
      index(child, childPointer);
    });
  };
  index(variable, '');
  for (const record of tree.children) {
    const pointer = record.name;
    if (!pointer.startsWith('/') || /~(?:[^01]|$)/.test(pointer))
      fail(
        'metadata requires a non-root JSON Pointer with valid ~0/~1 escapes.',
        at(record),
        fileUri,
        path
      );
    const target = targets.get(pointer);
    if (!target)
      fail(
        `metadata path does not exist: ${pointer}.`,
        at(record),
        fileUri,
        path
      );
    if (record.type !== 'structure')
      fail('metadata records must be JSON objects.', at(record), fileUri, path);
    for (const field of record.children)
      if (!['type', ...metadataKeys].includes(field.name))
        fail(
          `Unknown nested variable metadata ${field.name}.`,
          at(field),
          fileUri,
          path
        );
    const data = jsonValue(record);
    if (own(data, 'type')) {
      if (data.type !== 'enum' || target.type !== 'string')
        fail(
          'Nested type metadata can only mark a string as enum.',
          at(record),
          fileUri,
          path
        );
      target.type = 'enum';
    }
    checkMetadata(target, data, at(record), fileUri, path);
  }
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
  const data = Object.fromEntries(
    Object.entries(node.properties).map(([key, item]) => [key, item.value])
  );
  for (const key of Object.keys(data))
    if (!['type', 'value', 'json', 'metadata', ...metadataKeys].includes(key))
      fail(
        `Unknown variable field ${key}; the variable name belongs in the node name.`,
        node.properties[key],
        fileUri,
        path
      );
  if (!node.type) fail('Variable name must be nonempty.', node, fileUri, path);
  if (!types.includes(data.type))
    fail(
      'Variable requires an explicit valid type.',
      node.properties.type || node,
      fileUri,
      path
    );
  if (node.children.length)
    fail(
      'Variables do not accept child nodes; use json for complex values.',
      node.children[0],
      fileUri,
      path
    );
  for (const item of Object.values(node.properties))
    if (item.expression)
      fail(
        'Expressions are not allowed in variable declarations.',
        item,
        fileUri,
        path
      );
  let result;
  if (containerType(data.type)) {
    if (!own(data, 'json') || own(data, 'value'))
      fail(
        'Structure and array variables require json and forbid value.',
        node,
        fileUri,
        path
      );
    const tree = parseVariableJson(node.properties.json, fileUri, path, depth);
    if (tree.type !== data.type)
      fail(
        'Variable JSON root does not match its declared type.',
        node.properties.json,
        fileUri,
        path
      );
    result = nativeJson(tree);
    if (own(data, 'metadata'))
      applyNestedMetadata(
        result,
        node.properties.metadata,
        fileUri,
        path,
        depth
      );
  } else {
    if (!own(data, 'value') || own(data, 'json') || own(data, 'metadata'))
      fail(
        'Scalar variables require value and forbid json/metadata.',
        node,
        fileUri,
        path
      );
    const expected = data.type === 'enum' ? 'string' : data.type;
    if (
      typeof data.value !== expected ||
      (expected === 'number' && !checkNumber(data.value))
    )
      fail(
        'Variable value does not match its type.',
        node.properties.value,
        fileUri,
        path
      );
    result = { type: data.type, value: data.value };
  }
  checkMetadata(result, data, node, fileUri, path);
  return { name: node.type, ...result };
};

export const decodeVariableContainer = (
  container,
  fileUri,
  path,
  instance = false,
  depth = 0
) => {
  if (Object.keys(container.properties).length)
    fail(
      'Variables require named descriptor blocks with explicit type; direct assignments are not supported.',
      Object.values(container.properties)[0],
      fileUri,
      path
    );
  const names = new Set();
  return container.children.map(child => {
    if (names.has(child.type))
      fail('Duplicate variable name.', child, fileUri, path);
    names.add(child.type);
    return decodeVariableNode(child, fileUri, path, instance, null, depth + 1);
  });
};

const encodeVariableNode = (variable, fileUri) => {
  const nested = [];
  let nodes = 0;
  const encode = (entry, path, depth, parentType) => {
    if (depth > MAX_SETTINGS_DEPTH || ++nodes > 200000)
      fail(
        'Variable nesting/node budget exceeded.',
        {},
        fileUri,
        variable.name
      );
    for (const key of Object.keys(entry))
      if (
        ![
          'name',
          'type',
          'value',
          'children',
          'id',
          'persistentUuid',
          ...metadataKeys,
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
    if (
      parentType === 'array'
        ? own(entry, 'name')
        : typeof entry.name !== 'string' || !entry.name
    )
      fail(
        'Structure variables need names; array elements must not have names.',
        {},
        fileUri,
        variable.name
      );
    const meta = {};
    if (entry.type === 'enum') meta.type = 'enum';
    for (const key of metadataKeys) if (own(entry, key)) meta[key] = entry[key];
    // Validate enum constraints against the actual value and declared type.
    checkMetadata(
      { type: entry.type, value: entry.value },
      entry,
      {},
      fileUri,
      variable.name
    );
    if (path && Object.keys(meta).length) nested.push({ path, data: meta });
    if (containerType(entry.type)) {
      if (
        own(entry, 'value') ||
        (entry.children !== undefined && !Array.isArray(entry.children))
      )
        fail('Invalid container variable.', {}, fileUri, variable.name);
      const names = new Set();
      return {
        type: entry.type,
        children: (entry.children || []).map((child, index) => {
          if (entry.type === 'structure') {
            if (names.has(child.name))
              fail('Duplicate structure member.', {}, fileUri, variable.name);
            names.add(child.name);
          }
          return {
            ...encode(
              child,
              path +
                '/' +
                jsonPointerSegment(entry.type === 'array' ? index : child.name),
              depth + 1,
              entry.type
            ),
            ...(entry.type === 'structure' ? { name: child.name } : {}),
          };
        }),
      };
    }
    const expected = entry.type === 'enum' ? 'string' : entry.type;
    if (
      typeof entry.value !== expected ||
      own(entry, 'children') ||
      (expected === 'number' && !checkNumber(entry.value))
    )
      fail(
        'Variable value does not match its type.',
        {},
        fileUri,
        variable.name
      );
    return { type: expected, value: entry.value };
  };
  const tree = encode(variable, '', 1, 'structure');
  const properties = { type: { value: variable.type } };
  properties[containerType(variable.type) ? 'json' : 'value'] = containerType(
    variable.type
  )
    ? { value: printVariableJson(tree), raw: true }
    : { value: variable.value };
  for (const key of metadataKeys)
    if (own(variable, key)) properties[key] = { value: variable[key] };
  if (nested.length)
    properties.metadata = {
      value: JSON.stringify(
        Object.fromEntries(nested.map(({ path, data }) => [path, data])),
        null,
        2
      ),
      raw: true,
    };
  return { type: variable.name, named: true, properties, children: [] };
};

export const encodeVariableContainer = (
  variables,
  type = 'variables',
  fileUri
) => {
  const names = new Set();
  const children = variables.map(variable => {
    if (names.has(variable.name))
      fail('Duplicate variable name.', {}, fileUri, type);
    names.add(variable.name);
    return encodeVariableNode(variable, fileUri);
  });
  return { type, properties: {}, children };
};

// Native structure maps may sort keys. Restore matching source member order,
// while treating current root variable order and array order as authoritative.
export const preserveVariableStructureOrder = (
  source,
  previousSource,
  fileUri
) => {
  const current = parseSettingsSyntax(source, fileUri);
  const previous = parseSettingsSyntax(previousSource, fileUri);
  const align = (tree, old) => {
    if (!old || tree.type !== old.type || !containerType(tree.type)) return;
    if (tree.type === 'structure') {
      const order = new Map(
        old.children.map((child, index) => [child.name, index])
      );
      tree.children.sort(
        (a, b) =>
          (order.get(a.name) ?? order.size) - (order.get(b.name) ?? order.size)
      );
      const byName = new Map(old.children.map(child => [child.name, child]));
      tree.children.forEach(child => align(child, byName.get(child.name)));
    } else
      tree.children.forEach((child, index) =>
        align(child, old.children[index])
      );
  };
  const visit = (node, old) => {
    if (!old) return;
    if (
      !node.named &&
      ['variables', 'global_variables', 'scene_variables'].includes(node.type)
    ) {
      const byName = new Map(old.children.map(child => [child.type, child]));
      node.children.forEach(child => {
        const item = child.properties.json;
        const oldItem = byName.get(child.type)?.properties.json;
        if (item && oldItem) {
          const tree = parseVariableJson(item, fileUri);
          align(tree, parseVariableJson(oldItem, fileUri));
          item.value = printVariableJson(tree);
        }
      });
      return;
    }
    const identity = child =>
      JSON.stringify([
        child.type,
        child.properties.id?.value,
        child.properties.name?.value,
      ]);
    const byIdentity = new Map();
    old.children.forEach(child => {
      const key = identity(child);
      if (!byIdentity.has(key)) byIdentity.set(key, []);
      byIdentity.get(key).push(child);
    });
    node.children.forEach(child =>
      visit(child, byIdentity.get(identity(child))?.shift())
    );
  };
  visit(current.root, previous.root);
  return printSettingsSyntax(current.root, current.comments);
};

export const getDeclaredVariableNames = owner =>
  (
    owner.children.find(child => child.type === 'variables')?.children || []
  ).map(child => child.type);
