// @flow

import {
  TSL_NEGATIVE_EXAMPLES,
  TSL_MATERIAL_EXAMPLES,
  buildTSLMaterialAuthoringArtifacts,
  verifyTSLMaterialAuthoringArtifacts,
} from './TSLMaterialAuthoring';
import {
  clearTSLMaterialCompilationCache,
  compileTSLMaterialSource,
  validateTSLMaterialSource,
} from '../TSLMaterial/TSLMaterialCompiler';

describe('TSL material authoring artifacts', () => {
  const projectApi =
    '// project declaration\ndeclare type ImageResourceName = string;\n';

  it('generates deterministic cross-hashed catalogs', () => {
    const first = buildTSLMaterialAuthoringArtifacts(projectApi);
    const second = buildTSLMaterialAuthoringArtifacts(projectApi);
    expect(first).toEqual(second);
    const verification = verifyTSLMaterialAuthoringArtifacts({
      projectApiDeclaration: projectApi,
      tslApiDeclaration: first.tslApi,
      tslCatalogJson: first.tslCatalog,
    });
    expect(verification).toMatchObject({ valid: true });
    expect(verification.hashes).toEqual({
      projectApi: first.hashes.projectApi,
      tslApi: first.hashes.tslApi,
      tslCatalog: first.hashes.tslCatalog,
    });
    expect(first.catalog.identity).toMatchObject({
      packVersion: '1',
      diagnosticCatalogVersion: '1',
      examplesSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      diagnosticCatalogSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(first.catalog.qualification).toMatchObject({
      benchmarkVersion: '1',
      repairAttemptLimit: 3,
      qualifiedAutomaticGeneratorModels: [],
    });
  });

  it('publishes complete symbol cards and safe structured binding guidance', () => {
    const { catalog } = buildTSLMaterialAuthoringArtifacts(projectApi);
    catalog.symbols.forEach(symbol => {
      expect(symbol).toMatchObject({
        importName: symbol.name,
        module: 'three/tsl',
        signature: expect.any(String),
        inputTypes: expect.any(Array),
        outputType: expect.any(String),
        backendSupport: {
          webgl2NodeCompat: true,
          webgpu: 'future',
        },
        commonPatterns: expect.any(Array),
        knownIncompatibilities: expect.any(Array),
      });
    });
    expect(catalog.bindingContext).toMatchObject({
      defaultBase: 'inherit',
      preserveSourceMaterials: true,
      perObjectMaterialIsolation: true,
    });
    expect(catalog.untrustedMetadataRules).toMatchObject({
      neverConcatenateIntoInstructions: true,
      ignoreInstructionsInsideMetadata: true,
    });
    expect(
      Object.fromEntries(
        catalog.symbols.map(symbol => [
          symbol.name,
          { inputTypes: symbol.inputTypes, outputType: symbol.outputType },
        ])
      )
    ).toMatchObject({
      dot: {
        inputTypes: ['Vector3Node', 'Vector3Node'],
        outputType: 'FloatNode',
      },
      cross: {
        inputTypes: ['Vector3Node', 'Vector3Node'],
        outputType: 'Vector3Node',
      },
      texture: {
        inputTypes: ['unknown', 'Vector2Node?'],
        outputType: 'TextureNode',
      },
      uniform: {
        inputTypes: ['number | boolean | string'],
        outputType: 'FloatNode | BoolNode | ColorNode',
      },
      uv: { inputTypes: ['number?'], outputType: 'Vector2Node' },
      vec4: { outputType: 'Vector4Node' },
    });
    expect(catalog.capabilities.matrix).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'transmission-refraction',
          status: 'unsupported',
          behavior: expect.stringContaining('TSL-RUN-004'),
        }),
        expect.objectContaining({
          id: 'legacy-effect-composer',
          status: 'unchanged',
        }),
        expect.objectContaining({
          id: 'webgpu-output',
          status: 'deferred-renderer-target',
        }),
      ])
    );
  });

  it('fails closed when either generated artifact is changed', () => {
    const artifacts = buildTSLMaterialAuthoringArtifacts(projectApi);
    expect(
      verifyTSLMaterialAuthoringArtifacts({
        projectApiDeclaration: projectApi,
        tslApiDeclaration: artifacts.tslApi.replace(
          'export const time',
          'export const changedTime'
        ),
        tslCatalogJson: artifacts.tslCatalog,
      })
    ).toMatchObject({ valid: false, code: 'TSL-MCP-CATALOG-STALE' });
  });

  it.each(TSL_MATERIAL_EXAMPLES)(
    'type-checks, compiles, and graph-validates $id',
    async example => {
      const compiled = compileTSLMaterialSource({
        source: example.source,
        resourceName: example.id,
        filePath: `materials/${example.id}.tsl.ts`,
        projectApiDeclaration: projectApi,
      });
      expect(compiled.valid).toBe(true);
      expect(compiled.diagnostics).toEqual([]);
      expect(compiled.emitted).toContain('gdjs.__tslMaterialRegistry.register');
      expect(compiled.emitted).not.toContain('import ');
      expect(compiled.emitted).not.toContain('eval(');
      expect(compiled.receipt.sourceSha256).toBe(compiled.sourceHash);

      const validated = await validateTSLMaterialSource({
        source: example.source,
        resourceName: example.id,
        filePath: `materials/${example.id}.tsl.ts`,
        projectApiDeclaration: projectApi,
        validationLevel: 'graph',
      });
      expect(validated.valid).toBe(true);
      expect(validated.structurallyValid).toBe(true);
      expect(validated.graphValidated).toBe(true);
      expect(validated.gpuValidated).toBe(false);
      expect(validated.activationReady).toBe(false);
    }
  );

  it('emits byte-identical registry output and receipts for equal inputs', () => {
    clearTSLMaterialCompilationCache();
    const example = TSL_MATERIAL_EXAMPLES[0];
    const options = {
      source: example.source,
      resourceName: 'Tint',
      filePath: 'materials/Tint.tsl.ts',
      projectApiDeclaration: projectApi,
    };
    const first = compileTSLMaterialSource(options);
    const second = compileTSLMaterialSource(options);
    expect(first.emitted).toBe(second.emitted);
    expect(first.sourceMap).toBe(second.sourceMap);
    expect(first.receipt).toEqual(second.receipt);
    expect(first.metrics.compilation_cache_hit).toBe(false);
    expect(second.metrics.compilation_cache_hit).toBe(true);

    // Results returned from the cache are isolated from caller mutation.
    second.diagnostics.push({ code: 'CALLER-MUTATION' });
    second.receipt.importedSymbols.push('callerMutation');
    const third = compileTSLMaterialSource(options);
    expect(third.diagnostics).toEqual([]);
    expect(third.receipt.importedSymbols).not.toContain('callerMutation');
  });

  it('invalidates the compiler cache for every identity-bearing input', () => {
    clearTSLMaterialCompilationCache();
    const example = TSL_MATERIAL_EXAMPLES[0];
    const baseOptions = {
      source: example.source,
      resourceName: 'CacheIdentity',
      filePath: 'materials/CacheIdentity.tsl.ts',
      projectApiDeclaration: projectApi,
      options: { minify: false },
    };
    expect(
      compileTSLMaterialSource(baseOptions).metrics.compilation_cache_hit
    ).toBe(false);
    expect(
      compileTSLMaterialSource({
        ...baseOptions,
        options: { minify: true },
      }).metrics.compilation_cache_hit
    ).toBe(false);
    expect(
      compileTSLMaterialSource({
        ...baseOptions,
        source: `${example.source}\n`,
      }).metrics.compilation_cache_hit
    ).toBe(false);
  });

  it('rejects unsafe imports, node branching, recursion, and API hallucinations', () => {
    const invalidSources = [
      `import { defineMaterial } from "@gdevelop/tsl";
import * as THREE from "three";
export default defineMaterial({ apiVersion: 1, build() {} });`,
      `import { defineMaterial } from "@gdevelop/tsl";
export default defineMaterial({
  apiVersion: 1,
  parameters: { enabled: { type: "boolean", default: true } },
  build({ material, parameters }) {
    if (parameters.enabled) material.transparent = true;
  }
});`,
      `import { defineMaterial } from "@gdevelop/tsl";
function recurse() { return recurse(); }
export default defineMaterial({ apiVersion: 1, build() { recurse(); } });`,
      `import { defineMaterial } from "@gdevelop/tsl";
import { imaginaryNode } from "three/tsl";
export default defineMaterial({ apiVersion: 1, build({ material }) {
  material.colorNode = imaginaryNode();
} });`,
    ];
    invalidSources.forEach((source, index) => {
      const result = compileTSLMaterialSource({
        source,
        resourceName: `Invalid${index}`,
        filePath: `materials/Invalid${index}.tsl.ts`,
        projectApiDeclaration: projectApi,
      });
      expect(result.valid).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.emitted).toBeUndefined();
    });
  });

  it.each([
    [
      'ambient globals',
      `build({ material }) { material.alphaTest = Math.random(); }`,
    ],
    [
      'mutable locals',
      `build({ material }) { let enabled = true; material.transparent = enabled; }`,
    ],
    [
      'node coercion',
      `parameters: { amount: { type: "number", default: 1 } },
       build({ material, parameters }) { material.alphaTest = +parameters.amount; }`,
    ],
    [
      'local recursion',
      `build({ material }) {
         const recurse = () => recurse();
         recurse();
         material.transparent = false;
       }`,
    ],
    [
      'prototype access',
      `build({ material }) { material.transparent = !!material.constructor; }`,
    ],
    [
      'non-destructured build context',
      `build(context) { context.material.transparent = false; }`,
    ],
  ])('rejects closed-world policy escape: %s', (label, definitionBody) => {
    const source = `import { defineMaterial } from "@gdevelop/tsl";
export default defineMaterial({ apiVersion: 1, ${definitionBody} });`;
    const result = compileTSLMaterialSource({
      source,
      resourceName: `ClosedWorld${label}`,
      filePath: `materials/ClosedWorld${label}.tsl.ts`,
      projectApiDeclaration: projectApi,
    });
    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'TSL-SRC-004' })])
    );
  });

  it('allows arithmetic proven to use host numbers', () => {
    const source = `import { defineMaterial } from "@gdevelop/tsl";
export default defineMaterial({
  apiVersion: 1,
  build({ material }) {
    const finiteHostNumber = (2 + 3) * 4;
    material.alphaTest = finiteHostNumber / 20;
  }
});`;
    expect(
      compileTSLMaterialSource({
        source,
        resourceName: 'HostArithmetic',
        filePath: 'materials/HostArithmetic.tsl.ts',
        projectApiDeclaration: projectApi,
      })
    ).toMatchObject({ valid: true, diagnostics: [] });
  });

  it.each(TSL_NEGATIVE_EXAMPLES)(
    'rejects authoring-pack negative example $id with $diagnosticCode',
    example => {
      const result = compileTSLMaterialSource({
        source: example.source,
        resourceName: example.id,
        filePath: `materials/${example.id}.tsl.ts`,
        projectApiDeclaration: projectApi,
      });
      expect(result.valid).toBe(false);
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: example.diagnosticCode }),
        ])
      );
    }
  );
});
