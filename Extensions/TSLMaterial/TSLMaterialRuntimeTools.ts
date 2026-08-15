namespace gdjs {
  const getSystem = (object: gdjs.RuntimeObject): gdjs.TSLMaterialSystem =>
    gdjs.TSLMaterialSystem.getOrCreateForScene(object.getRuntimeScene());

  export namespace TSLMaterialRuntimeTools {
    export const applyMaterial = (
      object: gdjs.RuntimeObject,
      bindingName: string,
      materialResourceName: string,
      selectorMode: string,
      meshName: string,
      materialName: string,
      priority: integer
    ): void => {
      // Keep invalid dynamic event values intact so TSLMaterialSystem can
      // reject them. Coercing an unknown selector to All would unexpectedly
      // broaden a binding to every material slot.
      const mode = selectorMode as gdjs.TSLMaterialSelectorMode;
      getSystem(object).applyBinding(object, {
        bindingName,
        materialResourceName,
        selector: { mode, meshName, materialName },
        priority,
        enabled: true,
      });
    };

    export const removeBinding = (
      object: gdjs.RuntimeObject,
      bindingName: string
    ): void => getSystem(object).removeBinding(object, bindingName);

    export const removeAllBindings = (object: gdjs.RuntimeObject): void =>
      getSystem(object).removeAllBindings(object);

    export const enableBinding = (
      object: gdjs.RuntimeObject,
      bindingName: string,
      enabled: boolean
    ): void => getSystem(object).enableBinding(object, bindingName, enabled);

    export const setNumberParameter = (
      object: gdjs.RuntimeObject,
      bindingName: string,
      parameterName: string,
      value: float
    ): void => {
      getSystem(object).setParameter(
        object,
        bindingName,
        parameterName,
        'number',
        value
      );
    };

    export const setBooleanParameter = (
      object: gdjs.RuntimeObject,
      bindingName: string,
      parameterName: string,
      value: boolean
    ): void => {
      getSystem(object).setParameter(
        object,
        bindingName,
        parameterName,
        'boolean',
        value
      );
    };

    export const setColorParameter = (
      object: gdjs.RuntimeObject,
      bindingName: string,
      parameterName: string,
      value: string
    ): void => {
      getSystem(object).setParameter(
        object,
        bindingName,
        parameterName,
        'color',
        value
      );
    };

    export const setVector2Parameter = (
      object: gdjs.RuntimeObject,
      bindingName: string,
      parameterName: string,
      x: float,
      y: float
    ): void => {
      getSystem(object).setParameter(
        object,
        bindingName,
        parameterName,
        'vec2',
        [x, y]
      );
    };

    export const setVector3Parameter = (
      object: gdjs.RuntimeObject,
      bindingName: string,
      parameterName: string,
      x: float,
      y: float,
      z: float
    ): void => {
      getSystem(object).setParameter(
        object,
        bindingName,
        parameterName,
        'vec3',
        [x, y, z]
      );
    };

    export const setVector4Parameter = (
      object: gdjs.RuntimeObject,
      bindingName: string,
      parameterName: string,
      x: float,
      y: float,
      z: float,
      w: float
    ): void => {
      getSystem(object).setParameter(
        object,
        bindingName,
        parameterName,
        'vec4',
        [x, y, z, w]
      );
    };

    export const setTextureParameter = (
      object: gdjs.RuntimeObject,
      bindingName: string,
      parameterName: string,
      imageResourceName: string
    ): void => {
      getSystem(object).setParameter(
        object,
        bindingName,
        parameterName,
        'texture',
        imageResourceName
      );
    };

    export const resetParameter = (
      object: gdjs.RuntimeObject,
      bindingName: string,
      parameterName: string
    ): void => {
      getSystem(object).resetParameter(object, bindingName, parameterName);
    };

    export const hasBinding = (
      object: gdjs.RuntimeObject,
      bindingName: string
    ): boolean => getSystem(object).hasBinding(object, bindingName);

    export const isBindingReady = (
      object: gdjs.RuntimeObject,
      bindingName: string
    ): boolean => getSystem(object).isBindingReady(object, bindingName);

    export const bindingHasError = (
      object: gdjs.RuntimeObject,
      bindingName: string
    ): boolean => getSystem(object).bindingHasError(object, bindingName);

    export const bindingMatchedSlot = (
      object: gdjs.RuntimeObject,
      bindingName: string
    ): boolean => getSystem(object).bindingMatchedSlot(object, bindingName);

    export const isBackendAvailable = (
      runtimeScene: gdjs.RuntimeScene
    ): boolean => gdjs.isTSLMaterialBackendAvailable(runtimeScene);

    export const getMatchedSlotCount = (
      object: gdjs.RuntimeObject,
      bindingName: string
    ): integer => getSystem(object).getMatchedSlotCount(object, bindingName);

    export const getActiveSlotCount = (
      object: gdjs.RuntimeObject,
      bindingName: string
    ): integer => getSystem(object).getActiveSlotCount(object, bindingName);

    export const getLastErrorCode = (
      object: gdjs.RuntimeObject,
      bindingName: string
    ): string => getSystem(object).getLastErrorCode(object, bindingName);

    export const getLastError = (
      object: gdjs.RuntimeObject,
      bindingName: string
    ): string => getSystem(object).getLastError(object, bindingName);

    export const getBackend = (): string => {
      const identity = (THREE as any).GDEVELOP_TSL_RUNTIME;
      return identity && identity.backend === 'webgl2-node-compat'
        ? identity.backend
        : 'unavailable';
    };
  }
}
