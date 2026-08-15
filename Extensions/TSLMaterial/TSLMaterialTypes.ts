namespace gdjs {
  export type TSLMaterialBase =
    | 'inherit'
    | 'basic'
    | 'standard'
    | 'physical'
    | 'custom';

  export type TSLMaterialParameterType =
    | 'number'
    | 'boolean'
    | 'color'
    | 'vec2'
    | 'vec3'
    | 'vec4'
    | 'texture';

  export type TSLMaterialParameterDefinition = {
    type: TSLMaterialParameterType;
    default: number | boolean | string | readonly number[];
    label?: string;
    min?: number;
    max?: number;
    step?: number;
    colorSpace?: 'srgb' | 'linear' | 'normal';
  };

  export type TSLMaterialParameterSchema = {
    [name: string]: TSLMaterialParameterDefinition;
  };

  export type TSLMaterialDefinition = {
    apiVersion: 1;
    authoringApiVersion: string;
    compilerVersion: string;
    threeRevision: string;
    portableProfileVersion: string;
    sourceHash: string;
    base: TSLMaterialBase;
    label: string;
    description: string;
    parameterSchema: TSLMaterialParameterSchema;
    importedSymbols: readonly string[];
    build: (context: gdjs.TSLMaterialBuildContext) => void;
  };

  export type TSLMaterialBundleReceipt = {
    apiVersion: 1;
    authoringApiVersion: string;
    compilerVersion: string;
    threeRevision: string;
    portableProfileVersion: string;
    target: string;
    definitionCount: number;
    definitionsSha256: string;
    receipts: readonly Object[];
  };

  /** Receipt written by the generated registry bundle currently being loaded. */
  export let __tslMaterialBundleReceipt:
    | gdjs.TSLMaterialBundleReceipt
    | undefined;

  export type TSLMaterialBuildContext = {
    material: any;
    inputs: {
      baseColor: any;
      opacity: any;
      emissive: any;
      roughness: any;
      metalness: any;
      normal: any;
    };
    parameters: { [name: string]: any };
    source: {
      name: string;
      kind: 'basic' | 'standard' | 'physical' | 'unsupported';
      hasColorMap: boolean;
      hasNormalMap: boolean;
      hasSkinning: boolean;
      hasMorphTargets: boolean;
    };
  };

  export type TSLMaterialSelectorMode =
    | 'All'
    | 'MeshName'
    | 'MaterialName'
    | 'MeshAndMaterialName';

  export type TSLMaterialSelector = {
    mode: TSLMaterialSelectorMode;
    meshName: string;
    materialName: string;
  };

  export type TSLMaterialBindingState =
    | 'Disabled'
    | 'PendingDefinition'
    | 'PendingHost'
    | 'PendingResources'
    | 'Building'
    | 'Ready'
    | 'NoMatch'
    | 'Shadowed'
    | 'Unsupported'
    | 'Error';

  export type TSLMaterialBindingOptions = {
    bindingName: string;
    materialResourceName: string;
    selector: TSLMaterialSelector;
    priority: integer;
    enabled: boolean;
  };

  export type TSLMaterialDiagnostic = {
    code: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    materialResourceName?: string;
    bindingName?: string;
    objectName?: string;
    sourceHash?: string;
    generation?: number;
    selector?: TSLMaterialSelector;
    sceneName?: string;
    threeRevision?: string;
    backend?: string;
    capabilityFlags?: { [name: string]: boolean };
    matchedMeshNames?: readonly string[];
    matchedMaterialNames?: readonly string[];
    exceptionName?: string;
  };

  export interface TSLMaterialBehaviorData extends BehaviorData {
    name: string;
    type: 'TSLMaterial::Material';
    Material: string;
    BindingName: string;
    SelectorMode: TSLMaterialSelectorMode;
    MeshName: string;
    MaterialName: string;
    Priority: integer;
    Enabled: boolean;
    Fallback: 'KeepOriginal';
  }
}
