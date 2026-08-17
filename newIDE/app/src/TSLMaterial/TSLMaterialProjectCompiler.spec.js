// @flow

import fs from 'fs-extra';
// $FlowFixMe[cannot-resolve-module] Node-only test dependency.
import os from 'os';
// $FlowFixMe[cannot-resolve-module] Node-only test dependency.
import path from 'path';
import { buildJavaScriptAuthoringArtifacts } from '../ProjectsStorage/JavaScriptAuthoringApi';
import {
  TSL_MATERIAL_EXAMPLES,
  buildTSLMaterialAuthoringArtifacts,
} from '../ProjectsStorage/TSLMaterialAuthoring';
import {
  serializeToJSObject,
  unserializeFromJSObject,
} from '../Utils/Serializer';
import {
  TSLMaterialProjectCompilationError,
  compileReferencedTSLMaterials,
  exportWholePixiProjectWithTSL,
  getTSLMaterialRuntimeExportDirectory,
  planTSLMaterialPreviewReload,
  writePreparedTSLMaterials,
} from './TSLMaterialProjectCompiler';
import { ensureTSLMaterialBrowserValidatorRegistered } from './TSLMaterialBrowserValidator';

jest.mock('./TSLMaterialBrowserValidator', () => ({
  ensureTSLMaterialBrowserValidatorRegistered: jest.fn(),
}));

const gd: libGDevelop = global.gd;

const addTSLMaterial = (
  project: gdProject,
  name: string,
  file: string
): void => {
  const resource = new gd.TSLMaterialResource();
  resource.setName(name);
  resource.setFile(file);
  project.getResourcesManager().addResource(resource);
  resource.delete();
};

describe('TSL material project compiler', () => {
  let project;
  let temporaryDirectory = null;

  beforeEach(() => {
    jest.clearAllMocks();
    project = gd.ProjectHelper.createNewGDJSProject();
    project.setProjectFile('C:\\Games\\TSLTest\\game.json');
  });

  afterEach(() => {
    project.delete();
    if (temporaryDirectory) fs.removeSync(temporaryDirectory);
    temporaryDirectory = null;
  });

  it('compiles all requested resources deterministically into one atomic registry bundle', async () => {
    addTSLMaterial(project, 'ZWave', 'materials/ZWave.tsl.ts');
    addTSLMaterial(project, 'ATint', 'materials/ATint.tsl.ts');
    const vertexWaveExample = TSL_MATERIAL_EXAMPLES.find(
      example => example.template === 'vertex-wave'
    );
    if (!vertexWaveExample) throw new Error('Missing vertex wave fixture.');
    const sources: { [string]: string } = {
      'materials/ZWave.tsl.ts': vertexWaveExample.source,
      'materials/ATint.tsl.ts': TSL_MATERIAL_EXAMPLES[0].source,
    };
    const readSource = jest.fn<[gdProject, string], Promise<string>>(
      async (ignoredProject: gdProject, file: string): Promise<string> =>
        sources[file]
    );

    const first = await compileReferencedTSLMaterials({
      project,
      includeAllResources: true,
      includeSourceMap: true,
      validationLevel: 'graph',
      readSource,
    });
    const second = await compileReferencedTSLMaterials({
      project,
      includeAllResources: true,
      includeSourceMap: true,
      validationLevel: 'graph',
      readSource,
    });

    expect(first.resourceNames).toEqual(['ATint', 'ZWave']);
    expect(first.registryCode).toBe(second.registryCode);
    expect(first.manifestJson).toBe(second.manifestJson);
    expect(first.registryCode).toContain(
      'gdjs.__tslMaterialRegistry.beginBundle'
    );
    expect(first.registryCode).toContain(
      'gdjs.__tslMaterialRegistry.endBundle();'
    );
    expect(first.registryCode).not.toContain('import ');
    expect(first.manifest).toMatchObject({
      target: 'webgl2-node-compat',
      definitionCount: 2,
      resources: [{ resourceName: 'ATint' }, { resourceName: 'ZWave' }],
    });
    expect(
      first.manifest.resources.every(resource =>
        /^[0-9a-f]{64}$/.test(resource.validationId)
      )
    ).toBe(true);
    expect(first.sourceMap).toContain('"sections"');
    expect(readSource).toHaveBeenCalledTimes(8);
  });

  it('round-trips the dedicated resource kind, file, and user-added flag', () => {
    addTSLMaterial(project, 'Tint', 'materials\\Tint.tsl.ts');
    project
      .getResourcesManager()
      .getResource('Tint')
      .setUserAdded(true);
    const serialized = serializeToJSObject(project, 'serializeTo');
    expect(serialized.resources.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Tint',
          kind: 'tslMaterial',
          file: 'materials/Tint.tsl.ts',
          userAdded: true,
        }),
      ])
    );

    const restoredProject = gd.ProjectHelper.createNewGDJSProject();
    try {
      unserializeFromJSObject(restoredProject, serialized, 'unserializeFrom');
      const restored = restoredProject
        .getResourcesManager()
        .getResource('Tint');
      expect(restored.getKind()).toBe('tslMaterial');
      expect(restored.getFile()).toBe('materials/Tint.tsl.ts');
      expect(restored.isUserAdded()).toBe(true);
    } finally {
      restoredProject.delete();
    }
  });

  it('fails closed if source bytes change between validation and emission', async () => {
    addTSLMaterial(project, 'Tint', 'materials/Tint.tsl.ts');
    let reads = 0;
    await expect(
      compileReferencedTSLMaterials({
        project,
        includeAllResources: true,
        validationLevel: 'graph',
        readSource: async () => {
          reads++;
          return `${TSL_MATERIAL_EXAMPLES[0].source}${reads === 1 ? '' : '\n'}`;
        },
      })
    ).rejects.toMatchObject({ code: 'TSL-MCP-SOURCE-CHANGED' });
  });

  it('blocks preview/export for missing, stale, or partial saved catalogs', async () => {
    temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gdevelop-tsl-project-compiler-')
    );
    project.setProjectFile(path.join(temporaryDirectory, 'project.gdevelop'));
    addTSLMaterial(project, 'Tint', 'materials/Tint.tsl.ts');
    const serializedProject = serializeToJSObject(project, 'serializeTo');
    const javascriptArtifacts = buildJavaScriptAuthoringArtifacts(
      serializedProject
    );
    const tslArtifacts = buildTSLMaterialAuthoringArtifacts(
      javascriptArtifacts.projectApi
    );
    const catalogDirectory = path.join(temporaryDirectory, '.gdevelop');
    fs.ensureDirSync(catalogDirectory);
    fs.writeFileSync(
      path.join(catalogDirectory, 'project-api.d.ts'),
      javascriptArtifacts.projectApi
    );
    fs.writeFileSync(
      path.join(catalogDirectory, 'tsl-api.d.ts'),
      tslArtifacts.tslApi
    );
    fs.writeFileSync(
      path.join(catalogDirectory, 'tsl-catalog.json'),
      tslArtifacts.tslCatalog
    );
    const compile = () =>
      compileReferencedTSLMaterials({
        project,
        includeAllResources: true,
        validationLevel: 'graph',
        readSource: async () => TSL_MATERIAL_EXAMPLES[0].source,
      });

    await expect(compile()).resolves.toMatchObject({
      resourceNames: ['Tint'],
    });

    fs.appendFileSync(
      path.join(catalogDirectory, 'tsl-catalog.json'),
      'tampered'
    );
    await expect(compile()).rejects.toMatchObject({
      code: 'TSL-MCP-CATALOG-STALE',
    });

    fs.writeFileSync(
      path.join(catalogDirectory, 'tsl-catalog.json'),
      tslArtifacts.tslCatalog
    );
    fs.removeSync(path.join(catalogDirectory, 'tsl-api.d.ts'));
    await expect(compile()).rejects.toMatchObject({
      code: 'TSL-MCP-CATALOG-MISSING',
    });
  });

  it('does not emit a registry for invalid material source', async () => {
    addTSLMaterial(project, 'Unsafe', 'materials/Unsafe.tsl.ts');
    await expect(
      compileReferencedTSLMaterials({
        project,
        includeAllResources: true,
        validationLevel: 'graph',
        readSource: async () =>
          'import { ShaderMaterial } from "three"; export default new ShaderMaterial();',
      })
    ).rejects.toBeInstanceOf(TSLMaterialProjectCompilationError);
  });

  it('writes only generated registry, map, and manifest to target-specific runtime directories', async () => {
    addTSLMaterial(project, 'Tint', 'materials/Tint.tsl.ts');
    const prepared = await compileReferencedTSLMaterials({
      project,
      includeAllResources: true,
      includeSourceMap: true,
      validationLevel: 'graph',
      readSource: async () => TSL_MATERIAL_EXAMPLES[0].source,
    });
    const written = new Map<string, string>();
    writePreparedTSLMaterials({
      prepared,
      outputDirectory: getTSLMaterialRuntimeExportDirectory(
        'C:\\Export',
        'electron'
      ),
      fileSystem: {
        writeToFile: (filePath, content) => {
          written.set(filePath, content);
          return true;
        },
      },
    });
    expect(Array.from(written.keys()).sort()).toEqual([
      'C:\\Export/app/tsl-material-manifest.json',
      'C:\\Export/app/tsl-material-registry.js',
      'C:\\Export/app/tsl-material-registry.js.map',
    ]);
    expect(written.get('C:\\Export/app/tsl-material-registry.js')).toBe(
      prepared.registryCode
    );
  });

  it('keeps absolute resource locations out of receipts and source maps', async () => {
    addTSLMaterial(
      project,
      'Private Tint',
      'C:\\Users\\Developer\\Private\\Tint.tsl.ts'
    );
    const prepared = await compileReferencedTSLMaterials({
      project,
      includeAllResources: true,
      includeSourceMap: true,
      validationLevel: 'graph',
      readSource: async () => TSL_MATERIAL_EXAMPLES[0].source,
    });

    expect(prepared.sourceMap).not.toContain('Users');
    expect(prepared.sourceMap).not.toContain('Private\\\\Tint');
    expect(prepared.manifest.receipts[0].normalizedSourcePath).toBe(
      'materials/Private_Tint.tsl.ts'
    );
  });

  it('leaves standard exports unchanged when no TSL material is referenced', async () => {
    const exporter = { exportWholePixiProject: jest.fn(() => true) };
    const fileSystem = { writeToFile: jest.fn(() => true) };
    await expect(
      exportWholePixiProjectWithTSL({
        project,
        exporter,
        exportOptions: { outputDir: 'C:\\Export' },
        fileSystem,
        outputDirectory: 'C:\\Export',
      })
    ).resolves.toBe(true);
    expect(exporter.exportWholePixiProject).toHaveBeenCalledTimes(1);
    expect(fileSystem.writeToFile).not.toHaveBeenCalled();
    expect(ensureTSLMaterialBrowserValidatorRegistered).not.toHaveBeenCalled();
  });

  it('hard reloads only when the preview Three runtime mode changes', () => {
    const plan = (
      previousUsesTSLMaterials: boolean,
      currentUsesTSLMaterials: boolean,
      requestedHardReload: boolean = false
    ) =>
      planTSLMaterialPreviewReload({
        shouldHotReload: true,
        requestedHardReload,
        previousUsesTSLMaterials,
        currentUsesTSLMaterials,
      });

    expect(plan(false, false)).toEqual({
      shouldHardReload: false,
      shouldWriteRegistry: false,
      shouldSendRegistryDescriptor: false,
    });
    expect(plan(true, true)).toEqual({
      shouldHardReload: false,
      shouldWriteRegistry: true,
      shouldSendRegistryDescriptor: true,
    });
    expect(plan(false, true)).toEqual({
      shouldHardReload: true,
      shouldWriteRegistry: true,
      shouldSendRegistryDescriptor: false,
    });
    expect(plan(true, false)).toEqual({
      shouldHardReload: true,
      shouldWriteRegistry: false,
      shouldSendRegistryDescriptor: false,
    });
    expect(plan(true, true, true)).toEqual({
      shouldHardReload: true,
      shouldWriteRegistry: true,
      shouldSendRegistryDescriptor: false,
    });
    expect(
      planTSLMaterialPreviewReload({
        shouldHotReload: false,
        requestedHardReload: false,
        previousUsesTSLMaterials: false,
        currentUsesTSLMaterials: true,
      })
    ).toEqual({
      shouldHardReload: false,
      shouldWriteRegistry: true,
      shouldSendRegistryDescriptor: false,
    });
  });
});
