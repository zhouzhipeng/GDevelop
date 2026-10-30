// @flow

import { MULTI_FILE_ENTRY_NAME } from './ProjectEntry';
import { shouldHideExtension } from '../Version';
import {
  serializeToJSObject,
  unserializeFromJSObject,
} from '../Utils/Serializer';
import { encodeManagedName } from './MultiFileProjectFormat';

import {
  getSettingsSchemas,
  registerSettingsTypes,
  setSettingsTypeProvider,
  getObjectSettingsSchema,
  getComponentSettingsSchema,
} from './SettingsDsl';

const gd: libGDevelop = global.gd;

// Physics2 still reads these legacy shared fields when worldScale is absent.
// They are retained in existing projects even though the editor no longer
// exposes them as properties or includes them in initialized defaults.
const LEGACY_SHARED_SERIALIZED_PROPERTIES = {
  'Physics2::Physics2Behavior': [
    { serializedKey: 'scaleX', type: 'number' },
    { serializedKey: 'scaleY', type: 'number' },
  ],
};

const SCENE_LIFECYCLE_SOURCES = Object.freeze([
  { name: 'sceneLoad', legacyField: 'sceneLoadEvents', order: 0 },
  { name: 'sceneSignal', legacyField: 'sceneSignalEvents', order: 1 },
  { name: 'sceneUpdate', legacyField: 'events', order: 2 },
  { name: 'sceneUnload', legacyField: 'sceneUnloadEvents', order: 3 },
]);

export const PROJECT_GDL_CATALOG_RELATIVE_PATH = '.gdevelop/gdl-catalog.json';
export const PROJECT_GDL_CATALOG_FORMAT_VERSION = 13;

export class ProjectSourceCatalogError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ProjectSourceCatalogError';
    this.code = code;
  }
}

const fail = (message: string): empty => {
  throw new ProjectSourceCatalogError(
    'PROJECT_SOURCE_CATALOG_INVALID',
    message
  );
};

const sortedUnique = (values: Array<string>): Array<string> =>
  Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));

const toArray = (collection: any): Array<any> => {
  if (!collection) return [];
  if (typeof collection.toJSArray === 'function') return collection.toJSArray();
  if (
    typeof collection.size === 'function' &&
    typeof collection.at === 'function'
  ) {
    const result = [];
    for (let index = 0; index < collection.size(); index++) {
      result.push(collection.at(index));
    }
    return result;
  }
  return [];
};

const summarizeProperty = (name: string, property: any): ?Object => {
  if (
    (property.isHidden && property.isHidden()) ||
    (property.isDeprecated && property.isDeprecated())
  ) {
    return null;
  }
  const type = String((property.getType && property.getType()) || '');
  if (!type) {
    console.warn(
      `[ProjectSourceCatalog] Property ${name} has no registered type and was omitted from the authoring catalog.`
    );
    return null;
  }
  const summary: Object = {
    name,
    authoringKey: name,
    type,
  };
  const defaultValue = property.getValue && property.getValue();
  if (defaultValue !== undefined) {
    summary.defaultValue = defaultValue;
  }
  const label = property.getLabel && property.getLabel();
  if (label) summary.label = label;
  const description = property.getDescription && property.getDescription();
  if (description) summary.description = description;
  const group = property.getGroup && property.getGroup();
  if (group) summary.group = group;
  if (property.isAdvanced && property.isAdvanced()) summary.advanced = true;
  const choices = property.getChoices && toArray(property.getChoices());
  if (choices && choices.length) {
    summary.choices = choices.map(choice => ({
      value: choice.getValue(),
      label: choice.getLabel(),
    }));
  }
  const extraInfo = property.getExtraInfo && toArray(property.getExtraInfo());
  if (extraInfo && extraInfo.length) summary.extraInfo = extraInfo;
  return summary;
};

const changedTopLevelKeys = (before: Object, after: Object): Array<string> =>
  sortedUnique([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]).filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]));

const propertyProbeValue = (property: any): string => {
  const type = String((property.getType && property.getType()) || '');
  const value = String((property.getValue && property.getValue()) || '');
  if (['Number', 'Integer', 'Float'].includes(type)) {
    const number = Number(value);
    return String(Number.isFinite(number) ? number + 1 : 1);
  }
  if (type === 'Boolean') {
    return ['1', 'true'].includes(value.toLowerCase()) ? '0' : '1';
  }
  const choices = property.getChoices && toArray(property.getChoices());
  if (choices && choices.length) {
    const alternative = choices.find(
      choice => String(choice.getValue()) !== value
    );
    if (alternative) return String(alternative.getValue());
  }
  return `${value}__gdevelop_catalog_probe__`;
};

const inferSerializedPropertyKey = ({
  instance,
  authoringKey,
  property,
}: Object): Object => {
  if (!instance || typeof instance.updateProperty !== 'function') {
    return {
      status: 'unsupported',
      reason: 'No writable metadata instance is registered for this property.',
    };
  }
  let baseline;
  try {
    baseline = serializeToJSObject(instance);
    if (!instance.updateProperty(authoringKey, propertyProbeValue(property))) {
      return {
        status: 'unsupported',
        reason: 'The registered instance rejected the metadata property key.',
      };
    }
    const changedKeys = changedTopLevelKeys(
      baseline,
      serializeToJSObject(instance)
    );
    if (changedKeys.length !== 1) {
      return {
        status: 'unsupported',
        reason:
          changedKeys.length === 0
            ? 'Updating the property did not change serialized data.'
            : `Updating the property changed multiple serialized keys: ${changedKeys.join(
                ', '
              )}.`,
      };
    }
    return { status: 'supported', serializedKey: changedKeys[0] };
  } catch (error) {
    return {
      status: 'unsupported',
      reason: error && error.message ? error.message : String(error),
    };
  } finally {
    if (baseline) {
      try {
        unserializeFromJSObject(instance, baseline);
      } catch (error) {
        console.warn(
          `[ProjectSourceCatalog] Unable to restore metadata instance after probing ${authoringKey}.`,
          error
        );
      }
    }
  }
};

// Metadata instances are prototypes, not necessarily initialized configurations.
// Inspect the engine's actual default content without retaining mutations on a
// borrowed WASM instance or guessing serialized keys from editor labels.
const readInitializedSerializedDefaults = (instance: any): Object => {
  // Shared-data wrappers do not expose the serialization API in these bindings.
  if (
    typeof instance.serializeTo !== 'function' ||
    typeof instance.unserializeFrom !== 'function'
  )
    return {};
  const baseline = serializeToJSObject(instance);
  try {
    instance.initializeContent();
    return serializeToJSObject(instance);
  } finally {
    unserializeFromJSObject(instance, baseline);
  }
};

const summarizeProperties = (
  properties: any,
  instance?: any
): Array<Object> => {
  if (!properties || !properties.keys) return [];
  return toArray(properties.keys())
    .sort((left, right) => String(left).localeCompare(String(right)))
    .map(name => {
      const authoringKey = String(name);
      const property = properties.get(name);
      if (
        (property.isHidden && property.isHidden()) ||
        (property.isDeprecated && property.isDeprecated())
      ) {
        return null;
      }
      const summary = summarizeProperty(authoringKey, property);
      if (!summary) return null;
      if (instance !== undefined) {
        const serialization = inferSerializedPropertyKey({
          instance,
          authoringKey,
          property,
        });
        if (serialization.status === 'supported') {
          summary.serializedKey = serialization.serializedKey;
        } else {
          summary.serialization = serialization;
        }
      }
      return summary;
    })
    .filter(Boolean);
};

const summarizeSerializedProperties = (
  propertyDescriptors: ?Array<Object>
): Array<Object> => {
  const descriptors = propertyDescriptors || [];
  return descriptors
    .filter(property => !property.hidden && !property.deprecated)
    .map(property => {
      const summary: Object = {
        name: String(property.name || ''),
        authoringKey: String(property.name || ''),
        serializedKey: String(property.name || ''),
        type: String(property.type || ''),
      };
      if (property.value !== undefined) summary.defaultValue = property.value;
      if (property.label) summary.label = property.label;
      if (property.description) summary.description = property.description;
      if (property.group) summary.group = property.group;
      if (property.advanced) summary.advanced = true;
      if (Array.isArray(property.choices) && property.choices.length) {
        summary.choices = property.choices.map(choice => ({
          value: choice.value,
          label: choice.label,
        }));
      }
      const extraInfo = Array.isArray(property.extraInformation)
        ? property.extraInformation
        : property.extraInfo;
      if (Array.isArray(extraInfo) && extraInfo.length) {
        summary.extraInfo = extraInfo;
      }
      return summary;
    });
};

const getSerializedRequiredBehaviorTypes = (
  behaviorDefinition: Object
): Array<string> =>
  (behaviorDefinition.propertyDescriptors || [])
    .filter(property => property.type === 'Behavior')
    .map(property => {
      const extraInfo = Array.isArray(property.extraInformation)
        ? property.extraInformation
        : property.extraInfo;
      return Array.isArray(extraInfo) && extraInfo.length
        ? String(extraInfo[0] || '')
        : '';
    })
    .filter(Boolean);

const safelySummarizeMetadataProperties = (
  readProperties: () => any,
  instance: any,
  context: string
): Array<Object> => {
  try {
    return summarizeProperties(readProperties(), instance);
  } catch (error) {
    console.warn(
      `[ProjectSourceCatalog] Unable to read ${context}; omitting its property metadata from the generated catalog.`,
      error
    );
    return [];
  }
};

const safelyReadRequiredBehaviorTypes = (
  metadata: gdBehaviorMetadata,
  behaviorType: string
): Array<string> => {
  try {
    return toArray(metadata.getRequiredBehaviorTypes());
  } catch (error) {
    console.warn(
      `[ProjectSourceCatalog] Unable to read required behavior types for behavior ${behaviorType}; omitting them from the generated catalog.`,
      error
    );
    return [];
  }
};

const getProjectExtensionNames = (serializedProject: Object): Set<string> =>
  new Set(
    (serializedProject.eventsFunctionsExtensions || []).map(extension =>
      String(extension.name || '')
    )
  );

const getProjectBehaviorDefinitions = (
  serializedProject: Object
): Map<string, Object> => {
  const definitions: Map<string, Object> = new Map();
  (serializedProject.eventsFunctionsExtensions || []).forEach(extension => {
    const extensionName = String(extension.name || '');
    (extension.eventsBasedBehaviors || []).forEach(behavior => {
      const behaviorName = String(behavior.name || '');
      definitions.set(`${extensionName}::${behaviorName}`, behavior);
    });
  });
  return definitions;
};

const getProjectObjectDefinitions = (
  serializedProject: Object
): Map<string, Object> => {
  const definitions: Map<string, Object> = new Map();
  (serializedProject.eventsFunctionsExtensions || []).forEach(extension => {
    const extensionName = String(extension.name || '');
    (extension.eventsBasedObjects || []).forEach(object => {
      const objectName = String(object.name || '');
      definitions.set(`${extensionName}::${objectName}`, object);
    });
  });
  return definitions;
};

const serializedPropertyDescriptorDefaultValue = (property: Object): any => {
  const type = String(property.type || '').toLowerCase();
  const value = property.value;
  if (
    type.includes('number') ||
    type.includes('integer') ||
    type.includes('float')
  ) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }
  if (type.includes('boolean')) {
    return ['1', 'true'].includes(String(value || '').toLowerCase());
  }
  return String(value || '');
};

const summarizeProjectObjectDefinition = (
  objectDefinition: Object
): {| serializedConfiguration: Object, properties: Array<Object> |} => {
  const properties = summarizeSerializedProperties(
    objectDefinition.propertyDescriptors
  ).map(property => ({
    ...property,
    serializedPath: `content.${property.serializedKey}`,
  }));
  const content: { [string]: any } = {};
  (objectDefinition.propertyDescriptors || [])
    .filter(property => !property.hidden && !property.deprecated)
    .forEach(property => {
      const name = String(property.name || '');
      if (name) {
        content[name] = serializedPropertyDescriptorDefaultValue(property);
      }
    });
  return {
    serializedConfiguration: { content, variant: '' },
    properties,
  };
};

const OBJECT_DEFINITION_FIELDS = new Set([
  'assetStoreId',
  'behaviors',
  'effects',
  'name',
  'persistentUuid',
  'resourcesPreloading',
  'type',
  'variables',
]);

const collectSerializedObjectConfigurationsByType = (
  serializedProject: Object
): Map<string, Array<Object>> => {
  const configurationsByType: Map<string, Array<Object>> = new Map();
  const addObjects = (objects: ?Array<Object>) => {
    (objects || []).forEach(object => {
      if (!object || typeof object !== 'object' || Array.isArray(object)) {
        return;
      }
      const type = String(object.type || '');
      if (!type) return;
      const configuration = {};
      Object.keys(object).forEach(key => {
        if (!OBJECT_DEFINITION_FIELDS.has(key)) {
          configuration[key] = object[key];
        }
      });
      const configurations = configurationsByType.get(type) || [];
      configurations.push(configuration);
      configurationsByType.set(type, configurations);
    });
  };

  addObjects(serializedProject.objects);
  (serializedProject.layouts || []).forEach(layout =>
    addObjects(layout.objects)
  );
  (serializedProject.eventsFunctionsExtensions || []).forEach(extension => {
    (extension.eventsBasedObjects || []).forEach(eventsBasedObject => {
      addObjects(eventsBasedObject.objects);
      (eventsBasedObject.variants || []).forEach(variant =>
        addObjects(variant.objects)
      );
    });
  });
  return configurationsByType;
};

const serializedValueKind = (value: any): string => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') {
    // An integral default (for example tileScale = 1) does not prove that
    // a native serializer field only accepts integers. JSON samples establish
    // a number schema; integral constraints require an explicit field schema.
    return 'number';
  }
  return typeof value;
};

type SerializedValueShape = {
  kinds: Array<string>,
  fields: { [string]: SerializedValueShape },
  item: ?SerializedValueShape,
  defaultValue?: any,
  defaultEmpty?: boolean,
};

const mergeSerializedValueShape = (
  shape: ?SerializedValueShape,
  value: any,
  isDefaultValue: boolean = false
): SerializedValueShape => {
  const merged: SerializedValueShape = shape || {
    kinds: [],
    fields: {},
    item: null,
  };
  const kind = serializedValueKind(value);
  if (!merged.kinds.includes(kind)) {
    merged.kinds.push(kind);
    merged.kinds.sort((left, right) => left.localeCompare(right));
  }
  if (
    isDefaultValue &&
    ['boolean', 'integer', 'number', 'string'].includes(kind)
  ) {
    merged.defaultValue = value;
  }
  if (kind === 'object') {
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .forEach(key => {
        merged.fields[key] = mergeSerializedValueShape(
          merged.fields[key],
          value[key],
          isDefaultValue
        );
      });
  } else if (kind === 'array') {
    value.forEach(item => {
      merged.item = mergeSerializedValueShape(
        merged.item,
        item,
        isDefaultValue
      );
    });
    if (isDefaultValue && value.length === 0) merged.defaultEmpty = true;
  }
  return merged;
};

const isInlineObjectConfigurationField = (name: string): boolean =>
  ['originPoint', 'centerPoint', 'points', 'customCollisionMask'].includes(
    name
  );

const shapeType = (
  shape: ?SerializedValueShape,
  fieldName: string = ''
): string => {
  if (!shape) return 'value determined by the object serializer';
  const types = shape.kinds.map(kind => {
    if (kind === 'array') {
      if (!shape.item) return 'array';
      const itemType = shapeType(shape.item);
      return isInlineObjectConfigurationField(fieldName)
        ? `${itemType} inline array`
        : `${itemType} array`;
    }
    if (kind === 'object') return 'inline object';
    if (kind === 'null')
      return 'unsupported null (not part of GDevelop Language (GDL))';
    return kind;
  });
  if (types.includes('number') && types.includes('integer')) {
    types.splice(types.indexOf('integer'), 1);
  }
  return types.join(' or ');
};

const shapeField = (name: string, shape: SerializedValueShape): Object => {
  const field: Object = settingsField(name, shapeType(shape, name));
  if (shape.defaultValue !== undefined) {
    field.defaultValue = shape.defaultValue;
  }
  if (shape.defaultEmpty) field.emptyValue = [];
  return field;
};

const buildSerializedObjectChildNode = (
  name: string,
  shape: SerializedValueShape,
  parentPath: string
): Object => {
  const path = parentPath ? `${parentPath}.${name}` : name;
  const repeated = shape.kinds.includes('array');
  const recordShape = repeated ? shape.item : shape;
  const fields = [];
  const childNodes = [];
  if (recordShape && recordShape.fields) {
    Object.keys(recordShape.fields)
      .sort((left, right) => left.localeCompare(right))
      .forEach(fieldName => {
        const fieldShape = recordShape.fields[fieldName];
        const isObject = fieldShape.kinds.includes('object');
        const isObjectArray =
          fieldShape.kinds.includes('array') &&
          fieldShape.item &&
          fieldShape.item.kinds.includes('object');
        if (isObject || isObjectArray) {
          childNodes.push(
            buildSerializedObjectChildNode(fieldName, fieldShape, path)
          );
        } else {
          fields.push(shapeField(fieldName, fieldShape));
        }
      });
  }
  const descriptor: Object = {
    serializedKey: path,
    ...(repeated ? { repeated: true } : {}),
    fields,
  };
  if (childNodes.length) descriptor.childNodes = childNodes;
  return descriptor;
};

const buildSerializedObjectConfigurationSchema = (
  configurations: Array<{| value: Object, isDefault: boolean |}>
): Object => {
  let rootShape: ?SerializedValueShape = null;
  configurations.forEach(({ value, isDefault }) => {
    rootShape = mergeSerializedValueShape(rootShape, value, isDefault);
  });
  const rootFields = [];
  const childNodes = [];
  const fields: { [string]: SerializedValueShape } = rootShape
    ? rootShape.fields
    : {};
  Object.keys(fields)
    .sort((left, right) => left.localeCompare(right))
    .forEach(name => {
      const shape = fields[name];
      const isObject = shape.kinds.includes('object');
      const isObjectArray =
        shape.kinds.includes('array') &&
        shape.item &&
        shape.item.kinds.includes('object');
      if (isObject || isObjectArray) {
        childNodes.push(buildSerializedObjectChildNode(name, shape, ''));
      } else {
        rootFields.push(shapeField(name, shape));
      }
    });
  return { rootFields, childNodes };
};

const collectSerializedPathsNamed = (
  shape: ?SerializedValueShape,
  searchedName: string,
  parentPath: string = ''
): Array<string> => {
  if (!shape || !shape.fields) return [];
  const paths = [];
  Object.keys(shape.fields).forEach(name => {
    const fieldShape = shape.fields[name];
    const path = parentPath ? `${parentPath}.${name}` : name;
    if (name === searchedName) paths.push(path);
    if (fieldShape.kinds.includes('object')) {
      paths.push(
        ...collectSerializedPathsNamed(fieldShape, searchedName, path)
      );
    }
    if (fieldShape.kinds.includes('array') && fieldShape.item) {
      paths.push(
        ...collectSerializedPathsNamed(
          fieldShape.item,
          searchedName,
          `${path}[]`
        )
      );
    }
  });
  return sortedUnique(paths);
};

// A few native object serializers have public repeated records whose default
// value is an empty array. Populate one record through their public APIs so
// the generated schema contains the record fields even when the project does
// not have an object of that type yet. Other object types are fully described
// by their default serializer and any same-type project objects collected
// above.
const safelyBuildPopulatedObjectConfiguration = (
  objectType: string
): ?Object => {
  const ownedValues: Array<any> = [];
  const own = (value: any): any => {
    ownedValues.push(value);
    return value;
  };
  let configuration;
  try {
    if (
      objectType === 'Scene3D::Model3DObject' &&
      gd.Model3DObjectConfiguration &&
      gd.Model3DAnimation
    ) {
      configuration = own(new gd.Model3DObjectConfiguration());
      configuration.setType(objectType);
      configuration.addSharedAnimationModelResource(
        '__gdevelop_catalog_model_resource__'
      );
      const animation = own(new gd.Model3DAnimation());
      animation.setName('__gdevelop_catalog_animation__');
      animation.setSource('Model');
      animation.setSourceModelResourceName(
        '__gdevelop_catalog_source_model_resource__'
      );
      animation.setShouldLoop(true);
      configuration.addAnimation(animation);
      return serializeToJSObject(configuration);
    }
    if (
      objectType === 'Spine::SpineObject' &&
      gd.SpineObjectConfiguration &&
      gd.SpineAnimation
    ) {
      configuration = own(new gd.SpineObjectConfiguration());
      configuration.setType(objectType);
      const animation = own(new gd.SpineAnimation());
      animation.setName('__gdevelop_catalog_animation__');
      animation.setSource('__gdevelop_catalog_animation_source__');
      animation.setShouldLoop(true);
      configuration.addAnimation(animation);
      return serializeToJSObject(configuration);
    }
    if (
      objectType === 'Sprite' &&
      gd.SpriteObject &&
      gd.Animation &&
      gd.Sprite
    ) {
      configuration = own(new gd.SpriteObject());
      configuration.setType(objectType);
      const animation = own(new gd.Animation());
      animation.setName('__gdevelop_catalog_animation__');
      animation.setDirectionsCount(1);
      const direction = animation.getDirection(0);
      direction.setMetadata('__gdevelop_catalog_direction_metadata__');
      const sprite = own(new gd.Sprite());
      sprite.setImageName('__gdevelop_catalog_image__');
      sprite.setCustomSourceRect(1, 2, 3, 4);
      const point = own(new gd.Point('__gdevelop_catalog_point__'));
      point.setXY(1, 2);
      sprite.addPoint(point);
      direction.addSprite(sprite);
      configuration.getAnimations().addAnimation(animation);
      return serializeToJSObject(configuration);
    }
  } catch (error) {
    console.warn(
      `[ProjectSourceCatalog] Unable to populate repeated serializer records for object ${objectType}; falling back to its default and project object schemas.`,
      error
    );
  } finally {
    ownedValues.reverse().forEach(value => value.delete());
  }
  return null;
};

const safelyReadObjectConfiguration = (
  platform: gdPlatform,
  objectType: string
): {|
  serializedConfiguration: Object,
  populatedConfiguration: ?Object,
  properties: Array<Object>,
|} => {
  let ownedConfiguration;
  try {
    ownedConfiguration = platform.createObjectConfiguration(objectType);
    const configuration = ownedConfiguration.get();
    const serializedConfiguration = serializeToJSObject(configuration);
    const properties = safelySummarizeMetadataProperties(
      () => configuration.getProperties(),
      undefined,
      `properties for object ${objectType}`
    );
    return {
      serializedConfiguration,
      populatedConfiguration: safelyBuildPopulatedObjectConfiguration(
        objectType
      ),
      properties,
    };
  } catch (error) {
    console.warn(
      `[ProjectSourceCatalog] Unable to inspect the default serializer for object ${objectType}; generating its catalog entry from project objects only.`,
      error
    );
    return {
      serializedConfiguration: {},
      populatedConfiguration: safelyBuildPopulatedObjectConfiguration(
        objectType
      ),
      properties: [],
    };
  } finally {
    if (ownedConfiguration) ownedConfiguration.delete();
  }
};

const collectRegisteredTypes = (
  project: gdProject,
  serializedProject: Object,
  additionalExtensions: Array<gdPlatformExtension> = []
): {|
  objectTypes: Array<Object>,
  behaviorTypes: Array<Object>,
  effectTypes: Array<Object>,
|} => {
  const objectTypes = [];
  const behaviorTypes = [];
  const effectTypes = [];
  const localExtensionNames = getProjectExtensionNames(serializedProject);
  const localBehaviorDefinitions = getProjectBehaviorDefinitions(
    serializedProject
  );
  const localObjectDefinitions = getProjectObjectDefinitions(serializedProject);
  const serializedObjectConfigurationsByType = collectSerializedObjectConfigurationsByType(
    serializedProject
  );
  const platform = project.getCurrentPlatform();
  const additionalExtensionNames = new Set(
    additionalExtensions.map(extension => extension.getName())
  );
  const extensions = [
    ...additionalExtensions,
    ...toArray(platform.getAllPlatformExtensions()).filter(
      extension => !additionalExtensionNames.has(extension.getName())
    ),
  ];

  extensions.forEach(extension => {
    if (shouldHideExtension(project, extension)) return;
    const extensionName = extension.getName();
    const canUsePrivateTypes = localExtensionNames.has(extensionName);

    toArray(extension.getExtensionObjectsTypes()).forEach(type => {
      const objectType = String(type || '');
      if (!objectType) return;
      const metadata = extension.getObjectMetadata(objectType);
      if (
        gd.MetadataProvider.isBadObjectMetadata(metadata) ||
        metadata.isHidden() ||
        (metadata.isPrivate() && !canUsePrivateTypes)
      ) {
        return;
      }
      const entry: Object = {
        type: objectType,
        name: metadata.getFullName() || metadata.getName(),
        description: metadata.getDescription(),
        extension: extensionName,
        renderedIn3D: metadata.isRenderedIn3D(),
      };
      const localObjectDefinition = localObjectDefinitions.get(objectType);
      const {
        serializedConfiguration,
        populatedConfiguration = null,
        properties,
      } = localObjectDefinition
        ? summarizeProjectObjectDefinition(localObjectDefinition)
        : safelyReadObjectConfiguration(platform, objectType);
      const configurations = [
        { value: serializedConfiguration, isDefault: true },
        ...(populatedConfiguration
          ? [{ value: populatedConfiguration, isDefault: false }]
          : []),
        ...(serializedObjectConfigurationsByType.get(objectType) || []).map(
          value => ({ value, isDefault: false })
        ),
      ];
      let configurationShape: ?SerializedValueShape = null;
      configurations.forEach(({ value, isDefault }) => {
        configurationShape = mergeSerializedValueShape(
          configurationShape,
          value,
          isDefault
        );
      });
      entry.properties = properties.map(property => {
        const serializedPaths = collectSerializedPathsNamed(
          configurationShape,
          property.authoringKey
        );
        if (serializedPaths.length === 1) {
          return { ...property, serializedPath: serializedPaths[0] };
        }
        if (serializedPaths.length > 1) {
          return { ...property, serializedPaths };
        }
        return property;
      });
      entry.schema = buildSerializedObjectConfigurationSchema(configurations);
      entry.keySpace = 'serialized paths';
      entry.unknownPropertyPolicy = 'error';
      const defaultBehaviors = toArray(metadata.getDefaultBehaviors());
      if (defaultBehaviors.length) {
        entry.defaultBehaviorTypes = sortedUnique(defaultBehaviors);
      }
      objectTypes.push(entry);
    });

    toArray(extension.getBehaviorsTypes()).forEach(type => {
      const behaviorType = String(type || '');
      if (!behaviorType) return;
      const metadata = extension.getBehaviorMetadata(behaviorType);
      if (
        gd.MetadataProvider.isBadBehaviorMetadata(metadata) ||
        metadata.isHidden() ||
        (metadata.isPrivate() && !canUsePrivateTypes)
      ) {
        return;
      }
      const entry: Object = {
        type: behaviorType,
        name: metadata.getFullName() || metadata.getName(),
        description: metadata.getDescription(),
        extension: extensionName,
        defaultName: metadata.getDefaultName(),
        properties: [],
        sharedProperties: [],
      };
      const localBehaviorDefinition = localBehaviorDefinitions.get(
        behaviorType
      );
      if (localBehaviorDefinition) {
        entry.properties = summarizeSerializedProperties(
          localBehaviorDefinition.propertyDescriptors
        );
        entry.sharedProperties = summarizeSerializedProperties(
          localBehaviorDefinition.sharedPropertyDescriptors
        );
      } else {
        entry.properties = safelySummarizeMetadataProperties(
          () => metadata.getProperties(),
          metadata.get(),
          `properties for behavior ${behaviorType}`
        );
        entry.sharedProperties = safelySummarizeMetadataProperties(
          () => metadata.getSharedProperties(),
          metadata.getSharedDataInstance(),
          `shared properties for behavior ${behaviorType}`
        );
      }
      entry.serializedDefaults = readInitializedSerializedDefaults(
        metadata.get()
      );
      entry.sharedSerializedDefaults = readInitializedSerializedDefaults(
        metadata.getSharedDataInstance()
      );
      entry.sharedSerializedProperties =
        LEGACY_SHARED_SERIALIZED_PROPERTIES[behaviorType] || [];
      if (!localBehaviorDefinition) {
        const byKey: Map<string, Object> = new Map();
        Object.entries(entry.serializedDefaults).forEach(
          ([serializedKey, value]) => {
            byKey.set(serializedKey, {
              serializedKey,
              type: Array.isArray(value) ? 'array' : typeof value,
            });
          }
        );
        const descriptors = metadata.getProperties();
        toArray(descriptors.keys()).forEach(key => {
          const authoringKey = String(key);
          const property = descriptors.get(key);
          const publicMapping = entry.properties.find(
            p => p.authoringKey === authoringKey
          );
          const mapping =
            publicMapping && publicMapping.serializedKey
              ? publicMapping
              : byKey.has(authoringKey)
              ? { serializedKey: authoringKey }
              : inferSerializedPropertyKey({
                  instance: metadata.get(),
                  authoringKey,
                  property,
                });
          // Deprecated/hidden editor keys are not serializer keys. Keep only
          // proven mappings; default serializer fields are already registered.
          if (!mapping.serializedKey) return;
          const serializedKey = mapping.serializedKey;
          if (!byKey.has(serializedKey))
            byKey.set(serializedKey, {
              serializedKey,
              type:
                property.getType() === 'Bitmask'
                  ? 'integer'
                  : property.getType(),
            });
        });
        entry.serializedProperties = Array.from(byKey.values());
      } else {
        entry.serializedProperties = (
          localBehaviorDefinition.propertyDescriptors || []
        ).map(p => ({ serializedKey: p.name, type: p.type }));
      }
      entry.keySpace = 'serialized';
      entry.unknownPropertyPolicy = 'error';
      const objectType = metadata.getObjectType();
      if (objectType) entry.objectType = objectType;
      const requiredBehaviorTypes = localBehaviorDefinition
        ? getSerializedRequiredBehaviorTypes(localBehaviorDefinition)
        : safelyReadRequiredBehaviorTypes(metadata, behaviorType);
      if (requiredBehaviorTypes.length) {
        entry.requiredBehaviorTypes = sortedUnique(requiredBehaviorTypes);
      }
      behaviorTypes.push(entry);
    });

    toArray(extension.getExtensionEffectTypes()).forEach(type => {
      const effectType = String(type || '');
      if (!effectType) return;
      const metadata = extension.getEffectMetadata(effectType);
      if (gd.MetadataProvider.isBadEffectMetadata(metadata)) return;
      effectTypes.push({
        type: effectType,
        name: metadata.getFullName() || metadata.getType(),
        description: metadata.getDescription(),
        extension: extensionName,
        worksForObjects: !metadata.isMarkedAsNotWorkingForObjects(),
        dimensions: metadata.isMarkedAsOnlyWorkingFor2D()
          ? ['2d']
          : metadata.isMarkedAsOnlyWorkingFor3D()
          ? ['3d']
          : ['2d', '3d'],
        unique: metadata.isMarkedAsUnique(),
        // Editor visibility does not determine which parameters the serializer
        // and runtime support. Keep hidden/deprecated parameters in this schema.
        serializedParameters: (() => {
          const properties = metadata.getProperties();
          return toArray(properties.keys()).map(name => ({
            name: String(name),
            type: String(properties.get(name).getType()),
          }));
        })(),
        parameters: safelySummarizeMetadataProperties(
          () => metadata.getProperties(),
          undefined,
          `parameters for effect ${effectType}`
        ),
      });
    });
  });

  const uniqueByType = (entries: Array<Object>): Array<Object> =>
    Array.from(
      entries
        .reduce((byType: Map<string, Object>, entry: Object) => {
          if (!byType.has(entry.type)) byType.set(entry.type, entry);
          return byType;
        }, new Map())
        .values()
    );
  const byType = (left: Object, right: Object) =>
    String(left.type).localeCompare(right.type);
  return {
    objectTypes: uniqueByType(objectTypes).sort(byType),
    behaviorTypes: uniqueByType(behaviorTypes).sort(byType),
    effectTypes: uniqueByType(effectTypes).sort(byType),
  };
};

setSettingsTypeProvider(() => {
  const project = gd.ProjectHelper.createNewGDJSProject();
  try {
    return collectRegisteredTypes(project, serializeToJSObject(project), []);
  } finally {
    project.delete();
  }
});

const settingsField = (
  name: string,
  type: string,
  options: Object = {}
): Object => ({
  name,
  type,
  ...options,
});

const SETTINGS_FILE_KINDS = [
  {
    kind: 'project',
    path: MULTI_FILE_ENTRY_NAME,
    componentKind: 'project',
    schemaKey: 'project',
    layout: false,
  },
  {
    kind: 'global-object',
    path: 'objects/<Object>.gdl',
    componentKind: 'object',
    schemaKey: 'object',
    layout: false,
  },
  {
    kind: 'resources',
    path: 'resources.gdl',
    componentKind: 'resources',
    schemaKey: 'resources',
    layout: false,
  },
  {
    kind: 'tests',
    path: 'tests.gdl',
    componentKind: 'tests',
    schemaKey: 'tests',
    layout: false,
  },
  {
    kind: 'scene',
    path: 'scenes/<Scene>/scene.gdl',
    componentKind: 'scene',
    schemaKey: 'scene',
    layout: true,
  },
  {
    kind: 'scene-lifecycle-function',
    path: 'scenes/<Scene>/functions/<Role>.gdl',
    componentKind: 'function',
    schemaKey: 'sceneLifecycleFunction',
    layout: false,
  },
  {
    kind: 'external-events',
    path: 'scenes/<Scene>/external-events/<Fragment>.gdl',
    componentKind: 'externalEvents',
    schemaKey: 'externalEvents',
    layout: false,
  },
  {
    kind: 'external-layout',
    path: 'scenes/<Scene>/external-layout/<ExternalLayout>.gdl',
    componentKind: 'externalLayout',
    schemaKey: 'externalLayout',
    layout: true,
  },
  {
    kind: 'scene-object',
    path: 'scenes/<Scene>/objects/<Object>.gdl',
    componentKind: 'object',
    schemaKey: 'object',
    layout: false,
  },
  {
    kind: 'extension',
    path: 'extensions/<Extension>/extension.gdl',
    componentKind: 'extension',
    schemaKey: 'extension',
    layout: false,
  },
  {
    kind: 'function',
    path: 'extensions/<Extension>/functions/<Function>.gdl',
    componentKind: 'function',
    schemaKey: 'extensionFunction',
    layout: false,
  },
  {
    kind: 'prefab',
    path: 'extensions/<Extension>/prefabs/<Prefab>/prefab.gdl',
    componentKind: 'prefab',
    schemaKey: 'prefab',
    layout: true,
  },
  {
    kind: 'prefab-variant',
    path:
      'extensions/<Extension>/prefabs/<Prefab>/variants/<Variant>/variant.gdl',
    componentKind: 'prefabVariant',
    schemaKey: 'prefabVariant',
    layout: true,
  },
  {
    kind: 'prefab-object',
    path:
      'extensions/<Extension>/prefabs/<Prefab>/{objects|variants/<Variant>/objects}/<Object>.gdl',
    componentKind: 'object',
    schemaKey: 'object',
    layout: false,
  },
  {
    kind: 'prefab-function',
    path: 'extensions/<Extension>/prefabs/<Prefab>/functions/<Function>.gdl',
    componentKind: 'function',
    schemaKey: 'prefabFunction',
    layout: false,
  },
  {
    kind: 'behavior',
    path: 'extensions/<Extension>/behaviors/<Behavior>/behavior.gdl',
    componentKind: 'behavior',
    schemaKey: 'behavior',
    layout: false,
  },
  {
    kind: 'behavior-function',
    path:
      'extensions/<Extension>/behaviors/<Behavior>/functions/<Function>.gdl',
    componentKind: 'function',
    schemaKey: 'behaviorFunction',
    layout: false,
  },
];

const summarizeObjectDefinition = (object: Object): Object => ({
  name: String(object.name || ''),
  type: String(object.type || ''),
  behaviors: (object.behaviors || []).map(behavior => ({
    name: String(behavior.name || ''),
    type: String(behavior.type || ''),
  })),
});

const buildSettingsOwners = (serializedProject: Object): Array<Object> => {
  const owners: Array<Object> = [
    {
      kind: 'project',
      name: String(
        (serializedProject.properties && serializedProject.properties.name) ||
          ''
      ),
      objects: (serializedProject.objects || []).map(summarizeObjectDefinition),
    },
  ];
  (serializedProject.layouts || []).forEach(scene => {
    const sceneName = String(scene.name || '');
    const sceneFolder = encodeManagedName(sceneName);
    owners.push({
      kind: 'scene',
      name: sceneName,
      objects: (scene.objects || []).map(summarizeObjectDefinition),
      lifecycleFunctions: SCENE_LIFECYCLE_SOURCES.map(source => ({
        name: source.name,
        lifecycleRole: source.name,
        order: source.order,
        materialized:
          source.name === 'sceneUpdate' ||
          !!(scene[source.legacyField] || []).length,
        settingsUri: `game://scenes/${sceneFolder}/functions/${
          source.name
        }.gdl`,
      })),
    });
  });
  (serializedProject.externalEvents || []).forEach(externalEvents => {
    const sceneName = String(externalEvents.associatedLayout || '');
    const name = String(externalEvents.name || '');
    const ownerBaseUri = `game://scenes/${encodeManagedName(
      sceneName
    )}/external-events/${encodeManagedName(`${name}.gdl`)}`;
    owners.push({
      kind: 'external-events',
      scene: sceneName,
      name,
      settingsUri: ownerBaseUri,
    });
  });
  (serializedProject.externalLayouts || []).forEach(externalLayout => {
    const sceneName = String(externalLayout.associatedLayout || '');
    const name = String(externalLayout.name || '');
    owners.push({
      kind: 'external-layout',
      scene: sceneName,
      name,
      settingsUri: `game://scenes/${encodeManagedName(
        sceneName
      )}/external-layout/${encodeManagedName(name)}.gdl`,
    });
  });
  (serializedProject.eventsFunctionsExtensions || []).forEach(extension => {
    const extensionName = String(extension.name || '');
    owners.push({
      kind: 'extension',
      name: extensionName,
      functions: (extension.eventsFunctions || []).map(item =>
        String(item.name || '')
      ),
      prefabs: (extension.eventsBasedObjects || []).map(item =>
        String(item.name || '')
      ),
      behaviors: (extension.eventsBasedBehaviors || []).map(item =>
        String(item.name || '')
      ),
    });
    (extension.eventsBasedObjects || []).forEach(prefab => {
      owners.push({
        kind: 'prefab',
        extension: extensionName,
        name: String(prefab.name || ''),
        objects: (prefab.objects || []).map(summarizeObjectDefinition),
        functions: (prefab.eventsFunctions || []).map(item =>
          String(item.name || '')
        ),
        variants: (prefab.variants || []).map(item => String(item.name || '')),
      });
      (prefab.variants || []).forEach(variant => {
        const variantName = String(variant.name || '');
        owners.push({
          kind: 'prefab-variant',
          extension: extensionName,
          prefab: String(prefab.name || ''),
          name: variantName,
          settingsUri: `game://extensions/${encodeManagedName(
            extensionName
          )}/prefabs/${encodeManagedName(
            String(prefab.name || '')
          )}/variants/${encodeManagedName(variantName)}/variant.gdl`,
          objects: (variant.objects || []).map(summarizeObjectDefinition),
        });
      });
    });
    (extension.eventsBasedBehaviors || []).forEach(behavior => {
      owners.push({
        kind: 'behavior',
        extension: extensionName,
        name: String(behavior.name || ''),
        functions: (behavior.eventsFunctions || []).map(item =>
          String(item.name || '')
        ),
      });
    });
  });
  return owners;
};

const projectIdentity = (project: gdProject): Object => ({
  name: project.getName(),
  uuid: project.getProjectUuid(),
});

export const buildProjectGdlCatalog = ({
  project,
  serializedProject,
  additionalExtensions = [],
}: {|
  project: gdProject,
  serializedProject: Object,
  additionalExtensions?: Array<gdPlatformExtension>,
|}): Object => {
  const registeredTypes = collectRegisteredTypes(
    project,
    serializedProject,
    additionalExtensions
  );
  const settingsOwners = buildSettingsOwners(serializedProject);
  const embeddedLayoutCatalog = buildEmbeddedLayoutCatalog({
    serializedProject,
    behaviorTypes: registeredTypes.behaviorTypes,
  });
  registerSettingsTypes(registeredTypes);
  registeredTypes.objectTypes.forEach(type => {
    type.schema = getObjectSettingsSchema(type.type);
  });
  return validateProjectGdlCatalog({
    format: 'gdevelop-gdl-catalog',
    formatVersion: PROJECT_GDL_CATALOG_FORMAT_VERSION,
    project: projectIdentity(project),
    authoring: {
      sourceExtension: '.gdl',
      syntax:
        'GDevelop Language (GDL): key = value and node { ... }. Only the current schema is supported.',
      rules: [
        'Use one typed component root. Names and properties belong inside the root; never use TOML headers, named node arguments, kind, settingsFormatVersion, settings or layout wrappers.',
        'Read fileKinds[].schema and objectTypes[type].schema. Unknown fields are errors. Dynamic fields require registered type metadata.',
        'Declare repeated variable nodes directly on the owner. Infer types from value literals; extension defaults require scope. Descendant identity, enum and editor fields belong on nested variable declarations. Expanded containers require explicit structure/array type, omit value, and use named structure children or unnamed ordered array children. metadata/path annotations are forbidden. Never write variables, sceneVariables or globalVariables wrappers.',
        'Instances are root children in global serialized order. Each instance owns variables and behavior overrides. Layers own camera and effect nodes.',
        'Object definitions and functions remain independent .gdl components; event bodies are embedded in the same function.gdl document.',
        'Only project.gdl declares formatVersion. Paths determine ownership. constants.toml is separate and generated JSON is not author input.',
      ],
    },
    eventFileKinds: [
      {
        kind: 'external-events',
        path: 'scenes/<Scene>/external-events/<Name>.gdl',
        syntax: 'GDevelop Language (GDL)',
        settingsRequired: true,
        settingsPath: 'scenes/<Scene>/external-events/<Name>.gdl',
        identity:
          'Scene from parent path; name from matching settings and filename stem.',
        execution:
          'Expanded at each Link with caller conditions, object selection and lifecycle context.',
      },
    ],
    fileKinds: SETTINGS_FILE_KINDS.map(entry => {
      const roots = getSettingsSchemas();
      const schema = getComponentSettingsSchema(
        entry.componentKind,
        entry.schemaKey
      );
      return {
        kind: entry.kind,
        path: entry.path,
        root: roots.roots[entry.componentKind],
        requiredFields: Object.keys(schema.fields).filter(
          name => schema.fields[name].required
        ),
        schema: {
          rootFields: Object.entries(schema.fields).map(([name, value]) => ({
            ...value,
            name,
          })),
          childNodes: schema.children,
        },
      };
    }),
    settingsOwners,
    variableSchemas: getSettingsSchemas().variableSchemas,
    eventSchemas: getSettingsSchemas().eventSchemas,
    objectTypes: registeredTypes.objectTypes,
    behaviorTypes: registeredTypes.behaviorTypes,
    effectTypes: registeredTypes.effectTypes,
    layoutAuthoring: embeddedLayoutCatalog.authoring,
    layoutNodes: embeddedLayoutCatalog.nodes,
    layoutContexts: embeddedLayoutCatalog.contexts,
    behaviorOverrideSchemas: embeddedLayoutCatalog.behaviorOverrideSchemas,
    counts: {
      fileKinds: SETTINGS_FILE_KINDS.length,
      settingsOwners: settingsOwners.length,
      objectTypes: registeredTypes.objectTypes.length,
      behaviorTypes: registeredTypes.behaviorTypes.length,
      effectTypes: registeredTypes.effectTypes.length,
      layoutNodes: embeddedLayoutCatalog.nodes.length,
      layoutContexts: embeddedLayoutCatalog.contexts.length,
      behaviorOverrideSchemas:
        embeddedLayoutCatalog.behaviorOverrideSchemas.length,
    },
  });
};

const mergeObjects = (
  localObjects: Array<Object>,
  fallbackObjects: Array<Object>
): Array<Object> => {
  const byName: Map<string, Object> = new Map();
  fallbackObjects.forEach(object =>
    byName.set(String(object.name || ''), object)
  );
  localObjects.forEach(object => byName.set(String(object.name || ''), object));
  return Array.from(byName.values());
};

const collectInstancePropertyTypes = (
  instances: Array<Object>,
  objectName: string
): Array<Object> => {
  const types: Map<string, string> = new Map();
  instances
    .filter(instance => String(instance.name || '') === objectName)
    .forEach(instance => {
      (instance.numberProperties || []).forEach(property =>
        types.set(String(property.name || ''), 'number')
      );
      (instance.stringProperties || []).forEach(property =>
        types.set(String(property.name || ''), 'string')
      );
    });
  return Array.from(types, ([name, type]) => ({ name, type })).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
};

const summarizeLayoutObject = (
  object: Object,
  instances: Array<Object>
): Object => {
  const entry: Object = summarizeObjectDefinition(object);
  const instanceProperties = collectInstancePropertyTypes(
    instances,
    entry.name
  );
  if (instanceProperties.length) entry.instanceProperties = instanceProperties;
  return entry;
};

const layoutContext = ({
  kind,
  owner,
  objects,
  instances,
  layerNames,
}: {
  kind: string,
  owner: Object,
  objects: Array<Object>,
  instances: Array<Object>,
  layerNames: Array<string>,
}): Object => ({
  kind,
  owner,
  layers: layerNames,
  objects: objects.map(object => summarizeLayoutObject(object, instances)),
});

const buildLayoutContexts = (serializedProject: Object): Array<Object> => {
  const contexts = [];
  const globalObjects = serializedProject.objects || [];
  (serializedProject.layouts || []).forEach(scene => {
    contexts.push(
      layoutContext({
        kind: 'scene',
        owner: {
          scene: String(scene.name || ''),
          settingsUri: `game://scenes/${encodeManagedName(
            String(scene.name || '')
          )}/scene.gdl`,
        },
        objects: mergeObjects(scene.objects || [], globalObjects),
        instances: scene.instances || [],
        layerNames: (scene.layers || []).map(layer => String(layer.name || '')),
      })
    );
  });
  (serializedProject.eventsFunctionsExtensions || []).forEach(extension => {
    const extensionName = String(extension.name || '');
    (extension.eventsBasedObjects || []).forEach(prefab => {
      const prefabName = String(prefab.name || '');
      contexts.push(
        layoutContext({
          kind: 'prefab',
          owner: {
            extension: extensionName,
            prefab: prefabName,
            settingsUri: `game://extensions/${encodeManagedName(
              extensionName
            )}/prefabs/${encodeManagedName(prefabName)}/prefab.gdl`,
          },
          objects: prefab.objects || [],
          instances: prefab.instances || [],
          layerNames: (prefab.layers || []).map(layer =>
            String(layer.name || '')
          ),
        })
      );
      (prefab.variants || []).forEach(variant => {
        const variantObjects =
          variant.objects !== undefined
            ? variant.objects
            : prefab.objects || [];
        contexts.push(
          layoutContext({
            kind: 'prefab-variant',
            owner: {
              extension: extensionName,
              prefab: prefabName,
              variant: String(variant.name || ''),
              settingsUri: `game://extensions/${encodeManagedName(
                extensionName
              )}/prefabs/${encodeManagedName(
                prefabName
              )}/variants/${encodeManagedName(
                String(variant.name || '')
              )}/variant.gdl`,
            },
            objects: variantObjects,
            instances: variant.instances || [],
            layerNames: (variant.layers || []).map(layer =>
              String(layer.name || '')
            ),
          })
        );
      });
    });
  });
  (serializedProject.externalLayouts || []).forEach(external => {
    const linkedSceneName = String(external.associatedLayout || '');
    const linkedScene = (serializedProject.layouts || []).find(
      scene => String(scene.name || '') === linkedSceneName
    );
    contexts.push(
      layoutContext({
        kind: 'external',
        owner: {
          external: String(external.name || ''),
          linkedScene: linkedSceneName,
          settingsUri: `game://scenes/${encodeManagedName(
            linkedSceneName
          )}/external-layout/${encodeManagedName(
            String(external.name || '')
          )}.gdl`,
        },
        objects: linkedScene
          ? mergeObjects(linkedScene.objects || [], globalObjects)
          : globalObjects,
        instances: external.instances || [],
        layerNames: linkedScene
          ? (linkedScene.layers || []).map(layer => String(layer.name || ''))
          : [],
      })
    );
  });
  return contexts;
};

const buildEmbeddedLayoutCatalog = ({
  serializedProject,
  behaviorTypes,
}: {|
  serializedProject: Object,
  behaviorTypes: Array<Object>,
|}): Object => {
  const behaviorOverrideSchemas = behaviorTypes.map(behavior => ({
    behaviorType: behavior.type,
    keySpace: 'serialized',
    unknownPropertyPolicy: behavior.unknownPropertyPolicy || 'preserve',
    properties: (behavior.properties || [])
      .filter(property => property.serializedKey)
      .map(property => ({
        authoringKey: property.authoringKey || property.name,
        serializedKey: property.serializedKey,
        type: property.type,
      })),
  }));
  const contexts = buildLayoutContexts(serializedProject);
  return {
    authoring: {
      sourceExtension: '.gdl',
      storage: 'component-root',
      syntax: 'GDevelop Language (GDL)',
      rules: [
        'Place layer and instance directly below scene/prefab/variant/external. Nest camera/effect below layer, variable/behavior below instance. Preserve instance order and UUIDs.',
      ],
    },
    nodes: Object.entries(getSettingsSchemas().layout).map(
      ([node, schema]) => ({
        node,
        ...schema,
      })
    ),
    contexts,
    behaviorOverrideSchemas,
  };
};

export const buildBehaviorPropertySchemasByType = (
  catalogOrBehaviorTypes: Object | Array<Object>
): Object => {
  const behaviorTypes = Array.isArray(catalogOrBehaviorTypes)
    ? catalogOrBehaviorTypes
    : (catalogOrBehaviorTypes && catalogOrBehaviorTypes.behaviorTypes) || [];
  const schemas: { [string]: Object } = {};
  behaviorTypes.forEach(behavior => {
    schemas[String(behavior.type || '')] = {
      keySpace: 'serialized',
      unknownPropertyPolicy: 'error',
      properties: (behavior.serializedProperties || behavior.properties || [])
        .filter(property => property.serializedKey)
        .map(property => ({
          authoringKey: String(property.authoringKey || property.name || ''),
          serializedKey: String(property.serializedKey || ''),
          type: String(property.type || ''),
        })),
    };
  });
  return schemas;
};

const validateBaseCatalog = (
  catalog: any,
  format: string,
  requiredArrays: Array<string>
): Object => {
  if (
    !catalog ||
    typeof catalog !== 'object' ||
    catalog.format !== format ||
    catalog.formatVersion !== PROJECT_GDL_CATALOG_FORMAT_VERSION ||
    !catalog.project ||
    typeof catalog.project !== 'object' ||
    !catalog.authoring ||
    typeof catalog.authoring !== 'object' ||
    requiredArrays.some(name => !Array.isArray(catalog[name]))
  ) {
    fail(`Unsupported ${format} format.`);
  }
  return catalog;
};

const validateUniqueEntries = (
  entries: Array<Object>,
  getKey: Object => string,
  label: string
) => {
  const keys: Set<string> = new Set();
  entries.forEach(entry => {
    if (!entry || typeof entry !== 'object') fail(`Invalid ${label} entry.`);
    const key = getKey(entry);
    if (!key) fail(`${label} entry has no identity.`);
    if (keys.has(key)) fail(`Duplicate ${label} entry ${key}.`);
    keys.add(key);
  });
};

export const validateProjectGdlCatalog = (catalog: any): Object => {
  const validated = validateBaseCatalog(catalog, 'gdevelop-gdl-catalog', [
    'fileKinds',
    'eventFileKinds',
    'settingsOwners',
    'objectTypes',
    'behaviorTypes',
    'effectTypes',
    'layoutNodes',
    'layoutContexts',
    'behaviorOverrideSchemas',
  ]);
  validateUniqueEntries(validated.fileKinds, entry => entry.kind, 'file kind');
  validated.fileKinds.forEach(fileKind => {
    const expectedFileKind: any = SETTINGS_FILE_KINDS.find(
      entry => entry.kind === fileKind.kind
    );
    if (!expectedFileKind) fail(`Unknown file kind ${fileKind.kind}.`);
    if (
      !fileKind.root ||
      !fileKind.schema ||
      !Array.isArray(fileKind.schema.rootFields) ||
      !fileKind.schema.childNodes
    )
      fail(`File kind ${fileKind.kind} requires a DSL root and node schema.`);
  });
  validateUniqueEntries(
    validated.objectTypes,
    entry => entry.type,
    'object type'
  );
  validated.objectTypes.forEach(objectType => {
    const hasConfigurationContract =
      objectType.properties !== undefined ||
      objectType.schema !== undefined ||
      objectType.keySpace !== undefined ||
      objectType.unknownPropertyPolicy !== undefined;
    if (!hasConfigurationContract) return;
    if (
      objectType.keySpace !== 'serialized paths' ||
      objectType.unknownPropertyPolicy !== 'error' ||
      !Array.isArray(objectType.properties) ||
      !objectType.schema
    ) {
      fail(
        `Object type ${objectType.type} has an invalid configuration contract.`
      );
    }
    if (!objectType.schema.fields || !objectType.schema.children)
      fail(
        `Object type ${
          objectType.type
        } requires a GDevelop Language (GDL) node schema.`
      );
  });
  validateUniqueEntries(
    validated.behaviorTypes,
    entry => entry.type,
    'behavior type'
  );
  validated.behaviorTypes.forEach(behavior => {
    if (
      behavior.keySpace !== 'serialized' ||
      !['error', 'preserve'].includes(behavior.unknownPropertyPolicy) ||
      !Array.isArray(behavior.properties) ||
      !Array.isArray(behavior.sharedProperties)
    ) {
      fail(`Behavior type ${behavior.type} has an invalid property contract.`);
    }
    ['properties', 'sharedProperties'].forEach(propertyListName => {
      const serializedKeys: Set<string> = new Set();
      behavior[propertyListName].forEach(property => {
        if (
          !property ||
          !String(property.authoringKey || '') ||
          !String(property.type || '')
        ) {
          fail(
            `Behavior type ${
              behavior.type
            } has a ${propertyListName} entry without an authoring key or type.`
          );
        }
        if (!property.serializedKey) {
          if (
            !property.serialization ||
            property.serialization.status !== 'unsupported' ||
            !String(property.serialization.reason || '')
          ) {
            fail(
              `Behavior property ${behavior.type}.${
                property.authoringKey
              } has no serialized key or explicit unsupported mapping.`
            );
          }
          return;
        }
        if (serializedKeys.has(property.serializedKey)) {
          fail(
            `Behavior type ${
              behavior.type
            } has duplicate serialized property key ${property.serializedKey}.`
          );
        }
        serializedKeys.add(property.serializedKey);
      });
    });
  });
  validateUniqueEntries(
    validated.effectTypes,
    entry => entry.type,
    'effect type'
  );
  validated.effectTypes.forEach(effect => {
    if (!Array.isArray(effect.serializedParameters)) {
      fail(`Effect ${effect.type} must declare serializedParameters.`);
    }
    validateUniqueEntries(
      effect.serializedParameters,
      parameter => parameter.name,
      `serialized parameter for effect ${effect.type}`
    );
    effect.serializedParameters.forEach(parameter => {
      if (
        !parameter ||
        typeof parameter.name !== 'string' ||
        !parameter.name ||
        typeof parameter.type !== 'string' ||
        !parameter.type
      ) {
        fail(`Invalid serialized effect parameter for ${effect.type}.`);
      }
    });
  });
  if (
    !validated.layoutAuthoring ||
    typeof validated.layoutAuthoring !== 'object' ||
    validated.layoutAuthoring.storage !== 'component-root' ||
    validated.layoutAuthoring.syntax !== 'GDevelop Language (GDL)'
  ) {
    fail('GDL catalog must declare embedded layout authoring metadata.');
  }
  validateUniqueEntries(
    validated.layoutNodes,
    entry => {
      if (typeof entry.node !== 'string' || !entry.node.trim())
        fail('Layout node entry has no identity.');
      return `${entry.node}\u0000${entry.variant || ''}`;
    },
    'layout node'
  );
  validated.layoutContexts.forEach(context => {
    if (
      !context ||
      !['scene', 'prefab', 'prefab-variant', 'external'].includes(
        context.kind
      ) ||
      !context.owner ||
      !Array.isArray(context.layers) ||
      !Array.isArray(context.objects)
    ) {
      fail('Invalid layout context entry.');
    }
  });
  validateUniqueEntries(
    validated.behaviorOverrideSchemas,
    entry => entry.behaviorType,
    'behavior override schema'
  );
  validated.behaviorOverrideSchemas.forEach(schema => {
    if (
      schema.keySpace !== 'serialized' ||
      !['error', 'preserve'].includes(schema.unknownPropertyPolicy) ||
      !Array.isArray(schema.properties)
    ) {
      fail(
        `Behavior override schema ${
          schema.behaviorType
        } has an invalid key-space contract.`
      );
    }
    validateUniqueEntries(
      schema.properties,
      property => property.serializedKey,
      `serialized property for ${schema.behaviorType}`
    );
    schema.properties.forEach(property => {
      if (!property.authoringKey || !property.type) {
        fail(
          `Behavior override property ${schema.behaviorType}.${
            property.serializedKey
          } has no authoring key or type.`
        );
      }
    });
  });
  return validated;
};

const serializeCatalog = (
  catalog: Object,
  orderedArrayNames: Array<string>
): string => {
  const arrays: { [string]: Array<Object> } = {};
  orderedArrayNames.forEach(name => {
    arrays[name] = catalog[name];
  });
  const metadata = { ...catalog };
  orderedArrayNames.forEach(name => delete metadata[name]);
  const lines = ['{'];
  Object.keys(metadata).forEach(key => {
    lines.push(`${JSON.stringify(key)}:${JSON.stringify(metadata[key])},`);
  });
  orderedArrayNames.forEach((name, arrayIndex) => {
    lines.push(`${JSON.stringify(name)}:[`);
    arrays[name].forEach((entry, entryIndex) => {
      lines.push(
        `${JSON.stringify(entry)}${
          entryIndex === arrays[name].length - 1 ? '' : ','
        }`
      );
    });
    lines.push(arrayIndex === orderedArrayNames.length - 1 ? ']' : '],');
  });
  lines.push('}', '');
  return lines.join('\n');
};

export const serializeProjectGdlCatalog = (catalog: Object): string =>
  serializeCatalog(validateProjectGdlCatalog(catalog), [
    'fileKinds',
    'eventFileKinds',
    'settingsOwners',
    'objectTypes',
    'behaviorTypes',
    'effectTypes',
    'layoutNodes',
    'layoutContexts',
    'behaviorOverrideSchemas',
  ]);
