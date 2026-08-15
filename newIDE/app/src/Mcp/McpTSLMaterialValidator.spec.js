// @flow

import fs from 'fs-extra';
// $FlowFixMe[cannot-resolve-module] Node-only test dependency.
import os from 'os';
// $FlowFixMe[cannot-resolve-module] Node-only test dependency.
import path from 'path';
import {
  buildTSLMaterialAuthoringArtifacts,
  clearVirtualTSLMaterialAuthoringArtifacts,
  registerVirtualTSLMaterialAuthoringArtifacts,
  TSL_MATERIAL_EXAMPLES,
  TSL_SOURCE_MAX_BYTES,
} from '../ProjectsStorage/TSLMaterialAuthoring';
import { setTSLMaterialBackendValidator } from '../TSLMaterial/TSLMaterialCompiler';
import {
  TSLMcpValidationError,
  validateTSLFileForMcp,
} from './McpTSLMaterialValidator';

const writeCatalogs = (root: string) => {
  const artifacts = buildTSLMaterialAuthoringArtifacts('');
  const directory = path.join(root, '.gdevelop');
  fs.ensureDirSync(directory);
  fs.writeFileSync(path.join(directory, 'project-api.d.ts'), '');
  fs.writeFileSync(path.join(directory, 'tsl-api.d.ts'), artifacts.tslApi);
  fs.writeFileSync(
    path.join(directory, 'tsl-catalog.json'),
    artifacts.tslCatalog
  );
};

describe('MCP single-file TSL material validator', () => {
  let root;
  let project;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'gdevelop-tsl-validator-'));
    fs.ensureDirSync(path.join(root, 'materials'));
    fs.writeFileSync(
      path.join(root, 'materials', 'Tint.tsl.ts'),
      TSL_MATERIAL_EXAMPLES[0].source
    );
    writeCatalogs(root);
    project = global.gd.ProjectHelper.createNewGDJSProject();
    project.setProjectFile(path.join(root, 'project.gdevelop'));
  });

  afterEach(() => {
    setTSLMaterialBackendValidator(null);
    clearVirtualTSLMaterialAuthoringArtifacts();
    project.delete();
    fs.removeSync(root);
  });

  test('validates a saved unregistered source without claiming activation', async () => {
    const result = await validateTSLFileForMcp({
      project,
      projectRoot: root,
      args: {
        file_path: 'materials/Tint.tsl.ts',
        validation_level: 'static',
      },
    });
    expect(result).toMatchObject({
      success: true,
      valid: true,
      activation_ready: false,
      source_mode: 'disk',
      file_path: 'materials/Tint.tsl.ts',
      registered_resource_name: null,
      validation_level: 'static',
      completed_stages: ['parse', 'policy', 'types', 'manifest'],
      structurally_valid: true,
      graph_validated: false,
      gpu_validated: false,
      catalogs: { source: 'disk', three_revision: '185' },
    });
    expect(result.validation_id).toMatch(/^[0-9a-f]{64}$/);
    expect(result.next_action).toContain('backend');
  });

  test('returns source diagnostics as a normal success result', async () => {
    fs.writeFileSync(
      path.join(root, 'materials', 'Tint.tsl.ts'),
      'import { nope } from "three/tsl";\nexport default nope;\n'
    );
    const result = await validateTSLFileForMcp({
      project,
      projectRoot: root,
      args: {
        file_path: 'materials/Tint.tsl.ts',
        validation_level: 'static',
        diagnostic_limit: 1,
      },
    });
    expect(result.success).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.activation_ready).toBe(false);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toMatch(/^TSL-/);
    expect(result.diagnostics[0].file_path).toBe('materials/Tint.tsl.ts');
  });

  test('finds a matching registered tslMaterial resource', async () => {
    const resource = new global.gd.TSLMaterialResource();
    resource.setName('Tint');
    resource.setFile('materials/Tint.tsl.ts');
    project.getResourcesManager().addResource(resource);
    resource.delete();
    const result = await validateTSLFileForMcp({
      project,
      projectRoot: root,
      args: {
        file_path: 'materials/Tint.tsl.ts',
        validation_level: 'graph',
      },
    });
    expect(result.valid).toBe(true);
    expect(result.registered_resource_name).toBe('Tint');
    expect(result.activation_ready).toBe(false);
    expect(result.graph_validated).toBe(true);
  });

  test.each([
    ['../Tint.tsl.ts', 'TSL-MCP-FILE-PATH-INVALID'],
    ['materials/Tint.ts', 'TSL-MCP-FILE-EXTENSION-INVALID'],
    ['materials/*.tsl.ts', 'TSL-MCP-FILE-PATH-INVALID'],
    ['https://example.com/Tint.tsl.ts', 'TSL-MCP-FILE-PATH-INVALID'],
  ])('rejects unsafe path %s', async (filePath, code) => {
    await expect(
      validateTSLFileForMcp({
        project,
        projectRoot: root,
        args: { file_path: filePath, validation_level: 'static' },
      })
    ).rejects.toMatchObject({ code });
  });

  test('rejects absolute, missing, directory, and symlink-escape paths', async () => {
    const directoryPath = path.join(root, 'materials', 'Folder.tsl.ts');
    fs.ensureDirSync(directoryPath);
    const outsideDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gdevelop-tsl-outside-')
    );
    const outsideLinkedDirectory = path.join(outsideDirectory, 'OutsideDir');
    fs.ensureDirSync(outsideLinkedDirectory);
    const linkedFile = path.join(root, 'materials', 'Linked.tsl.ts');
    fs.symlinkSync(outsideLinkedDirectory, linkedFile, 'junction');
    try {
      await expect(
        validateTSLFileForMcp({
          project,
          projectRoot: root,
          args: {
            file_path: path.join(root, 'materials', 'Tint.tsl.ts'),
            validation_level: 'static',
          },
        })
      ).rejects.toMatchObject({ code: 'TSL-MCP-FILE-PATH-INVALID' });
      await expect(
        validateTSLFileForMcp({
          project,
          projectRoot: root,
          args: {
            file_path: 'materials/Missing.tsl.ts',
            validation_level: 'static',
          },
        })
      ).rejects.toMatchObject({ code: 'TSL-MCP-FILE-NOT-FOUND' });
      await expect(
        validateTSLFileForMcp({
          project,
          projectRoot: root,
          args: {
            file_path: 'materials/Folder.tsl.ts',
            validation_level: 'static',
          },
        })
      ).rejects.toMatchObject({ code: 'TSL-MCP-FILE-PATH-INVALID' });
      await expect(
        validateTSLFileForMcp({
          project,
          projectRoot: root,
          args: {
            file_path: 'materials/Linked.tsl.ts',
            validation_level: 'static',
          },
        })
      ).rejects.toMatchObject({
        code: 'TSL-MCP-FILE-PATH-OUTSIDE-PROJECT',
      });
    } finally {
      fs.removeSync(outsideDirectory);
    }
  });

  test('rejects invalid UTF-8 and oversized sources before parsing', async () => {
    fs.writeFileSync(
      path.join(root, 'materials', 'Tint.tsl.ts'),
      // Invalid two-byte UTF-8 prefix followed by an ASCII opening parenthesis.
      Uint8Array.from([0xc3, 0x28])
    );
    await expect(
      validateTSLFileForMcp({
        project,
        projectRoot: root,
        args: {
          file_path: 'materials/Tint.tsl.ts',
          validation_level: 'static',
        },
      })
    ).rejects.toMatchObject({ code: 'TSL-MCP-FILE-PATH-INVALID' });

    fs.writeFileSync(
      path.join(root, 'materials', 'Tint.tsl.ts'),
      new Uint8Array(TSL_SOURCE_MAX_BYTES + 1).fill(0x20)
    );
    await expect(
      validateTSLFileForMcp({
        project,
        projectRoot: root,
        args: {
          file_path: 'materials/Tint.tsl.ts',
          validation_level: 'static',
        },
      })
    ).rejects.toMatchObject({ code: 'TSL-MCP-FILE-TOO-LARGE' });
  });

  test('bounds and explicitly reports diagnostic truncation', async () => {
    fs.writeFileSync(
      path.join(root, 'materials', 'Tint.tsl.ts'),
      `import { defineMaterial } from "@gdevelop/tsl";
import { unknownA, unknownB, unknownC } from "three/tsl";
export default defineMaterial({ apiVersion: 1, build({ material }) {
  material.colorNode = unknownA(unknownB(unknownC()));
} });`
    );
    const result = await validateTSLFileForMcp({
      project,
      projectRoot: root,
      args: {
        file_path: 'materials/Tint.tsl.ts',
        validation_level: 'static',
        diagnostic_limit: 1,
      },
    });
    expect(result.valid).toBe(false);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics_truncated).toBe(true);
    expect(result.diagnostics[0].line).toBeGreaterThanOrEqual(1);
    expect(result.diagnostics[0].column).toBeGreaterThanOrEqual(1);
    expect(result.diagnostics[0].source_excerpt.length).toBeLessThanOrEqual(
      240
    );
  });

  test('changes validation IDs when source bytes or fixture options change', async () => {
    const validate = (fixtureBaseMaterial: string): Promise<Object> =>
      validateTSLFileForMcp({
        project,
        projectRoot: root,
        args: {
          file_path: 'materials/Tint.tsl.ts',
          validation_level: 'static',
          fixture_base_material: fixtureBaseMaterial,
        },
      });
    const standard = await validate('standard');
    const basic = await validate('basic');
    expect(basic.validation_id).not.toBe(standard.validation_id);
    fs.appendFileSync(path.join(root, 'materials', 'Tint.tsl.ts'), '\n');
    const changedSource = await validate('standard');
    expect(changedSource.validation_id).not.toBe(standard.validation_id);
  });

  test('enforces the hard backend validation timeout and aborts queued GPU work', async () => {
    setTSLMaterialBackendValidator(
      ({ fixture }) =>
        new Promise((resolve, reject) => {
          fixture.abortSignal.addEventListener(
            'abort',
            () => reject(new Error('aborted by deadline')),
            { once: true }
          );
        })
    );
    await expect(
      validateTSLFileForMcp({
        project,
        projectRoot: root,
        args: {
          file_path: 'materials/Tint.tsl.ts',
          validation_level: 'backend',
          timeout_ms: 1000,
        },
      })
    ).rejects.toMatchObject({ code: 'TSL-MCP-TIMEOUT' });
  });

  test('reports only backend stages that actually completed', async () => {
    setTSLMaterialBackendValidator(async () => ({
      nodeBuilderValidated: false,
      gpuValidated: false,
      modelValidated: false,
      completedStages: ['nodeBuilder'],
      diagnostics: [
        {
          code: 'TSL-VAL-002',
          severity: 'error',
          stage: 'nodeBuilder',
          message: 'The node builder rejected the fixture.',
          file_path: 'materials/Tint.tsl.ts',
        },
      ],
    }));
    const result = await validateTSLFileForMcp({
      project,
      projectRoot: root,
      args: {
        file_path: 'materials/Tint.tsl.ts',
        validation_level: 'backend',
      },
    });
    expect(result).toMatchObject({
      success: true,
      valid: false,
      activation_ready: false,
      node_builder_validated: false,
      gpu_validated: false,
      completed_stages: [
        'parse',
        'policy',
        'types',
        'manifest',
        'graph',
        'nodeBuilder',
      ],
    });
    expect(result.completed_stages).not.toContain('gpu');
  });

  test('fails closed on stale catalogs and recommends regeneration', async () => {
    fs.appendFileSync(
      path.join(root, '.gdevelop', 'tsl-catalog.json'),
      'tampered'
    );
    await expect(
      validateTSLFileForMcp({
        project,
        projectRoot: root,
        args: {
          file_path: 'materials/Tint.tsl.ts',
          validation_level: 'static',
        },
      })
    ).rejects.toMatchObject({
      code: 'TSL-MCP-CATALOG-STALE',
      details: { nextAction: expect.stringContaining('generate-catalogs') },
    });
  });

  test('does not hide a partial disk catalog set behind virtual catalogs', async () => {
    const artifacts = buildTSLMaterialAuthoringArtifacts('');
    registerVirtualTSLMaterialAuthoringArtifacts({
      projectRoot: root,
      projectApiDeclaration: '',
      artifacts,
    });
    fs.removeSync(path.join(root, '.gdevelop', 'tsl-api.d.ts'));

    await expect(
      validateTSLFileForMcp({
        project,
        projectRoot: root,
        args: {
          file_path: 'materials/Tint.tsl.ts',
          validation_level: 'static',
        },
      })
    ).rejects.toMatchObject({
      code: 'TSL-MCP-CATALOG-MISSING',
      details: { nextAction: expect.stringContaining('generate-catalogs') },
    });
  });

  test('does not issue a receipt when bytes change during validation', async () => {
    const validation = validateTSLFileForMcp({
      project,
      projectRoot: root,
      args: {
        file_path: 'materials/Tint.tsl.ts',
        validation_level: 'static',
      },
    });
    fs.appendFileSync(path.join(root, 'materials', 'Tint.tsl.ts'), '\n');
    await expect(validation).rejects.toBeInstanceOf(TSLMcpValidationError);
    await expect(validation).rejects.toMatchObject({
      code: 'TSL-MCP-SOURCE-CHANGED',
    });
  });

  test('enforces model argument coupling and the unavailable WebGPU target', async () => {
    await expect(
      validateTSLFileForMcp({
        project,
        projectRoot: root,
        args: {
          file_path: 'materials/Tint.tsl.ts',
          validation_level: 'model',
        },
      })
    ).rejects.toMatchObject({ code: 'TSL-MCP-MODEL-REQUIRED' });
    await expect(
      validateTSLFileForMcp({
        project,
        projectRoot: root,
        args: {
          file_path: 'materials/Tint.tsl.ts',
          target: 'webgpu',
        },
      })
    ).rejects.toMatchObject({ code: 'TSL-MCP-TARGET-UNAVAILABLE' });
  });
});
