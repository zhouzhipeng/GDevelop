//@ts-check
/// <reference path="../JsExtensionTypes.d.ts" />

const defaults = {
  material: '',
  bindingName: 'Default',
  selectorMode: 'All',
  meshName: '',
  materialName: '',
  priority: 0,
  enabled: true,
  fallback: 'KeepOriginal',
};

const includeFiles = [
  'Extensions/TSLMaterial/TSLMaterialTypes.js',
  'Extensions/TSLMaterial/TSLMaterialRegistry.js',
  'Extensions/TSLMaterial/TSLMaterialRuntimeAdapter.js',
  'Extensions/TSLMaterial/TSLMaterialSystem.js',
  'Extensions/TSLMaterial/TSLMaterialRuntimeTools.js',
  'Extensions/TSLMaterial/TSLMaterialRuntimeBehavior.js',
];

const addIncludeFiles = (metadata) => {
  includeFiles.forEach((file) => metadata.addIncludeFile(file));
  return metadata;
};

/** @type {ExtensionModule} */
module.exports = {
  createExtension: function (_, gd) {
    const extension = new gd.PlatformExtension();
    extension
      .setExtensionInformation(
        'TSLMaterial',
        _('TSL materials'),
        _(
          'Apply typed Three.js Shading Language node materials to materials embedded in 3D models.'
        ),
        'GDevelop',
        'MIT'
      )
      .setShortDescription(
        _(
          'Create portable, AI-authorable node materials for GLB models using the WebGL compatibility backend.'
        )
      )
      .setDimension('3D')
      .setCategory('General');
    extension
      .addInstructionOrExpressionGroupMetadata(_('TSL materials'))
      .setIcon('JsPlatform/Extensions/3d_model.svg');

    const implementation = new gd.BehaviorJsImplementation();
    implementation.initializeContent = function (content) {
      content.setStringAttribute('material', defaults.material);
      content.setStringAttribute('bindingName', defaults.bindingName);
      content.setStringAttribute('selectorMode', defaults.selectorMode);
      content.setStringAttribute('meshName', defaults.meshName);
      content.setStringAttribute('materialName', defaults.materialName);
      content.setDoubleAttribute('priority', defaults.priority);
      content.setBoolAttribute('enabled', defaults.enabled);
      content.setStringAttribute('fallback', defaults.fallback);
    };
    implementation.updateProperty = function (content, propertyName, value) {
      if (!Object.prototype.hasOwnProperty.call(defaults, propertyName)) {
        return false;
      }
      if (propertyName === 'priority') {
        const number = Number(value);
        content.setDoubleAttribute(
          propertyName,
          Number.isFinite(number) ? Math.trunc(number) : defaults.priority
        );
      } else if (propertyName === 'enabled') {
        content.setBoolAttribute(
          propertyName,
          value === 'true' || value === '1'
        );
      } else if (propertyName === 'selectorMode') {
        content.setStringAttribute(
          propertyName,
          ['All', 'MeshName', 'MaterialName', 'MeshAndMaterialName'].includes(
            value
          )
            ? value
            : defaults.selectorMode
        );
      } else if (propertyName === 'fallback') {
        content.setStringAttribute(propertyName, 'KeepOriginal');
      } else {
        content.setStringAttribute(propertyName, value);
      }
      return true;
    };
    implementation.getProperties = function (content) {
      const properties = new gd.MapStringPropertyDescriptor();
      properties
        .getOrCreate('material')
        .setValue(content.getStringAttribute('material'))
        .setType('Resource')
        .addExtraInfo('tslMaterial')
        .setLabel(_('TSL material'))
        .setDescription(
          _(
            'A validated .tsl.ts material resource. Source text is never evaluated by the game runtime.'
          )
        );
      properties
        .getOrCreate('bindingName')
        .setValue(content.getStringAttribute('bindingName'))
        .setType('String')
        .setLabel(_('Binding name'));
      properties
        .getOrCreate('selectorMode')
        .setValue(content.getStringAttribute('selectorMode'))
        .setType('Choice')
        .addChoice('All', _('All material slots'))
        .addChoice('MeshName', _('Mesh name'))
        .addChoice('MaterialName', _('Material name'))
        .addChoice('MeshAndMaterialName', _('Mesh and material name'))
        .setLabel(_('Selector'));
      properties
        .getOrCreate('meshName')
        .setValue(content.getStringAttribute('meshName'))
        .setType('String')
        .setLabel(_('Mesh name'));
      properties
        .getOrCreate('materialName')
        .setValue(content.getStringAttribute('materialName'))
        .setType('String')
        .setLabel(_('Material name'));
      properties
        .getOrCreate('priority')
        .setValue(String(content.getDoubleAttribute('priority')))
        .setType('Number')
        .setLabel(_('Priority'));
      properties
        .getOrCreate('enabled')
        .setValue(content.getBoolAttribute('enabled') ? 'true' : 'false')
        .setType('Boolean')
        .setLabel(_('Enabled'));
      properties
        .getOrCreate('fallback')
        .setValue('KeepOriginal')
        .setType('Choice')
        .addChoice('KeepOriginal', _('Keep the original material'))
        .setLabel(_('Fallback'))
        .setAdvanced(true);
      return properties;
    };

    const behavior = addIncludeFiles(
      extension
        .addBehavior(
          'Material',
          _('TSL material'),
          'TSLMaterial',
          _(
            'Apply a validated TSL material definition to selected material slots of a 3D model.'
          ),
          '',
          'JsPlatform/Extensions/3d_model.svg',
          'TSLMaterialRuntimeBehavior',
          // @ts-ignore BehaviorJsImplementation is accepted by the extension API.
          implementation,
          new gd.BehaviorsSharedData()
        )
        .setObjectType('Scene3D::Model3DObject')
    );

    const icon = 'JsPlatform/Extensions/3d_model.svg';
    const addBehaviorParameters = (metadata) =>
      metadata
        .addParameter('object', _('3D model'), 'Scene3D::Model3DObject', false)
        .addParameter(
          'behavior',
          _('TSL material behavior'),
          'Material',
          false
        );
    const addAction = (name, label, description, sentence) =>
      addBehaviorParameters(
        behavior.addAction(
          name,
          label,
          description,
          sentence,
          _('TSL materials'),
          icon,
          icon
        )
      );

    addAction(
      'ApplyMaterial',
      _('Apply TSL material'),
      _(
        'Create or update a named TSL material binding. The material source must be a validated resource.'
      ),
      _(
        'Apply TSL material _PARAM3_ to _PARAM0_ as binding _PARAM2_ with selector _PARAM4_'
      )
    )
      .addParameter('string', _('Binding name'), '', false)
      .addParameter(
        'tslMaterialResource',
        _('TSL material resource'),
        '',
        false
      )
      .addParameter(
        'stringWithSelector',
        _('Selector mode'),
        JSON.stringify([
          'All',
          'MeshName',
          'MaterialName',
          'MeshAndMaterialName',
        ]),
        false
      )
      .setDefaultValue('All')
      .addParameter('string', _('Mesh name'), '', true)
      .setDefaultValue('""')
      .addParameter('string', _('Material name'), '', true)
      .setDefaultValue('""')
      .addParameter('expression', _('Priority'), '', true)
      .setDefaultValue('0')
      .getCodeExtraInformation()
      .setFunctionName('applyMaterial');
    addAction(
      'RemoveBinding',
      _('Remove TSL material binding'),
      _(
        'Remove a named binding and reveal the next winner or original material.'
      ),
      _('Remove TSL material binding _PARAM2_ from _PARAM0_')
    )
      .addParameter('string', _('Binding name'))
      .getCodeExtraInformation()
      .setFunctionName('removeBinding');
    addAction(
      'RemoveAllBindings',
      _('Remove all TSL material bindings'),
      _('Remove all extension-owned bindings and restore eligible slots.'),
      _('Remove all TSL material bindings from _PARAM0_')
    )
      .getCodeExtraInformation()
      .setFunctionName('removeAllBindings');
    addAction(
      'EnableBinding',
      _('Enable TSL material binding'),
      _('Enable or disable a binding without deleting its parameter values.'),
      _('Enable TSL material binding _PARAM2_ on _PARAM0_: _PARAM3_')
    )
      .addParameter('string', _('Binding name'))
      .addParameter('yesorno', _('Enable'))
      .getCodeExtraInformation()
      .setFunctionName('enableBinding');

    const addParameterAction = (name, label, description, sentence) =>
      addAction(name, label, description, sentence)
        .addParameter('string', _('Binding name'))
        .addParameter('string', _('Parameter name'));
    addParameterAction(
      'SetNumberParameter',
      _('Set number parameter'),
      _(
        'Set a declared numeric uniform without rebuilding the material graph.'
      ),
      _(
        'Set number parameter _PARAM3_ of binding _PARAM2_ on _PARAM0_ to _PARAM4_'
      )
    )
      .addParameter('expression', _('Value'))
      .getCodeExtraInformation()
      .setFunctionName('setNumberParameter');
    addParameterAction(
      'SetBooleanParameter',
      _('Set boolean parameter'),
      _(
        'Set a declared boolean uniform without rebuilding the material graph.'
      ),
      _(
        'Set boolean parameter _PARAM3_ of binding _PARAM2_ on _PARAM0_ to _PARAM4_'
      )
    )
      .addParameter('yesorno', _('Value'))
      .getCodeExtraInformation()
      .setFunctionName('setBooleanParameter');
    addParameterAction(
      'SetColorParameter',
      _('Set color parameter'),
      _('Set a declared color uniform in its declared color space.'),
      _(
        'Set color parameter _PARAM3_ of binding _PARAM2_ on _PARAM0_ to _PARAM4_'
      )
    )
      .addParameter('color', _('Color'))
      .getCodeExtraInformation()
      .setFunctionName('setColorParameter');
    addParameterAction(
      'SetVector2Parameter',
      _('Set vector2 parameter'),
      _('Set a declared vec2 uniform.'),
      _('Set vec2 parameter _PARAM3_ of binding _PARAM2_ on _PARAM0_')
    )
      .addParameter('expression', _('X'))
      .addParameter('expression', _('Y'))
      .getCodeExtraInformation()
      .setFunctionName('setVector2Parameter');
    addParameterAction(
      'SetVector3Parameter',
      _('Set vector3 parameter'),
      _('Set a declared vec3 uniform.'),
      _('Set vec3 parameter _PARAM3_ of binding _PARAM2_ on _PARAM0_')
    )
      .addParameter('expression', _('X'))
      .addParameter('expression', _('Y'))
      .addParameter('expression', _('Z'))
      .getCodeExtraInformation()
      .setFunctionName('setVector3Parameter');
    addParameterAction(
      'SetVector4Parameter',
      _('Set vector4 parameter'),
      _('Set a declared vec4 uniform.'),
      _('Set vec4 parameter _PARAM3_ of binding _PARAM2_ on _PARAM0_')
    )
      .addParameter('expression', _('X'))
      .addParameter('expression', _('Y'))
      .addParameter('expression', _('Z'))
      .addParameter('expression', _('W'))
      .getCodeExtraInformation()
      .setFunctionName('setVector4Parameter');
    addParameterAction(
      'SetTextureParameter',
      _('Set texture parameter'),
      _('Resolve and set a declared texture parameter from an image resource.'),
      _(
        'Set texture parameter _PARAM3_ of binding _PARAM2_ on _PARAM0_ to _PARAM4_'
      )
    )
      .addParameter('imageResource', _('Image resource'))
      .getCodeExtraInformation()
      .setFunctionName('setTextureParameter');
    addParameterAction(
      'ResetParameter',
      _('Reset TSL material parameter'),
      _('Restore a parameter to its manifest default.'),
      _('Reset parameter _PARAM3_ of binding _PARAM2_ on _PARAM0_')
    )
      .getCodeExtraInformation()
      .setFunctionName('resetParameter');

    const addCondition = (name, label, description, sentence, functionName) =>
      addBehaviorParameters(
        behavior.addCondition(
          name,
          label,
          description,
          sentence,
          _('TSL materials'),
          icon,
          icon
        )
      )
        .addParameter('string', _('Binding name'))
        .getCodeExtraInformation()
        .setFunctionName(functionName);
    addCondition(
      'HasBinding',
      _('Has TSL material binding'),
      _('Check whether the named runtime binding exists.'),
      _('_PARAM0_ has TSL material binding _PARAM2_'),
      'hasBinding'
    );
    addCondition(
      'IsBindingReady',
      _('TSL material binding is ready'),
      _('Check whether at least one winning slot was installed successfully.'),
      _('TSL material binding _PARAM2_ of _PARAM0_ is ready'),
      'isBindingReady'
    );
    addCondition(
      'BindingHasError',
      _('TSL material binding has an error'),
      _('Check whether the binding is in Error or Unsupported state.'),
      _('TSL material binding _PARAM2_ of _PARAM0_ has an error'),
      'bindingHasError'
    );
    addCondition(
      'BindingMatchedSlot',
      _('TSL material binding matched a slot'),
      _('Check whether the selector matched at least one current model slot.'),
      _('TSL material binding _PARAM2_ of _PARAM0_ matched a slot'),
      'bindingMatchedSlot'
    );

    const addNumberExpression = (name, label, description, functionName) =>
      addBehaviorParameters(
        behavior.addExpression(
          name,
          label,
          description,
          _('TSL materials'),
          icon
        )
      )
        .addParameter('string', _('Binding name'))
        .getCodeExtraInformation()
        .setFunctionName(functionName);
    addNumberExpression(
      'MatchedSlotCount',
      _('Matched TSL material slot count'),
      _('Return the slots matched by a named binding.'),
      'getMatchedSlotCount'
    );
    addNumberExpression(
      'ActiveSlotCount',
      _('Active TSL material slot count'),
      _('Return the slots on which a named binding currently wins.'),
      'getActiveSlotCount'
    );

    const addStringExpression = (name, label, description, functionName) =>
      addBehaviorParameters(
        behavior.addStrExpression(
          name,
          label,
          description,
          _('TSL materials'),
          icon
        )
      )
        .addParameter('string', _('Binding name'))
        .getCodeExtraInformation()
        .setFunctionName(functionName);
    addStringExpression(
      'TSLMaterialLastErrorCode',
      _('TSL material last error code'),
      _('Return the stable diagnostic code for a named binding.'),
      'getLastErrorCode'
    );
    addStringExpression(
      'TSLMaterialLastError',
      _('TSL material last error'),
      _('Return the developer-facing diagnostic message for a named binding.'),
      'getLastError'
    );

    const backendCondition = extension
      .addCondition(
        'BackendAvailable',
        _('TSL material backend is available'),
        _(
          'Check whether the current renderer has the version-matched WebGL TSL compatibility backend.'
        ),
        _('The TSL material backend is available'),
        _('TSL materials'),
        icon,
        icon
      )
      .addCodeOnlyParameter('currentScene', '');
    addIncludeFiles(backendCondition.getCodeExtraInformation()).setFunctionName(
      'gdjs.TSLMaterialRuntimeTools.isBackendAvailable'
    );

    const backendExpression = extension.addStrExpression(
      'TSLMaterialBackend',
      _('TSL material backend'),
      _('Return the stable active backend identifier.'),
      _('TSL materials'),
      icon
    );
    addIncludeFiles(
      backendExpression.getCodeExtraInformation()
    ).setFunctionName('gdjs.TSLMaterialRuntimeTools.getBackend');

    return extension;
  },

  runExtensionSanityTests: function () {
    return [];
  },
};
