// @noflow
import { EVENT_SCHEMAS, EVENTS_CONTAINER_SCHEMA } from './Events';
import { decodeVariableNode, encodeVariableNode } from './Variables';

import {
  SettingsDslError,
  parseSettingsSyntax,
  printSettingsSyntax,
} from './Syntax';
import {
  SETTINGS_FILE_SCHEMAS,
  SETTINGS_FORMAT_VERSION,
} from './SchemaInventory';
export { SettingsDslError, parseSettingsSyntax, SETTINGS_FORMAT_VERSION };
export { preserveVariableStructureOrder } from './Variables';

const ROOTS = {
  project: 'project',
  resources: 'resources',
  tests: 'tests',
  scene: 'scene',
  prefab: 'prefab',
  prefabVariant: 'variant',
  externalLayout: 'external',
  externalEvents: 'external_events',
  object: 'object',
  function: 'function',
  extension: 'extension',
  behavior: 'behavior',
};
const KINDS = Object.fromEntries(
  Object.entries(ROOTS).map(([kind, root]) => [root, kind])
);
const SINGULAR = {
  resources: 'resource',
  tests: 'test',
  parameters: 'parameter',
  animations: 'animation',
  directions: 'direction',
  sprites: 'frame',
  behaviors: 'behavior',
  effects: 'effect',
  properties: 'property',
  propertyDescriptors: 'property',
  sharedPropertyDescriptors: 'shared_property',
  choices: 'choice',
  dependencies: 'dependency',
  sourceFiles: 'source_file',
  points: 'point',
  behaviorsSharedData: 'shared_behavior',
  changelog: 'change',
  extensionProperties: 'extension_property',
  platforms: 'platform',
  resourceFolders: 'resource_folder',
};
const own = (o, key) => Object.prototype.hasOwnProperty.call(o, key);
const node = (type, values = {}, children = []) => ({
  type,
  properties: Object.assign(
    Object.create(null),
    Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, { value }])
    )
  ),
  children,
});
const values = n =>
  Object.fromEntries(
    Object.entries(n.properties).map(([key, item]) => [key, item.value])
  );
const omit = (o, keys) =>
  Object.fromEntries(Object.entries(o).filter(([key]) => !keys.includes(key)));
const record = (fields = {}, children = {}, dynamic) => ({
  fields: Object.assign(Object.create(null), fields),
  children: Object.assign(Object.create(null), children),
  dynamic,
});
const scalar = type => ({ type });
const leafName = path => path.split('.').pop();
const variableSchema = record(
  {
    name: { type: 'non-empty string', required: true },
    value: {
      type: 'variable literal',
      valueKinds: ['string', 'number', 'boolean', 'structure', 'array'],
      requiredUnless: 'explicit structure/array type with child declarations',
    },
    type: {
      type: 'enum',
      values: ['string', 'number', 'boolean', 'structure', 'array', 'enum'],
    },
    values: scalar('unique string array'),
    id: scalar('empty string or UUIDv4'),
    folded: scalar('boolean'),
    hasMixedValues: scalar('boolean'),
  },
  {}
);
// Recursive child declarations follow the same fields; array elements omit name.
variableSchema.children.variable = {
  key: 'children',
  repeated: true,
  recursive: true,
  schemaRef: 'variableSchemas.variable',
  rules: [
    'Structure children require unique names; array children forbid name and use source order. Nested scope is forbidden. Value and child declarations are mutually exclusive.',
  ],
  schema: record({
    ...variableSchema.fields,
    name: { type: 'non-empty string', requiredFor: 'structure' },
  }),
};
const variableEntry = keys => ({
  key: keys.length === 1 ? keys[0] : '$variables',
  repeated: true,
  variableKeys: keys,
  schema:
    keys.length === 1
      ? variableSchema
      : {
          ...variableSchema,
          fields: {
            ...variableSchema.fields,
            scope: {
              type: 'enum',
              required: true,
              values: ['global', 'scene'],
            },
          },
        },
});
const inventorySchema = descriptor => {
  const fields = Object.create(null);
  (descriptor.rootFields || descriptor.fields || []).forEach(field => {
    if (
      !descriptor.rootFields ||
      ![
        'kind',
        'settingsFormatVersion',
        'combinedSettingsFormatVersion',
        'entry',
      ].includes(field.name)
    )
      fields[field.name] = field;
  });
  const children = Object.create(null);
  (descriptor.childTables || []).forEach(child => {
    if (child.table === 'rawJson' || child.table === 'migration') return;
    const key = leafName(child.table);
    if (['variables', 'globalVariables', 'sceneVariables'].includes(key)) {
      const keys = children.variable ? children.variable.variableKeys : [];
      children.variable = variableEntry([...keys, key]);
      return;
    }
    children[child.repeated ? SINGULAR[key] || key : key] = {
      key,
      repeated: !!child.repeated,
      schema: inventorySchema(child),
    };
  });
  return record(
    fields,
    children,
    descriptor.dynamicFields && !descriptor.dynamicFields.source
      ? descriptor.dynamicFields.value
      : null
  );
};
const schemas = Object.fromEntries(
  Object.entries(SETTINGS_FILE_SCHEMAS).map(([key, schema]) => [
    key,
    inventorySchema(schema),
  ])
);
schemas.function = {
  ...schemas.prefabFunction,
  fields: {
    ...schemas.prefabFunction.fields,
    ...schemas.extensionFunction.fields,
    lifecycleRole: {
      type: 'string',
      values: ['sceneLoad', 'sceneSignal', 'sceneUpdate', 'sceneUnload'],
    },
  },
};
[
  'function',
  'prefabFunction',
  'behaviorFunction',
  'extensionFunction',
  'sceneLifecycleFunction',
  'externalEvents',
].forEach(kind => {
  schemas[kind].children.events = {
    key: 'events',
    maximum: 1,
    schema: EVENTS_CONTAINER_SCHEMA,
  };
});
const projectProperties = schemas.project.children.properties.schema;
schemas.project.fields = {
  ...projectProperties.fields,
  ...schemas.project.fields,
};
schemas.project.children = {
  ...projectProperties.children,
  ...schemas.project.children,
};
delete schemas.project.children.properties;
schemas.project.fields.formatVersion = {
  type: 'integer',
  value: SETTINGS_FORMAT_VERSION,
  required: true,
};
// Model-level structured configuration, not opaque JSON or inline objects.
const point = record({
  name: scalar('string'),
  x: scalar('number'),
  y: scalar('number'),
  z: scalar('number'),
  automatic: scalar('boolean'),
});
const frame = record(
  {
    resource: { type: 'string', sourceKey: 'image' },
    hasCustomCollisionMask: scalar('boolean'),
  },
  {
    originPoint: { key: 'originPoint', schema: point },
    centerPoint: { key: 'centerPoint', schema: point },
    point: { key: 'points', repeated: true, schema: point },
    polygon: {
      key: 'customCollisionMask',
      repeated: true,
      schema: record(
        {},
        { point: { key: '$items', repeated: true, schema: point } }
      ),
    },
  }
);
const direction = record(
  {
    loop: { type: 'boolean', sourceKey: 'looping' },
    timeBetweenFrames: scalar('number'),
    metadata: scalar('string'),
  },
  { frame: { key: 'sprites', repeated: true, schema: frame } }
);
const animation = record(
  { name: scalar('string'), useMultipleDirections: scalar('boolean') },
  { direction: { key: 'directions', repeated: true, schema: direction } }
);
const sprite = record(
  {
    updateIfNotVisible: scalar('boolean'),
    adaptCollisionMaskAutomatically: scalar('boolean'),
  },
  { animation: { key: 'animations', repeated: true, schema: animation } }
);
const registeredObjects = new Map([['Sprite', sprite]]);
const registeredBehaviors = new Map();
const registeredEffects = new Map();
const registeredSharedBehaviors = new Map();
export const resetSettingsTypes = () => {
  registeredObjects.clear();
  registeredObjects.set('Sprite', sprite);
  registeredBehaviors.clear();
  registeredSharedBehaviors.clear();
  registeredEffects.clear();
};
export const getLayoutTypeContext = () =>
  registeredEffects.size
    ? {
        effectTypes: Array.from(registeredEffects.keys()),
        effectParameterTypesByType: Object.fromEntries(
          Array.from(registeredEffects, ([type, fields]) => [
            type,
            Object.fromEntries(
              Object.entries(fields).map(([name, field]) => [
                name,
                ['number', 'float', 'integer'].includes(
                  String(field.type).toLowerCase()
                )
                  ? 'number'
                  : String(field.type).toLowerCase() === 'boolean'
                  ? 'boolean'
                  : 'string',
              ])
            ),
          ])
        ),
      }
    : {};
let typeProvider;
let loadingTypes = false;
export const setSettingsTypeProvider = provider => {
  typeProvider = provider;
};
const ensureType = (registry, name) => {
  if (!registry.has(name) && typeProvider && !loadingTypes) {
    loadingTypes = true;
    try {
      registerSettingsTypes(typeProvider(), true);
    } finally {
      loadingTypes = false;
    }
  }
  return registry.get(name);
};
const mergeSchema = (left, right) => {
  const children = { ...left.children, ...right.children };
  Object.keys(left.children).forEach(key => {
    if (right.children[key])
      children[key] = {
        ...right.children[key],
        schema: mergeSchema(
          left.children[key].schema,
          right.children[key].schema
        ),
      };
  });
  const fields = { ...right.fields, ...left.fields };
  Object.values(children).forEach(child => delete fields[child.key]);
  Object.values(fields).forEach(field => {
    if (field.sourceKey) delete fields[field.sourceKey];
  });
  return record(fields, children, left.dynamic || right.dynamic);
};

// Catalog schemas are registered by the metadata owner, not inferred from an
// untrusted document. Unknown fields never teach the parser a new schema.
export const registerSettingsTypes = (
  { objectTypes = [], behaviorTypes = [], effectTypes = [] } = {},
  onlyMissing = false
) => {
  objectTypes.forEach(type => {
    if (onlyMissing && registeredObjects.has(type.type)) return;
    if (type.schema)
      registeredObjects.set(
        type.type,
        type.type === 'Sprite'
          ? mergeSchema(
              sprite,
              type.schema.fields ? type.schema : inventorySchema(type.schema)
            )
          : type.schema.fields
          ? type.schema
          : inventorySchema(type.schema)
      );
  });
  behaviorTypes.forEach(type => {
    const properties = Object.create(null);
    (type.serializedProperties || type.properties || []).forEach(p => {
      properties[p.serializedKey || p.name] = scalar(p.type);
    });
    Object.entries(type.serializedDefaults || {}).forEach(([key, value]) => {
      if (!properties[key]) properties[key] = scalar(typeof value);
    });
    if (!onlyMissing || !registeredBehaviors.has(type.type))
      registeredBehaviors.set(type.type, properties);
    const shared = {};
    (type.sharedProperties || []).forEach(p => {
      shared[p.serializedKey || p.name] = scalar(p.type);
    });
    Object.entries(type.sharedSerializedDefaults || {}).forEach(
      ([key, value]) => {
        if (!shared[key])
          shared[key] = scalar(Array.isArray(value) ? 'array' : typeof value);
      }
    );
    if (!onlyMissing || !registeredSharedBehaviors.has(type.type))
      registeredSharedBehaviors.set(type.type, shared);
  });
  effectTypes.forEach(type => {
    if (onlyMissing && registeredEffects.has(type.type)) return;
    registeredEffects.set(
      type.type,
      Object.fromEntries(
        (type.serializedParameters || type.parameters || []).map(p => [
          p.name,
          scalar(p.type),
        ])
      )
    );
  });
};
export const registerLocalSettingsDefinitions = extensions => {
  (extensions || []).forEach(extension => {
    (extension.eventsBasedObjects || []).forEach(prefab => {
      const fields = Object.create(null);
      (prefab.propertyDescriptors || []).forEach(p => {
        fields[p.name] = scalar(p.type);
      });
      registeredObjects.set(
        `${extension.name}::${prefab.name}`,
        record(
          { variant: scalar('string') },
          {
            content: { key: 'content', schema: record(fields) },
            animatable: {
              key: 'animatable',
              schema: record({}, sprite.children),
            },
            childrenContent: {
              key: 'childrenContent',
              configurations: Object.fromEntries(
                (prefab.objects || []).map(object => [object.name, object.type])
              ),
            },
          }
        )
      );
    });
    (extension.eventsBasedBehaviors || []).forEach(behavior => {
      const fields = Object.create(null);
      (behavior.propertyDescriptors || []).forEach(p => {
        fields[p.name] = scalar(p.type);
      });
      registeredBehaviors.set(`${extension.name}::${behavior.name}`, fields);
      registeredSharedBehaviors.set(
        `${extension.name}::${behavior.name}`,
        Object.fromEntries(
          (behavior.sharedPropertyDescriptors || []).map(property => [
            property.name,
            scalar(property.type),
          ])
        )
      );
    });
  });
};
export const registerLocalSettingsSources = files => {
  const extensions = new Map();
  Object.entries(files)
    .filter(([uri]) =>
      /\/extensions\/[^/]+\/(prefabs|behaviors)\/[^/]+\/(prefab|behavior)\.settings$/.test(
        uri
      )
    )
    .forEach(([uri, source]) => {
      const parsed = decodeSettingsDocument(source, uri);
      const parts = uri
        .slice('game://'.length)
        .split('/')
        .map(decodeURIComponent);
      const extension = extensions.get(parts[1]) || {
        name: parts[1],
        eventsBasedObjects: [],
        eventsBasedBehaviors: [],
      };
      extension[
        parts[2] === 'prefabs' ? 'eventsBasedObjects' : 'eventsBasedBehaviors'
      ].push(parsed.payload);
      extensions.set(parts[1], extension);
    });
  extensions.forEach(extension => {
    extension.eventsBasedObjects.forEach(prefab => {
      prefab.objects = Object.entries(files)
        .filter(
          ([uri]) =>
            uri.startsWith(
              `game://extensions/${encodeURIComponent(
                extension.name
              )}/prefabs/${encodeURIComponent(prefab.name)}/objects/`
            ) && uri.endsWith('.settings')
        )
        .map(([, source]) => values(parseSettingsSyntax(source).root));
    });
  });
  registerLocalSettingsDefinitions(Array.from(extensions.values()));
};
const fail = (message, n, fileUri, path, code = 'SETTINGS_INVALID_SCHEMA') => {
  throw new SettingsDslError(code, message, fileUri, n.location || n, path);
};
const checkValue = (value, field, n, fileUri, path) => {
  const type = String(field.type || '').toLowerCase();
  const containsObject = value =>
    Array.isArray(value)
      ? value.some(containsObject)
      : value !== null && typeof value === 'object';
  if (containsObject(value))
    fail(
      'Structure literals are only allowed in variable values.',
      n,
      fileUri,
      path,
      'SETTINGS_INVALID_TYPE'
    );
  let valid = true;
  if (field.kinds)
    valid = field.kinds.includes(Array.isArray(value) ? 'array' : typeof value);
  else if (type === 'boolean') valid = typeof value === 'boolean';
  else if (type.includes('array')) {
    valid = Array.isArray(value);
    if (valid && type.includes('string'))
      valid = value.every(v => typeof v === 'string');
    if (valid && /number|integer/.test(type))
      valid = value.every(
        v =>
          typeof v === 'number' &&
          Number.isFinite(v) &&
          (!type.includes('integer') || Number.isSafeInteger(v))
      );
    if (valid && type.includes('boolean'))
      valid = value.every(v => typeof v === 'boolean');
    if (valid && type.includes('unique'))
      valid = new Set(value).size === value.length;
    if (type.includes('string or string array'))
      valid = typeof value === 'string' || valid;
  } else if (type.includes('integer')) valid = Number.isSafeInteger(value);
  else if (
    ['number', 'float', 'double', 'integer', 'bitmask'].includes(type) ||
    type.includes('positive number') ||
    type.includes('non-negative number')
  )
    valid = typeof value === 'number' && Number.isFinite(value);
  else if (
    type === 'enum' ||
    type.includes('string') ||
    type.includes('name') ||
    type.includes('path') ||
    type.includes('type') ||
    type.includes('uuid') ||
    type.includes('uri')
  )
    valid = typeof value === 'string';
  if (field.tupleLengths && Array.isArray(value))
    valid =
      field.tupleLengths.includes(value.length) &&
      value.every(v => typeof v === 'number' && Number.isFinite(v));
  if (field.stringValue !== undefined && typeof value === 'string')
    valid = value === field.stringValue;
  if (
    typeof value === 'number' &&
    ((field.minimum !== undefined && value < field.minimum) ||
      (field.maximum !== undefined && value > field.maximum))
  )
    valid = false;
  if (!valid)
    fail(`Expected ${field.type}.`, n, fileUri, path, 'SETTINGS_INVALID_TYPE');
  if (
    typeof value === 'number' &&
    ((type.startsWith('positive ') && value <= 0) ||
      (type.startsWith('non-negative ') && value < 0))
  )
    fail(`Expected ${field.type}.`, n, fileUri, path, 'SETTINGS_INVALID_TYPE');
  if (
    type.startsWith('enum:') &&
    (typeof value !== 'string' ||
      !type
        .slice(5)
        .split(',')
        .map(v => v.trim())
        .includes(value))
  )
    fail('Invalid enum value.', n, fileUri, path, 'SETTINGS_INVALID_TYPE');
  if (
    field.values &&
    !(Array.isArray(value)
      ? value.every(v => field.values.includes(v))
      : field.values.includes(value))
  )
    fail(`Expected one of ${field.values.join(', ')}.`, n, fileUri, path);
  if (field.value !== undefined && value !== field.value)
    fail(
      `Only current format ${field.value} is supported.`,
      n,
      fileUri,
      path,
      'MULTIFILE_UNSUPPORTED_VERSION'
    );
};
const layoutFields = ['background', 'bounds', 'editor', 'layer', 'instance'];
const isLayout = kind =>
  ['scene', 'prefab', 'prefabVariant', 'externalLayout'].includes(kind);
const schemaFor = (kind, data) => {
  const schema = own(schemas, kind) ? schemas[kind] : null;
  if (!schema) return null;
  if (kind !== 'object') return schema;
  const extra = ensureType(registeredObjects, data.type);
  return extra
    ? {
        ...schema,
        fields: { ...schema.fields, ...extra.fields },
        children: { ...schema.children, ...extra.children },
      }
    : schema;
};

const behaviorPropertiesSchema = (fields = {}) => {
  const children = {};
  const scalars = { ...fields };
  if (fields.vertices)
    children.vertex = { key: 'vertices', repeated: true, schema: point };
  return record(scalars, children);
};
const effectSchema = (schema, data) => {
  const fields = registeredEffects.get(data.effectType);
  if (!fields) return schema;
  const children = { ...schema.children };
  ['doubleParameters', 'stringParameters', 'booleanParameters'].forEach(key => {
    children[key] = { key, schema: record(fields) };
  });
  return { ...schema, children };
};
const decodeRecord = (n, schema, fileUri, path, locations) => {
  const out = {};
  locations.set(out, { ...n.location, path });
  Object.entries(n.properties).forEach(([key, item]) => {
    const field = own(schema.fields, key) ? schema.fields[key] : null;
    const emptyCollection = Object.values(schema.children).find(
      c => c.repeated && !c.variableKeys && c.key === key
    );
    if (
      emptyCollection &&
      Array.isArray(item.value) &&
      item.value.length === 0
    ) {
      out[key] = [];
      return;
    }
    if (!field && !schema.dynamic)
      fail(
        `Unknown property ${key}.`,
        item,
        fileUri,
        `${path}.${key}`,
        'SETTINGS_UNKNOWN_FIELD'
      );
    checkValue(
      item.value,
      field || scalar(schema.dynamic),
      item,
      fileUri,
      `${path}.${key}`
    );
    Object.defineProperty(out, (field && field.sourceKey) || key, {
      value: item.value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  });
  const seen = new Set();
  n.children.forEach(child => {
    if (
      child.type === 'variable' &&
      schema.children.variable &&
      schema.children.variable.variableKeys
    ) {
      const keys = schema.children.variable.variableKeys;
      const scope = values(child).scope;
      const key =
        keys.length > 1
          ? scope === 'global'
            ? 'globalVariables'
            : scope === 'scene'
            ? 'sceneVariables'
            : null
          : keys[0];
      if (
        !key ||
        !keys.includes(key) ||
        (keys.length === 1 && scope !== undefined)
      )
        fail(
          'Variable scope is required only on an owner with global and scene defaults.',
          child.properties.scope || child,
          fileUri,
          path
        );
      const variable = decodeVariableNode(
        child,
        fileUri,
        path,
        path.startsWith('instance')
      );
      const list = out[key] || (out[key] = []);
      if (list.some(entry => entry.name === variable.name))
        fail('Duplicate variable name.', child.properties.name, fileUri, path);
      list.push(variable);
      locations.set(variable, { ...child.location, path });
      return;
    }
    const entry = own(schema.children, child.type)
      ? schema.children[child.type]
      : null;
    if (entry && own(n.properties, entry.key))
      fail(
        'A collection cannot use both an empty assignment and child nodes.',
        child,
        fileUri,
        path
      );
    if (!entry)
      fail(
        `Unknown node ${child.type}.`,
        child,
        fileUri,
        path,
        'SETTINGS_UNKNOWN_NODE'
      );
    if (entry.configurations) {
      const configurations = Object.create(null);
      child.children.forEach(configuration => {
        const name = values(configuration).name;
        const configurationType = own(entry.configurations, name)
          ? entry.configurations[name]
          : null;
        if (
          configuration.type !== 'child' ||
          !configurationType ||
          own(configurations, name)
        )
          fail(
            'Unknown or duplicate child configuration.',
            configuration,
            fileUri,
            path
          );
        const configurationSchema = ensureType(
          registeredObjects,
          configurationType
        );
        if (!configurationSchema)
          fail(
            `Unknown child object type ${configurationType}.`,
            configuration,
            fileUri,
            path
          );
        const configurationNode = {
          ...configuration,
          properties: { ...configuration.properties },
        };
        delete configurationNode.properties.name;
        configurations[name] = decodeRecord(
          configurationNode,
          configurationSchema,
          fileUri,
          path,
          locations
        );
      });
      if (seen.has(child.type) || Object.keys(child.properties).length)
        fail('Invalid childrenContent container.', child, fileUri, path);
      seen.add(child.type);
      out[entry.key] = configurations;
      return;
    }
    if (!entry.repeated && seen.has(child.type))
      fail(`Duplicate ${child.type} node.`, child, fileUri, path);
    seen.add(child.type);
    let childSchema =
      entry.key === 'effects'
        ? effectSchema(entry.schema, values(child))
        : entry.schema;
    let decoded;
    if (
      ['behaviors', 'behaviorsSharedData'].includes(entry.key) &&
      entry.schema.fields.type
    ) {
      const data = values(child);
      const properties = ensureType(
        entry.key === 'behaviorsSharedData'
          ? registeredSharedBehaviors
          : registeredBehaviors,
        data.type
      );
      if (!properties)
        fail(
          `Unknown behavior type ${
            data.type
          }; register its current schema first.`,
          child,
          fileUri,
          path
        );
      const propsNode = child.children.find(c => c.type === 'properties');
      childSchema = {
        ...childSchema,
        children: {
          ...childSchema.children,
          properties: {
            key: '$properties',
            schema: behaviorPropertiesSchema(properties),
          },
        },
      };
      decoded = decodeRecord(
        child,
        childSchema,
        fileUri,
        `${path}.${child.type}`,
        locations
      );
      if (propsNode) {
        Object.assign(decoded, decoded.$properties);
        delete decoded.$properties;
      }
    } else
      decoded = decodeRecord(
        child,
        childSchema,
        fileUri,
        `${path}.${child.type}`,
        locations
      );
    if (entry.repeated)
      (out[entry.key] || (out[entry.key] = [])).push(
        entry.key === 'customCollisionMask' ? decoded.$items || [] : decoded
      );
    else out[entry.key] = decoded;
  });
  return out;
};
const encodeRecord = (type, data, schema, fileUri) => {
  const out = node(type);
  const preferred = [
    'formatVersion',
    'name',
    'order',
    ...Object.keys(schema.fields),
    ...Object.values(schema.children).flatMap(
      child => child.variableKeys || [child.key]
    ),
  ];
  const keys = Object.keys(data).sort((left, right) => {
    const a = preferred.indexOf(left);
    const b = preferred.indexOf(right);
    return (
      (a < 0 ? preferred.length : a) - (b < 0 ? preferred.length : b) ||
      (schema.dynamic ? 0 : left.localeCompare(right))
    );
  });
  keys.forEach(key => {
    const value = data[key];
    const variables = schema.children.variable;
    if (
      variables &&
      variables.variableKeys &&
      variables.variableKeys.includes(key)
    ) {
      if (!Array.isArray(value))
        fail('Variables must be an array.', out, fileUri, type);
      value.forEach(variable =>
        out.children.push(
          encodeVariableNode(
            variable,
            variables.variableKeys.length > 1
              ? key === 'globalVariables'
                ? 'global'
                : 'scene'
              : null,
            fileUri
          )
        )
      );
      return;
    }
    const childEntry = Object.entries(schema.children).find(
      ([, c]) => c.key === key
    );
    if (childEntry) {
      const [childType, entry] = childEntry;
      if (entry.configurations) {
        const container = node(childType);
        Object.entries(value).forEach(([name, configuration]) => {
          const configurationType = own(entry.configurations, name)
            ? entry.configurations[name]
            : null;
          if (!configurationType)
            fail(`Unknown child configuration ${name}.`, out, fileUri, type);
          const configurationSchema = ensureType(
            registeredObjects,
            configurationType
          );
          if (!configurationSchema)
            fail(
              `Unknown child object type ${configurationType}.`,
              out,
              fileUri,
              type
            );
          const encoded = encodeRecord(
            'child',
            configuration,
            configurationSchema,
            fileUri
          );
          encoded.properties = { name: { value: name }, ...encoded.properties };
          container.children.push(encoded);
        });
        out.children.push(container);
      } else if (entry.repeated && value.length === 0)
        out.properties[key] = { value: [] };
      else if (entry.repeated)
        (value || []).forEach(item => {
          if (
            ['behaviors', 'behaviorsSharedData'].includes(key) &&
            entry.schema.fields.type
          ) {
            const structural = Object.keys(entry.schema.fields);
            const data = omit(
              item,
              Object.keys(item).filter(
                k => !structural.includes(k) && !own(entry.schema.children, k)
              )
            );
            const properties = omit(item, [
              ...structural,
              ...Object.keys(entry.schema.children),
            ]);
            const b = encodeRecord(childType, data, entry.schema, fileUri);
            if (Object.keys(properties).length)
              b.children.push(
                encodeRecord(
                  'properties',
                  properties,
                  behaviorPropertiesSchema(
                    ensureType(
                      key === 'behaviorsSharedData'
                        ? registeredSharedBehaviors
                        : registeredBehaviors,
                      item.type
                    ) || {}
                  ),
                  fileUri
                )
              );
            out.children.push(b);
          } else
            out.children.push(
              encodeRecord(
                childType,
                key === 'customCollisionMask' ? { $items: item } : item,
                key === 'effects'
                  ? effectSchema(entry.schema, item)
                  : entry.schema,
                fileUri
              )
            );
        });
      else
        out.children.push(
          encodeRecord(childType, value, entry.schema, fileUri)
        );
    } else {
      if (
        value === null ||
        (typeof value === 'object' && !Array.isArray(value))
      )
        fail(`Unregistered structured field ${key}.`, out, fileUri, type);
      const authorKey =
        Object.keys(schema.fields).find(
          k => schema.fields[k].sourceKey === key
        ) || key;
      if (!own(schema.fields, authorKey) && !schema.dynamic)
        fail(
          `Unknown serializer field ${key}. Register its schema before saving.`,
          out,
          fileUri,
          type,
          'SETTINGS_UNKNOWN_FIELD'
        );
      checkValue(
        value,
        schema.fields[authorKey] || scalar(schema.dynamic),
        out,
        fileUri,
        `${type}.${key}`
      );
      out.properties[authorKey] = { value };
    }
  });
  return out;
};

// Shared, publishable node contracts. Runtime constraints (references,
// uniqueness, object-specific overrides) are checked by LayoutDocument.
const vector = lengths => ({ type: 'number array', tupleLengths: lengths });
const enumeration = values => ({ type: 'enum', values });
const layoutNodeSchema = {
  editor: record({
    grid: scalar('boolean'),
    grid_type: enumeration(['rectangular', 'isometric']),
    grid_size: vector([3]),
    grid_offset: vector([3]),
    grid_color: scalar('string'),
    grid_alpha: { type: 'number', minimum: 0, maximum: 1 },
    snap: scalar('boolean'),
    zoom: { type: 'number', minimum: 0.01 },
    window_mask: scalar('boolean'),
    selected_layer: scalar('string'),
    mode: enumeration(['instances-editor', 'embedded-game']),
  }),
  camera: record({
    size: {
      type: 'string or number array',
      kinds: ['string', 'array'],
      tupleLengths: [2],
      stringValue: 'default',
    },
    viewport: {
      type: 'string or number array',
      kinds: ['string', 'array'],
      tupleLengths: [4],
      stringValue: 'default',
    },
    stored_size: vector([2]),
    stored_viewport: vector([4]),
  }),
  effect: record(
    {
      name: scalar('string'),
      type: scalar('string'),
      enabled: scalar('boolean'),
      folded: scalar('boolean'),
    },
    {
      properties: { key: 'properties', schema: record({}, {}, 'value') },
    }
  ),
  behavior: record(
    {
      name: scalar('string'),
      folded: scalar('boolean'),
      muted: scalar('boolean'),
      inherited: scalar('boolean'),
      quick: enumeration(['default', 'visible', 'hidden']),
    },
    {
      properties: { key: 'properties', schema: record({}, {}, 'value') },
      property_visibility: {
        key: 'property_visibility',
        schema: record({}, {}, 'string'),
      },
    }
  ),
};
layoutNodeSchema.layer = record(
  {
    id: scalar('string'),
    name: scalar('string'),
    rendering: enumeration(['', '2d', '3d', '2d+3d']),
    camera_type: enumeration(['', 'perspective', 'orthographic']),
    camera_behavior: scalar('string'),
    visible: scalar('boolean'),
    locked: scalar('boolean'),
    lighting: scalar('boolean'),
    follow_base_camera: scalar('boolean'),
    ambient: scalar('string'),
    near: scalar('number'),
    far: scalar('number'),
    fov: { type: 'number', minimum: 0, maximum: 180 },
    max_2d_distance: scalar('positive number'),
  },
  {
    camera: { key: 'cameras', repeated: true, schema: layoutNodeSchema.camera },
    effect: { key: 'effects', repeated: true, schema: layoutNodeSchema.effect },
  }
);
layoutNodeSchema.instance = record(
  {
    id: scalar('UUIDv4 string'),
    object: scalar('string'),
    layer: scalar('string'),
    position: vector([2, 3]),
    rotation: {
      type: 'number or number array',
      kinds: ['number', 'array'],
      tupleLengths: [3],
    },
    z_order: scalar('integer'),
    size: vector([2]),
    auto_size: vector([2]),
    depth: scalar('number'),
    opacity: { type: 'integer', minimum: 0, maximum: 255 },
    flip: { type: 'string array', values: ['x', 'y', 'z'] },
    locked: scalar('boolean'),
    sealed: scalar('boolean'),
    hidden: scalar('boolean'),
    keep_ratio: scalar('boolean'),
  },
  {
    properties: { key: 'properties', schema: record({}, {}, 'value') },
    variable: variableEntry(['variables']),
    behavior: {
      key: 'behaviors',
      repeated: true,
      schema: layoutNodeSchema.behavior,
    },
  }
);
export const decodeSettingsDocument = (source, fileUri) => {
  const syntax = parseSettingsSyntax(source, fileUri);
  const root = syntax.root;
  const kind = own(KINDS, root.type) ? KINDS[root.type] : null;
  if (!kind)
    fail(`Unknown component root ${root.type}.`, root, fileUri, root.type);
  const locations = new WeakMap();
  const schema = schemaFor(kind, values(root));
  if (kind === 'object' && !ensureType(registeredObjects, values(root).type))
    fail(
      'Unknown object type; register its current schema first.',
      root,
      fileUri,
      root.type
    );
  const metadataNode = {
    ...root,
    properties: Object.fromEntries(
      Object.entries(root.properties).filter(
        ([k]) => !isLayout(kind) || !layoutFields.includes(k)
      )
    ),
    children: root.children.filter(
      c =>
        (!(kind === 'function' || kind === 'externalEvents') ||
          c.type !== 'events') &&
        (!isLayout(kind) || !layoutFields.includes(c.type))
    ),
  };
  const eventContainers = root.children.filter(c => c.type === 'events');
  if (eventContainers.length > 1)
    fail('Duplicate events container.', eventContainers[1], fileUri, root.type);
  let payload = decodeRecord(
    metadataNode,
    schema,
    fileUri,
    root.type,
    locations
  );
  if (kind === 'project') {
    const propertyKeys = [
      ...Object.keys(projectProperties.fields),
      ...Object.values(projectProperties.children).map(c => c.key),
    ];
    const properties = Object.fromEntries(
      Object.entries(payload).filter(([key]) => propertyKeys.includes(key))
    );
    payload = { ...omit(payload, propertyKeys), properties };
  }
  if (kind === 'project' && payload.formatVersion !== SETTINGS_FORMAT_VERSION)
    fail(
      `Only Settings DSL format ${SETTINGS_FORMAT_VERSION} is supported.`,
      root,
      fileUri,
      root.type,
      'MULTIFILE_UNSUPPORTED_VERSION'
    );
  if (
    !['project', 'resources', 'tests'].includes(kind) &&
    (typeof payload.name !== 'string' || !payload.name)
  )
    fail('Component name is required.', root, fileUri, root.type);
  let layout;
  if (isLayout(kind)) {
    layout = {
      layout: { version: 1 },
      layers: [],
      effects: [],
      instances: [],
      variables: [],
      behaviors: [],
    };
    locations.set(layout.layout, root.location);
    if (root.properties.background)
      layout.layout.background = root.properties.background.value;
    const single = new Set();
    root.children
      .filter(c => layoutFields.includes(c.type))
      .forEach(c => {
        if (['bounds', 'editor'].includes(c.type)) {
          if (single.has(c.type))
            fail(`Duplicate ${c.type}.`, c, fileUri, root.type);
          single.add(c.type);
        }
        if (c.type === 'bounds')
          layout.layout.bounds = decodeRecord(
            c,
            record({ min: scalar('value'), max: scalar('value') }),
            fileUri,
            'bounds',
            locations
          );
        if (c.type === 'editor')
          layout.editor = decodeRecord(
            c,
            layoutNodeSchema.editor,
            fileUri,
            'editor',
            locations
          );
        if (c.type === 'layer') {
          const layer = decodeRecord(
            c,
            layoutNodeSchema.layer,
            fileUri,
            'layer',
            locations
          );
          (layer.cameras || []).forEach(camera =>
            ['size', 'viewport'].forEach(k => {
              if (camera[`stored_${k}`] !== undefined) {
                if (camera[k] !== 'default')
                  fail(
                    `stored_${k} requires default mode.`,
                    c,
                    fileUri,
                    'camera'
                  );
                camera[k] = { default: camera[`stored_${k}`] };
                delete camera[`stored_${k}`];
              }
            })
          );
          (layer.effects || []).forEach(effect => {
            const out = {
              ...omit(effect, ['properties']),
              ...effect.properties,
              layer: layer.id,
            };
            locations.set(out, locations.get(effect));
            layout.effects.push(out);
          });
          delete layer.effects;
          layout.layers.push(layer);
        }
        if (c.type === 'instance') {
          const instance = decodeRecord(
            c,
            layoutNodeSchema.instance,
            fileUri,
            'instance',
            locations
          );
          const out = {
            ...omit(instance, ['position', 'variables', 'behaviors']),
            at: instance.position,
          };
          locations.set(out, locations.get(instance));
          (instance.variables || []).forEach(v => {
            const item = { ...v, instance: instance.id };
            locations.set(item, c.location);
            layout.variables.push(item);
          });
          (instance.behaviors || []).forEach(b => {
            const item = { ...b, instance: instance.id };
            locations.set(item, locations.get(b));
            layout.behaviors.push(item);
          });
          layout.instances.push(out);
        }
      });
    payload.layout = layout;
  }
  return { kind, payload, layout, locations, syntax };
};
export const serializeSettingsDocument = (kind, payload, layout, fileUri) => {
  if (kind === 'project')
    payload = { ...payload.properties, ...omit(payload, ['properties']) };
  const schema = schemaFor(kind, payload);
  if (kind === 'object' && !ensureType(registeredObjects, payload.type))
    fail(
      'Unknown object type; register its current schema first.',
      {},
      fileUri,
      kind
    );
  if (!schema || !ROOTS[kind])
    fail(`Unknown component ${kind}.`, {}, fileUri, kind);
  const root = encodeRecord(ROOTS[kind], payload, schema, fileUri);
  if (layout) {
    const group = (records, key) => {
      const groups = new Map();
      (records || []).forEach(item => {
        const list = groups.get(item[key]) || [];
        list.push(item);
        groups.set(item[key], list);
      });
      return groups;
    };
    const effectsByLayer = group(layout.effects, 'layer');
    const variablesByInstance = group(layout.variables, 'instance');
    const behaviorsByInstance = group(layout.behaviors, 'instance');
    if (layout.layout.background !== undefined)
      root.properties.background = { value: layout.layout.background };
    if (layout.layout.bounds)
      root.children.push(
        encodeRecord(
          'bounds',
          layout.layout.bounds,
          record({ min: scalar('value'), max: scalar('value') }),
          fileUri
        )
      );
    if (layout.editor)
      root.children.push(
        encodeRecord('editor', layout.editor, layoutNodeSchema.editor, fileUri)
      );
    (layout.layers || []).forEach(layer => {
      const cameras = (layer.cameras || []).map(camera => {
        const out = { ...camera };
        ['size', 'viewport'].forEach(k => {
          if (out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
            out[`stored_${k}`] = out[k].default;
            out[k] = 'default';
          }
        });
        return out;
      });
      const effects = (effectsByLayer.get(layer.id) || []).map(e => ({
        ...Object.fromEntries(
          ['name', 'type', 'enabled', 'folded']
            .filter(k => e[k] !== undefined)
            .map(k => [k, e[k]])
        ),
        properties: omit(e, ['layer', 'name', 'type', 'enabled', 'folded']),
      }));
      root.children.push(
        encodeRecord(
          'layer',
          { ...layer, ...(layer.cameras ? { cameras } : {}), effects },
          layoutNodeSchema.layer,
          fileUri
        )
      );
    });
    (layout.instances || []).forEach(instance => {
      const variables = (variablesByInstance.get(instance.id) || []).map(v =>
        omit(v, ['instance'])
      );
      const behaviors = (behaviorsByInstance.get(instance.id) || []).map(b =>
        omit(b, ['instance'])
      );
      root.children.push(
        encodeRecord(
          'instance',
          {
            ...omit(instance, ['at']),
            position: instance.at,
            variables,
            behaviors,
          },
          layoutNodeSchema.instance,
          fileUri
        )
      );
    });
  }
  if (kind === 'function' || kind === 'externalEvents')
    root.children.push(node('events'));
  const source = printSettingsSyntax(root);
  decodeSettingsDocument(source, fileUri);
  return source;
};
export const formatSettingsDsl = (source, fileUri) => {
  const parsed = parseSettingsSyntax(source, fileUri);
  return printSettingsSyntax(parsed.root, parsed.comments);
};
export const getObjectSettingsSchema = type => registeredObjects.get(type);
export const toSettingsNodeSchema = inventorySchema;
export const getSettingsSchemas = () => ({
  roots: ROOTS,
  components: schemas,
  layout: layoutNodeSchema,
  variableSchemas: { variable: variableSchema },
  eventSchemas: EVENT_SCHEMAS,
});

export const getComponentSettingsSchema = (kind, schemaKey) => {
  const base = schemas[kind === 'project' ? kind : schemaKey] || schemas[kind];
  if (!isLayout(kind)) return base;
  const children = {
    ...base.children,
    editor: { key: 'editor', schema: layoutNodeSchema.editor },
    layer: {
      key: 'layers',
      repeated: true,
      schema:
        kind === 'externalLayout'
          ? record({ id: scalar('string'), name: scalar('string') })
          : layoutNodeSchema.layer,
    },
    instance: {
      key: 'instances',
      repeated: true,
      schema: layoutNodeSchema.instance,
    },
  };
  if (kind === 'prefab' || kind === 'prefabVariant')
    children.bounds = {
      key: 'bounds',
      required: true,
      schema: record({ min: vector([3]), max: vector([3]) }),
    };
  return record(
    {
      ...base.fields,
      ...(kind === 'scene'
        ? { background: { type: 'string', required: true } }
        : {}),
    },
    children
  );
};
