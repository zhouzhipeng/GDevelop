// @noflow
import {
  SettingsDslError,
  MAX_SETTINGS_DEPTH,
  parseSettingsSyntax,
  printSettingsSyntax,
  hasSettingsReference,
} from './Syntax';

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
export const decodeVariableNode = (
  node,
  fileUri,
  path,
  instance = false,
  parentType = null,
  depth = 0,
  budget = { nodes: 0 }
) => {
  if (depth > MAX_SETTINGS_DEPTH || ++budget.nodes > 200000)
    fail('Variable nesting/node budget exceeded.', node, fileUri, path);
  const data = Object.fromEntries(
    Object.entries(node.properties).map(([key, item]) => [key, item.value])
  );
  for (const key of Object.keys(data))
    if (!['type', 'value', ...metadataKeys].includes(key))
      fail(
        `Unknown variable field ${key}.`,
        node.properties[key],
        fileUri,
        path
      );
  if (!node.type || (parentType === 'array' && node.type !== 'item'))
    fail(
      'Variables require names; array elements must use item nodes.',
      node,
      fileUri,
      path
    );
  if (!types.includes(data.type))
    fail(
      'Variable requires an explicit valid type.',
      node.properties.type || node,
      fileUri,
      path
    );
  for (const item of Object.values(node.properties))
    if (item.expression || hasSettingsReference(item))
      fail(
        'Expressions and symbol references are not allowed in variable declarations.',
        item,
        fileUri,
        path
      );
  let result;
  if (containerType(data.type)) {
    const expected = data.type === 'structure' ? 'members' : 'elements';
    if (
      own(data, 'value') ||
      node.children.length !== 1 ||
      node.children[0].type !== expected
    )
      fail(
        `${
          data.type
        } variables require exactly one ${expected} container and forbid value.`,
        node,
        fileUri,
        path
      );
    const container = node.children[0];
    if (Object.keys(container.properties).length)
      fail(
        `${expected} only accepts descriptor nodes.`,
        Object.values(container.properties)[0],
        fileUri,
        path
      );
    const names = new Set();
    const children = container.children.map((child, index) => {
      if (data.type === 'structure') {
        if (names.has(child.type))
          fail('Duplicate structure member.', child, fileUri, path);
        names.add(child.type);
      }
      return decodeVariableNode(
        child,
        fileUri,
        `${path}.${data.type === 'array' ? index : child.type}`,
        instance,
        data.type,
        depth + 1,
        budget
      );
    });
    result = { type: data.type, children };
  } else {
    if (!own(data, 'value') || node.children.length)
      fail(
        'Scalar variables require value and forbid child nodes.',
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
  return parentType === 'array' ? result : { name: node.type, ...result };
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
  const budget = { nodes: 0 };
  return container.children.map(child => {
    if (names.has(child.type))
      fail('Duplicate variable name.', child, fileUri, path);
    names.add(child.type);
    return decodeVariableNode(
      child,
      fileUri,
      path,
      instance,
      null,
      depth + 1,
      budget
    );
  });
};

const encodeVariableNode = (variable, fileUri) => {
  let nodes = 0;
  const encode = (entry, depth, parentType) => {
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
    checkMetadata(
      { type: entry.type, value: entry.value },
      entry,
      {},
      fileUri,
      variable.name
    );
    const properties = { type: { value: entry.type } };
    const children = [];
    if (containerType(entry.type)) {
      if (
        own(entry, 'value') ||
        (entry.children !== undefined && !Array.isArray(entry.children))
      )
        fail('Invalid container variable.', {}, fileUri, variable.name);
      const names = new Set();
      const entries = (entry.children || []).map(child => {
        if (entry.type === 'structure') {
          if (names.has(child.name))
            fail('Duplicate structure member.', {}, fileUri, variable.name);
          names.add(child.name);
        }
        return encode(child, depth + 1, entry.type);
      });
      children.push({
        type: entry.type === 'structure' ? 'members' : 'elements',
        named: true,
        properties: {},
        children: entries,
      });
    } else {
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
      properties.value = { value: entry.value };
    }
    for (const key of metadataKeys)
      if (own(entry, key)) properties[key] = { value: entry[key] };
    return {
      type: parentType === 'array' ? 'item' : entry.name,
      named: true,
      properties,
      children,
    };
  };
  return encode(variable, 1, 'structure');
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

// Native structure maps may sort keys. Root and array order remain authoritative.
export const preserveVariableStructureOrder = (
  source,
  previousSource,
  fileUri
) => {
  const current = parseSettingsSyntax(source, fileUri);
  const previous = parseSettingsSyntax(previousSource, fileUri);
  const align = (node, old) => {
    const type = node.properties.type?.value;
    if (!old || type !== old.properties.type?.value || !containerType(type))
      return;
    const containerName = type === 'structure' ? 'members' : 'elements';
    const children = node.children.find(child => child.type === containerName);
    const oldChildren = old.children.find(
      child => child.type === containerName
    );
    if (!children || !oldChildren) return;
    if (type === 'structure') {
      const order = new Map(
        oldChildren.children.map((child, index) => [child.type, index])
      );
      children.children.sort(
        (a, b) =>
          (order.get(a.type) ?? order.size) - (order.get(b.type) ?? order.size)
      );
      children.members = children.children.map(child => ({ child }));
      const byName = new Map(
        oldChildren.children.map(child => [child.type, child])
      );
      children.children.forEach(child => align(child, byName.get(child.type)));
    } else
      children.children.forEach((child, index) =>
        align(child, oldChildren.children[index])
      );
  };
  const visit = (node, old) => {
    if (!old) return;
    if (
      !node.named &&
      ['variables', 'global_variables', 'scene_variables'].includes(node.type)
    ) {
      const byName = new Map(old.children.map(child => [child.type, child]));
      node.children.forEach(child => align(child, byName.get(child.type)));
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
