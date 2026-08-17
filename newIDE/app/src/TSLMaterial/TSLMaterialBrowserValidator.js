// @flow

import * as THREE from 'three';
// $FlowFixMe[cannot-resolve-module]
import * as TSL from 'three/tsl';
// $FlowFixMe[cannot-resolve-module]
import * as ThreeWebGPU from 'three/webgpu';
// $FlowFixMe[cannot-resolve-module]
import { WebGLNodesHandler } from 'three/addons/tsl/WebGLNodesHandler.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { setTSLMaterialBackendValidator } from './TSLMaterialCompiler';

const {
  MeshBasicNodeMaterial,
  MeshPhysicalNodeMaterial,
  MeshStandardNodeMaterial,
  NodeMaterial,
} = ThreeWebGPU;

const VALIDATION_SIZE = 64;
const MAXIMUM_BACKEND_MESSAGE_LENGTH = 1000;

class TSLBrowserValidationError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'TSLBrowserValidationError';
    this.code = code;
  }
}

const now = (): number =>
  typeof performance === 'undefined' ? Date.now() : performance.now();

const checkAborted = (abortSignal: ?Object): void => {
  if (abortSignal && abortSignal.aborted) {
    throw new TSLBrowserValidationError(
      'TSL-MCP-TIMEOUT',
      'TSL validation was cancelled before the backend check completed.'
    );
  }
};

const sanitizeBackendMessage = (value: mixed): string =>
  String(value || '')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '') // eslint-disable-line no-control-regex
    .slice(0, MAXIMUM_BACKEND_MESSAGE_LENGTH);

const getSourceMaterialKind = (
  source: any
): 'basic' | 'standard' | 'physical' | 'unsupported' => {
  if (source && source.isMeshPhysicalMaterial) return 'physical';
  if (source && source.isMeshStandardMaterial) return 'standard';
  if (source && source.isMeshBasicMaterial) return 'basic';
  return 'unsupported';
};

const getRequestedBase = (sourceKind: string, requestedBase: string): string =>
  requestedBase === 'inherit' ? sourceKind : requestedBase;

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

const copyCompatibleMaterialProperties = (source: any, target: any): void => {
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
  ].forEach(property => copyIfPresent(source, target, property));
  target.userData = { ...(source.userData || {}) };
  target.needsUpdate = true;
};

const createOwnedNodeMaterial = (source: any, requestedBase: string): any => {
  const sourceKind = getSourceMaterialKind(source);
  const base = getRequestedBase(sourceKind, requestedBase);
  if (sourceKind === 'unsupported') {
    throw new TSLBrowserValidationError(
      'TSL-VAL-002',
      'The source material class is outside the version-one conversion table.'
    );
  }
  if (
    sourceKind === 'physical' &&
    (source.transmission > 0 || source.transmissionMap)
  ) {
    throw new TSLBrowserValidationError(
      'TSL-RUN-004',
      'Physical transmission is unavailable in the WebGL node compatibility profile.'
    );
  }
  let material;
  if (base === 'basic') material = new MeshBasicNodeMaterial();
  else if (base === 'standard') material = new MeshStandardNodeMaterial();
  else if (base === 'physical') material = new MeshPhysicalNodeMaterial();
  else if (base === 'custom') material = new NodeMaterial();
  else {
    throw new TSLBrowserValidationError(
      'TSL-VAL-002',
      'The requested node-material base is incompatible with the source material.'
    );
  }
  copyCompatibleMaterialProperties(source, material);
  return material;
};

const createInheritedInputs = (_source: any): Object => {
  return {
    baseColor: TSL.materialColor,
    opacity: TSL.materialOpacity,
    emissive: TSL.materialEmissive,
    roughness: TSL.materialRoughness,
    metalness: TSL.materialMetalness,
    normal: TSL.materialNormal,
  };
};

const createMaterialFacade = (material: any): Object =>
  new Proxy(material, {
    set(target, property, inputValue) {
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
        throw new TSLBrowserValidationError(
          'TSL-VAL-001',
          'Material field "' + name + '" is not writable.'
        );
      }
      let value = inputValue;
      if (name.endsWith('Node') && value !== null && !(value && value.isNode)) {
        throw new TSLBrowserValidationError(
          'TSL-VAL-001',
          'Material field "' + name + '" requires a TSL node.'
        );
      }
      if (name === 'side') {
        if (value === 'front') value = THREE.FrontSide;
        else if (value === 'back') value = THREE.BackSide;
        else if (value === 'double') value = THREE.DoubleSide;
        else {
          throw new TSLBrowserValidationError(
            'TSL-VAL-001',
            'Material side must be front, back, or double.'
          );
        }
      }
      if (
        ['transparent', 'depthWrite', 'depthTest'].includes(name) &&
        typeof value !== 'boolean'
      ) {
        throw new TSLBrowserValidationError(
          'TSL-VAL-001',
          'Material field "' + name + '" requires a boolean.'
        );
      }
      if (
        name === 'alphaTest' &&
        (typeof value !== 'number' || !Number.isFinite(value))
      ) {
        throw new TSLBrowserValidationError(
          'TSL-VAL-001',
          'Material alphaTest requires a finite number.'
        );
      }
      target[property] = value;
      target.needsUpdate = true;
      return true;
    },
  });

const createValidationTexture = (
  colorSpace: ?string,
  ownedTextures: Set<any>
): any => {
  const data = new Uint8Array([128, 192, 255, 255]);
  const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  if (colorSpace === 'srgb') texture.colorSpace = THREE.SRGBColorSpace;
  else texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  ownedTextures.add(texture);
  return texture;
};

const createParameterNodes = (
  parameterSchema: Object,
  ownedTextures: Set<any>,
  parameterValues: Object = {}
): Object => {
  const parameters: { [string]: any } = {};
  Object.keys(parameterSchema).forEach(name => {
    const definition = parameterSchema[name];
    const value = Object.keys(parameterValues).includes(name)
      ? parameterValues[name]
      : definition.default;
    if (definition.type === 'number' || definition.type === 'boolean') {
      parameters[name] = TSL.uniform(value);
    } else if (definition.type === 'color') {
      parameters[name] = TSL.uniform(new THREE.Color(value));
    } else if (definition.type === 'vec2') {
      parameters[name] = TSL.uniform(new THREE.Vector2(value[0], value[1]));
    } else if (definition.type === 'vec3') {
      parameters[name] = TSL.uniform(
        new THREE.Vector3(value[0], value[1], value[2])
      );
    } else if (definition.type === 'vec4') {
      parameters[name] = TSL.uniform(
        new THREE.Vector4(value[0], value[1], value[2], value[3])
      );
    } else if (definition.type === 'texture') {
      parameters[name] = TSL.texture(
        createValidationTexture(definition.colorSpace, ownedTextures)
      );
    }
  });
  return parameters;
};

const buildMaterial = ({
  compiled,
  source,
  mesh,
  executeBuildWithInterpreter,
  ownedMaterials,
  ownedTextures,
  parameterValues,
}: Object): any => {
  const material = createOwnedNodeMaterial(source, compiled.manifest.base);
  ownedMaterials.add(material);
  const geometry = mesh && mesh.geometry;
  const context = {
    material: createMaterialFacade(material),
    inputs: createInheritedInputs(source),
    parameters: createParameterNodes(
      compiled.manifest.parameters,
      ownedTextures,
      parameterValues
    ),
    source: Object.freeze({
      name: source.name || '',
      kind: getSourceMaterialKind(source),
      hasColorMap: !!source.map,
      hasNormalMap: !!source.normalMap,
      hasSkinning: !!(mesh && mesh.isSkinnedMesh),
      hasMorphTargets: !!(
        geometry &&
        geometry.morphAttributes &&
        Object.keys(geometry.morphAttributes).length
      ),
    }),
  };
  const result = executeBuildWithInterpreter({
    tslAdapter: TSL,
    context,
  });
  if (result && result.material && result.material !== context.material) {
    throw new TSLBrowserValidationError(
      'TSL-VAL-001',
      'The graph build attempted to replace the owned material.'
    );
  }
  material.needsUpdate = true;
  return material;
};

const createSourceMaterial = (base: string): any => {
  if (base === 'basic') {
    return new THREE.MeshBasicMaterial({
      color: 0x80c0ff,
      transparent: true,
      opacity: 0.9,
      alphaTest: 0.01,
    });
  }
  if (base === 'physical') {
    return new THREE.MeshPhysicalMaterial({
      color: 0x80c0ff,
      roughness: 0.55,
      metalness: 0.1,
      clearcoat: 0.2,
    });
  }
  return new THREE.MeshStandardMaterial({
    color: 0x80c0ff,
    roughness: 0.55,
    metalness: 0.1,
  });
};

const addSkinningAttributes = (geometry: any): void => {
  const vertexCount = geometry.attributes.position.count;
  const skinIndices = new Uint16Array(vertexCount * 4);
  const skinWeights = new Float32Array(vertexCount * 4);
  for (let index = 0; index < vertexCount; index++) {
    skinWeights[index * 4] = 1;
  }
  geometry.setAttribute(
    'skinIndex',
    new THREE.Uint16BufferAttribute(skinIndices, 4)
  );
  geometry.setAttribute(
    'skinWeight',
    new THREE.Float32BufferAttribute(skinWeights, 4)
  );
};

const createGenericFixture = ({
  feature,
  baseMaterial,
  compiled,
  executeBuildWithInterpreter,
  ownedMaterials,
  ownedTextures,
  ownedGeometries,
  ownedSkeletons,
  parameterValues,
}: Object): Object => {
  const geometry =
    feature === 'sphere'
      ? new THREE.SphereGeometry(0.8, 32, 20)
      : feature === 'plane'
      ? new THREE.PlaneGeometry(1.7, 1.7, 12, 12)
      : new THREE.BoxGeometry(1.25, 1.25, 1.25, 2, 2, 2);
  ownedGeometries.add(geometry);
  let object;
  if (feature === 'skinning') {
    addSkinningAttributes(geometry);
    const source = createSourceMaterial(baseMaterial);
    ownedMaterials.add(source);
    object = new THREE.SkinnedMesh(geometry, source);
    const bone = new THREE.Bone();
    object.add(bone);
    const skeleton = new THREE.Skeleton([bone]);
    ownedSkeletons.add(skeleton);
    object.bind(skeleton);
    object.material = buildMaterial({
      compiled,
      source,
      mesh: object,
      executeBuildWithInterpreter,
      ownedMaterials,
      ownedTextures,
      parameterValues,
    });
  } else if (feature === 'instancing') {
    const source = createSourceMaterial(baseMaterial);
    ownedMaterials.add(source);
    const material = buildMaterial({
      compiled,
      source,
      mesh: null,
      executeBuildWithInterpreter,
      ownedMaterials,
      ownedTextures,
      parameterValues,
    });
    object = new THREE.InstancedMesh(geometry, material, 2);
    object.setMatrixAt(0, new THREE.Matrix4().makeTranslation(-0.35, 0, 0));
    object.setMatrixAt(1, new THREE.Matrix4().makeTranslation(0.35, 0, 0));
    object.instanceMatrix.needsUpdate = true;
  } else if (feature === 'material_array') {
    const sourceA = createSourceMaterial(baseMaterial);
    const sourceB = createSourceMaterial(baseMaterial);
    sourceA.name = 'Fixture material A';
    sourceB.name = 'Fixture material B';
    ownedMaterials.add(sourceA);
    ownedMaterials.add(sourceB);
    object = new THREE.Mesh(geometry, [sourceA, sourceB]);
    object.material = [
      buildMaterial({
        compiled,
        source: sourceA,
        mesh: object,
        executeBuildWithInterpreter,
        ownedMaterials,
        ownedTextures,
        parameterValues,
      }),
      buildMaterial({
        compiled,
        source: sourceB,
        mesh: object,
        executeBuildWithInterpreter,
        ownedMaterials,
        ownedTextures,
        parameterValues,
      }),
    ];
  } else {
    if (feature === 'morph_targets') {
      const morphPosition = geometry.attributes.position.clone();
      for (let index = 0; index < morphPosition.count; index++) {
        morphPosition.setY(index, morphPosition.getY(index) + 0.08);
      }
      geometry.morphAttributes.position = [morphPosition];
      geometry.morphTargetsRelative = true;
    }
    const source = createSourceMaterial(baseMaterial);
    ownedMaterials.add(source);
    object = new THREE.Mesh(geometry, source);
    if (feature === 'morph_targets') {
      object.updateMorphTargets();
      object.morphTargetInfluences[0] = 0.5;
    }
    object.material = buildMaterial({
      compiled,
      source,
      mesh: object,
      executeBuildWithInterpreter,
      ownedMaterials,
      ownedTextures,
      parameterValues,
    });
  }
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
};

const createScene = (
  object: any,
  fixture: Object,
  environmentTexture: ?any
): Object => {
  const scene = new THREE.Scene();
  scene.background =
    fixture.backgroundPreset === 'transparent'
      ? null
      : new THREE.Color(
          fixture.backgroundPreset === 'light' ? 0xe7edf4 : 0x101820
        );
  scene.environment = environmentTexture || null;
  scene.add(object);
  const lightMultiplier =
    fixture.lightPreset === 'soft'
      ? 0.65
      : fixture.lightPreset === 'bright'
      ? 1.5
      : 1;
  scene.add(
    new THREE.HemisphereLight(0xffffff, 0x202840, 1.2 * lightMultiplier)
  );
  const directionalLight = new THREE.DirectionalLight(
    0xffffff,
    2 * lightMultiplier
  );
  directionalLight.position.set(2, 3, 4);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.set(64, 64);
  scene.add(directionalLight);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1000);
  camera.position.set(0, 0.3, 3.5);
  camera.lookAt(0, 0, 0);
  return { scene, camera };
};

const frameObject = (
  object: any,
  camera: any,
  cameraAngle: string = 'front'
): void => {
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) {
    camera.position.set(0, 0.3, 3.5);
    camera.lookAt(0, 0, 0);
    return;
  }
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, 0.1);
  camera.near = Math.max(0.001, radius / 100);
  camera.far = Math.max(100, radius * 20);
  const cameraDirection =
    cameraAngle === 'side'
      ? new THREE.Vector3(2.5, 0.2, 0)
      : cameraAngle === 'three-quarter'
      ? new THREE.Vector3(1.75, 0.35, 1.75)
      : new THREE.Vector3(0, 0.2, 2.5);
  camera.position.copy(center).add(cameraDirection.multiplyScalar(radius));
  camera.lookAt(center);
  camera.updateProjectionMatrix();
};

const parseGlb = (bytes: any, abortSignal: ?Object): Promise<Object> =>
  new Promise((resolve, reject) => {
    checkAborted(abortSignal);
    const arrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    );
    const loader = new GLTFLoader();
    loader.parse(
      arrayBuffer,
      '',
      gltf => {
        try {
          checkAborted(abortSignal);
          resolve(gltf);
        } catch (error) {
          reject(error);
        }
      },
      error =>
        reject(
          new TSLBrowserValidationError(
            'TSL-VAL-002',
            'The selected GLB could not be parsed: ' +
              sanitizeBackendMessage(
                error && error.message ? error.message : error
              )
          )
        )
    );
  });

export const inspectTSLMaterialModelBytes = async (
  modelBytes: any,
  abortSignal?: ?Object
): Promise<Object> => {
  const gltf = await parseGlb(modelBytes, abortSignal);
  const root = gltf.scene;
  const meshes = [];
  root.updateMatrixWorld(true);
  root.traverse(node => {
    if (!node.isMesh) return;
    const materials = Array.isArray(node.material)
      ? node.material
      : node.material
      ? [node.material]
      : [];
    meshes.push({
      name: String(node.name || ''),
      skinned: !!node.isSkinnedMesh,
      morphTargets: !!(
        node.geometry &&
        node.geometry.morphAttributes &&
        Object.keys(node.geometry.morphAttributes).length
      ),
      materialArray: Array.isArray(node.material),
      materials: materials.map((material, slot) => ({
        slot,
        name: String(material.name || ''),
        kind: getSourceMaterialKind(material),
        transparent: !!material.transparent,
        alphaTest: Number(material.alphaTest || 0),
        transmission: Number(material.transmission || 0),
        textureChannels: [
          'map',
          'normalMap',
          'roughnessMap',
          'metalnessMap',
          'emissiveMap',
          'alphaMap',
          'aoMap',
        ].filter(channel => !!material[channel]),
      })),
    });
  });
  const ownedGeometries: Set<any> = new Set();
  const ownedMaterials: Set<any> = new Set();
  const ownedTextures: Set<any> = new Set();
  disposeObjectResources(root, ownedGeometries, ownedMaterials, ownedTextures);
  ownedMaterials.forEach(material => material.dispose && material.dispose());
  ownedTextures.forEach(texture => texture.dispose && texture.dispose());
  ownedGeometries.forEach(geometry => geometry.dispose && geometry.dispose());
  return {
    meshCount: meshes.length,
    materialSlotCount: meshes.reduce(
      (count, mesh) => count + mesh.materials.length,
      0
    ),
    meshes,
  };
};

const replaceModelMaterials = ({
  root,
  compiled,
  executeBuildWithInterpreter,
  ownedMaterials,
  ownedTextures,
  parameterValues,
}: Object): number => {
  let slotCount = 0;
  root.traverse(node => {
    if (!node.isMesh || !node.material) return;
    if (Array.isArray(node.material)) {
      node.material = node.material.map(source => {
        slotCount++;
        ownedMaterials.add(source);
        return buildMaterial({
          compiled,
          source,
          mesh: node,
          executeBuildWithInterpreter,
          ownedMaterials,
          ownedTextures,
          parameterValues,
        });
      });
    } else {
      const source = node.material;
      slotCount++;
      ownedMaterials.add(source);
      node.material = buildMaterial({
        compiled,
        source,
        mesh: node,
        executeBuildWithInterpreter,
        ownedMaterials,
        ownedTextures,
        parameterValues,
      });
    }
    node.castShadow = true;
    node.receiveShadow = true;
  });
  if (!slotCount) {
    throw new TSLBrowserValidationError(
      'TSL-VAL-002',
      'The selected GLB has no mesh material slots to validate.'
    );
  }
  return slotCount;
};

const disposeObjectResources = (
  root: any,
  ownedGeometries: Set<any>,
  ownedMaterials: Set<any>,
  ownedTextures: Set<any>
): void => {
  root.traverse(node => {
    if (node.geometry) ownedGeometries.add(node.geometry);
    const materials = Array.isArray(node.material)
      ? node.material
      : node.material
      ? [node.material]
      : [];
    materials.forEach(material => {
      ownedMaterials.add(material);
      Object.keys(material).forEach(key => {
        const value = material[key];
        if (value && value.isTexture) ownedTextures.add(value);
      });
    });
  });
};

const makeDiagnostic = (
  code: string,
  stage: string,
  message: string,
  filePath: string
): Object => ({
  code,
  severity: 'error',
  stage,
  message: sanitizeBackendMessage(message),
  file_path: filePath,
});

const validateInBrowser = async ({
  compiled,
  fixture,
  validationLevel,
  executeBuildWithInterpreter,
}: Object): Promise<Object> => {
  const abortSignal = fixture.abortSignal;
  checkAborted(abortSignal);
  if (typeof document === 'undefined') {
    throw new TSLBrowserValidationError(
      'TSL-MCP-GPU-UNAVAILABLE',
      'This editor process has no browser canvas environment.'
    );
  }

  const validationSize = Math.max(
    VALIDATION_SIZE,
    Math.min(512, Math.floor(fixture.previewSize || VALIDATION_SIZE))
  );
  const canvas = document.createElement('canvas');
  canvas.width = validationSize;
  canvas.height = validationSize;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.position = 'fixed';
  canvas.style.left = '-10000px';
  canvas.style.top = '-10000px';
  canvas.style.width = '1px';
  canvas.style.height = '1px';
  // Flow's browser libdef in this repository does not expose the WebGL2
  // interface name, while Chromium does. Keep the runtime capability check
  // authoritative and avoid weakening it to a WebGL1 fallback.
  let context: ?any = null;
  try {
    context = (canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: true,
      preserveDrawingBuffer: true,
      powerPreference: 'low-power',
    }): any);
  } catch (error) {
    context = null;
  }
  if (!context) {
    throw new TSLBrowserValidationError(
      'TSL-MCP-GPU-UNAVAILABLE',
      'A WebGL2 validation context could not be created.'
    );
  }
  const gl: any = context;

  document.body && document.body.appendChild(canvas);
  const ownedMaterials: Set<any> = new Set();
  const ownedTextures: Set<any> = new Set();
  const ownedGeometries: Set<any> = new Set();
  const ownedSkeletons: Set<any> = new Set();
  let renderer: any = null;
  let environmentRenderTarget: any = null;
  const shaderErrors: Array<string> = [];
  let shaderBuildMilliseconds = 0;
  let gpuDrawMilliseconds = 0;
  let nodeBuilderValidated = false;
  let gpuValidated = false;
  let modelValidated = false;
  let previewDataUrl = '';
  let previewRenderStats = null;
  let referencePreviewDataUrl = '';
  let referenceRenderStats = null;
  let currentStage = 'nodeBuilder';
  try {
    const identityProbe = new MeshStandardNodeMaterial();
    const hasCompatibleIdentity =
      THREE.REVISION === '185' && identityProbe instanceof THREE.Material;
    identityProbe.dispose();
    if (!hasCompatibleIdentity) {
      throw new TSLBrowserValidationError(
        'TSL-MCP-VALIDATOR-UNAVAILABLE',
        'The editor TSL validator does not have one compatible Three r185 identity.'
      );
    }
    renderer = new THREE.WebGLRenderer({ canvas, context: gl });
    renderer.setPixelRatio(1);
    renderer.setSize(validationSize, validationSize, false);
    renderer.setClearColor(
      0x101820,
      fixture.backgroundPreset === 'transparent' ? 0 : 1
    );
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    if (fixture.environmentPreset !== 'none') {
      const environmentScene = new RoomEnvironment();
      if (fixture.environmentPreset === 'warm') {
        environmentScene.traverse(object => {
          if (object.isLight && object.color) object.color.set(0xffd6ad);
        });
      }
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      try {
        environmentRenderTarget = pmremGenerator.fromScene(
          environmentScene,
          0.04
        );
      } finally {
        pmremGenerator.dispose();
        disposeObjectResources(
          environmentScene,
          ownedGeometries,
          ownedMaterials,
          ownedTextures
        );
        environmentScene.clear();
      }
    }
    const nodesHandler: any = new WebGLNodesHandler();
    if (Number.isFinite(fixture.animationTime) && nodesHandler.nodeFrame) {
      const animationTime = Number(fixture.animationTime);
      const nodeFrame = nodesHandler.nodeFrame;
      nodeFrame.update = () => {
        nodeFrame.frameId++;
        nodeFrame.deltaTime = 0;
        nodeFrame.time = animationTime;
      };
    }
    renderer.setNodesHandler(nodesHandler);
    renderer.debug.checkShaderErrors = true;
    renderer.debug.onShaderError = (
      gl,
      program,
      vertexShader,
      fragmentShader
    ) => {
      const programLog = gl.getProgramInfoLog(program) || 'Shader link failed.';
      shaderErrors.push(sanitizeBackendMessage(programLog));
    };

    const renderFixture = (object: any): Object => {
      checkAborted(abortSignal);
      const { scene, camera } = createScene(
        object,
        fixture,
        environmentRenderTarget ? environmentRenderTarget.texture : null
      );
      frameObject(object, camera, fixture.cameraAngle || 'front');
      for (let index = 0; index < 32; index++) {
        if (gl.getError() === gl.NO_ERROR) break;
      }
      const renderStartedAt = now();
      try {
        renderer.render(scene, camera);
      } catch (error) {
        throw new TSLBrowserValidationError(
          error && error.code ? error.code : 'TSL-VAL-002',
          error && error.message
            ? error.message
            : 'Three NodeBuilder rejected the validation fixture.'
        );
      }
      shaderBuildMilliseconds += now() - renderStartedAt;
      if (shaderErrors.length) {
        throw new TSLBrowserValidationError('TSL-VAL-003', shaderErrors[0]);
      }
      const drawStartedAt = now();
      gl.finish();
      const pixels = new Uint8Array(validationSize * validationSize * 4);
      gl.readPixels(
        0,
        0,
        validationSize,
        validationSize,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels
      );
      const glError = gl.getError();
      gpuDrawMilliseconds += now() - drawStartedAt;
      if (glError !== gl.NO_ERROR) {
        throw new TSLBrowserValidationError(
          'TSL-VAL-003',
          'The validation draw ended with WebGL error ' + glError + '.'
        );
      }
      const background = [pixels[0], pixels[1], pixels[2], pixels[3]];
      let coveredPixelCount = 0;
      let nonTransparentPixelCount = 0;
      let minimumChannel = 255;
      let maximumChannel = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        const alpha = pixels[index + 3];
        if (alpha > 0) nonTransparentPixelCount++;
        minimumChannel = Math.min(
          minimumChannel,
          pixels[index],
          pixels[index + 1],
          pixels[index + 2]
        );
        maximumChannel = Math.max(
          maximumChannel,
          pixels[index],
          pixels[index + 1],
          pixels[index + 2]
        );
        const differsFromBackground =
          Math.abs(pixels[index] - background[0]) +
            Math.abs(pixels[index + 1] - background[1]) +
            Math.abs(pixels[index + 2] - background[2]) +
            Math.abs(alpha - background[3]) >
          8;
        if (
          (fixture.backgroundPreset === 'transparent' && alpha > 0) ||
          differsFromBackground
        ) {
          coveredPixelCount++;
        }
      }
      const totalPixelCount = validationSize * validationSize;
      if (!coveredPixelCount) {
        throw new TSLBrowserValidationError(
          'TSL-VAL-003',
          'The validation render contains no covered pixels.'
        );
      }
      if (!nonTransparentPixelCount) {
        throw new TSLBrowserValidationError(
          'TSL-VAL-003',
          'The validation render is fully transparent.'
        );
      }
      const renderStats = {
        totalPixelCount,
        coveredPixelCount,
        nonTransparentPixelCount,
        coverageRatio: coveredPixelCount / totalPixelCount,
        alphaCoverageRatio: nonTransparentPixelCount / totalPixelCount,
        minimumColorChannel: minimumChannel,
        maximumColorChannel: maximumChannel,
        finite: true,
      };
      let dataUrl = '';
      if (
        renderer.domElement &&
        typeof renderer.domElement.toDataURL === 'function'
      ) {
        dataUrl = renderer.domElement.toDataURL('image/png');
      }
      scene.clear();
      return { dataUrl, renderStats };
    };

    const requestedFeatures = Array.from(
      new Set([
        'static',
        ...(Array.isArray(fixture.geometryFeatures)
          ? fixture.geometryFeatures
          : []),
        ...(compiled.manifest &&
        Array.isArray(compiled.manifest.assignedMaterialFields) &&
        compiled.manifest.assignedMaterialFields.includes('positionNode')
          ? ['skinning', 'morph_targets']
          : []),
      ])
    );
    for (const feature of requestedFeatures) {
      const object = createGenericFixture({
        feature,
        baseMaterial: fixture.baseMaterial || 'standard',
        compiled,
        executeBuildWithInterpreter,
        ownedMaterials,
        ownedTextures,
        ownedGeometries,
        ownedSkeletons,
        parameterValues: fixture.parameterValues || {},
      });
      const rendered = renderFixture(object);
      previewDataUrl = rendered.dataUrl;
      previewRenderStats = rendered.renderStats;
    }
    nodeBuilderValidated = true;
    gpuValidated = true;

    if (validationLevel === 'model') {
      currentStage = 'model';
      checkAborted(abortSignal);
      if (!fixture.modelBytes) {
        throw new TSLBrowserValidationError(
          'TSL-VAL-002',
          'Selected-model validation received no GLB bytes.'
        );
      }
      const gltf = await parseGlb(fixture.modelBytes, abortSignal);
      const modelRoot = gltf.scene;
      disposeObjectResources(
        modelRoot,
        ownedGeometries,
        ownedMaterials,
        ownedTextures
      );
      if (fixture.includeOriginalModelPreview) {
        const referenceRendered = renderFixture(modelRoot);
        referencePreviewDataUrl = referenceRendered.dataUrl;
        referenceRenderStats = referenceRendered.renderStats;
      }
      replaceModelMaterials({
        root: modelRoot,
        compiled,
        executeBuildWithInterpreter,
        ownedMaterials,
        ownedTextures,
        parameterValues: fixture.parameterValues || {},
      });
      const rendered = renderFixture(modelRoot);
      previewDataUrl = rendered.dataUrl;
      previewRenderStats = rendered.renderStats;
      modelValidated = true;
    }
    checkAborted(abortSignal);
    return {
      nodeBuilderValidated,
      gpuValidated,
      modelValidated,
      completedStages: [
        'nodeBuilder',
        'gpu',
        ...(validationLevel === 'model' ? ['model'] : []),
      ],
      previewDataUrl,
      previewRenderStats,
      referencePreviewDataUrl,
      referenceRenderStats,
      diagnostics: [],
      metrics: {
        shader_build_milliseconds: shaderBuildMilliseconds,
        gpu_draw_milliseconds: gpuDrawMilliseconds,
      },
    };
  } catch (error) {
    if (
      error &&
      typeof error.code === 'string' &&
      error.code.startsWith('TSL-MCP-')
    ) {
      throw error;
    }
    const code =
      error && typeof error.code === 'string' ? error.code : 'TSL-VAL-002';
    const stage = code === 'TSL-VAL-003' ? 'gpu' : currentStage;
    const failedAtModelStage = currentStage === 'model';
    return {
      nodeBuilderValidated: nodeBuilderValidated || code === 'TSL-VAL-003',
      gpuValidated: failedAtModelStage && gpuValidated,
      modelValidated: false,
      completedStages: failedAtModelStage
        ? ['nodeBuilder', 'gpu', 'model']
        : code === 'TSL-VAL-003'
        ? ['nodeBuilder', 'gpu']
        : ['nodeBuilder'],
      diagnostics: [
        makeDiagnostic(
          code,
          stage,
          error && error.message
            ? error.message
            : 'The browser backend validation failed.',
          compiled.receipt.normalizedSourcePath
        ),
      ],
      metrics: {
        shader_build_milliseconds: shaderBuildMilliseconds,
        gpu_draw_milliseconds: gpuDrawMilliseconds,
      },
    };
  } finally {
    if (environmentRenderTarget) environmentRenderTarget.dispose();
    if (renderer) {
      renderer.debug.onShaderError = null;
      if (renderer.renderLists) renderer.renderLists.dispose();
      renderer.dispose();
      if (typeof renderer.forceContextLoss === 'function') {
        renderer.forceContextLoss();
      }
    }
    ownedSkeletons.forEach(skeleton => {
      if (skeleton && typeof skeleton.dispose === 'function')
        skeleton.dispose();
    });
    ownedMaterials.forEach(material => {
      if (material && typeof material.dispose === 'function')
        material.dispose();
    });
    ownedTextures.forEach(texture => {
      if (texture && typeof texture.dispose === 'function') texture.dispose();
    });
    ownedGeometries.forEach(geometry => {
      if (geometry && typeof geometry.dispose === 'function')
        geometry.dispose();
    });
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }
};

let isRegistered = false;

export const ensureTSLMaterialBrowserValidatorRegistered = (): void => {
  if (isRegistered) return;
  setTSLMaterialBackendValidator(validateInBrowser);
  isRegistered = true;
};

/** @internal */
export const resetTSLMaterialBrowserValidatorForTests = (): void => {
  isRegistered = false;
  setTSLMaterialBackendValidator(null);
};
