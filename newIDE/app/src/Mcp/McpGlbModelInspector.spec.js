// @flow

import {
  GlbModelInspectionError,
  inspectGlbModelBytes,
  inspectGlbModelFile,
  inspectGlbModelJson,
} from './McpGlbModelInspector';

// $FlowFixMe[cannot-resolve-module]
const fs = require('fs');
// $FlowFixMe[cannot-resolve-module]
const os = require('os');
// $FlowFixMe[cannot-resolve-module]
const path = require('path');
// $FlowFixMe[cannot-resolve-module]
const BufferClass = require('buffer').Buffer;

const JSON_CHUNK_TYPE = 0x4e4f534a;

const makeGlb = (
  json: Object,
  options: {|
    binaryChunkLength?: number,
    chunkType?: number,
    trailingBytes?: number,
  |} = {}
): any => {
  const source = BufferClass.from(JSON.stringify(json), 'utf8');
  const jsonChunkLength = Math.ceil(source.length / 4) * 4;
  const binaryChunkLength = options.binaryChunkLength || 0;
  const trailingBytes = options.trailingBytes || 0;
  const binaryContainerLength = binaryChunkLength ? 8 + binaryChunkLength : 0;
  const glb = BufferClass.alloc(
    12 + 8 + jsonChunkLength + binaryContainerLength + trailingBytes,
    0x20
  );
  glb.write('glTF', 0, 'ascii');
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(jsonChunkLength, 12);
  glb.writeUInt32LE(
    options.chunkType === undefined ? JSON_CHUNK_TYPE : options.chunkType,
    16
  );
  source.copy(glb, 20);
  if (binaryChunkLength) {
    const binaryChunkOffset = 20 + jsonChunkLength;
    glb.writeUInt32LE(binaryChunkLength, binaryChunkOffset);
    glb.writeUInt32LE(0x004e4942, binaryChunkOffset + 4);
    glb.fill(
      0xab,
      binaryChunkOffset + 8,
      binaryChunkOffset + 8 + binaryChunkLength
    );
  }
  return glb;
};

const appendEmptyChunks = (glb: any, chunkCount: number): any => {
  const chunks = BufferClass.alloc(chunkCount * 8);
  for (let index = 0; index < chunkCount; index++) {
    chunks.writeUInt32LE(0, index * 8);
    chunks.writeUInt32LE(0x004e4942, index * 8 + 4);
  }
  const result = BufferClass.concat([glb, chunks]);
  result.writeUInt32LE(result.length, 8);
  return result;
};

const captureInspectionError = (callback: () => mixed) => {
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(GlbModelInspectionError);
    return error;
  }
  throw new Error('Expected GLB inspection to fail.');
};

describe('McpGlbModelInspector', () => {
  let temporaryDirectory = null;

  afterEach(() => {
    if (temporaryDirectory) {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
      temporaryDirectory = null;
    }
  });

  it('extracts Three-compatible animation names and exact usable joint names', () => {
    const inspection = inspectGlbModelBytes(
      makeGlb({
        asset: { version: '2.0' },
        animations: [{ name: 'Idle' }, {}, { name: '' }, { name: 'Walk.Fast' }],
        nodes: [
          { name: 'Mesh' },
          { name: 'Root' },
          { name: 'Arm.L' },
          { name: 'Ambiguous' },
          { name: 'Ambiguous' },
          {},
          { name: 'root' },
        ],
        scenes: [{ nodes: [0, 1, 2, 3, 4, 5, 6] }],
        skins: [{ joints: [1, 2, 3, 1] }, { joints: [2, 4, 5, 6] }],
      })
    );

    expect(inspection).toEqual({
      animationNames: ['Idle', 'animation_1', 'animation_2', 'Walk.Fast'],
      // Sorting and duplicate handling are exact and case-sensitive. A joint
      // reused by two skins is still one bone; two distinct same-name joints
      // are ambiguous and both are omitted.
      boneNames: ['Arm.L', 'Root', 'root'],
    });
  });

  it('handles models without animations or skins', () => {
    expect(
      inspectGlbModelJson({
        asset: { version: '2.0' },
        nodes: [],
        scenes: [{ nodes: [] }],
      })
    ).toEqual({ animationNames: [], boneNames: [] });
  });

  it('returns canonical authored and extras bone names', () => {
    expect(
      inspectGlbModelJson({
        asset: { version: '2.0' },
        scenes: [{ nodes: [0, 1, 2, 3] }],
        nodes: [
          { name: 'Arm.L', extras: { name: 'Socket' } },
          { extras: { name: 'ExtraOnly' } },
          { name: 'Hand.R', extras: { name: '' } },
          { name: 'Spine 01' },
        ],
        skins: [{ joints: [0, 1, 2, 3] }],
      })
    ).toEqual({
      animationNames: [],
      // Empty extras.name forces a loader-generated fallback. It is omitted
      // because meshes, cameras, lights, and scenes share the suffix namespace.
      boneNames: ['ExtraOnly', 'Socket', 'Spine 01'],
    });
  });

  it('omits bone fallbacks whose loader suffix depends on other object names', () => {
    expect(
      inspectGlbModelJson({
        asset: { version: '2.0' },
        cameras: [{ name: 'HandR', type: 'perspective', perspective: {} }],
        scenes: [{ nodes: [0, 1] }],
        nodes: [{ camera: 0 }, { name: 'Hand.R', extras: { name: '' } }],
        skins: [{ joints: [1] }],
      })
    ).toEqual({ animationNames: [], boneNames: [] });
  });

  it('rejects non-string animation names instead of inventing a clip name', () => {
    const error = captureInspectionError(() =>
      inspectGlbModelJson({
        asset: { version: '2.0' },
        animations: [{ name: 42 }],
        scenes: [{ nodes: [] }],
      })
    );
    expect(error.code).toBe('GLB_STRUCTURE_INVALID');
    expect(error.details).toEqual({ animationIndex: 0 });
  });

  it('only returns bones reachable through the selected GLB scene', () => {
    expect(
      inspectGlbModelJson({
        asset: { version: '2.0' },
        scene: 1,
        scenes: [{ nodes: [0] }, { nodes: [1] }],
        nodes: [
          { name: 'InactiveRoot', children: [2] },
          { name: 'ActiveRoot', children: [3] },
          { name: 'InactiveBone' },
          { name: 'ActiveBone' },
        ],
        skins: [{ joints: [2, 3] }],
      })
    ).toEqual({ animationNames: [], boneNames: ['ActiveBone'] });
  });

  it('handles a wide scene hierarchy without spreading child arguments', () => {
    const childCount = 200000;
    const children = Array.from(
      { length: childCount },
      (_, index) => index + 1
    );
    const nodes: Array<Object> = [{ children }];
    for (let index = 0; index < childCount; index++) nodes.push({});

    expect(
      inspectGlbModelJson({
        asset: { version: '2.0' },
        scenes: [{ nodes: [0] }],
        nodes,
      })
    ).toEqual({ animationNames: [], boneNames: [] });
  });

  it.each([undefined, '1.0', 'not-a-version'])(
    'rejects unsupported glTF asset version %p',
    assetVersion => {
      const asset =
        assetVersion === undefined ? undefined : { version: assetVersion };
      const error = captureInspectionError(() =>
        inspectGlbModelJson({ asset })
      );
      expect(error.code).toBe('GLB_UNSUPPORTED_ASSET_VERSION');
    }
  );

  it('rejects invalid joint indexes instead of returning misleading names', () => {
    const error = captureInspectionError(() =>
      inspectGlbModelJson({
        asset: { version: '2.0' },
        nodes: [{ name: 'Root' }],
        scenes: [{ nodes: [0] }],
        skins: [{ joints: [1] }],
      })
    );
    expect(error.code).toBe('GLB_STRUCTURE_INVALID');
    expect(error.details).toEqual({
      skinIndex: 0,
      jointIndex: 0,
      jointNodeIndex: 1,
    });
  });

  it.each([
    {
      label: 'wrong magic',
      mutate: (glb: any) => glb.write('nope', 0, 'ascii'),
      code: 'GLB_INVALID_MAGIC',
    },
    {
      label: 'non-v2 header',
      mutate: (glb: any) => glb.writeUInt32LE(1, 4),
      code: 'GLB_UNSUPPORTED_VERSION',
    },
    {
      label: 'incorrect declared length',
      mutate: (glb: any) => glb.writeUInt32LE(glb.length - 4, 8),
      code: 'GLB_LENGTH_MISMATCH',
    },
    {
      label: 'JSON chunk extending beyond the file',
      mutate: (glb: any) => glb.writeUInt32LE(glb.readUInt32LE(12) + 4, 12),
      code: 'GLB_INVALID_CHUNK',
    },
  ])('rejects a malformed GLB $label', ({ mutate, code }) => {
    const glb = makeGlb({ asset: { version: '2.0' } });
    mutate(glb);
    expect(captureInspectionError(() => inspectGlbModelBytes(glb)).code).toBe(
      code
    );
  });

  it('requires the JSON chunk to be first and valid', () => {
    const wrongFirstChunk = makeGlb(
      { asset: { version: '2.0' } },
      { chunkType: 0x004e4942 }
    );
    expect(
      captureInspectionError(() => inspectGlbModelBytes(wrongFirstChunk)).code
    ).toBe('GLB_JSON_CHUNK_MISSING');

    const invalidJson = makeGlb({ asset: { version: '2.0' } });
    invalidJson.fill(0x78, 20);
    expect(
      captureInspectionError(() => inspectGlbModelBytes(invalidJson)).code
    ).toBe('GLB_JSON_INVALID');
  });

  it('validates every chunk boundary after the JSON metadata', () => {
    const glb = makeGlb({ asset: { version: '2.0' } }, { trailingBytes: 4 });
    expect(captureInspectionError(() => inspectGlbModelBytes(glb)).code).toBe(
      'GLB_INVALID_CHUNK'
    );
  });

  it('caps the number of chunks inspected', () => {
    const glb = appendEmptyChunks(
      makeGlb({ asset: { version: '2.0' }, scenes: [{ nodes: [] }] }),
      3
    );
    const error = captureInspectionError(() =>
      inspectGlbModelBytes(glb, { maxChunkCount: 3 })
    );
    expect(error.code).toBe('GLB_TOO_MANY_CHUNKS');
    expect(error.details).toEqual({ maxChunkCount: 3 });
  });

  it('enforces independent file and JSON metadata size limits', () => {
    const glb = makeGlb({ asset: { version: '2.0' }, nodes: [] });
    expect(
      captureInspectionError(() =>
        inspectGlbModelBytes(glb, { maxFileSizeBytes: glb.length - 1 })
      ).code
    ).toBe('GLB_FILE_TOO_LARGE');
    expect(
      captureInspectionError(() =>
        inspectGlbModelBytes(glb, { maxJsonChunkSizeBytes: 4 })
      ).code
    ).toBe('GLB_JSON_TOO_LARGE');
  });

  it('inspects a file without reading the binary payload into memory', () => {
    temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gdevelop-glb-inspection-')
    );
    const filePath = path.join(temporaryDirectory, 'hero.glb');
    const glb = makeGlb(
      {
        asset: { version: '2.0' },
        animations: [{ name: 'Run' }],
        nodes: [{ name: 'Hips' }],
        scenes: [{ nodes: [0] }],
        skins: [{ joints: [0] }],
      },
      { binaryChunkLength: 64 }
    );
    fs.writeFileSync(filePath, glb);
    const jsonChunkLength = glb.readUInt32LE(12);
    const binaryContentOffset = 20 + jsonChunkLength + 8;
    const readRanges: Array<{| length: number, position: number |}> = [];
    const countingFileSystem = {
      statSync: fs.statSync,
      openSync: fs.openSync,
      closeSync: fs.closeSync,
      readSync: (
        fileDescriptor: number,
        buffer: any,
        offset: number,
        length: number,
        position: number
      ) => {
        readRanges.push({ length, position });
        return fs.readSync(fileDescriptor, buffer, offset, length, position);
      },
    };

    expect(
      inspectGlbModelFile(filePath, { fileSystem: countingFileSystem })
    ).toEqual({
      animationNames: ['Run'],
      boneNames: ['Hips'],
    });
    expect(readRanges).toContainEqual({
      length: 8,
      position: 20 + jsonChunkLength,
    });
    expect(
      readRanges.some(({ position }) => position >= binaryContentOffset)
    ).toBe(false);
  });

  it('returns a stable error code for a missing file', () => {
    temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gdevelop-glb-inspection-')
    );
    const error = captureInspectionError(() =>
      inspectGlbModelFile(path.join(temporaryDirectory, 'missing.glb'))
    );
    expect(error.code).toBe('GLB_FILE_NOT_FOUND');
  });
});
