// @flow

const gd: libGDevelop = global.gd;
// $FlowFixMe[cannot-resolve-module] - Runtime extensions live outside the IDE Flow root.
const attachmentExtensionModule = require('../../../../Extensions/Model3DBoneAttachment/JsExtension');
// $FlowFixMe[cannot-resolve-module] - Runtime extensions live outside the IDE Flow root.
const scene3DExtensionModule = require('../../../../Extensions/3D/JsExtension');

describe('Model3DBoneAttachment JavaScript extension declaration', () => {
  let extension;
  let scene3DExtension;

  beforeAll(() => {
    extension = attachmentExtensionModule.createExtension(
      message => message,
      gd
    );
    scene3DExtension = scene3DExtensionModule.createExtension(
      message => message,
      gd
    );
  });

  afterAll(() => {
    extension.delete();
    scene3DExtension.delete();
  });

  test('declares an optional behavior requiring the base 3D capability', () => {
    expect(extension.getName()).toBe('Model3DBoneAttachment');
    const behavior = extension.getBehaviorMetadata(
      'Model3DBoneAttachment::Model3DBoneAttachmentBehavior'
    );
    expect(behavior.getObjectType()).toBe('');
    expect(behavior.getRequiredBehaviorTypes().toJSArray()).toEqual([
      'Scene3D::Base3DBehavior',
    ]);
  });

  test('owns the attachment event API outside Base3D', () => {
    const behavior = extension.getBehaviorMetadata(
      'Model3DBoneAttachment::Model3DBoneAttachmentBehavior'
    );
    const attachActionName =
      'Model3DBoneAttachment::Model3DBoneAttachmentBehavior::AttachToModelBone';
    expect(behavior.getAllActions().has(attachActionName)).toBe(true);
    expect(
      behavior
        .getAllConditions()
        .has(
          'Model3DBoneAttachment::Model3DBoneAttachmentBehavior::IsBoneAttachmentResolved'
        )
    ).toBe(true);
    expect(behavior.getAllStrExpressions().has('AttachedBoneName')).toBe(true);
    expect(behavior.getAllExpressions().has('BoneAttachmentOffsetX')).toBe(
      true
    );

    const attachAction = behavior.getAllActions().get(attachActionName);
    expect(attachAction.getParametersCount()).toBe(4);
    expect(attachAction.getParameter(0).getType()).toBe('object');
    expect(attachAction.getParameter(1).getType()).toBe('behavior');
    expect(attachAction.getParameter(2).getType()).toBe('objectPtr');
    expect(attachAction.getParameter(2).getExtraInfo()).toBe(
      'Scene3D::Model3DObject'
    );
    expect(attachAction.getParameter(3).getType()).toBe('model3DBoneName');

    const base3D = scene3DExtension.getBehaviorMetadata(
      'Scene3D::Base3DBehavior'
    );
    expect(
      base3D.getAllActions().has('Scene3D::Base3DBehavior::AttachToModelBone')
    ).toBe(false);
  });
});
