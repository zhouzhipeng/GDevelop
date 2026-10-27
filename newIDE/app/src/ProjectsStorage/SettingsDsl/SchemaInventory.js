// @noflow
// Shared authoring field inventory. SettingsDsl converts these descriptors to
// strict node schemas; catalogs publish the same schemas used by the parser.
export const SETTINGS_FORMAT_VERSION = 13;
const MULTI_FILE_FORMAT_VERSION = SETTINGS_FORMAT_VERSION;
const MULTI_FILE_ENTRY_URI = 'game://project.gdl';
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
const variableNode = (name: string): Object => ({
  serializedKey: name,
  variableCollection: true,
  repeated: true,
  fields: variableRecordFields,
  additionalFields:
    'Direct variable nodes with literal values or explicit structure/array type and nested variable declarations. Array children have no names; structure children require unique names. Never mix value with children; metadata nodes are forbidden.',
});

const objectGroupsNode = (prefix: string = ''): Object => ({
  serializedKey: `${prefix}objectGroups`,
  optional: true,
  dynamicFields: {
    key: 'unique object-group name',
    value: 'ordered string array of existing object names',
  },
});

const objectGroupRequiredBehaviorsNode = (prefix: string = ''): Object => ({
  serializedKey: `${prefix}objectGroupRequiredBehaviors`,
  optional: true,
  dynamicFields: {
    key: `object-group name also present in ${prefix}objectGroups`,
    value: 'ordered string array of registered behavior types',
  },
});

const quickCustomizationNode = (prefix: string): Object => ({
  serializedKey: `${prefix}.propertiesQuickCustomizationVisibilities`,
  optional: true,
  dynamicFields: {
    key: 'serialized property name',
    value: 'enum: default, visible, or hidden',
  },
});

const attachedBehaviorNode = {
  serializedKey: 'behaviors',
  repeated: true,
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
  childNodes: [quickCustomizationNode('behaviors')],
  dynamicFields: {
    source: 'behaviorTypes[type].properties',
    key: 'properties[].serializedKey',
    value: 'properties[].type',
  },
  additionalFields:
    'reject unlisted existing serializer fields according to behaviorTypes[type].unknownPropertyPolicy',
};

const objectEffectNode = {
  serializedKey: 'effects',
  repeated: true,
  fields: [
    settingsField('name', 'unique object-local string', { required: true }),
    settingsField('effectType', 'registered effectTypes[].type', {
      required: true,
    }),
    settingsField('folded', 'boolean', { default: false }),
    settingsField('disabled', 'boolean', { default: false }),
  ],
  childNodes: [
    {
      serializedKey: 'effects.doubleParameters',
      optional: true,
      dynamicFields: {
        source: 'effectTypes[effectType].parameters',
        key: 'effect parameter name',
        value: 'number',
      },
    },
    {
      serializedKey: 'effects.stringParameters',
      optional: true,
      dynamicFields: {
        source: 'effectTypes[effectType].parameters',
        key: 'effect parameter name',
        value: 'string',
      },
    },
    {
      serializedKey: 'effects.booleanParameters',
      optional: true,
      dynamicFields: {
        source: 'effectTypes[effectType].parameters',
        key: 'effect parameter name',
        value: 'boolean',
      },
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

const propertyDescriptorNode = (name: string): Object => ({
  serializedKey: name,
  repeated: true,
  fields: propertyDescriptorFields,
  childNodes: [
    {
      serializedKey: `${name}.choices`,
      repeated: true,
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
  childNodes: [
    {
      serializedKey: 'expressionType',
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
      serializedKey: 'parameters',
      repeated: true,
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
    objectGroupsNode(),
    objectGroupRequiredBehaviorsNode(),
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
  childNodes: [
    variableNode('variables'),
    attachedBehaviorNode,
    objectEffectNode,
  ],
  dynamicFields: {
    source: 'the object serializer selected by root field type',
    schema: 'objectTypes[type].schema',
    policy:
      'Use objectTypes[type].schema for public type-specific configuration and reject unknown legacy or private fields and child nodes.',
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
    childNodes: [
      {
        serializedKey: 'gdVersion',
        fields: ['major', 'minor', 'build', 'revision'].map(name =>
          settingsField(name, 'integer', { required: true })
        ),
      },
      {
        serializedKey: 'properties',
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
        childNodes: [
          {
            serializedKey: 'properties.platformSpecificAssets',
            dynamicFields: {
              key: '<platform>-<asset-name>',
              value: 'resource name string',
            },
          },
          {
            serializedKey: 'properties.loadingScreen',
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
            serializedKey: 'properties.watermark',
            fields: [
              settingsField('showWatermark', 'boolean'),
              settingsField('placement', 'string'),
            ],
          },
          {
            serializedKey: 'properties.extensionProperties',
            repeated: true,
            fields: [
              settingsField('extension', 'extension name', { required: true }),
              settingsField('property', 'property name', { required: true }),
              settingsField('value', 'string', { required: true }),
            ],
          },
          {
            serializedKey: 'properties.platforms',
            repeated: true,
            fields: [
              settingsField('name', 'platform name', { required: true }),
            ],
          },
        ],
        additionalFields:
          'reject unknown current Project::properties serializer fields',
      },
      variableNode('variables'),
      objectGroupsNode(),
      objectGroupRequiredBehaviorsNode(),
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
        {}
      ),
    ],
    childNodes: [
      {
        serializedKey: 'resources',
        repeated: true,
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
        childNodes: [
          {
            serializedKey: 'resources.origin',
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
    childNodes: [
      {
        serializedKey: 'tests',
        repeated: true,
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
    childNodes: [],
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
    childNodes: [
      variableNode('variables'),
      objectGroupsNode(),
      objectGroupRequiredBehaviorsNode(),
      {
        serializedKey: 'behaviorsSharedData',
        repeated: true,
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
        childNodes: [quickCustomizationNode('behaviorsSharedData')],
        dynamicFields: {
          source:
            'behaviorTypes[type].sharedProperties and sharedSerializedProperties',
          key: 'serializedKey',
          value: 'type',
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
    childNodes: [],
  },
  externalLayout: {
    rootFields: [
      ...formatFields({ kind: 'externalLayout', ordered: true, name: true }),
    ],
    childNodes: [],
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
    childNodes: [
      {
        serializedKey: 'origin',
        optional: true,
        fields: [
          settingsField('name', 'origin name string', { required: true }),
          settingsField('identifier', 'origin identifier string', {
            required: true,
          }),
        ],
      },
      {
        serializedKey: 'changelog',
        repeated: true,
        fields: [
          settingsField('version', 'version string', { required: true }),
          settingsField('breaking', 'string or string array of lines', {
            required: true,
          }),
        ],
      },
      {
        serializedKey: 'dependencies',
        repeated: true,
        fields: [
          settingsField('type', 'dependency type string', { required: true }),
          settingsField('exportName', 'string', { required: true }),
          settingsField('name', 'dependency name string', { required: true }),
          settingsField('version', 'version string', { required: true }),
        ],
      },
      {
        serializedKey: 'sourceFiles',
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
      variableNode('globalVariables'),
      variableNode('sceneVariables'),
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
    childNodes: [
      variableNode('variables'),
      attachedBehaviorNode,
      propertyDescriptorNode('propertyDescriptors'),
      objectGroupsNode(),
      objectGroupRequiredBehaviorsNode(),
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
    childNodes: [objectGroupsNode(), objectGroupRequiredBehaviorsNode()],
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
    childNodes: [
      variableNode('variables'),
      propertyDescriptorNode('propertyDescriptors'),
      propertyDescriptorNode('sharedPropertyDescriptors'),
    ],
    additionalFields:
      'reject unknown current EventsBasedBehavior metadata fields except split functions',
  },
  behaviorFunction: functionSchema({
    folder: true,
    extensionRequired: false,
  }),
});
