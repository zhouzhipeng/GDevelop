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
  options: {| chunkType?: number, trailingBytes?: number |} = {}
): any => {
  const source = BufferClass.from(JSON.stringify(json), 'utf8');
  const jsonChunkLength = Math.ceil(source.length / 4) * 4;
  const trailingBytes = options.trailingBytes || 0;
  const glb = BufferClass.alloc(12 + 8 + jsonChunkLength + trailingBytes, 0x20);
  glb.write('glTF', 0, 'ascii');
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(jsonChunkLength, 12);
  glb.writeUInt32LE(
    options.chunkType === undefined ? JSON_CHUNK_TYPE : options.chunkType,
    16
  );
  source.copy(glb, 20);
  return glb;
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
        animations: [
          { name: 'Idle' },
          {},
          { name: '' },
          { name: 'Walk.Fast' },
          { name: 42 },
        ],
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
      animationNames: [
        'Idle',
        'animation_1',
        'animation_2',
        'Walk.Fast',
        'animation_4',
      ],
      // Sorting and duplicate handling are exact and case-sensitive. A joint
      // reused by two skins is still one bone; two distinct same-name joints
      // are ambiguous and both are omitted.
      boneNames: ['Arm.L', 'Root', 'root'],
    });
  });

  it('handles models without animations or skins', () => {
    expect(
      inspectGlbModelJson({ asset: { version: '2.0' }, nodes: [] })
    ).toEqual({ animationNames: [], boneNames: [] });
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
    fs.writeFileSync(
      filePath,
      makeGlb({
        asset: { version: '2.0' },
        animations: [{ name: 'Run' }],
        nodes: [{ name: 'Hips' }],
        scenes: [{ nodes: [0] }],
        skins: [{ joints: [0] }],
      })
    );

    expect(inspectGlbModelFile(filePath)).toEqual({
      animationNames: ['Run'],
      boneNames: ['Hips'],
    });
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
