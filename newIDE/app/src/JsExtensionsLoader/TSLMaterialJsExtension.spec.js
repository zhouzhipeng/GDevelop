// @flow

const gd: libGDevelop = global.gd;
// $FlowFixMe[cannot-resolve-module] - Runtime extensions live outside the IDE Flow root.
const tslMaterialExtensionModule = require('../../../../Extensions/TSLMaterial/JsExtension');

describe('TSLMaterial JavaScript extension declaration', () => {
  let extension;

  beforeAll(() => {
    extension = tslMaterialExtensionModule.createExtension(
      message => message,
      gd
    );
  });

  afterAll(() => {
    extension.delete();
  });

  test('declares the Model3D-only behavior and complete stable event API', () => {
    expect(extension.getName()).toBe('TSLMaterial');
    const behavior = extension.getBehaviorMetadata('TSLMaterial::Material');
    expect(behavior.getObjectType()).toBe('Scene3D::Model3DObject');

    const actions = behavior.getAllActions();
    [
      'ApplyMaterial',
      'RemoveBinding',
      'RemoveAllBindings',
      'EnableBinding',
      'SetNumberParameter',
      'SetBooleanParameter',
      'SetColorParameter',
      'SetVector2Parameter',
      'SetVector3Parameter',
      'SetVector4Parameter',
      'SetTextureParameter',
      'ResetParameter',
    ].forEach(name => expect(actions.has(`TSLMaterial::${name}`)).toBe(true));

    const applyAction = actions.get('TSLMaterial::ApplyMaterial');
    expect(applyAction.getParametersCount()).toBe(8);
    expect(applyAction.getParameter(0).getType()).toBe('object');
    expect(applyAction.getParameter(1).getType()).toBe('behavior');
    expect(applyAction.getParameter(3).getType()).toBe('tslMaterialResource');
    expect(applyAction.getParameter(4).getType()).toBe('stringWithSelector');

    const conditions = behavior.getAllConditions();
    [
      'HasBinding',
      'IsBindingReady',
      'BindingHasError',
      'BindingMatchedSlot',
    ].forEach(name =>
      expect(conditions.has(`TSLMaterial::${name}`)).toBe(true)
    );
    expect(behavior.getAllExpressions().has('MatchedSlotCount')).toBe(true);
    expect(behavior.getAllExpressions().has('ActiveSlotCount')).toBe(true);
    expect(
      behavior.getAllStrExpressions().has('TSLMaterialLastErrorCode')
    ).toBe(true);
    expect(behavior.getAllStrExpressions().has('TSLMaterialLastError')).toBe(
      true
    );
  });

  test('declares backend condition and expression without source access', () => {
    expect(
      extension.getAllConditions().has('TSLMaterial::BackendAvailable')
    ).toBe(true);
    expect(
      extension.getAllStrExpressions().has('TSLMaterial::TSLMaterialBackend')
    ).toBe(true);
  });
});
