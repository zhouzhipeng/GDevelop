// @noflow
// Shared authoring field inventory. SettingsDsl converts these descriptors to
// strict node schemas; catalogs publish the same schemas used by the parser.
export const SETTINGS_FORMAT_VERSION = 11;
const MULTI_FILE_FORMAT_VERSION = SETTINGS_FORMAT_VERSION;
const MULTI_FILE_ENTRY_URI = 'game://project.gdevelop';
const SCENE_LIFECYCLE_SOURCES = [
  'sceneLoad',
  'sceneSignal',
  'sceneUpdate',
  'sceneUnload',
].map(name => ({ name }));
const settingsField = (
  name: string,
  type: string,
  options: Object = {}
): Object => ({
  name,
  type,
  ...options,
});

const formatFields = ({
  kind,
  ordered = false,
  folder = false,
  name = false,
}: Object): Array<Object> => [
  ...(ordered
    ? [
        settingsField('order', 'contiguous zero-based integer', {
          required: true,
        }),
      ]
    : []),
  ...(folder
    ? [
        settingsField('folder', 'ordered string array', {
          required: true,
          emptyValue: [],
        }),
      ]
    : []),
  ...(name ? [settingsField('name', 'string', { required: true })] : []),
];

const variableRecordFields = [
  settingsField('name', 'non-empty string', { required: true }),
  settingsField('value', 'variable literal', {
    requiredUnless: 'explicit structure/array type with child declarations',
  }),
  settingsField('type', 'enum', {
    values: ['string', 'number', 'boolean', 'structure', 'array', 'enum'],
  }),
  settingsField('values', 'unique string array'),
  settingsField('folded', 'boolean'),
  settingsField('id', 'empty string or lowercase UUIDv4 string'),
  settingsField('hasMixedValues', 'boolean'),
];
const variableTable = (name: string): Object => ({
  table: name,
  variableCollection: true,
  repeated: true,
  fields: variableRecordFields,
  additionalFields:
    'Direct variable nodes with literal values or explicit structure/array type and nested variable declarations. Array children have no names; structure children require unique names. Never mix value with children; metadata nodes are forbidden.',
});

const objectGroupsTable = (prefix: string = ''): Object => ({
  table: `${prefix}objectGroups`,
  header: `[${prefix}objectGroups]`,
  optional: true,
  emptyForm: prefix
    ? `objectGroups = { } inside [[${prefix.slice(0, -1)}]]`
    : 'objectGroups = { }',
  dynamicFields: {
    key: 'unique object-group name',
    value: 'ordered string array of existing object names',
  },
});

const objectGroupRequiredBehaviorsTable = (prefix: string = ''): Object => ({
  table: `${prefix}objectGroupRequiredBehaviors`,
  header: `[${prefix}objectGroupRequiredBehaviors]`,
  optional: true,
  dynamicFields: {
    key: `object-group name also present in ${prefix}objectGroups`,
    value: 'ordered string array of registered behavior types',
  },
});

const quickCustomizationTable = (prefix: string): Object => ({
  table: `${prefix}.propertiesQuickCustomizationVisibilities`,
  header: `[${prefix}.propertiesQuickCustomizationVisibilities]`,
  optional: true,
  dynamicFields: {
    key: 'serialized property name',
    value: 'enum: default, visible, or hidden',
  },
});

const attachedBehaviorTable = {
  table: 'behaviors',
  header: '[[behaviors]]',
  repeated: true,
  emptyForm: 'behaviors = [ ]',
  fields: [
    settingsField('name', 'unique object-local string', { required: true }),
    settingsField('type', 'registered behaviorTypes[].type', {
      required: true,
    }),
    settingsField('isFolded', 'boolean', { default: false }),
    settingsField('isMuted', 'boolean', { default: false }),
    settingsField('isInheritedFromObjectType', 'boolean', { default: false }),
    settingsField('quickCustomizationVisibility', 'enum', {
      values: ['default', 'visible', 'hidden'],
    }),
  ],
  childTables: [quickCustomizationTable('behaviors')],
  dynamicFields: {
    source: 'behaviorTypes[type].properties',
    key: 'properties[].serializedKey',
    value: 'properties[].type',
  },
  additionalFields:
    'reject unlisted existing serializer fields according to behaviorTypes[type].unknownPropertyPolicy',
};

const objectEffectTable = {
  table: 'effects',
  header: '[[effects]]',
  repeated: true,
  emptyForm: 'effects = [ ]',
  fields: [
    settingsField('name', 'unique object-local string', { required: true }),
    settingsField('effectType', 'registered effectTypes[].type', {
      required: true,
    }),
    settingsField('folded', 'boolean', { default: false }),
    settingsField('disabled', 'boolean', { default: false }),
  ],
  childTables: [
    {
      table: 'effects.doubleParameters',
      header: '[effects.doubleParameters]',
      optional: true,
      dynamicFields: {
        source: 'effectTypes[effectType].parameters',
        key: 'effect parameter name',
        value: 'number',
      },
      emptyForm: 'doubleParameters = { } inside [[effects]]',
    },
    {
      table: 'effects.stringParameters',
      header: '[effects.stringParameters]',
      optional: true,
      dynamicFields: {
        source: 'effectTypes[effectType].parameters',
        key: 'effect parameter name',
        value: 'string',
      },
      emptyForm: 'stringParameters = { } inside [[effects]]',
    },
    {
      table: 'effects.booleanParameters',
      header: '[effects.booleanParameters]',
      optional: true,
      dynamicFields: {
        source: 'effectTypes[effectType].parameters',
        key: 'effect parameter name',
        value: 'boolean',
      },
      emptyForm: 'booleanParameters = { } inside [[effects]]',
    },
  ],
};

const propertyDescriptorFields = [
  settingsField('name', 'unique string', { required: true }),
  settingsField('value', 'string', { required: true }),
  settingsField('type', 'property type string', { required: true }),
  settingsField('unit', 'measurement-unit string', {
    emittedWhen: 'type is Number and a measurement unit is defined',
  }),
  settingsField('label', 'string', { required: true }),
  settingsField('description', 'string'),
  settingsField('group', 'compatibility string'),
  settingsField('extraInformation', 'string array'),
  settingsField('hidden', 'boolean', { default: false }),
  settingsField('deprecated', 'boolean', { default: false }),
  settingsField('advanced', 'boolean', { default: false }),
  settingsField('quickCustomizationVisibility', 'enum', {
    values: ['default', 'visible', 'hidden'],
  }),
];

const propertyDescriptorTable = (name: string): Object => ({
  table: name,
  header: `[[${name}]]`,
  repeated: true,
  emptyForm: `${name} = [ ]`,
  fields: propertyDescriptorFields,
  childTables: [
    {
      table: `${name}.choices`,
      header: `[[${name}.choices]]`,
      repeated: true,
      emptyForm: 'choices = [ ] inside the parent property descriptor',
      fields: [
        settingsField('value', 'string', { required: true }),
        settingsField('label', 'string', { required: true }),
      ],
    },
  ],
});

const functionSchema = ({ folder, extensionRequired }: Object): Object => ({
  rootFields: [
    ...formatFields({
      kind: 'function',
      ordered: true,
      folder,
      name: true,
    }),
    ...(extensionRequired
      ? [
          settingsField('extension', 'owning extension name', {
            required: true,
          }),
        ]
      : []),
    settingsField('functionType', 'enum', {
      required: true,
      values: [
        'Action',
        'Condition',
        'Expression',
        'StringExpression',
        'ExpressionAndCondition',
        'ActionWithOperator',
      ],
    }),
    settingsField('fullName', 'string'),
    settingsField('description', 'string'),
    settingsField('sentence', 'string'),
    settingsField('group', 'string'),
    settingsField('getterName', 'string'),
    settingsField('private', 'boolean', { default: false }),
    settingsField('async', 'boolean', { default: false }),
    settingsField('helpUrl', 'string'),
    settingsField('deprecated', 'boolean', { default: false }),
    settingsField('deprecationMessage', 'string'),
  ],
  childTables: [
    {
      table: 'expressionType',
      header: '[expressionType]',
      optional: true,
      requiredForFunctionTypes: [
        'Expression',
        'StringExpression',
        'ExpressionAndCondition',
      ],
      fields: [
        settingsField('type', 'value type string', { required: true }),
        settingsField('supplementaryInformation', 'string'),
        settingsField('optional', 'boolean', { default: false }),
        settingsField('defaultValue', 'string'),
      ],
    },
    {
      table: 'parameters',
      header: '[[parameters]]',
      repeated: true,
      emptyForm: 'parameters = [ ]',
      fields: [
        settingsField('name', 'unique parameter string', { required: true }),
        settingsField('type', 'parameter value type string', {
          required: true,
        }),
        settingsField('supplementaryInformation', 'string'),
        settingsField('optional', 'boolean', { default: false }),
        settingsField('defaultValue', 'string'),
        settingsField('description', 'string', { required: true }),
        settingsField('longDescription', 'string'),
        settingsField('hint', 'string'),
        settingsField('codeOnly', 'boolean', { default: false }),
      ],
    },
    objectGroupsTable(),
    objectGroupRequiredBehaviorsTable(),
  ],
  additionalFields:
    'reject unknown current EventsFunction serializer metadata fields',
});

const lifecycleFunctionSchema = (() => {
  const schema = functionSchema({ folder: true, extensionRequired: false });
  return {
    ...schema,
    rootFields: [
      ...schema.rootFields.map(field =>
        field.name === 'order'
          ? {
              ...field,
              type: 'fixed lifecycle integer',
              values: [0, 1, 2, 3],
            }
          : field
      ),
      settingsField('lifecycleRole', 'fixed lifecycle role', {
        required: true,
        values: SCENE_LIFECYCLE_SOURCES.map(source => source.name),
      }),
    ],
    additionalFields:
      'Lifecycle metadata is fixed. Do not rename, reorder, delete, duplicate, make public/async, or change signatures.',
  };
})();

const objectSettingsSchema = {
  rootFields: [
    ...formatFields({
      kind: 'object',
      ordered: true,
      folder: true,
      name: true,
    }),
    settingsField('type', 'registered objectTypes[].type', { required: true }),
    settingsField('persistentUuid', 'lowercase UUIDv4 string'),
    settingsField('assetStoreId', 'string'),
    settingsField('resourcesPreloading', 'string'),
  ],
  childTables: [
    variableTable('variables'),
    attachedBehaviorTable,
    objectEffectTable,
  ],
  dynamicFields: {
    source: 'the object serializer selected by root field type',
    schema: 'objectTypes[type].schema',
    policy:
      'Use objectTypes[type].schema for public type-specific configuration and reject unknown legacy or private fields and child tables.',
  },
};

// Keep these contracts aligned with MultiFileProjectFormat's ownership
// projection and the corresponding libGD SerializeTo methods. `header` is the
// exact canonical header emitted by @iarna/toml, including nested records.
export const SETTINGS_FILE_SCHEMAS = Object.freeze({
  project: {
    rootFields: [
      settingsField('formatVersion', 'integer', {
        required: true,
        value: MULTI_FILE_FORMAT_VERSION,
      }),
      settingsField('entry', MULTI_FILE_ENTRY_URI, {
        optional: true,
      }),
      ...formatFields({ kind: 'project' }),
      settingsField('initialGDVersion', 'string'),
      settingsField('firstLayout', 'existing scene name', { required: true }),
      settingsField('previewLayout', 'existing scene name'),
    ],
    childTables: [
      {
        table: 'gdVersion',
        header: '[gdVersion]',
        fields: ['major', 'minor', 'build', 'revision'].map(name =>
          settingsField(name, 'integer', { required: true })
        ),
      },
      {
        table: 'properties',
        header: '[properties]',
        fields: [
          settingsField('name', 'string', { required: true }),
          settingsField('description', 'string'),
          settingsField('version', 'string'),
          settingsField('author', 'string'),
          settingsField('windowWidth', 'positive integer'),
          settingsField('windowHeight', 'positive integer'),
          settingsField('latestCompilationDirectory', 'string'),
          settingsField('maxFPS', 'number'),
          settingsField('minFPS', 'number'),
          settingsField('verticalSync', 'boolean'),
          settingsField('scaleMode', 'string'),
          settingsField('pixelsRounding', 'boolean'),
          settingsField('adaptGameResolutionAtRuntime', 'boolean'),
          settingsField('sizeOnStartupMode', 'string'),
          settingsField('antialiasingMode', 'string'),
          settingsField('antialisingEnabledOnMobile', 'boolean'),
          settingsField('projectUuid', 'UUID string'),
          settingsField('folderProject', 'boolean'),
          settingsField('packageName', 'string'),
          settingsField('templateSlug', 'string'),
          settingsField('orientation', 'string'),
          settingsField('areEffectsHiddenInEditor', 'boolean'),
          settingsField('authorIds', 'string array'),
          settingsField('authorUsernames', 'string array'),
          settingsField('categories', 'string array'),
          settingsField('playableDevices', 'unique enum string array', {
            values: ['keyboard', 'gamepad', 'mobile'],
          }),
          settingsField('useDeprecatedZeroAsDefaultZOrder', 'boolean'),
          settingsField('useDeprecatedZeroAsDefaultStringVariable', 'boolean'),
          settingsField('currentPlatform', 'string'),
          settingsField('sceneResourcesPreloading', 'string'),
          settingsField('sceneResourcesUnloading', 'string'),
        ],
        childTables: [
          {
            table: 'properties.platformSpecificAssets',
            header: '[properties.platformSpecificAssets]',
            emptyForm: 'platformSpecificAssets = { } inside [properties]',
            dynamicFields: {
              key: '<platform>-<asset-name>',
              value: 'resource name string',
            },
          },
          {
            table: 'properties.loadingScreen',
            header: '[properties.loadingScreen]',
            fields: [
              settingsField('showGDevelopSplash', 'boolean'),
              settingsField('gdevelopLogoStyle', 'string'),
              settingsField('backgroundImageResourceName', 'resource name'),
              settingsField('backgroundColor', 'integer RGB color'),
              settingsField('backgroundFadeInDuration', 'non-negative number'),
              settingsField('minDuration', 'non-negative number'),
              settingsField(
                'logoAndProgressFadeInDuration',
                'non-negative number'
              ),
              settingsField(
                'logoAndProgressLogoFadeInDelay',
                'non-negative number'
              ),
              settingsField('showProgressBar', 'boolean'),
              settingsField('progressBarMinWidth', 'non-negative number'),
              settingsField('progressBarMaxWidth', 'non-negative number'),
              settingsField('progressBarWidthPercent', 'number'),
              settingsField('progressBarHeight', 'non-negative number'),
              settingsField('progressBarColor', 'integer RGB color'),
            ],
          },
          {
            table: 'properties.watermark',
            header: '[properties.watermark]',
            fields: [
              settingsField('showWatermark', 'boolean'),
              settingsField('placement', 'string'),
            ],
          },
          {
            table: 'properties.extensionProperties',
            header: '[[properties.extensionProperties]]',
            repeated: true,
            emptyForm: 'extensionProperties = [ ] inside [properties]',
            fields: [
              settingsField('extension', 'extension name', { required: true }),
              settingsField('property', 'property name', { required: true }),
              settingsField('value', 'string', { required: true }),
            ],
          },
          {
            table: 'properties.platforms',
            header: '[[properties.platforms]]',
            repeated: true,
            emptyForm: 'platforms = [ ] inside [properties]',
            fields: [
              settingsField('name', 'platform name', { required: true }),
            ],
          },
        ],
        additionalFields:
          'reject unknown current Project::properties serializer fields',
      },
      variableTable('variables'),
      objectGroupsTable(),
      objectGroupRequiredBehaviorsTable(),
    ],
    additionalFields:
      'reject unknown current Project serializer fields except split/forbidden ownership fields',
  },
  object: objectSettingsSchema,
  resources: {
    rootFields: [
      ...formatFields({ kind: 'resources' }),
      settingsField(
        'resourceFolders',
        'preserved homogeneous resource-folder array',
        {
          emptyForm: 'resourceFolders = [ ]',
        }
      ),
    ],
    childTables: [
      {
        table: 'resources',
        header: '[[resources]]',
        repeated: true,
        emptyForm: 'resources = [ ]',
        fields: [
          settingsField('kind', 'enum', {
            required: true,
            values: [
              'image',
              'audio',
              'font',
              'video',
              'json',
              'tilemap',
              'tileset',
              'bitmapFont',
              'model3D',
              'atlas',
              'spine',
              'javascript',
              'tslMaterial',
              'internal-in-game-editor-only-svg',
            ],
            capabilitiesByValue: {
              image: ['image-2d', 'three-texture'],
              model3D: ['model-3d'],
              tslMaterial: ['tsl-material'],
            },
            capabilityNotes: {
              'three-texture':
                'Image resources can be uploaded to Three.js from the cached Pixi image, canvas, ImageBitmap, ImageData, video, or OffscreenCanvas source. SVG image files are supported after Pixi rasterizes them.',
            },
          }),
          settingsField('name', 'unique resource name', { required: true }),
          settingsField('metadata', 'string', { required: true }),
          settingsField('file', 'project-relative resource path', {
            required: true,
          }),
          settingsField('userAdded', 'boolean', { required: true }),
          settingsField('smoothed', 'boolean', {
            requiredForKinds: ['image'],
          }),
          settingsField('preloadAsMusic', 'boolean', {
            requiredForKinds: ['audio'],
          }),
          settingsField('preloadAsSound', 'boolean', {
            requiredForKinds: ['audio'],
          }),
          settingsField('preloadInCache', 'boolean', {
            requiredForKinds: ['audio'],
          }),
          settingsField('disablePreload', 'boolean', {
            requiredForKinds: ['json', 'tilemap', 'tileset', 'spine'],
          }),
        ],
        childTables: [
          {
            table: 'resources.origin',
            header: '[resources.origin]',
            optional: true,
            fields: [
              settingsField('name', 'origin name string', { required: true }),
              settingsField('identifier', 'origin identifier string', {
                required: true,
              }),
            ],
          },
        ],
        additionalFields:
          'reject unknown resource-kind serializer fields for forward compatibility',
      },
    ],
  },
  tests: {
    rootFields: [...formatFields({ kind: 'tests' })],
    childTables: [
      {
        table: 'tests',
        header: '[[tests]]',
        repeated: true,
        emptyForm: 'tests = [ ]',
        fields: [
          settingsField('scope', 'enum', {
            required: true,
            values: ['project', 'extension'],
          }),
          settingsField('extension', 'owning extension name', {
            requiredForScopes: ['extension'],
          }),
          settingsField('order', 'contiguous zero-based integer', {
            required: true,
          }),
          settingsField('name', 'container-unique test name', {
            required: true,
          }),
          settingsField('type', 'enum', {
            required: true,
            values: ['gameplay'],
          }),
          settingsField('description', 'string', { required: true }),
          settingsField(
            'file',
            'canonical root-relative tests/<Encoded basename>.js path',
            { required: true }
          ),
        ],
      },
    ],
    additionalFields:
      'No additional fields. lastRunStatus, lastRunAt, lastRunDurationMs, and lastRunFramesExecuted are forbidden editor state.',
  },
  constants: {
    rootFields: [],
    childTables: [],
    dynamicFields: {
      key: 'arbitrary user-owned TOML-compatible key',
      value:
        'string, finite number, boolean, homogeneous array, table, or nested combination',
    },
    additionalFields:
      'all fields are user-owned; rawJson has no reserved meaning here',
  },
  scene: {
    rootFields: [
      ...formatFields({ kind: 'scene', ordered: true, name: true }),
      settingsField('mangledName', 'string'),
      settingsField('title', 'string'),
      settingsField('standardSortMethod', 'boolean'),
      settingsField('stopSoundsOnStartup', 'boolean'),
      settingsField('renderer3DWorldScale', 'number'),
      settingsField('resourcesPreloading', 'string'),
      settingsField('resourcesUnloading', 'string'),
      settingsField('disableInputWhenNotFocused', 'boolean'),
    ],
    childTables: [
      variableTable('variables'),
      objectGroupsTable(),
      objectGroupRequiredBehaviorsTable(),
      {
        table: 'behaviorsSharedData',
        header: '[[behaviorsSharedData]]',
        repeated: true,
        emptyForm: 'behaviorsSharedData = [ ]',
        fields: [
          settingsField('name', 'unique scene-local string', {
            required: true,
          }),
          settingsField('type', 'registered behaviorTypes[].type', {
            required: true,
          }),
          settingsField('quickCustomizationVisibility', 'enum', {
            values: ['default', 'visible', 'hidden'],
          }),
        ],
        childTables: [quickCustomizationTable('behaviorsSharedData')],
        dynamicFields: {
          source: 'behaviorTypes[type].sharedProperties',
          key: 'sharedProperties[].serializedKey',
          value: 'sharedProperties[].type',
        },
        additionalFields:
          'reject unlisted existing shared-data serializer fields',
      },
    ],
    additionalFields:
      'reject unknown current Layout serializer fields except layout/lifecycle-function/object ownership fields',
  },
  sceneLifecycleFunction: lifecycleFunctionSchema,
  externalEvents: {
    rootFields: [
      ...formatFields({ kind: 'externalEvents', name: true }),
      settingsField('description', 'string'),
      settingsField('eventsLogic', 'string'),
    ],
    childTables: [],
  },
  externalLayout: {
    rootFields: [
      ...formatFields({ kind: 'externalLayout', ordered: true, name: true }),
    ],
    childTables: [],
    additionalFields:
      'reject unknown current ExternalLayout serializer metadata fields except association and embedded layout fields',
  },
  extension: {
    rootFields: [
      ...formatFields({ kind: 'extension', ordered: true, name: true }),
      settingsField('version', 'string'),
      settingsField('extensionNamespace', 'string'),
      settingsField('shortDescription', 'string'),
      settingsField('description', 'string or string array of lines'),
      settingsField('dimension', 'string'),
      settingsField('fullName', 'string'),
      settingsField('category', 'string'),
      settingsField('tags', 'string array'),
      settingsField('authorIds', 'string array'),
      settingsField('author', 'string'),
      settingsField('previewIconUrl', 'string'),
      settingsField('iconUrl', 'string'),
      settingsField('helpPath', 'string'),
      settingsField('gdevelopVersion', 'string'),
    ],
    childTables: [
      {
        table: 'origin',
        header: '[origin]',
        optional: true,
        fields: [
          settingsField('name', 'origin name string', { required: true }),
          settingsField('identifier', 'origin identifier string', {
            required: true,
          }),
        ],
      },
      {
        table: 'changelog',
        header: '[[changelog]]',
        repeated: true,
        fields: [
          settingsField('version', 'version string', { required: true }),
          settingsField('breaking', 'string or string array of lines', {
            required: true,
          }),
        ],
      },
      {
        table: 'dependencies',
        header: '[[dependencies]]',
        repeated: true,
        emptyForm: 'dependencies = [ ]',
        fields: [
          settingsField('type', 'dependency type string', { required: true }),
          settingsField('exportName', 'string', { required: true }),
          settingsField('name', 'dependency name string', { required: true }),
          settingsField('version', 'version string', { required: true }),
        ],
      },
      {
        table: 'sourceFiles',
        header: '[[sourceFiles]]',
        repeated: true,
        fields: [
          settingsField('resourceName', 'resource name string', {
            required: true,
          }),
          settingsField('includePosition', 'enum', {
            required: true,
            values: ['first', 'last'],
          }),
        ],
      },
      variableTable('globalVariables'),
      variableTable('sceneVariables'),
    ],
    additionalFields:
      'reject unknown current EventsFunctionsExtension metadata fields except split child implementations',
  },
  extensionFunction: functionSchema({
    folder: false,
    extensionRequired: true,
  }),
  prefab: {
    rootFields: [
      ...formatFields({ kind: 'prefab', ordered: true, name: true }),
      settingsField('defaultName', 'string'),
      settingsField('assetStoreTag', 'string'),
      settingsField('assetStoreAssetId', 'string'),
      settingsField('assetStoreOriginalName', 'string'),
      settingsField('is3D', 'boolean', { default: false }),
      settingsField('isAnimatable', 'boolean', { default: false }),
      settingsField('isTextContainer', 'boolean', { default: false }),
      settingsField('isInnerAreaFollowingParentSize', 'boolean', {
        default: false,
      }),
      settingsField('isUsingLegacyInstancesRenderer', 'boolean'),
      settingsField('description', 'string'),
      settingsField('fullName', 'string'),
      settingsField('private', 'boolean', { default: false }),
      settingsField('previewIconUrl', 'string'),
      settingsField('iconUrl', 'string'),
      settingsField('helpPath', 'string'),
    ],
    childTables: [
      variableTable('variables'),
      attachedBehaviorTable,
      propertyDescriptorTable('propertyDescriptors'),
      objectGroupsTable(),
      objectGroupRequiredBehaviorsTable(),
    ],
    additionalFields:
      'reject unknown current EventsBasedObject metadata fields except split functions/layout/objects',
  },
  prefabVariant: {
    rootFields: [
      ...formatFields({ kind: 'prefabVariant', ordered: true, name: true }),
      settingsField('assetStoreAssetId', 'string'),
      settingsField('assetStoreOriginalName', 'string'),
    ],
    childTables: [objectGroupsTable(), objectGroupRequiredBehaviorsTable()],
    additionalFields:
      'reject unknown current EventsBasedObjectVariant metadata fields except split layout/object fields',
  },
  prefabFunction: functionSchema({
    folder: true,
    extensionRequired: false,
  }),
  behavior: {
    rootFields: [
      ...formatFields({ kind: 'behavior', ordered: true, name: true }),
      settingsField('description', 'string'),
      settingsField('fullName', 'string'),
      settingsField('private', 'boolean', { default: false }),
      settingsField('previewIconUrl', 'string'),
      settingsField('iconUrl', 'string'),
      settingsField('helpPath', 'string'),
      settingsField('objectType', 'registered object type or empty string'),
      settingsField('quickCustomizationVisibility', 'enum', {
        values: ['default', 'visible', 'hidden'],
      }),
    ],
    childTables: [
      variableTable('variables'),
      propertyDescriptorTable('propertyDescriptors'),
      propertyDescriptorTable('sharedPropertyDescriptors'),
    ],
    additionalFields:
      'reject unknown current EventsBasedBehavior metadata fields except split functions',
  },
  behaviorFunction: functionSchema({
    folder: true,
    extensionRequired: false,
  }),
});
