//@ts-check
/// <reference path="../JsExtensionTypes.d.ts" />

/** @type {ExtensionModule} */
module.exports = {
  createExtension: function (_, gd) {
    const extension = new gd.PlatformExtension();
    extension
      .setExtensionInformation(
        'Model3DBoneAttachment',
        _('3D model bone attachment'),
        _(
          'Attach independent 3D objects to animated bones of a 3D model while preserving their own size, scale and lifecycle.'
        ),
        'GDevelop',
        'MIT'
      )
      .setShortDescription(
        _(
          'Make equipment, effects and other 3D objects follow an animated model bone.'
        )
      )
      .setDimension('3D')
      .setCategory('General');
    extension
      .addInstructionOrExpressionGroupMetadata(_('3D model bone attachment'))
      .setIcon('JsPlatform/Extensions/skeletonboneicon24.png');

    const implementation = new gd.BehaviorJsImplementation();
    implementation.initializeContent = function (content) {
      content.addChild('object3D').setStringValue('');
    };
    implementation.updateProperty = function (content, propertyName, newValue) {
      if (propertyName !== 'object3D') return false;
      content.getOrCreateChild('object3D').setStringValue(newValue);
      return true;
    };
    implementation.getProperties = function (content) {
      const properties = new gd.MapStringPropertyDescriptor();
      properties
        .getOrCreate('object3D')
        .setValue(content.getChild('object3D').getStringValue())
        .setType('Behavior')
        .setLabel(_('3D capability'))
        .setQuickCustomizationVisibility(gd.QuickCustomization.Hidden)
        .addExtraInfo('Scene3D::Base3DBehavior');
      return properties;
    };

    const behavior = extension
      .addBehavior(
        'Model3DBoneAttachmentBehavior',
        _('3D model bone attachment'),
        'Model3DBoneAttachment',
        _(
          'Attach this rendered 3D object to a named bone of an animated 3D model.'
        ),
        '',
        'JsPlatform/Extensions/skeletonboneicon24.png',
        'Model3DBoneAttachmentRuntimeBehavior',
        // @ts-ignore BehaviorJsImplementation is accepted by the extension API.
        implementation,
        new gd.BehaviorsSharedData()
      )
      .setIncludeFile(
        'Extensions/Model3DBoneAttachment/Model3DBoneAttachmentTypes.js'
      )
      .addIncludeFile(
        'Extensions/Model3DBoneAttachment/Model3DBoneAttachmentManager.js'
      )
      .addIncludeFile(
        'Extensions/Model3DBoneAttachment/Model3DBoneAttachmentRuntimeBehavior.js'
      );

    const group = _('3D model bone attachment');
    const icon = 'JsPlatform/Extensions/skeletonboneicon24.png';
    const smallIcon = 'JsPlatform/Extensions/skeletonboneicon16.png';

    behavior
      .addScopedAction(
        'AttachToModelBone',
        _('Attach to a 3D model bone'),
        _(
          'Attach the 3D object to a named bone of a 3D model. The objects must be in the same instance container and on the same 3D layer. Position and rotation follow the bone, while the attached object keeps its own size, scale, flips and visibility. Do not use this on an object whose transform is also controlled by an active physics behavior. For full-rate multiplayer following, run the same equipment events on every peer after both objects exist.'
        ),
        _('Attach _PARAM0_ to bone _PARAM3_ of _PARAM2_'),
        group,
        icon,
        smallIcon
      )
      .addParameter('object', _('3D object'), '', false)
      .addParameter(
        'behavior',
        _('Bone attachment behavior'),
        'Model3DBoneAttachmentBehavior'
      )
      .addParameter(
        'objectPtr',
        _('Target 3D model'),
        'Scene3D::Model3DObject',
        false
      )
      .addParameter('model3DBoneName', _('Bone name'))
      .setFunctionName('attachToModelBone');

    behavior
      .addScopedAction(
        'DetachFromModelBone',
        _('Detach from the 3D model bone'),
        _(
          'Detach the object from its 3D model bone while preserving its last synchronized position and rotation.'
        ),
        _('Detach _PARAM0_ from its 3D model bone'),
        group,
        icon,
        smallIcon
      )
      .addParameter('object', _('3D object'), '', false)
      .addParameter(
        'behavior',
        _('Bone attachment behavior'),
        'Model3DBoneAttachmentBehavior'
      )
      .setFunctionName('detachFromModelBone');

    behavior
      .addScopedAction(
        'SetBoneAttachmentPositionOffset',
        _('Set bone attachment position offset'),
        _(
          "Set the attachment position offset in the bone's local axes. The offset uses GDevelop distance units and is not multiplied by target scale."
        ),
        _(
          'Set bone attachment position offset of _PARAM0_ to _PARAM2_; _PARAM3_; _PARAM4_'
        ),
        group,
        icon,
        smallIcon
      )
      .addParameter('object', _('3D object'), '', false)
      .addParameter(
        'behavior',
        _('Bone attachment behavior'),
        'Model3DBoneAttachmentBehavior'
      )
      .addParameter('number', _('X offset'))
      .addParameter('number', _('Y offset'))
      .addParameter('number', _('Z offset'))
      .setFunctionName('setBoneAttachmentPositionOffset');

    behavior
      .addScopedAction(
        'SetBoneAttachmentRotationOffset',
        _('Set bone attachment rotation offset'),
        _(
          "Set the attachment rotation offset in degrees using GDevelop's ZYX Euler order. The offset is composed after the bone rotation."
        ),
        _(
          'Set bone attachment rotation offset of _PARAM0_ to _PARAM2_; _PARAM3_; _PARAM4_ degrees'
        ),
        group,
        icon,
        smallIcon
      )
      .addParameter('object', _('3D object'), '', false)
      .addParameter(
        'behavior',
        _('Bone attachment behavior'),
        'Model3DBoneAttachmentBehavior'
      )
      .addParameter('number', _('X rotation offset'))
      .addParameter('number', _('Y rotation offset'))
      .addParameter('number', _('Z rotation offset'))
      .setFunctionName('setBoneAttachmentRotationOffset');

    behavior
      .addScopedCondition(
        'IsAttachedToModelBone',
        _('Is attached to a 3D model bone'),
        _(
          'Check whether a bone attachment relationship is registered, including while it is temporarily unresolved.'
        ),
        _('_PARAM0_ is attached to a 3D model bone'),
        group,
        icon,
        smallIcon
      )
      .addParameter('object', _('3D object'), '', false)
      .addParameter(
        'behavior',
        _('Bone attachment behavior'),
        'Model3DBoneAttachmentBehavior'
      )
      .setFunctionName('isAttachedToModelBone');

    behavior
      .addScopedCondition(
        'IsBoneAttachmentResolved',
        _('Bone attachment is resolved'),
        _(
          'Check whether the attachment produced a valid transform during the most recent synchronization pass.'
        ),
        _('The bone attachment of _PARAM0_ is resolved'),
        group,
        icon,
        smallIcon
      )
      .addParameter('object', _('3D object'), '', false)
      .addParameter(
        'behavior',
        _('Bone attachment behavior'),
        'Model3DBoneAttachmentBehavior'
      )
      .setFunctionName('isBoneAttachmentResolved');

    behavior
      .addStrExpression(
        'AttachedBoneName',
        _('Attached bone name'),
        _('Return the registered bone name, or an empty string.'),
        group,
        smallIcon
      )
      .addParameter('object', _('3D object'), '', false)
      .addParameter(
        'behavior',
        _('Bone attachment behavior'),
        'Model3DBoneAttachmentBehavior'
      )
      .setFunctionName('getAttachedBoneName');

    const attachmentNumberExpressions = [
      [
        'BoneAttachmentOffsetX',
        _('Bone attachment offset X'),
        'getBoneAttachmentOffsetX',
      ],
      [
        'BoneAttachmentOffsetY',
        _('Bone attachment offset Y'),
        'getBoneAttachmentOffsetY',
      ],
      [
        'BoneAttachmentOffsetZ',
        _('Bone attachment offset Z'),
        'getBoneAttachmentOffsetZ',
      ],
      [
        'BoneAttachmentRotationOffsetX',
        _('Bone attachment rotation offset X'),
        'getBoneAttachmentRotationOffsetX',
      ],
      [
        'BoneAttachmentRotationOffsetY',
        _('Bone attachment rotation offset Y'),
        'getBoneAttachmentRotationOffsetY',
      ],
      [
        'BoneAttachmentRotationOffsetZ',
        _('Bone attachment rotation offset Z'),
        'getBoneAttachmentRotationOffsetZ',
      ],
    ];
    attachmentNumberExpressions.forEach(([name, fullName, functionName]) => {
      behavior
        .addExpression(
          name,
          fullName,
          _('Return a component of the registered bone attachment offset.'),
          group,
          smallIcon
        )
        .addParameter('object', _('3D object'), '', false)
        .addParameter(
          'behavior',
          _('Bone attachment behavior'),
          'Model3DBoneAttachmentBehavior'
        )
        .setFunctionName(functionName);
    });

    return extension;
  },
  runExtensionSanityTests: function () {
    return [];
  },
};
