// @flow

import optionalRequire from '../Utils/OptionalRequire';

const defaultFileSystem = optionalRequire('fs');

const GLB_HEADER_LENGTH = 12;
const GLB_CHUNK_HEADER_LENGTH = 8;
const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const GLB_JSON_CHUNK_TYPE = 0x4e4f534a;

export const DEFAULT_GLB_MODEL_INSPECTION_LIMITS = Object.freeze({
  // The binary payload is never read, but bounding the container prevents
  // accidental inspection of an unexpectedly huge or corrupt file.
  maxFileSizeBytes: 1024 * 1024 * 1024,
  // Model metadata is normally much smaller than this, including large rigs.
  maxJsonChunkSizeBytes: 32 * 1024 * 1024,
  // GLB normally contains JSON and one BIN chunk. Keep malformed files from
  // forcing an unbounded number of synchronous header reads in the renderer.
  maxChunkCount: 64,
});

export type GlbModelInspection = {|
  animationNames: Array<string>,
  boneNames: Array<string>,
|};

export type GlbModelInspectionLimits = {|
  maxFileSizeBytes?: number,
  maxJsonChunkSizeBytes?: number,
  maxChunkCount?: number,
|};

type GlbByteReader = (offset: number, length: number) => Uint8Array;

export class GlbModelInspectionError extends Error {
  code: string;
  details: Object;

  constructor(code: string, message: string, details?: Object = {}) {
    super(message);
    this.name = 'GlbModelInspectionError';
    this.code = code;
    this.details = details;
  }
}

const inspectionError = (
  code: string,
  message: string,
  details?: Object
): GlbModelInspectionError =>
  new GlbModelInspectionError(code, message, details);

const resolveLimits = (
  limits?: GlbModelInspectionLimits = {}
): {|
  maxFileSizeBytes: number,
  maxJsonChunkSizeBytes: number,
  maxChunkCount: number,
|} => {
  const requestedMaxFileSizeBytes = limits.maxFileSizeBytes;
  const maxFileSizeBytes =
    typeof requestedMaxFileSizeBytes === 'number' &&
    Number.isFinite(requestedMaxFileSizeBytes) &&
    requestedMaxFileSizeBytes > 0
      ? Math.floor(requestedMaxFileSizeBytes)
      : DEFAULT_GLB_MODEL_INSPECTION_LIMITS.maxFileSizeBytes;
  const requestedMaxJsonChunkSizeBytes = limits.maxJsonChunkSizeBytes;
  const maxJsonChunkSizeBytes =
    typeof requestedMaxJsonChunkSizeBytes === 'number' &&
    Number.isFinite(requestedMaxJsonChunkSizeBytes) &&
    requestedMaxJsonChunkSizeBytes > 0
      ? Math.floor(requestedMaxJsonChunkSizeBytes)
      : DEFAULT_GLB_MODEL_INSPECTION_LIMITS.maxJsonChunkSizeBytes;
  const requestedMaxChunkCount = limits.maxChunkCount;
  const maxChunkCount =
    typeof requestedMaxChunkCount === 'number' &&
    Number.isFinite(requestedMaxChunkCount) &&
    requestedMaxChunkCount > 0
      ? Math.floor(requestedMaxChunkCount)
      : DEFAULT_GLB_MODEL_INSPECTION_LIMITS.maxChunkCount;
  return { maxFileSizeBytes, maxJsonChunkSizeBytes, maxChunkCount };
};

const readUint32LittleEndian = (bytes: Uint8Array, offset: number): number =>
  new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true);

const decodeJsonChunk = (jsonBytes: Uint8Array): Object => {
  let source;
  try {
    source = new TextDecoder().decode(jsonBytes);
  } catch (error) {
    throw inspectionError(
      'GLB_JSON_DECODE_FAILED',
      'The GLB JSON chunk could not be decoded as UTF-8.'
    );
  }

  try {
    const json = JSON.parse(source);
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      throw inspectionError(
        'GLB_STRUCTURE_INVALID',
        'The GLB JSON chunk must contain a JSON object.'
      );
    }
    return json;
  } catch (error) {
    if (error instanceof GlbModelInspectionError) throw error;
    throw inspectionError(
      'GLB_JSON_INVALID',
      `The GLB JSON chunk is invalid: ${
        error && error.message ? error.message : String(error)
      }`
    );
  }
};

/**
 * Extract the public names that GDevelop can safely use from parsed glTF JSON.
 *
 * Animation fallbacks match Three.js GLTFLoader. Bone names mirror the
 * selected scene and the runtime's `userData.name || bone.name` lookup. Names
 * that are empty, ambiguous, or depend on loader-generated fallbacks are
 * omitted.
 */
export const inspectGlbModelJson = (json: Object): GlbModelInspection => {
  const asset = json.asset;
  const assetVersion =
    asset && typeof asset === 'object' ? asset.version : undefined;
  const assetMajorVersion =
    typeof assetVersion === 'string' ? Number(assetVersion.split('.')[0]) : NaN;
  if (!Number.isFinite(assetMajorVersion) || assetMajorVersion < 2) {
    throw inspectionError(
      'GLB_UNSUPPORTED_ASSET_VERSION',
      'The GLB JSON must declare glTF asset version 2.0 or newer.',
      { assetVersion }
    );
  }

  const animationDefinitions =
    json.animations === undefined ? [] : json.animations;
  if (!Array.isArray(animationDefinitions)) {
    throw inspectionError(
      'GLB_STRUCTURE_INVALID',
      'The GLB "animations" property must be an array.'
    );
  }
  const animationNames = animationDefinitions.map((animation, index) => {
    if (!animation || typeof animation !== 'object') {
      throw inspectionError(
        'GLB_STRUCTURE_INVALID',
        `GLB animation ${index} must be an object.`,
        { animationIndex: index }
      );
    }
    if (animation.name !== undefined && typeof animation.name !== 'string') {
      throw inspectionError(
        'GLB_STRUCTURE_INVALID',
        `GLB animation ${index} name must be a string.`,
        { animationIndex: index }
      );
    }
    return animation.name || `animation_${index}`;
  });

  const nodeDefinitions = json.nodes === undefined ? [] : json.nodes;
  if (!Array.isArray(nodeDefinitions)) {
    throw inspectionError(
      'GLB_STRUCTURE_INVALID',
      'The GLB "nodes" property must be an array.'
    );
  }
  const skinDefinitions = json.skins === undefined ? [] : json.skins;
  if (!Array.isArray(skinDefinitions)) {
    throw inspectionError(
      'GLB_STRUCTURE_INVALID',
      'The GLB "skins" property must be an array.'
    );
  }
  const sceneDefinitions = json.scenes;
  if (!Array.isArray(sceneDefinitions) || sceneDefinitions.length === 0) {
    throw inspectionError(
      'GLB_STRUCTURE_INVALID',
      'The GLB must contain at least one scene for GDevelop to load.'
    );
  }
  const selectedSceneIndex = json.scene === undefined ? 0 : json.scene;
  if (
    !Number.isInteger(selectedSceneIndex) ||
    selectedSceneIndex < 0 ||
    selectedSceneIndex >= sceneDefinitions.length
  ) {
    throw inspectionError(
      'GLB_STRUCTURE_INVALID',
      `The GLB default scene index ${String(selectedSceneIndex)} is invalid.`,
      { selectedSceneIndex }
    );
  }

  skinDefinitions.forEach((skin, skinIndex) => {
    if (!skin || typeof skin !== 'object' || !Array.isArray(skin.joints)) {
      throw inspectionError(
        'GLB_STRUCTURE_INVALID',
        `GLB skin ${skinIndex} must contain a joints array.`,
        { skinIndex }
      );
    }
    skin.joints.forEach((jointNodeIndex, jointIndex) => {
      if (
        !Number.isInteger(jointNodeIndex) ||
        jointNodeIndex < 0 ||
        jointNodeIndex >= nodeDefinitions.length
      ) {
        throw inspectionError(
          'GLB_STRUCTURE_INVALID',
          `GLB skin ${skinIndex} joint ${jointIndex} references invalid node index ${String(
            jointNodeIndex
          )}.`,
          { skinIndex, jointIndex, jointNodeIndex }
        );
      }
    });
  });

  nodeDefinitions.forEach((node, nodeIndex) => {
    if (!node || typeof node !== 'object') {
      throw inspectionError(
        'GLB_STRUCTURE_INVALID',
        `GLB node ${nodeIndex} must be an object.`,
        { nodeIndex }
      );
    }
    if (node.name !== undefined && typeof node.name !== 'string') {
      throw inspectionError(
        'GLB_STRUCTURE_INVALID',
        `GLB node ${nodeIndex} name must be a string when specified.`,
        { nodeIndex }
      );
    }
    const children = node.children === undefined ? [] : node.children;
    if (!Array.isArray(children)) {
      throw inspectionError(
        'GLB_STRUCTURE_INVALID',
        `GLB node ${nodeIndex} must contain a children array when children are specified.`,
        { nodeIndex }
      );
    }
    children.forEach(childNodeIndex => {
      if (
        !Number.isInteger(childNodeIndex) ||
        childNodeIndex < 0 ||
        childNodeIndex >= nodeDefinitions.length
      ) {
        throw inspectionError(
          'GLB_STRUCTURE_INVALID',
          `GLB node ${nodeIndex} references invalid child node index ${String(
            childNodeIndex
          )}.`,
          { nodeIndex, childNodeIndex }
        );
      }
    });
    const skinIndex = node.skin;
    if (
      skinIndex !== undefined &&
      (!Number.isInteger(skinIndex) ||
        skinIndex < 0 ||
        skinIndex >= skinDefinitions.length)
    ) {
      throw inspectionError(
        'GLB_STRUCTURE_INVALID',
        `GLB node ${nodeIndex} references invalid skin index ${String(
          skinIndex
        )}.`,
        { nodeIndex, skinIndex }
      );
    }
  });

  const sceneRootNodeIndexes: Array<Array<number>> = [];
  sceneDefinitions.forEach((scene, sceneIndex) => {
    if (!scene || typeof scene !== 'object') {
      throw inspectionError(
        'GLB_STRUCTURE_INVALID',
        `GLB scene ${sceneIndex} must be an object.`,
        { sceneIndex }
      );
    }
    if (scene.name !== undefined && typeof scene.name !== 'string') {
      throw inspectionError(
        'GLB_STRUCTURE_INVALID',
        `GLB scene ${sceneIndex} name must be a string when specified.`,
        { sceneIndex }
      );
    }
    const rootNodeIndexes = scene.nodes === undefined ? [] : scene.nodes;
    if (!Array.isArray(rootNodeIndexes)) {
      throw inspectionError(
        'GLB_STRUCTURE_INVALID',
        `GLB scene ${sceneIndex} must contain a nodes array when nodes are specified.`,
        { sceneIndex }
      );
    }
    rootNodeIndexes.forEach(nodeIndex => {
      if (
        !Number.isInteger(nodeIndex) ||
        nodeIndex < 0 ||
        nodeIndex >= nodeDefinitions.length
      ) {
        throw inspectionError(
          'GLB_STRUCTURE_INVALID',
          `GLB scene ${sceneIndex} references invalid node index ${String(
            nodeIndex
          )}.`,
          { sceneIndex, nodeIndex }
        );
      }
    });
    sceneRootNodeIndexes.push(rootNodeIndexes);
  });

  // GDevelop builds its cache by traversing GLTFLoader's selected scene only.
  // Skin joints loaded as detached dependencies and bones in other scenes are
  // therefore not usable runtime identifiers.
  const reachableNodeIndexes = new Set<number>();
  const pendingReachableNodeIndexes = [
    ...sceneRootNodeIndexes[selectedSceneIndex],
  ];
  while (pendingReachableNodeIndexes.length > 0) {
    const maybeNodeIndex = pendingReachableNodeIndexes.pop();
    if (maybeNodeIndex === undefined) continue;
    const nodeIndex = maybeNodeIndex;
    if (reachableNodeIndexes.has(nodeIndex)) continue;
    reachableNodeIndexes.add(nodeIndex);
    const children = nodeDefinitions[nodeIndex].children || [];
    for (let index = 0; index < children.length; index++) {
      pendingReachableNodeIndexes.push(children[index]);
    }
  }

  const jointNodeIndexes = new Set<number>();
  skinDefinitions.forEach(skin => {
    skin.joints.forEach(jointNodeIndex => {
      if (reachableNodeIndexes.has(jointNodeIndex)) {
        jointNodeIndexes.add(jointNodeIndex);
      }
    });
  });

  const countByBoneName: Map<string, number> = new Map();
  jointNodeIndexes.forEach(nodeIndex => {
    const node = nodeDefinitions[nodeIndex];
    let canonicalName = typeof node.name === 'string' ? node.name : '';
    const extras = node.extras;
    if (extras && typeof extras === 'object' && extras.name !== undefined) {
      // GLTFLoader assigns extras after preserving node.name in userData.
      // If extras.name is not a non-empty string, GDevelop falls back to the
      // loader-generated Object3D name. It shares a uniqueness namespace with
      // scenes, meshes, cameras, and lights, so omit what metadata-only
      // inspection cannot promise exactly.
      canonicalName =
        typeof extras.name === 'string' && extras.name ? extras.name : '';
    }
    if (!canonicalName) return;
    countByBoneName.set(
      canonicalName,
      (countByBoneName.get(canonicalName) || 0) + 1
    );
  });

  const boneNames = Array.from(countByBoneName.entries())
    .filter(([, count]) => count === 1)
    .map(([name]) => name)
    .sort();

  return { animationNames, boneNames };
};

const inspectGlbModelWithReader = ({
  byteLength,
  readBytes,
  limits,
}: {|
  byteLength: number,
  readBytes: GlbByteReader,
  limits?: GlbModelInspectionLimits,
|}): GlbModelInspection => {
  const {
    maxFileSizeBytes,
    maxJsonChunkSizeBytes,
    maxChunkCount,
  } = resolveLimits(limits);
  if (byteLength > maxFileSizeBytes) {
    throw inspectionError(
      'GLB_FILE_TOO_LARGE',
      `The GLB file is ${byteLength} bytes, exceeding the ${maxFileSizeBytes}-byte inspection limit.`,
      { byteLength, maxFileSizeBytes }
    );
  }
  if (byteLength < GLB_HEADER_LENGTH) {
    throw inspectionError(
      'GLB_FILE_TOO_SMALL',
      `The GLB file is shorter than its ${GLB_HEADER_LENGTH}-byte header.`,
      { byteLength }
    );
  }

  const header = readBytes(0, GLB_HEADER_LENGTH);
  if (readUint32LittleEndian(header, 0) !== GLB_MAGIC) {
    throw inspectionError(
      'GLB_INVALID_MAGIC',
      'The file is not a GLB: expected the "glTF" binary header.'
    );
  }
  const version = readUint32LittleEndian(header, 4);
  if (version !== GLB_VERSION) {
    throw inspectionError(
      'GLB_UNSUPPORTED_VERSION',
      `Unsupported GLB version ${version}; only GLB version 2 is supported.`,
      { version }
    );
  }
  const declaredLength = readUint32LittleEndian(header, 8);
  if (declaredLength !== byteLength) {
    throw inspectionError(
      'GLB_LENGTH_MISMATCH',
      `The GLB header declares ${declaredLength} bytes, but the file contains ${byteLength} bytes.`,
      { declaredLength, byteLength }
    );
  }

  let offset = GLB_HEADER_LENGTH;
  let chunkIndex = 0;
  let jsonBytes = null;
  while (offset < declaredLength) {
    if (chunkIndex >= maxChunkCount) {
      throw inspectionError(
        'GLB_TOO_MANY_CHUNKS',
        `The GLB contains more than the ${maxChunkCount}-chunk inspection limit.`,
        { maxChunkCount }
      );
    }
    if (declaredLength - offset < GLB_CHUNK_HEADER_LENGTH) {
      throw inspectionError(
        'GLB_INVALID_CHUNK',
        `GLB chunk ${chunkIndex} has a truncated header.`,
        { chunkIndex, offset }
      );
    }
    const chunkHeader = readBytes(offset, GLB_CHUNK_HEADER_LENGTH);
    const chunkLength = readUint32LittleEndian(chunkHeader, 0);
    const chunkType = readUint32LittleEndian(chunkHeader, 4);
    if (chunkLength % 4 !== 0) {
      throw inspectionError(
        'GLB_INVALID_CHUNK',
        `GLB chunk ${chunkIndex} length is not aligned to 4 bytes.`,
        { chunkIndex, offset, chunkLength }
      );
    }
    const contentOffset = offset + GLB_CHUNK_HEADER_LENGTH;
    const contentEnd = contentOffset + chunkLength;
    if (contentEnd > declaredLength) {
      throw inspectionError(
        'GLB_INVALID_CHUNK',
        `GLB chunk ${chunkIndex} extends beyond the declared file length.`,
        { chunkIndex, offset, chunkLength, declaredLength }
      );
    }
    if (chunkIndex === 0 && chunkType !== GLB_JSON_CHUNK_TYPE) {
      throw inspectionError(
        'GLB_JSON_CHUNK_MISSING',
        'The first GLB chunk must be the JSON chunk.',
        { chunkType }
      );
    }
    if (chunkType === GLB_JSON_CHUNK_TYPE) {
      if (jsonBytes) {
        throw inspectionError(
          'GLB_INVALID_CHUNK',
          'The GLB contains more than one JSON chunk.',
          { chunkIndex }
        );
      }
      if (chunkLength === 0) {
        throw inspectionError(
          'GLB_JSON_INVALID',
          'The GLB JSON chunk is empty.'
        );
      }
      if (chunkLength > maxJsonChunkSizeBytes) {
        throw inspectionError(
          'GLB_JSON_TOO_LARGE',
          `The GLB JSON chunk is ${chunkLength} bytes, exceeding the ${maxJsonChunkSizeBytes}-byte inspection limit.`,
          { chunkLength, maxJsonChunkSizeBytes }
        );
      }
      jsonBytes = readBytes(contentOffset, chunkLength);
    }
    offset = contentEnd;
    chunkIndex++;
  }

  if (!jsonBytes) {
    throw inspectionError(
      'GLB_JSON_CHUNK_MISSING',
      'The GLB does not contain a JSON chunk.'
    );
  }
  return inspectGlbModelJson(decodeJsonChunk(jsonBytes));
};

/** Inspect in-memory GLB data. Useful for focused tests and non-file callers. */
export const inspectGlbModelBytes = (
  data: any,
  limits?: GlbModelInspectionLimits
): GlbModelInspection => {
  let bytes;
  if (data instanceof Uint8Array) {
    bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  } else if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else {
    throw inspectionError(
      'GLB_INPUT_INVALID',
      'GLB data must be an ArrayBuffer or Uint8Array.'
    );
  }
  return inspectGlbModelWithReader({
    byteLength: bytes.byteLength,
    readBytes: (offset, length) => bytes.subarray(offset, offset + length),
    limits,
  });
};

const readFileBytesExactly = (
  fileSystem: any,
  fileDescriptor: number,
  offset: number,
  length: number
): Uint8Array => {
  const bytes = new Uint8Array(length);
  let bytesRead = 0;
  while (bytesRead < length) {
    const readCount = fileSystem.readSync(
      fileDescriptor,
      bytes,
      bytesRead,
      length - bytesRead,
      offset + bytesRead
    );
    if (!readCount) {
      throw inspectionError(
        'GLB_FILE_TRUNCATED',
        'The GLB file changed or ended while it was being inspected.',
        { offset, length, bytesRead }
      );
    }
    bytesRead += readCount;
  }
  return bytes;
};

/**
 * Inspect a GLB on disk without reading its mesh, image, or binary-buffer data.
 * The caller is responsible for resolving and authorizing the file path.
 */
export const inspectGlbModelFile = (
  filePath: string,
  options?: {|
    fileSystem?: any,
    limits?: GlbModelInspectionLimits,
  |} = {}
): GlbModelInspection => {
  const fileSystem = options.fileSystem || defaultFileSystem;
  if (!fileSystem) {
    throw inspectionError(
      'GLB_FILE_SYSTEM_UNAVAILABLE',
      'Local filesystem access is unavailable in this GDevelop build.'
    );
  }
  if (typeof filePath !== 'string' || !filePath) {
    throw inspectionError(
      'GLB_FILE_PATH_INVALID',
      'The GLB file path must be a non-empty string.'
    );
  }

  let stat;
  try {
    stat = fileSystem.statSync(filePath);
  } catch (error) {
    const isMissing = error && error.code === 'ENOENT';
    throw inspectionError(
      isMissing ? 'GLB_FILE_NOT_FOUND' : 'GLB_FILE_READ_FAILED',
      isMissing
        ? `GLB file not found: ${filePath}`
        : `Unable to inspect GLB file "${filePath}": ${
            error && error.message ? error.message : String(error)
          }`,
      { filePath }
    );
  }
  if (!stat.isFile()) {
    throw inspectionError(
      'GLB_FILE_NOT_REGULAR',
      `The GLB path is not a regular file: ${filePath}`,
      { filePath }
    );
  }

  const { maxFileSizeBytes } = resolveLimits(options.limits);
  if (stat.size > maxFileSizeBytes) {
    throw inspectionError(
      'GLB_FILE_TOO_LARGE',
      `The GLB file is ${
        stat.size
      } bytes, exceeding the ${maxFileSizeBytes}-byte inspection limit.`,
      { filePath, byteLength: stat.size, maxFileSizeBytes }
    );
  }

  let fileDescriptor;
  try {
    fileDescriptor = fileSystem.openSync(filePath, 'r');
    return inspectGlbModelWithReader({
      byteLength: stat.size,
      readBytes: (offset, length) =>
        readFileBytesExactly(fileSystem, (fileDescriptor: any), offset, length),
      limits: options.limits,
    });
  } catch (error) {
    if (error instanceof GlbModelInspectionError) throw error;
    throw inspectionError(
      'GLB_FILE_READ_FAILED',
      `Unable to inspect GLB file "${filePath}": ${
        error && error.message ? error.message : String(error)
      }`,
      { filePath }
    );
  } finally {
    if (fileDescriptor !== undefined) {
      try {
        fileSystem.closeSync(fileDescriptor);
      } catch (error) {
        // The inspection result/error is more useful than a close failure.
      }
    }
  }
};
