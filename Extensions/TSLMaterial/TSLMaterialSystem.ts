namespace gdjs {
  const tslMaterialLogger = new gdjs.Logger('TSL materials');
  const maximumBindingsPerObject = 64;
  const maximumSlotsPerBinding = 1024;
  // This is a derived traversal/allocation guard, not a substitute for the
  // normative per-binding matched-slot budget below.
  const maximumCapturedSlotsPerObject =
    maximumBindingsPerObject * maximumSlotsPerBinding;

  type MaterialHostObject = gdjs.RuntimeObject & gdjs.ThreeMaterialHost;

  type MaterialArraySnapshot = {
    mesh: THREE.Mesh;
    originalArray: THREE.Material[];
    ownedArray: THREE.Material[] | null;
    generation: number;
    externallyModified: boolean;
  };

  type MaterialSlotSnapshot = {
    key: string;
    mesh: THREE.Mesh;
    slotIndex: number | null;
    originalMaterial: THREE.Material;
    materialArraySnapshot: MaterialArraySnapshot | null;
    generation: number;
    externallyModified: boolean;
  };

  type ParameterOverride = {
    type: gdjs.TSLMaterialParameterType;
    value: any;
  };

  type PendingTextureOverride = {
    value: string;
    reset: boolean;
  };

  type TextureLoadRecord = {
    status: 'pending' | 'ready' | 'error';
    message: string;
  };

  type RuntimeBinding = {
    bindingName: string;
    materialResourceName: string;
    selector: gdjs.TSLMaterialSelector;
    priority: integer;
    sequence: number;
    enabled: boolean;
    state: gdjs.TSLMaterialBindingState;
    matchedSlotCount: number;
    activeSlotCount: number;
    lastErrorCode: string;
    lastErrorMessage: string;
    parameterOverrides: Map<string, ParameterOverride>;
    pendingTextureOverrides: Map<string, PendingTextureOverride>;
  };

  type InstalledSlot = {
    snapshot: MaterialSlotSnapshot;
    bindingName: string;
    materialResourceName: string;
    definitionHash: string;
    material: THREE.Material;
    parameterNodes: Map<string, any>;
  };

  type HostRecord = {
    object: MaterialHostObject;
    root: THREE.Object3D | null;
    generation: number;
    capturedGeneration: number;
    slots: MaterialSlotSnapshot[];
    slotLimitExceeded: boolean;
    bindings: Map<string, RuntimeBinding>;
    installedSlots: Map<string, InstalledSlot>;
    nextSequence: number;
    dirty: boolean;
    forceRebuild: boolean;
    sceneVariantKey: string;
    removeRootListener: () => void;
  };

  type OwnedMaterialBuildResult = {
    material: THREE.Material;
    parameterNodes: Map<string, any>;
  };

  const getMaterialAtSlot = (
    snapshot: MaterialSlotSnapshot
  ): THREE.Material | null => {
    const material = snapshot.mesh.material;
    if (snapshot.slotIndex === null) {
      return Array.isArray(material) ? null : material;
    }
    return Array.isArray(material)
      ? material[snapshot.slotIndex] || null
      : null;
  };

  const setMaterialAtSlot = (
    snapshot: MaterialSlotSnapshot,
    material: THREE.Material
  ): boolean => {
    if (snapshot.slotIndex === null) {
      if (Array.isArray(snapshot.mesh.material)) return false;
      snapshot.mesh.material = material;
      return true;
    }
    const materialArraySnapshot = snapshot.materialArraySnapshot;
    let materialArray = snapshot.mesh.material;
    if (!materialArraySnapshot || !Array.isArray(materialArray)) return false;
    if (materialArray === materialArraySnapshot.originalArray) {
      // SkeletonUtils.clone shares the source mesh's material-array object.
      // Clone only the container before the first write so cached GLB state and
      // other instances keep their exact array and material references.
      materialArray = materialArray.slice();
      materialArraySnapshot.ownedArray = materialArray;
      snapshot.mesh.material = materialArray;
    } else if (materialArray !== materialArraySnapshot.ownedArray) {
      materialArraySnapshot.externallyModified = true;
      return false;
    }
    materialArray[snapshot.slotIndex] = material;
    return true;
  };

  const getSceneVariantKey = (
    runtimeScene: gdjs.RuntimeScene,
    object: MaterialHostObject
  ): string => {
    const layer = runtimeScene.getLayer(object.getLayer());
    const scene = layer && (layer.get3DRendererObject() as any);
    if (!scene) return 'no-three-scene';
    const fog = scene.fog as any;
    const environment = scene.environment as any;
    const environmentRotation = scene.environmentRotation as any;
    return JSON.stringify({
      fog: fog
        ? {
            type: fog.type || '',
            color:
              fog.color && typeof fog.color.getHexString === 'function'
                ? fog.color.getHexString()
                : '',
            near: fog.near,
            far: fog.far,
            density: fog.density,
          }
        : null,
      environment: environment
        ? {
            uuid: environment.uuid || '',
            version: environment.version || 0,
            mapping: environment.mapping,
            colorSpace: environment.colorSpace || '',
          }
        : null,
      environmentIntensity: scene.environmentIntensity,
      environmentRotation: environmentRotation
        ? [
            environmentRotation.x,
            environmentRotation.y,
            environmentRotation.z,
            environmentRotation.order,
          ]
        : null,
    });
  };

  const getSourceMaterialKind = (
    source: THREE.Material
  ): 'basic' | 'standard' | 'physical' | 'unsupported' => {
    const material = source as any;
    if (material.isMeshPhysicalMaterial) return 'physical';
    if (material.isMeshStandardMaterial) return 'standard';
    if (material.isMeshBasicMaterial) return 'basic';
    return 'unsupported';
  };

  const copyIfPresent = (source: any, target: any, property: string): void => {
    if (source[property] === undefined || !(property in target)) return;
    const sourceValue = source[property];
    const targetValue = target[property];
    if (targetValue && sourceValue && typeof targetValue.copy === 'function') {
      targetValue.copy(sourceValue);
    } else if (Array.isArray(sourceValue)) {
      target[property] = sourceValue.slice();
    } else {
      target[property] = sourceValue;
    }
  };

  const copyCompatibleMaterialProperties = (
    source: THREE.Material,
    target: THREE.Material
  ): void => {
    const sourceMaterial = source as any;
    const targetMaterial = target as any;
    [
      'name',
      'opacity',
      'transparent',
      'alphaTest',
      'alphaHash',
      'side',
      'shadowSide',
      'depthTest',
      'depthWrite',
      'depthFunc',
      'colorWrite',
      'blending',
      'blendSrc',
      'blendDst',
      'blendEquation',
      'blendSrcAlpha',
      'blendDstAlpha',
      'blendEquationAlpha',
      'blendColor',
      'blendAlpha',
      'premultipliedAlpha',
      'alphaToCoverage',
      'dithering',
      'toneMapped',
      'visible',
      'vertexColors',
      'fog',
      'polygonOffset',
      'polygonOffsetFactor',
      'polygonOffsetUnits',
      'clippingPlanes',
      'clipIntersection',
      'clipShadows',
      'forceSinglePass',
      'stencilWrite',
      'stencilWriteMask',
      'stencilFunc',
      'stencilRef',
      'stencilFuncMask',
      'stencilFail',
      'stencilZFail',
      'stencilZPass',
      'map',
      'alphaMap',
      'aoMap',
      'aoMapIntensity',
      'lightMap',
      'lightMapIntensity',
      'emissiveMap',
      'emissiveIntensity',
      'bumpMap',
      'bumpScale',
      'normalMap',
      'normalMapType',
      'normalScale',
      'displacementMap',
      'displacementScale',
      'displacementBias',
      'roughnessMap',
      'metalnessMap',
      'envMap',
      'envMapIntensity',
      'envMapRotation',
      'wireframe',
      'wireframeLinewidth',
      'flatShading',
      'color',
      'emissive',
      'roughness',
      'metalness',
      'clearcoat',
      'clearcoatMap',
      'clearcoatRoughness',
      'clearcoatRoughnessMap',
      'clearcoatNormalMap',
      'clearcoatNormalScale',
      'ior',
      'reflectivity',
      'iridescence',
      'iridescenceIOR',
      'iridescenceThicknessRange',
      'iridescenceMap',
      'iridescenceThicknessMap',
      'sheen',
      'sheenColor',
      'sheenColorMap',
      'sheenRoughness',
      'sheenRoughnessMap',
      'specularIntensity',
      'specularIntensityMap',
      'specularColor',
      'specularColorMap',
      'anisotropy',
      'anisotropyRotation',
      'anisotropyMap',
    ].forEach((property) =>
      copyIfPresent(sourceMaterial, targetMaterial, property)
    );
    targetMaterial.userData = { ...(sourceMaterial.userData || {}) };
    targetMaterial.needsUpdate = true;
  };

  const getRequestedMaterialBase = (
    sourceKind: 'basic' | 'standard' | 'physical' | 'unsupported',
    requestedBase: gdjs.TSLMaterialBase
  ): 'basic' | 'standard' | 'physical' | 'custom' | 'unsupported' => {
    if (requestedBase === 'inherit') return sourceKind;
    return requestedBase;
  };

  const createNodeMaterial = (
    source: THREE.Material,
    requestedBase: gdjs.TSLMaterialBase
  ): THREE.Material | null => {
    const three = THREE as any;
    const sourceKind = getSourceMaterialKind(source);
    const base = getRequestedMaterialBase(sourceKind, requestedBase);
    if (
      sourceKind === 'physical' &&
      ((source as any).transmission > 0 || !!(source as any).transmissionMap)
    ) {
      const error: any = new Error(
        'Physical transmission and refraction are unavailable in the version-one portable material profile.'
      );
      error.code = 'TSL-RUN-004';
      throw error;
    }
    if (sourceKind === 'unsupported') {
      return null;
    }
    let material: THREE.Material | null = null;
    if (base === 'basic') material = new three.MeshBasicNodeMaterial();
    else if (base === 'standard')
      material = new three.MeshStandardNodeMaterial();
    else if (base === 'physical')
      material = new three.MeshPhysicalNodeMaterial();
    else if (base === 'custom') material = new three.NodeMaterial();
    if (!material) return null;
    copyCompatibleMaterialProperties(source, material);
    return material;
  };

  const getColorFromValue = (value: any): THREE.Color | null => {
    if (value instanceof THREE.Color) return value.clone();
    if (typeof value !== 'string') return null;
    const semicolonColor = /^(\d{1,3});(\d{1,3});(\d{1,3})$/.exec(value);
    if (semicolonColor) {
      const red = Number(semicolonColor[1]);
      const green = Number(semicolonColor[2]);
      const blue = Number(semicolonColor[3]);
      if (red > 255 || green > 255 || blue > 255) return null;
      return new THREE.Color(`rgb(${red}, ${green}, ${blue})`);
    }
    // Match the authoring contract. Eight-digit defaults are accepted for
    // round-tripping, while opacity remains an independent material channel.
    if (!/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value)) return null;
    return new THREE.Color(value.slice(0, 7));
  };

  const createInheritedInputs = (
    _source: THREE.Material,
    tsl: any
  ): gdjs.TSLMaterialBuildContext['inputs'] => {
    // These accessors read the compatible public properties copied to the
    // owned node material. They preserve maps, channel selection, transforms,
    // intensity/scale and Three's exact r185 material semantics without
    // exposing the mutable source material to the authored build function.
    return {
      baseColor: tsl.materialColor,
      opacity: tsl.materialOpacity,
      emissive: tsl.materialEmissive,
      roughness: tsl.materialRoughness,
      metalness: tsl.materialMetalness,
      normal: tsl.materialNormal,
    };
  };

  const createMaterialFacade = (material: THREE.Material): any =>
    new Proxy(material as any, {
      get(target, property) {
        return target[property];
      },
      set(target, property, value) {
        const name = String(property);
        if (
          ![
            'colorNode',
            'opacityNode',
            'emissiveNode',
            'roughnessNode',
            'metalnessNode',
            'normalNode',
            'positionNode',
            'fragmentNode',
            'outputNode',
            'transparent',
            'depthWrite',
            'depthTest',
            'side',
            'alphaTest',
          ].includes(name)
        ) {
          throw new Error(`Material field "${name}" is not writable.`);
        }
        if (name.endsWith('Node') && value !== null && !value?.isNode) {
          throw new Error(`Material field "${name}" requires a TSL node.`);
        }
        if (name === 'side') {
          if (value === 'front') value = THREE.FrontSide;
          else if (value === 'back') value = THREE.BackSide;
          else if (value === 'double') value = THREE.DoubleSide;
          else throw new Error('Material side must be front, back, or double.');
        }
        if (
          ['transparent', 'depthWrite', 'depthTest'].includes(name) &&
          typeof value !== 'boolean'
        ) {
          throw new Error(`Material field "${name}" requires a boolean.`);
        }
        if (
          name === 'alphaTest' &&
          (typeof value !== 'number' || !Number.isFinite(value))
        ) {
          throw new Error('Material alphaTest requires a finite number.');
        }
        target[property] = value;
        target.needsUpdate = true;
        return true;
      },
    });

  const resolveTexture = (
    runtimeScene: gdjs.RuntimeScene,
    resourceName: string
  ): THREE.Texture => {
    const runtimeGame = runtimeScene.getGame();
    const resource = resourceName
      ? runtimeGame.getResourceLoader().getResource(resourceName)
      : null;
    if (!resource || resource.kind !== 'image') {
      const error: any = new Error(
        `Texture "${resourceName}" is missing or is not an image resource.`
      );
      error.code = 'TSL-RUN-005';
      throw error;
    }
    const imageManager = runtimeGame.getImageManager() as any;
    if (
      typeof imageManager.isResourceLoaded === 'function' &&
      !imageManager.isResourceLoaded(resourceName)
    ) {
      const error: any = new Error(`Texture "${resourceName}" is not ready.`);
      error.code = 'TSL-RUN-005';
      throw error;
    }
    try {
      const texture = imageManager.getThreeTexture(resourceName);
      if (!texture || !texture.isTexture) {
        throw new Error('The image manager returned no usable Three texture.');
      }
      return texture;
    } catch (cause) {
      const error: any = new Error(
        `Texture "${String(resourceName).slice(
          0,
          256
        )}" could not be resolved by the image manager.`
      );
      error.code = 'TSL-RUN-005';
      throw error;
    }
  };

  const createParameterNode = ({
    runtimeScene,
    definition,
    override,
    tsl,
  }: {
    runtimeScene: gdjs.RuntimeScene;
    definition: gdjs.TSLMaterialParameterDefinition;
    override: ParameterOverride | null;
    tsl: any;
  }): any => {
    const value = override ? override.value : definition.default;
    switch (definition.type) {
      case 'number':
        return tsl.uniform(value);
      case 'boolean':
        return tsl.uniform(value);
      case 'color': {
        const color = getColorFromValue(value);
        if (!color) {
          const error: any = new Error('A color parameter is invalid.');
          error.code = 'TSL-RUN-007';
          throw error;
        }
        return tsl.uniform(color);
      }
      case 'vec2':
        return tsl.uniform(new THREE.Vector2(value[0], value[1]));
      case 'vec3':
        return tsl.uniform(new THREE.Vector3(value[0], value[1], value[2]));
      case 'vec4':
        return tsl.uniform(
          new THREE.Vector4(value[0], value[1], value[2], value[3])
        );
      case 'texture':
        return tsl.texture(resolveTexture(runtimeScene, value));
      default:
        throw new Error(`Unsupported parameter type "${definition.type}".`);
    }
  };

  const updateParameterNode = (
    node: any,
    type: gdjs.TSLMaterialParameterType,
    value: any,
    runtimeScene: gdjs.RuntimeScene
  ): boolean => {
    if (!node) return false;
    if (type === 'number' || type === 'boolean') {
      node.value = value;
    } else if (type === 'color') {
      const color = getColorFromValue(value);
      if (!color) return false;
      if (node.value && typeof node.value.copy === 'function') {
        node.value.copy(color);
      } else node.value = color;
    } else if (type === 'vec2') {
      if (!node.value || typeof node.value.set !== 'function') return false;
      node.value.set(value[0], value[1]);
    } else if (type === 'vec3') {
      if (!node.value || typeof node.value.set !== 'function') return false;
      node.value.set(value[0], value[1], value[2]);
    } else if (type === 'vec4') {
      if (!node.value || typeof node.value.set !== 'function') return false;
      node.value.set(value[0], value[1], value[2], value[3]);
    } else if (type === 'texture') {
      node.value = resolveTexture(runtimeScene, value);
    } else return false;
    node.needsUpdate = true;
    return true;
  };

  /** Scene-owned material binding and ownership system. */
  export class TSLMaterialSystem {
    private static _systemsByScene = new WeakMap<
      gdjs.RuntimeScene,
      gdjs.TSLMaterialSystem
    >();

    private _runtimeScene: gdjs.RuntimeScene;
    private _records = new Map<MaterialHostObject, HostRecord>();
    private _dirtyRecords = new Set<HostRecord>();
    private _diagnostics: gdjs.TSLMaterialDiagnostic[] = [];
    private _diagnosticKeys = new Set<string>();
    private _textureLoads = new Map<string, TextureLoadRecord>();
    private _removeRegistryListener: () => void;
    private _renderer: any = null;
    private _removeRendererLifecycleListener: () => void = () => {};
    private _rendererContextLost: boolean = false;
    private _shaderFailurePending: boolean = false;
    private _isDisposed: boolean = false;

    constructor(runtimeScene: gdjs.RuntimeScene) {
      this._runtimeScene = runtimeScene;
      this._removeRegistryListener =
        gdjs.__tslMaterialRegistry.addDefinitionChangedListener(
          (resourceName) => {
            for (const record of this._records.values()) {
              for (const binding of record.bindings.values()) {
                if (binding.materialResourceName === resourceName) {
                  this._markRecordDirty(record);
                }
              }
            }
          }
        );
      this._syncRendererLifecycleListener();
    }

    static getForScene(
      runtimeScene: gdjs.RuntimeScene
    ): gdjs.TSLMaterialSystem | null {
      return this._systemsByScene.get(runtimeScene) || null;
    }

    static getOrCreateForScene(
      runtimeScene: gdjs.RuntimeScene
    ): gdjs.TSLMaterialSystem {
      let system = this._systemsByScene.get(runtimeScene);
      if (!system) {
        system = new gdjs.TSLMaterialSystem(runtimeScene);
        this._systemsByScene.set(runtimeScene, system);
      }
      return system;
    }

    static flushScene(runtimeScene: gdjs.RuntimeScene): void {
      gdjs.TSLMaterialSystem._systemsByScene.get(runtimeScene)?.flush();
    }

    static unloadScene(runtimeScene: gdjs.RuntimeScene): void {
      const system = gdjs.TSLMaterialSystem._systemsByScene.get(runtimeScene);
      if (!system) return;
      system.dispose();
      gdjs.TSLMaterialSystem._systemsByScene.delete(runtimeScene);
    }

    /** Explicitly invalidates materials after fog/environment scene changes. */
    static invalidateSceneInputs(
      runtimeScene: gdjs.RuntimeScene,
      layerName?: string
    ): void {
      const system = gdjs.TSLMaterialSystem._systemsByScene.get(runtimeScene);
      if (!system) return;
      for (const record of system._records.values()) {
        if (layerName !== undefined && record.object.getLayer() !== layerName) {
          continue;
        }
        system._markRecordDirty(record, true);
      }
    }

    applyBinding(
      object: gdjs.RuntimeObject,
      options: gdjs.TSLMaterialBindingOptions
    ): boolean {
      if (!this._isMaterialHost(object)) {
        this._reportDiagnostic({
          code: 'TSL-RUN-004',
          severity: 'error',
          message:
            'The object does not implement the 3D material-host contract.',
          objectName: object.getName(),
          bindingName: options.bindingName,
        });
        return false;
      }
      if (!options.bindingName || !options.materialResourceName) return false;
      const selector = options.selector;
      const selectorIsValid =
        !!selector &&
        (selector.mode === 'All' ||
          (selector.mode === 'MeshName' && !!selector.meshName) ||
          (selector.mode === 'MaterialName' && !!selector.materialName) ||
          (selector.mode === 'MeshAndMaterialName' &&
            !!selector.meshName &&
            !!selector.materialName));
      if (!selectorIsValid) {
        this._reportDiagnostic({
          code: 'TSL-RUN-003',
          severity: 'warning',
          message:
            'The material selector is invalid. Non-All selectors require their exact mesh/material names.',
          objectName: object.getName(),
          bindingName: options.bindingName,
          materialResourceName: options.materialResourceName,
        });
        return false;
      }
      const normalizedSelector: gdjs.TSLMaterialSelector =
        selector.mode === 'All'
          ? { mode: 'All', meshName: '', materialName: '' }
          : { ...selector };
      const normalizedPriority = Number.isFinite(options.priority)
        ? Math.trunc(options.priority)
        : 0;
      const record = this._getOrCreateRecord(object);
      const existing = record.bindings.get(options.bindingName);
      if (!existing && record.bindings.size >= maximumBindingsPerObject) {
        this._reportDiagnostic({
          code: 'TSL-LIMIT-001',
          severity: 'error',
          message: `An object cannot have more than ${maximumBindingsPerObject} TSL material bindings.`,
          objectName: object.getName(),
          bindingName: options.bindingName,
        });
        return false;
      }
      if (existing) {
        const materialResourceChanged =
          existing.materialResourceName !== options.materialResourceName;
        existing.materialResourceName = options.materialResourceName;
        existing.selector = normalizedSelector;
        existing.priority = normalizedPriority;
        existing.enabled = options.enabled;
        existing.lastErrorCode = '';
        existing.lastErrorMessage = '';
        if (materialResourceChanged) {
          existing.parameterOverrides.clear();
          existing.pendingTextureOverrides.clear();
        }
      } else {
        record.bindings.set(options.bindingName, {
          bindingName: options.bindingName,
          materialResourceName: options.materialResourceName,
          selector: normalizedSelector,
          priority: normalizedPriority,
          sequence: record.nextSequence++,
          enabled: options.enabled,
          state: options.enabled ? 'PendingHost' : 'Disabled',
          matchedSlotCount: 0,
          activeSlotCount: 0,
          lastErrorCode: '',
          lastErrorMessage: '',
          parameterOverrides: new Map<string, ParameterOverride>(),
          pendingTextureOverrides: new Map<string, PendingTextureOverride>(),
        });
      }
      this._markRecordDirty(record);
      return true;
    }

    removeBinding(object: gdjs.RuntimeObject, bindingName: string): void {
      const record = this._getRecord(object);
      if (!record || !record.bindings.delete(bindingName)) return;
      this._markRecordDirty(record);
    }

    removeAllBindings(object: gdjs.RuntimeObject): void {
      const record = this._getRecord(object);
      if (!record) return;
      record.bindings.clear();
      this._markRecordDirty(record);
      this._dirtyRecords.delete(record);
      this._rebuildRecord(record);
    }

    enableBinding(
      object: gdjs.RuntimeObject,
      bindingName: string,
      enabled: boolean
    ): void {
      const binding = this._getRecord(object)?.bindings.get(bindingName);
      if (!binding || binding.enabled === enabled) return;
      binding.enabled = enabled;
      const record = this._getRecord(object)!;
      this._markRecordDirty(record);
    }

    setParameter(
      object: gdjs.RuntimeObject,
      bindingName: string,
      parameterName: string,
      type: gdjs.TSLMaterialParameterType,
      value: any
    ): boolean {
      const record = this._getRecord(object);
      const binding = record?.bindings.get(bindingName);
      if (!record || !binding) return false;
      const definition = gdjs.__tslMaterialRegistry.get(
        binding.materialResourceName
      );
      const parameterDefinition = definition?.parameterSchema[parameterName];
      if (!parameterDefinition || parameterDefinition.type !== type) {
        return this._setBindingError(
          record,
          binding,
          'TSL-RUN-007',
          `Parameter "${parameterName}" is missing or is not ${type}.`,
          false,
          'warning'
        );
      }
      const normalizedValue = this._normalizeParameterValue(
        parameterDefinition,
        value
      );
      if (normalizedValue === undefined) {
        return this._setBindingError(
          record,
          binding,
          'TSL-RUN-007',
          `Value for parameter "${parameterName}" is invalid.`,
          false,
          'warning'
        );
      }
      if (type === 'texture') {
        const loadRecord = this._getTextureLoadRecord(normalizedValue);
        if (loadRecord.status === 'error') {
          binding.pendingTextureOverrides.delete(parameterName);
          return this._setBindingError(
            record,
            binding,
            'TSL-RUN-005',
            loadRecord.message,
            false
          );
        }
        if (loadRecord.status === 'pending') {
          binding.pendingTextureOverrides.set(parameterName, {
            value: normalizedValue,
            reset: false,
          });
          binding.lastErrorCode = '';
          binding.lastErrorMessage = '';
          binding.state = binding.enabled ? 'PendingResources' : 'Disabled';
          return true;
        }
        binding.pendingTextureOverrides.delete(parameterName);
      }
      const previousOverride =
        binding.parameterOverrides.get(parameterName) || null;
      const previousValue = previousOverride
        ? previousOverride.value
        : parameterDefinition.default;
      const restorePreviousValue = (): void => {
        for (const installed of record.installedSlots.values()) {
          if (installed.bindingName !== bindingName) continue;
          try {
            updateParameterNode(
              installed.parameterNodes.get(parameterName),
              type,
              previousValue,
              this._runtimeScene
            );
          } catch (error) {
            // The existing node still owns its last usable value when a
            // borrowed resource disappeared during rollback.
          }
        }
      };
      let updated = true;
      try {
        if (type === 'texture') {
          // Resolve before mutating any per-slot node so a missing borrowed
          // texture cannot leave a partially updated binding.
          resolveTexture(this._runtimeScene, normalizedValue);
        }
        for (const installed of record.installedSlots.values()) {
          if (installed.bindingName !== bindingName) continue;
          updated =
            updateParameterNode(
              installed.parameterNodes.get(parameterName),
              type,
              normalizedValue,
              this._runtimeScene
            ) && updated;
        }
      } catch (error) {
        restorePreviousValue();
        const code =
          error && (error as any).code === 'TSL-RUN-005'
            ? 'TSL-RUN-005'
            : 'TSL-RUN-007';
        return this._setBindingError(
          record,
          binding,
          code,
          error && (error as Error).message
            ? (error as Error).message
            : `Unable to update parameter "${parameterName}".`,
          false,
          code === 'TSL-RUN-007' ? 'warning' : 'error'
        );
      }
      if (!updated) {
        restorePreviousValue();
        return this._setBindingError(
          record,
          binding,
          'TSL-RUN-007',
          `Unable to update parameter "${parameterName}".`,
          false,
          'warning'
        );
      }
      binding.parameterOverrides.set(parameterName, {
        type,
        value: normalizedValue,
      });
      binding.pendingTextureOverrides.delete(parameterName);
      binding.lastErrorCode = '';
      binding.lastErrorMessage = '';
      if (binding.activeSlotCount > 0) binding.state = 'Ready';
      return true;
    }

    resetParameter(
      object: gdjs.RuntimeObject,
      bindingName: string,
      parameterName: string
    ): boolean {
      const record = this._getRecord(object);
      const binding = record?.bindings.get(bindingName);
      if (!record || !binding) return false;
      const definition = gdjs.__tslMaterialRegistry.get(
        binding.materialResourceName
      );
      const parameterDefinition = definition?.parameterSchema[parameterName];
      if (!parameterDefinition) {
        return this._setBindingError(
          record,
          binding,
          'TSL-RUN-007',
          `Parameter "${parameterName}" is missing.`,
          false,
          'warning'
        );
      }
      if (parameterDefinition.type === 'texture') {
        const defaultValue = parameterDefinition.default;
        if (typeof defaultValue !== 'string' || !defaultValue) {
          binding.pendingTextureOverrides.delete(parameterName);
          return this._setBindingError(
            record,
            binding,
            'TSL-RUN-007',
            `Default value for texture parameter "${parameterName}" is invalid.`,
            false,
            'warning'
          );
        }
        const loadRecord = this._getTextureLoadRecord(defaultValue);
        if (loadRecord.status === 'error') {
          binding.pendingTextureOverrides.delete(parameterName);
          return this._setBindingError(
            record,
            binding,
            'TSL-RUN-005',
            loadRecord.message,
            false
          );
        }
        if (loadRecord.status === 'pending') {
          binding.pendingTextureOverrides.set(parameterName, {
            value: defaultValue,
            reset: true,
          });
          binding.lastErrorCode = '';
          binding.lastErrorMessage = '';
          binding.state = binding.enabled ? 'PendingResources' : 'Disabled';
          return true;
        }
        binding.pendingTextureOverrides.delete(parameterName);
      }
      const previousOverride =
        binding.parameterOverrides.get(parameterName) || null;
      const previousValue = previousOverride
        ? previousOverride.value
        : parameterDefinition.default;
      const restorePreviousValue = (): void => {
        for (const installed of record.installedSlots.values()) {
          if (installed.bindingName !== bindingName) continue;
          try {
            updateParameterNode(
              installed.parameterNodes.get(parameterName),
              parameterDefinition.type,
              previousValue,
              this._runtimeScene
            );
          } catch (error) {
            // Keep the last usable node value if a borrowed resource also
            // disappeared while attempting to roll the reset back.
          }
        }
      };
      let updated = true;
      try {
        if (parameterDefinition.type === 'texture') {
          if (typeof parameterDefinition.default !== 'string') {
            throw new Error(
              `Default value for texture parameter "${parameterName}" is invalid.`
            );
          }
          resolveTexture(this._runtimeScene, parameterDefinition.default);
        }
        for (const installed of record.installedSlots.values()) {
          if (installed.bindingName !== bindingName) continue;
          updated =
            updateParameterNode(
              installed.parameterNodes.get(parameterName),
              parameterDefinition.type,
              parameterDefinition.default,
              this._runtimeScene
            ) && updated;
        }
      } catch (error) {
        restorePreviousValue();
        const code =
          error && (error as any).code === 'TSL-RUN-005'
            ? 'TSL-RUN-005'
            : 'TSL-RUN-007';
        return this._setBindingError(
          record,
          binding,
          code,
          error && (error as Error).message
            ? (error as Error).message
            : `Unable to reset parameter "${parameterName}".`,
          false,
          code === 'TSL-RUN-007' ? 'warning' : 'error'
        );
      }
      if (updated) {
        binding.parameterOverrides.delete(parameterName);
        binding.pendingTextureOverrides.delete(parameterName);
        binding.lastErrorCode = '';
        binding.lastErrorMessage = '';
        if (binding.activeSlotCount > 0) binding.state = 'Ready';
      } else {
        restorePreviousValue();
        return this._setBindingError(
          record,
          binding,
          'TSL-RUN-007',
          `Unable to reset parameter "${parameterName}".`,
          false,
          'warning'
        );
      }
      return updated;
    }

    hasBinding(object: gdjs.RuntimeObject, bindingName: string): boolean {
      return !!this._getRecord(object)?.bindings.has(bindingName);
    }

    isBindingReady(object: gdjs.RuntimeObject, bindingName: string): boolean {
      return this._getBindingState(object, bindingName) === 'Ready';
    }

    bindingHasError(object: gdjs.RuntimeObject, bindingName: string): boolean {
      const state = this._getBindingState(object, bindingName);
      return state === 'Error' || state === 'Unsupported';
    }

    bindingMatchedSlot(
      object: gdjs.RuntimeObject,
      bindingName: string
    ): boolean {
      return this.getMatchedSlotCount(object, bindingName) > 0;
    }

    getMatchedSlotCount(
      object: gdjs.RuntimeObject,
      bindingName: string
    ): integer {
      return (
        this._getRecord(object)?.bindings.get(bindingName)?.matchedSlotCount ||
        0
      );
    }

    getActiveSlotCount(
      object: gdjs.RuntimeObject,
      bindingName: string
    ): integer {
      return (
        this._getRecord(object)?.bindings.get(bindingName)?.activeSlotCount || 0
      );
    }

    getLastErrorCode(object: gdjs.RuntimeObject, bindingName: string): string {
      return (
        this._getRecord(object)?.bindings.get(bindingName)?.lastErrorCode || ''
      );
    }

    getLastError(object: gdjs.RuntimeObject, bindingName: string): string {
      return (
        this._getRecord(object)?.bindings.get(bindingName)?.lastErrorMessage ||
        ''
      );
    }

    getDiagnostics(): readonly gdjs.TSLMaterialDiagnostic[] {
      return this._diagnostics;
    }

    flush(): void {
      this._syncRendererLifecycleListener();
      if (this._rendererContextLost) return;
      if (this._shaderFailurePending) {
        this._shaderFailurePending = false;
        for (const record of this._records.values()) {
          if (!record.installedSlots.size) continue;
          this._releaseRecordGeneration(record);
          record.dirty = false;
          record.forceRebuild = false;
          this._dirtyRecords.delete(record);
          for (const binding of record.bindings.values()) {
            if (!binding.enabled) continue;
            this._setBindingError(
              record,
              binding,
              'TSL-RUN-006',
              'Three failed to create a shader program for an active TSL material.',
              false
            );
          }
        }
      }
      const dirtyRecords = Array.from(this._dirtyRecords);
      this._dirtyRecords.clear();
      for (const record of dirtyRecords) {
        if (this._records.get(record.object) !== record) continue;
        record.sceneVariantKey = getSceneVariantKey(
          this._runtimeScene,
          record.object
        );
        if (record.dirty) this._rebuildRecord(record);
      }
    }

    dispose(): void {
      this._isDisposed = true;
      this._removeRegistryListener();
      this._removeRendererLifecycleListener();
      this._removeRendererLifecycleListener = () => {};
      this._renderer = null;
      for (const record of Array.from(this._records.values())) {
        this._releaseRecordGeneration(record);
        record.removeRootListener();
      }
      this._records.clear();
      this._dirtyRecords.clear();
      this._diagnostics.length = 0;
      this._diagnosticKeys.clear();
      this._textureLoads.clear();
    }

    private _markRecordDirty(
      record: HostRecord,
      forceRebuild: boolean = false
    ): void {
      record.dirty = true;
      if (forceRebuild) record.forceRebuild = true;
      this._dirtyRecords.add(record);
    }

    private _getTextureLoadRecord(resourceName: string): TextureLoadRecord {
      const runtimeGame = this._runtimeScene.getGame();
      const resource = runtimeGame
        .getResourceLoader()
        .getResource(resourceName);
      if (!resource || resource.kind !== 'image') {
        return {
          status: 'error',
          message: `Texture "${resourceName}" is missing or is not an image resource.`,
        };
      }

      const imageManager = runtimeGame.getImageManager() as any;
      const isLoaded =
        typeof imageManager.isResourceLoaded === 'function' &&
        imageManager.isResourceLoaded(resourceName);
      let loadRecord = this._textureLoads.get(resourceName);
      if (isLoaded) {
        if (!loadRecord) {
          loadRecord = { status: 'ready', message: '' };
          this._textureLoads.set(resourceName, loadRecord);
        } else {
          loadRecord.status = 'ready';
          loadRecord.message = '';
        }
        return loadRecord;
      }
      if (loadRecord && loadRecord.status !== 'ready') return loadRecord;

      loadRecord = { status: 'pending', message: '' };
      this._textureLoads.set(resourceName, loadRecord);
      try {
        Promise.resolve(imageManager.loadResource(resourceName)).then(
          () => {
            if (
              this._isDisposed ||
              this._textureLoads.get(resourceName) !== loadRecord
            ) {
              return;
            }
            const loaded =
              typeof imageManager.isResourceLoaded !== 'function' ||
              imageManager.isResourceLoaded(resourceName);
            if (loaded) {
              loadRecord!.status = 'ready';
              loadRecord!.message = '';
            } else {
              loadRecord!.status = 'error';
              loadRecord!.message = `Texture "${resourceName}" did not become ready.`;
            }
            this._settlePendingTextureOverrides(resourceName, loadRecord!);
          },
          (error) => {
            if (
              this._isDisposed ||
              this._textureLoads.get(resourceName) !== loadRecord
            ) {
              return;
            }
            loadRecord!.status = 'error';
            loadRecord!.message = `Unable to load texture "${String(
              resourceName
            ).slice(0, 256)}".`;
            this._settlePendingTextureOverrides(resourceName, loadRecord!);
          }
        );
      } catch (error) {
        loadRecord.status = 'error';
        loadRecord.message = `Unable to load texture "${String(
          resourceName
        ).slice(0, 256)}".`;
      }
      return loadRecord;
    }

    private _settlePendingTextureOverrides(
      resourceName: string,
      loadRecord: TextureLoadRecord
    ): void {
      for (const record of this._records.values()) {
        let recordChanged = false;
        for (const binding of record.bindings.values()) {
          const definition = gdjs.__tslMaterialRegistry.get(
            binding.materialResourceName
          );
          if (!definition) continue;
          for (const [parameterName, pending] of Array.from(
            binding.pendingTextureOverrides.entries()
          )) {
            if (pending.value !== resourceName) continue;
            recordChanged = true;
            const parameterDefinition =
              definition.parameterSchema[parameterName];
            if (
              !parameterDefinition ||
              parameterDefinition.type !== 'texture'
            ) {
              binding.pendingTextureOverrides.delete(parameterName);
              this._setBindingError(
                record,
                binding,
                'TSL-RUN-007',
                `Texture parameter "${parameterName}" no longer exists.`,
                false,
                'warning'
              );
              continue;
            }
            if (loadRecord.status === 'error') {
              this._setBindingError(
                record,
                binding,
                'TSL-RUN-005',
                loadRecord.message,
                false
              );
              continue;
            }
            const previousOverride =
              binding.parameterOverrides.get(parameterName) || null;
            const previousValue = previousOverride
              ? previousOverride.value
              : parameterDefinition.default;
            const restorePreviousValue = (): void => {
              for (const installed of record.installedSlots.values()) {
                if (installed.bindingName !== binding.bindingName) continue;
                try {
                  updateParameterNode(
                    installed.parameterNodes.get(parameterName),
                    'texture',
                    previousValue,
                    this._runtimeScene
                  );
                } catch (error) {
                  // Retain whichever last usable texture the node still owns.
                }
              }
            };
            let updated = true;
            try {
              for (const installed of record.installedSlots.values()) {
                if (installed.bindingName !== binding.bindingName) continue;
                updated =
                  updateParameterNode(
                    installed.parameterNodes.get(parameterName),
                    'texture',
                    pending.value,
                    this._runtimeScene
                  ) && updated;
              }
            } catch (error) {
              updated = false;
              loadRecord.status = 'error';
              loadRecord.message =
                error && (error as Error).message
                  ? (error as Error).message
                  : `Texture "${resourceName}" could not be resolved.`;
            }
            if (!updated) {
              restorePreviousValue();
              this._setBindingError(
                record,
                binding,
                'TSL-RUN-005',
                loadRecord.message ||
                  `Texture "${resourceName}" could not be resolved.`,
                false
              );
              continue;
            }
            if (pending.reset) {
              binding.parameterOverrides.delete(parameterName);
            } else {
              binding.parameterOverrides.set(parameterName, {
                type: 'texture',
                value: pending.value,
              });
            }
            binding.pendingTextureOverrides.delete(parameterName);
            binding.lastErrorCode = '';
            binding.lastErrorMessage = '';
          }
        }
        if (recordChanged) this._markRecordDirty(record);
      }

      // Definitions can reference this resource as a default without having a
      // pending event override. Dirties are limited to affected bindings and
      // occur only when the asynchronous resource state changes.
      for (const record of this._records.values()) {
        for (const binding of record.bindings.values()) {
          const definition = gdjs.__tslMaterialRegistry.get(
            binding.materialResourceName
          );
          if (!definition) continue;
          const referencesResource = Object.keys(definition.parameterSchema)
            .filter(
              (name) => definition.parameterSchema[name].type === 'texture'
            )
            .some((name) => {
              const pending = binding.pendingTextureOverrides.get(name);
              const override = binding.parameterOverrides.get(name);
              const value = pending
                ? pending.value
                : override
                  ? override.value
                  : definition.parameterSchema[name].default;
              return value === resourceName;
            });
          if (referencesResource) {
            this._markRecordDirty(record);
            break;
          }
        }
      }
    }

    private _getBindingTextureLoadRecord(
      binding: RuntimeBinding,
      definition: gdjs.TSLMaterialDefinition
    ): TextureLoadRecord {
      let pendingRecord: TextureLoadRecord | null = null;
      for (const parameterName of Object.keys(definition.parameterSchema)) {
        const parameterDefinition = definition.parameterSchema[parameterName];
        if (parameterDefinition.type !== 'texture') continue;
        const pending = binding.pendingTextureOverrides.get(parameterName);
        const override = binding.parameterOverrides.get(parameterName);
        const resourceName = pending
          ? pending.value
          : override
            ? override.value
            : parameterDefinition.default;
        if (typeof resourceName !== 'string' || !resourceName) {
          return {
            status: 'error',
            message: `Texture parameter "${parameterName}" has an invalid resource name.`,
          };
        }
        const loadRecord = this._getTextureLoadRecord(resourceName);
        if (loadRecord.status === 'error') return loadRecord;
        if (loadRecord.status === 'pending') pendingRecord = loadRecord;
      }
      return pendingRecord || { status: 'ready', message: '' };
    }

    private _syncRendererLifecycleListener(): void {
      const renderer = gdjs.getTSLMaterialRenderer(this._runtimeScene);
      if (renderer === this._renderer) return;
      const previousRenderer = this._renderer;
      this._removeRendererLifecycleListener();
      this._removeRendererLifecycleListener = () => {};
      this._renderer = renderer;
      this._rendererContextLost = false;
      if (this._records.size) {
        for (const record of this._records.values()) {
          if (previousRenderer) this._releaseRecordGeneration(record);
          this._markRecordDirty(record);
        }
      }
      if (!renderer) return;
      const registration = gdjs.addTSLMaterialRendererLifecycleListener(
        this._runtimeScene,
        {
          onContextLost: () => {
            this._rendererContextLost = true;
            for (const record of this._records.values()) {
              this._releaseRecordGeneration(record);
              record.dirty = false;
              record.forceRebuild = false;
            }
            this._dirtyRecords.clear();
          },
          onContextRestored: () => {
            this._rendererContextLost = false;
            for (const record of this._records.values())
              this._markRecordDirty(record);
          },
          onShaderError: () => {
            // The Three hook does not identify the owning material. Fail safe
            // for all active materials in this scene during the next post-event
            // flush, outside the renderer's program-creation stack.
            this._shaderFailurePending = true;
          },
        }
      );
      if (registration) {
        this._renderer = registration.renderer;
        this._removeRendererLifecycleListener = registration.remove;
      }
    }

    private _isMaterialHost(
      object: gdjs.RuntimeObject
    ): object is MaterialHostObject {
      const candidate = object as any;
      return !!(
        candidate &&
        typeof candidate.getThreeMaterialRoot === 'function' &&
        typeof candidate.getThreeMaterialGeneration === 'function' &&
        typeof candidate.addThreeMaterialRootChangedListener === 'function'
      );
    }

    private _getRecord(object: gdjs.RuntimeObject): HostRecord | null {
      return this._isMaterialHost(object)
        ? this._records.get(object as MaterialHostObject) || null
        : null;
    }

    private _getOrCreateRecord(object: MaterialHostObject): HostRecord {
      let record = this._records.get(object);
      if (record) return record;
      const hostRecord = {} as HostRecord;
      hostRecord.object = object;
      hostRecord.root = object.getThreeMaterialRoot();
      hostRecord.generation = object.getThreeMaterialGeneration();
      hostRecord.capturedGeneration = -1;
      hostRecord.slots = [];
      hostRecord.slotLimitExceeded = false;
      hostRecord.bindings = new Map<string, RuntimeBinding>();
      hostRecord.installedSlots = new Map<string, InstalledSlot>();
      hostRecord.nextSequence = 0;
      hostRecord.dirty = true;
      hostRecord.forceRebuild = false;
      hostRecord.sceneVariantKey = getSceneVariantKey(
        this._runtimeScene,
        object
      );
      hostRecord.removeRootListener =
        object.addThreeMaterialRootChangedListener((change) => {
          this._releaseRecordGeneration(hostRecord);
          hostRecord.root = change.nextRoot;
          hostRecord.generation = change.generation;
          hostRecord.capturedGeneration = -1;
          hostRecord.sceneVariantKey = getSceneVariantKey(
            this._runtimeScene,
            object
          );
          if (change.reason === 'destroyed') {
            hostRecord.dirty = false;
            hostRecord.forceRebuild = false;
            this._dirtyRecords.delete(hostRecord);
            hostRecord.removeRootListener();
            this._records.delete(object);
          } else {
            this._markRecordDirty(hostRecord);
          }
        });
      record = hostRecord;
      this._records.set(object, record);
      this._dirtyRecords.add(record);
      return record;
    }

    private _captureSlots(record: HostRecord): void {
      if (!record.root || record.capturedGeneration === record.generation) {
        return;
      }
      record.slots.length = 0;
      record.slotLimitExceeded = false;
      let slotSequence = 0;
      record.root.traverse((node) => {
        if (record.slotLimitExceeded) return;
        const mesh = node as THREE.Mesh;
        if (!(mesh as any).isMesh || !mesh.material) return;
        if (Array.isArray(mesh.material)) {
          const materialArraySnapshot: MaterialArraySnapshot = {
            mesh,
            originalArray: mesh.material,
            ownedArray: null,
            generation: record.generation,
            externallyModified: false,
          };
          for (let index = 0; index < mesh.material.length; index++) {
            const material = mesh.material[index];
            if (!material) continue;
            if (record.slots.length >= maximumCapturedSlotsPerObject) {
              record.slotLimitExceeded = true;
              break;
            }
            record.slots.push({
              key: `${slotSequence++}`,
              mesh,
              slotIndex: index,
              originalMaterial: material,
              materialArraySnapshot,
              generation: record.generation,
              externallyModified: false,
            });
          }
        } else {
          if (record.slots.length >= maximumCapturedSlotsPerObject) {
            record.slotLimitExceeded = true;
            return;
          }
          record.slots.push({
            key: `${slotSequence++}`,
            mesh,
            slotIndex: null,
            originalMaterial: mesh.material,
            materialArraySnapshot: null,
            generation: record.generation,
            externallyModified: false,
          });
        }
      });
      record.capturedGeneration = record.generation;
    }

    private _matches(
      binding: RuntimeBinding,
      snapshot: MaterialSlotSnapshot
    ): boolean {
      const selector = binding.selector;
      if (selector.mode === 'All') return true;
      const meshMatches = snapshot.mesh.name === selector.meshName;
      const materialMatches =
        snapshot.originalMaterial.name === selector.materialName;
      if (selector.mode === 'MeshName') return meshMatches;
      if (selector.mode === 'MaterialName') return materialMatches;
      return meshMatches && materialMatches;
    }

    private _rebuildRecord(record: HostRecord): void {
      const forceRebuild = record.forceRebuild;
      record.dirty = false;
      record.forceRebuild = false;
      for (const binding of record.bindings.values()) {
        binding.matchedSlotCount = 0;
        binding.activeSlotCount = 0;
        binding.state = binding.enabled ? 'PendingHost' : 'Disabled';
      }
      if (!record.root) {
        this._releaseRecordGeneration(record);
        return;
      }
      this._captureSlots(record);
      if (record.slotLimitExceeded) {
        for (const binding of record.bindings.values()) {
          if (!binding.enabled) continue;
          this._setBindingError(
            record,
            binding,
            'TSL-LIMIT-001',
            `The model exceeds the ${maximumCapturedSlotsPerObject}-slot capture budget derived from the binding limits. No TSL material was applied.`,
            false
          );
        }
        return;
      }
      const backend = gdjs.ensureTSLMaterialBackend(this._runtimeScene);
      if (!backend.available) {
        for (const binding of record.bindings.values()) {
          if (!binding.enabled) continue;
          this._setBindingError(
            record,
            binding,
            backend.code,
            backend.message,
            true
          );
        }
        return;
      }

      const bindingsOverSlotLimit = new Set<RuntimeBinding>();
      for (const snapshot of record.slots) {
        for (const binding of record.bindings.values()) {
          if (!this._matches(binding, snapshot)) continue;
          binding.matchedSlotCount++;
          if (
            binding.enabled &&
            binding.matchedSlotCount > maximumSlotsPerBinding
          ) {
            bindingsOverSlotLimit.add(binding);
          }
        }
      }
      for (const binding of bindingsOverSlotLimit) {
        this._setBindingError(
          record,
          binding,
          'TSL-LIMIT-001',
          `The binding matched more than ${maximumSlotsPerBinding} material slots. No TSL material was applied for this binding.`,
          false
        );
      }

      const winners = new Map<string, RuntimeBinding>();
      for (const snapshot of record.slots) {
        const matching = Array.from(record.bindings.values()).filter(
          (binding) =>
            binding.enabled &&
            !bindingsOverSlotLimit.has(binding) &&
            this._matches(binding, snapshot)
        );
        matching.sort(
          (left, right) =>
            right.priority - left.priority || right.sequence - left.sequence
        );
        if (matching[0]) winners.set(snapshot.key, matching[0]);
      }
      const retainInstalledFallback = (
        current: InstalledSlot | null,
        snapshot: MaterialSlotSnapshot
      ): boolean => {
        if (!current) return false;
        const fallbackBinding = record.bindings.get(current.bindingName);
        if (
          !fallbackBinding ||
          !fallbackBinding.enabled ||
          bindingsOverSlotLimit.has(fallbackBinding) ||
          !this._matches(fallbackBinding, snapshot)
        ) {
          return false;
        }
        fallbackBinding.activeSlotCount++;
        return true;
      };

      const textureLoadRecords = new Map<RuntimeBinding, TextureLoadRecord>();
      for (const binding of new Set(winners.values())) {
        const definition = gdjs.__tslMaterialRegistry.get(
          binding.materialResourceName
        );
        if (!definition) continue;
        const loadRecord = this._getBindingTextureLoadRecord(
          binding,
          definition
        );
        textureLoadRecords.set(binding, loadRecord);
        if (loadRecord.status === 'pending') {
          binding.state = 'PendingResources';
        } else if (loadRecord.status === 'error') {
          this._setBindingError(
            record,
            binding,
            'TSL-RUN-005',
            loadRecord.message,
            false
          );
        }
      }

      for (const snapshot of record.slots) {
        const desiredBinding = winners.get(snapshot.key) || null;
        const current = record.installedSlots.get(snapshot.key) || null;
        if (!desiredBinding) {
          if (current) this._removeInstalledSlot(record, current, true);
          continue;
        }
        const expectedMaterial = current
          ? current.material
          : snapshot.originalMaterial;
        if (
          snapshot.externallyModified ||
          getMaterialAtSlot(snapshot) !== expectedMaterial
        ) {
          if (current) this._removeInstalledSlot(record, current, false);
          snapshot.externallyModified = true;
          this._setBindingError(
            record,
            desiredBinding,
            'TSL-RUN-008',
            'A material slot changed externally; the extension did not overwrite it.',
            false,
            'warning'
          );
          continue;
        }
        const definition = gdjs.__tslMaterialRegistry.get(
          desiredBinding.materialResourceName
        );
        if (!definition) {
          desiredBinding.state = 'PendingDefinition';
          if (current && !retainInstalledFallback(current, snapshot)) {
            this._removeInstalledSlot(record, current, true);
          }
          continue;
        }
        const textureLoadRecord = textureLoadRecords.get(desiredBinding);
        if (textureLoadRecord && textureLoadRecord.status !== 'ready') {
          if (current && !retainInstalledFallback(current, snapshot)) {
            this._removeInstalledSlot(record, current, true);
          }
          // Keep an eligible last-known-good/lower-priority owned material
          // while the replacement texture loads or after that load fails.
          continue;
        }
        if (
          current &&
          current.bindingName === desiredBinding.bindingName &&
          current.materialResourceName ===
            desiredBinding.materialResourceName &&
          current.definitionHash === definition.sourceHash &&
          !forceRebuild
        ) {
          desiredBinding.activeSlotCount++;
          continue;
        }
        desiredBinding.state = 'Building';
        try {
          const replacement = this._buildOwnedMaterial(
            record,
            desiredBinding,
            definition,
            snapshot
          );
          if (getMaterialAtSlot(snapshot) !== expectedMaterial) {
            replacement.material.dispose();
            if (current) this._removeInstalledSlot(record, current, false);
            snapshot.externallyModified = true;
            this._setBindingError(
              record,
              desiredBinding,
              'TSL-RUN-008',
              'A material slot changed externally while a replacement was being built; the extension did not overwrite it.',
              false,
              'warning'
            );
            continue;
          }
          if (!setMaterialAtSlot(snapshot, replacement.material)) {
            replacement.material.dispose();
            throw new Error(
              'The model material slot changed shape before swap.'
            );
          }
          if (current) {
            current.material.dispose();
            record.installedSlots.delete(snapshot.key);
          }
          record.installedSlots.set(snapshot.key, {
            snapshot,
            bindingName: desiredBinding.bindingName,
            materialResourceName: desiredBinding.materialResourceName,
            definitionHash: definition.sourceHash,
            material: replacement.material,
            parameterNodes: replacement.parameterNodes,
          });
          desiredBinding.activeSlotCount++;
          desiredBinding.lastErrorCode = '';
          desiredBinding.lastErrorMessage = '';
        } catch (error) {
          const code =
            error && (error as any).code
              ? (error as any).code
              : getSourceMaterialKind(snapshot.originalMaterial) ===
                  'unsupported'
                ? 'TSL-RUN-002'
                : 'TSL-RUN-001';
          const message =
            error && (error as Error).message
              ? (error as Error).message
              : 'The material graph build failed.';
          this._setBindingError(
            record,
            desiredBinding,
            code,
            message,
            code === 'TSL-RUN-002' || code === 'TSL-RUN-004',
            'error',
            {
              matchedMeshNames: [snapshot.mesh.name],
              matchedMaterialNames: [snapshot.originalMaterial.name],
              exceptionName:
                error && (error as Error).name
                  ? (error as Error).name
                  : undefined,
            }
          );
          if (current && !retainInstalledFallback(current, snapshot)) {
            this._removeInstalledSlot(record, current, true);
          }
        }
      }

      for (const binding of record.bindings.values()) {
        if (!binding.enabled) binding.state = 'Disabled';
        else if (
          binding.state === 'Error' ||
          binding.state === 'Unsupported' ||
          binding.state === 'PendingResources'
        ) {
          continue;
        } else if (
          !gdjs.__tslMaterialRegistry.has(binding.materialResourceName)
        ) {
          binding.state = 'PendingDefinition';
        } else if (binding.matchedSlotCount === 0) {
          binding.state = 'NoMatch';
          this._setBindingError(
            record,
            binding,
            'TSL-RUN-003',
            'The selector matched no material slot.',
            false,
            'warning'
          );
        } else if (binding.activeSlotCount === 0) binding.state = 'Shadowed';
        else binding.state = 'Ready';
      }
    }

    private _buildOwnedMaterial(
      record: HostRecord,
      binding: RuntimeBinding,
      definition: gdjs.TSLMaterialDefinition,
      snapshot: MaterialSlotSnapshot
    ): OwnedMaterialBuildResult {
      const tsl = (THREE as any).GDevelopTSL;
      const material = createNodeMaterial(
        snapshot.originalMaterial,
        definition.base
      );
      if (!material) {
        const error: any = new Error(
          `Source material "${snapshot.originalMaterial.name}" is unsupported by ${definition.base}.`
        );
        error.code = 'TSL-RUN-002';
        throw error;
      }
      const parameterNodes = new Map<string, any>();
      const parameters: { [name: string]: any } = {};
      try {
        for (const name of Object.keys(definition.parameterSchema)) {
          const parameterDefinition = definition.parameterSchema[name];
          const override = binding.parameterOverrides.get(name) || null;
          const node = createParameterNode({
            runtimeScene: this._runtimeScene,
            definition: parameterDefinition,
            override,
            tsl,
          });
          parameterNodes.set(name, node);
          parameters[name] = node;
        }
        const sourceMaterial = snapshot.originalMaterial as any;
        const geometry = snapshot.mesh.geometry as any;
        const context: gdjs.TSLMaterialBuildContext = {
          material: createMaterialFacade(material),
          inputs: createInheritedInputs(snapshot.originalMaterial, tsl),
          parameters,
          source: Object.freeze({
            name: snapshot.originalMaterial.name,
            kind: getSourceMaterialKind(snapshot.originalMaterial),
            hasColorMap: !!sourceMaterial.map,
            hasNormalMap: !!sourceMaterial.normalMap,
            hasSkinning: !!(snapshot.mesh as any).isSkinnedMesh,
            hasMorphTargets: !!(
              geometry &&
              geometry.morphAttributes &&
              Object.keys(geometry.morphAttributes).length
            ),
          }),
        };
        const returnValue = definition.build(context);
        if (returnValue !== undefined) {
          throw new Error('The material build function returned a value.');
        }
        (material as any).needsUpdate = true;
        return { material, parameterNodes };
      } catch (error) {
        material.dispose();
        throw error;
      }
    }

    private _removeInstalledSlot(
      record: HostRecord,
      installed: InstalledSlot,
      restore: boolean
    ): void {
      const currentMaterial = getMaterialAtSlot(installed.snapshot);
      if (restore && currentMaterial === installed.material) {
        setMaterialAtSlot(
          installed.snapshot,
          installed.snapshot.originalMaterial
        );
      } else if (restore && currentMaterial !== installed.material) {
        if (installed.snapshot.materialArraySnapshot) {
          installed.snapshot.materialArraySnapshot.externallyModified = true;
        }
        this._reportDiagnostic({
          code: 'TSL-RUN-008',
          severity: 'warning',
          message:
            'A material slot changed externally; the extension did not overwrite it during restore.',
          objectName: record.object.getName(),
          bindingName: installed.bindingName,
          generation: record.generation,
        });
      }
      installed.material.dispose();
      record.installedSlots.delete(installed.snapshot.key);
      this._restoreMaterialArrayIfEligible(
        record,
        installed.snapshot.materialArraySnapshot
      );
    }

    private _restoreMaterialArrayIfEligible(
      record: HostRecord,
      materialArraySnapshot: MaterialArraySnapshot | null
    ): void {
      if (
        !materialArraySnapshot ||
        !materialArraySnapshot.ownedArray ||
        materialArraySnapshot.externallyModified ||
        materialArraySnapshot.generation !== record.generation ||
        materialArraySnapshot.mesh.material !== materialArraySnapshot.ownedArray
      ) {
        return;
      }
      for (const other of record.installedSlots.values()) {
        if (other.snapshot.materialArraySnapshot === materialArraySnapshot) {
          return;
        }
      }
      if (
        materialArraySnapshot.ownedArray.length !==
          materialArraySnapshot.originalArray.length ||
        materialArraySnapshot.ownedArray.some(
          (material, index) =>
            material !== materialArraySnapshot.originalArray[index]
        )
      ) {
        materialArraySnapshot.externallyModified = true;
        return;
      }
      materialArraySnapshot.mesh.material = materialArraySnapshot.originalArray;
      materialArraySnapshot.ownedArray = null;
    }

    private _releaseRecordGeneration(record: HostRecord): void {
      for (const installed of Array.from(record.installedSlots.values())) {
        this._removeInstalledSlot(record, installed, true);
      }
      record.slots.length = 0;
      record.slotLimitExceeded = false;
      record.capturedGeneration = -1;
      for (const binding of record.bindings.values()) {
        binding.activeSlotCount = 0;
        binding.matchedSlotCount = 0;
        binding.state = binding.enabled ? 'PendingHost' : 'Disabled';
      }
    }

    private _getBindingState(
      object: gdjs.RuntimeObject,
      bindingName: string
    ): gdjs.TSLMaterialBindingState | null {
      return this._getRecord(object)?.bindings.get(bindingName)?.state || null;
    }

    private _normalizeParameterValue(
      definition: gdjs.TSLMaterialParameterDefinition,
      value: any
    ): any {
      if (definition.type === 'number') {
        if (typeof value !== 'number' || !Number.isFinite(value))
          return undefined;
        return Math.min(
          definition.max === undefined ? Infinity : definition.max,
          Math.max(
            definition.min === undefined ? -Infinity : definition.min,
            value
          )
        );
      }
      if (definition.type === 'boolean') {
        return typeof value === 'boolean' ? value : undefined;
      }
      if (definition.type === 'color') {
        return getColorFromValue(value) ? value : undefined;
      }
      if (definition.type === 'texture') {
        return typeof value === 'string' ? value : undefined;
      }
      const expectedLength =
        definition.type === 'vec2' ? 2 : definition.type === 'vec3' ? 3 : 4;
      return Array.isArray(value) &&
        value.length === expectedLength &&
        value.every(
          (component) =>
            typeof component === 'number' && Number.isFinite(component)
        )
        ? value.slice()
        : undefined;
    }

    private _setBindingError(
      record: HostRecord,
      binding: RuntimeBinding,
      code: string,
      message: string,
      unsupported: boolean,
      severity: 'error' | 'warning' = 'error',
      details: {
        matchedMeshNames?: readonly string[];
        matchedMaterialNames?: readonly string[];
        exceptionName?: string;
      } = {}
    ): false {
      binding.lastErrorCode = code;
      binding.lastErrorMessage = message;
      if (severity === 'error') {
        binding.state = unsupported ? 'Unsupported' : 'Error';
      }
      this._reportDiagnostic({
        code,
        severity,
        message,
        objectName: record.object.getName(),
        bindingName: binding.bindingName,
        materialResourceName: binding.materialResourceName,
        generation: record.generation,
        selector: binding.selector,
        ...details,
      });
      return false;
    }

    private _reportDiagnostic(diagnostic: gdjs.TSLMaterialDiagnostic): void {
      const three = THREE as any;
      const identity = three.GDEVELOP_TSL_RUNTIME;
      const definition = diagnostic.materialResourceName
        ? gdjs.__tslMaterialRegistry.get(diagnostic.materialResourceName)
        : null;
      const boundedNames = (names: readonly string[] | undefined): string[] =>
        Array.from(new Set(names || []))
          .slice(0, 64)
          .map((name) => String(name).slice(0, 256));
      const enrichedDiagnostic: gdjs.TSLMaterialDiagnostic = {
        ...diagnostic,
        sceneName:
          typeof this._runtimeScene.getName === 'function'
            ? this._runtimeScene.getName()
            : '',
        threeRevision: String(three.REVISION || identity?.threeRevision || ''),
        backend: identity?.backend || 'unavailable',
        capabilityFlags: {
          runtimeIdentity: !!identity,
          tslNamespace: !!three.GDevelopTSL,
          webglNodesHandler: !!three.WebGLNodesHandler,
          nodeMaterialConstructors: !!three.MeshStandardNodeMaterial,
          rendererAvailable: !!this._renderer,
          contextAvailable: !this._rendererContextLost,
        },
        sourceHash: diagnostic.sourceHash || definition?.sourceHash,
        matchedMeshNames: boundedNames(diagnostic.matchedMeshNames),
        matchedMaterialNames: boundedNames(diagnostic.matchedMaterialNames),
        exceptionName: diagnostic.exceptionName
          ? String(diagnostic.exceptionName).slice(0, 128)
          : undefined,
      };
      const key = `${diagnostic.code}:${diagnostic.objectName || ''}:${
        diagnostic.bindingName || ''
      }:${diagnostic.generation || 0}:${diagnostic.message}`;
      if (this._diagnosticKeys.has(key)) return;
      this._diagnosticKeys.add(key);
      if (this._diagnostics.length < 128)
        this._diagnostics.push(enrichedDiagnostic);
      const message = `[${diagnostic.code}] ${diagnostic.message}`;
      if (enrichedDiagnostic.severity === 'error')
        tslMaterialLogger.error(message);
      else if (enrichedDiagnostic.severity === 'warning')
        tslMaterialLogger.warn(message);
      else tslMaterialLogger.info(message);
    }
  }

  gdjs.registerRuntimeScenePostEventsCallback(
    gdjs.TSLMaterialSystem.flushScene
  );
  gdjs.registerRuntimeSceneUnloadedCallback(gdjs.TSLMaterialSystem.unloadScene);
}
