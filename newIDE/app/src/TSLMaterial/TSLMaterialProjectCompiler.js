// @flow

import { sha256 } from 'js-sha256';
import optionalRequire from '../Utils/OptionalRequire';
import { serializeToJSObject } from '../Utils/Serializer';
import ResourcesLoader from '../ResourcesLoader';
import {
  PROJECT_API_RELATIVE_PATH,
  buildJavaScriptAuthoringArtifacts,
} from '../ProjectsStorage/JavaScriptAuthoringApi';
import { MULTI_FILE_ENTRY_NAME } from '../ProjectsStorage/MultiFileProjectFormat';
import {
  PROJECT_TSL_API_RELATIVE_PATH,
  PROJECT_TSL_CATALOG_RELATIVE_PATH,
  TSL_AUTHORING_API_VERSION,
  TSL_COMPILER_VERSION,
  TSL_CURRENT_TARGET,
  TSL_PORTABLE_PROFILE_VERSION,
  TSL_THREE_REVISION,
  buildTSLMaterialAuthoringArtifacts,
  registerVirtualTSLMaterialAuthoringArtifacts,
  stableStringifyTSLCatalog,
  verifyTSLMaterialAuthoringArtifacts,
} from '../ProjectsStorage/TSLMaterialAuthoring';
import {
  createTSLValidationId,
  validateTSLMaterialSource,
} from './TSLMaterialCompiler';

const fs = optionalRequire('fs-extra');
const path = optionalRequire('path');
const url = optionalRequire('url');
const gd: libGDevelop = global.gd;

export const TSL_MATERIAL_REGISTRY_RELATIVE_PATH = 'tsl-material-registry.js';
export const TSL_MATERIAL_REGISTRY_SOURCE_MAP_RELATIVE_PATH =
  'tsl-material-registry.js.map';
export const TSL_MATERIAL_EXPORT_MANIFEST_RELATIVE_PATH =
  'tsl-material-manifest.json';

export const planTSLMaterialPreviewReload = ({
  shouldHotReload,
  requestedHardReload,
  previousUsesTSLMaterials,
  currentUsesTSLMaterials,
}: {|
  shouldHotReload: boolean,
  requestedHardReload: boolean,
  previousUsesTSLMaterials: boolean,
  currentUsesTSLMaterials: boolean,
|}): {|
  shouldHardReload: boolean,
  shouldWriteRegistry: boolean,
  shouldSendRegistryDescriptor: boolean,
|} => {
  const runtimeModeChanged =
    shouldHotReload && previousUsesTSLMaterials !== currentUsesTSLMaterials;
  const shouldHardReload = requestedHardReload || runtimeModeChanged;
  const shouldSendRegistryDescriptor =
    shouldHotReload &&
    !shouldHardReload &&
    (currentUsesTSLMaterials || previousUsesTSLMaterials);
  return {
    shouldHardReload,
    shouldWriteRegistry:
      currentUsesTSLMaterials || shouldSendRegistryDescriptor,
    shouldSendRegistryDescriptor,
  };
};

const compareStrings = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const normalizeResourcePath = (filePath: string): string =>
  filePath.replace(/\\/g, '/');

const isRemoteUrl = (filePath: string): boolean =>
  /^(?:https?|ftp|blob|data):/i.test(filePath);

const getSafeCompilerSourcePath = (
  resourceName: string,
  resourceFile: string
): string => {
  const normalized = normalizeResourcePath(resourceFile);
  const segments = normalized.split('/');
  const isContainedRelativePath =
    !!normalized &&
    !/^[a-z][a-z0-9+.-]*:/i.test(normalized) &&
    !(path && path.isAbsolute(normalized)) &&
    !/^\//.test(normalized) &&
    !segments.some(segment => segment === '.' || segment === '..');
  if (isContainedRelativePath) return normalized;

  const safeResourceName =
    resourceName
      .replace(/\.tsl$/i, '')
      .replace(/[^a-z0-9._-]+/gi, '_')
      .replace(/^[._-]+|[._-]+$/g, '') || 'Material';
  return `materials/${safeResourceName}.tsl.ts`;
};

const readLocalSource = (project: gdProject, resourceFile: string): ?string => {
  if (!fs || !path) return null;
  let localFile = resourceFile;
  if (/^file:/i.test(localFile)) {
    if (url && typeof url.fileURLToPath === 'function') {
      localFile = url.fileURLToPath(localFile);
    } else {
      localFile = decodeURIComponent(localFile.replace(/^file:\/\//i, ''));
    }
  } else if (!path.isAbsolute(localFile)) {
    const projectFile = project.getProjectFile();
    if (!projectFile) return null;
    localFile = path.resolve(path.dirname(projectFile), localFile);
  }
  return fs.readFileSync(localFile, 'utf8');
};

export const readTSLMaterialResourceSource = async (
  project: gdProject,
  resourceFile: string
): Promise<string> => {
  if (!resourceFile) throw new Error('The TSL material has no source file.');
  if (!isRemoteUrl(resourceFile)) {
    const localSource = readLocalSource(project, resourceFile);
    if (typeof localSource === 'string') return localSource;
  }

  const fullUrl = ResourcesLoader.getFullUrl(project, resourceFile, {
    disableCacheBurst: true,
    isResourceForPixi: false,
  });
  if (/^file:/i.test(fullUrl)) {
    const localSource = readLocalSource(project, fullUrl);
    if (typeof localSource === 'string') return localSource;
  }
  const response = await fetch(fullUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(
      `Unable to read the TSL material source (${response.status}).`
    );
  }
  return response.text();
};

export class TSLMaterialProjectCompilationError extends Error {
  code: string;
  resourceName: string;
  filePath: string;
  diagnostics: Array<Object>;

  constructor({
    code,
    message,
    resourceName = '',
    filePath = '',
    diagnostics = [],
  }: Object) {
    super(message);
    this.name = 'TSLMaterialProjectCompilationError';
    this.code = code;
    this.resourceName = resourceName;
    this.filePath = filePath;
    this.diagnostics = diagnostics;
  }
}

const assertSavedMultiFileCatalogIntegrity = (projectFile: string): void => {
  if (
    !fs ||
    !path ||
    !projectFile ||
    path.basename(projectFile).toLowerCase() !== MULTI_FILE_ENTRY_NAME
  ) {
    return;
  }
  const projectRoot = path.dirname(projectFile);
  const artifactPaths = [
    PROJECT_API_RELATIVE_PATH,
    PROJECT_TSL_API_RELATIVE_PATH,
    PROJECT_TSL_CATALOG_RELATIVE_PATH,
  ].map(relativePath => path.join(projectRoot, ...relativePath.split('/')));
  const completeCatalogSet = artifactPaths.every(artifactPath => {
    try {
      return fs.existsSync(artifactPath) && fs.statSync(artifactPath).isFile();
    } catch (error) {
      return false;
    }
  });
  if (!completeCatalogSet) {
    throw new TSLMaterialProjectCompilationError({
      code: 'TSL-MCP-CATALOG-MISSING',
      message:
        'The saved multi-file project has no complete TSL authoring catalog set. Save the project or generate catalogs before preview/export.',
    });
  }

  let diskProjectApi;
  let diskTslApi;
  let diskTslCatalog;
  try {
    diskProjectApi = fs.readFileSync(artifactPaths[0], 'utf8');
    diskTslApi = fs.readFileSync(artifactPaths[1], 'utf8');
    diskTslCatalog = fs.readFileSync(artifactPaths[2], 'utf8');
  } catch (error) {
    throw new TSLMaterialProjectCompilationError({
      code: 'TSL-MCP-CATALOG-MISSING',
      message:
        'The saved TSL authoring catalogs could not be read. Save the project or generate catalogs before preview/export.',
    });
  }
  const verification = verifyTSLMaterialAuthoringArtifacts({
    projectApiDeclaration: diskProjectApi,
    tslApiDeclaration: diskTslApi,
    tslCatalogJson: diskTslCatalog,
  });
  // The saved set must be internally atomic. The compiler still consumes the
  // freshly generated in-memory set below so unsaved editor state is valid and
  // all stages receive one current set of hashes.
  if (!verification.valid) {
    throw new TSLMaterialProjectCompilationError({
      code: 'TSL-MCP-CATALOG-STALE',
      message:
        (verification && verification.message) ||
        'The saved TSL authoring catalogs are stale. Save the project or generate catalogs before preview/export.',
    });
  }
};

export const getReferencedTSLMaterialResourceNames = (
  project: gdProject
): Array<string> => {
  const resourcesInUse = new gd.ResourcesInUseHelper(
    project.getResourcesManager()
  );
  try {
    gd.ResourceExposer.exposeWholeProjectResources(project, resourcesInUse);
    return resourcesInUse
      .getAll('tslMaterial')
      .toNewVectorString()
      .toJSArray()
      .sort(compareStrings);
  } finally {
    resourcesInUse.delete();
  }
};

const getAllTSLMaterialResourceNames = (project: gdProject): Array<string> =>
  project
    .getResourcesManager()
    .getAllResourceNames()
    .toJSArray()
    .filter(
      resourceName =>
        project
          .getResourcesManager()
          .getResource(resourceName)
          .getKind() === 'tslMaterial'
    )
    .sort(compareStrings);

const formatDiagnosticMessage = (
  resourceName: string,
  filePath: string,
  diagnostic: ?Object
): string => {
  if (!diagnostic) {
    return `TSL material "${resourceName}" could not be validated (${filePath}).`;
  }
  const location = diagnostic.line
    ? `${filePath}:${diagnostic.line}:${diagnostic.column || 1}`
    : filePath;
  return `[${diagnostic.code ||
    'TSL-VAL-001'}] ${resourceName} (${location}): ${diagnostic.message ||
    'Validation failed.'}`;
};

const makeIndexedSourceMap = (
  compiledDefinitions: Array<Object>,
  header: string
): string => {
  let generatedLine = header.split('\n').length - 1;
  const sections = [];
  compiledDefinitions.forEach(definition => {
    if (definition.sourceMap) {
      try {
        // Individual compiler output adds a generated comment, IIFE and
        // strict-mode prologue before the TypeScript transpilation.
        sections.push({
          offset: { line: generatedLine + 3, column: 2 },
          map: JSON.parse(definition.sourceMap),
        });
      } catch (error) {
        // A missing map never changes executable output. Validation receipts
        // remain authoritative and the developer map is simply omitted.
      }
    }
    generatedLine += definition.emitted.split('\n').length;
  });
  return stableStringifyTSLCatalog({
    version: 3,
    file: TSL_MATERIAL_REGISTRY_RELATIVE_PATH,
    sections,
  });
};

export type PreparedTSLMaterialProject = {|
  resourceNames: Array<string>,
  registryCode: string,
  sourceMap: string,
  manifest: Object,
  manifestJson: string,
  bundleSha256: string,
|};

interface TSLMaterialFileWriter {
  writeToFile(filePath: string, contents: string): any;
}

export const compileReferencedTSLMaterials = async ({
  project,
  includeAllResources = false,
  includeSourceMap = false,
  validationLevel = 'backend',
  readSource = readTSLMaterialResourceSource,
}: {
  project: gdProject,
  includeAllResources?: boolean,
  includeSourceMap?: boolean,
  validationLevel?: 'graph' | 'backend',
  readSource?: (gdProject, string) => Promise<string>,
}): Promise<PreparedTSLMaterialProject> => {
  const resourceNames = includeAllResources
    ? getAllTSLMaterialResourceNames(project)
    : getReferencedTSLMaterialResourceNames(project);
  const serializedProject = serializeToJSObject(project, 'serializeTo');
  const javascriptArtifacts = buildJavaScriptAuthoringArtifacts(
    serializedProject
  );
  const authoringArtifacts = buildTSLMaterialAuthoringArtifacts(
    javascriptArtifacts.projectApi
  );
  const projectFile = project.getProjectFile();
  if (resourceNames.length) {
    assertSavedMultiFileCatalogIntegrity(projectFile);
  }
  if (projectFile && path) {
    registerVirtualTSLMaterialAuthoringArtifacts({
      projectRoot: path.dirname(projectFile),
      projectApiDeclaration: javascriptArtifacts.projectApi,
      artifacts: authoringArtifacts,
    });
  }
  if (resourceNames.length && validationLevel === 'backend') {
    const browserValidator = await import(/* webpackChunkName: "tsl-material-validator" */ './TSLMaterialBrowserValidator');
    browserValidator.ensureTSLMaterialBrowserValidatorRegistered();
  }

  const compiledDefinitions = [];
  for (const resourceName of resourceNames) {
    const resourcesManager = project.getResourcesManager();
    if (!resourcesManager.hasResource(resourceName)) {
      throw new TSLMaterialProjectCompilationError({
        code: 'TSL-RUN-005',
        message: `Referenced TSL material resource "${resourceName}" is missing.`,
        resourceName,
      });
    }
    const resource = resourcesManager.getResource(resourceName);
    if (resource.getKind() !== 'tslMaterial') {
      throw new TSLMaterialProjectCompilationError({
        code: 'TSL-PKG-001',
        message: `Referenced resource "${resourceName}" is not a TSL material.`,
        resourceName,
      });
    }
    const resourceFile = resource.getFile();
    const normalizedResourceFile = normalizeResourcePath(resourceFile);
    const filePath = getSafeCompilerSourcePath(resourceName, resourceFile);
    if (!normalizedResourceFile.toLowerCase().endsWith('.tsl.ts')) {
      throw new TSLMaterialProjectCompilationError({
        code: 'TSL-MCP-FILE-EXTENSION-INVALID',
        message: `TSL material "${resourceName}" must use the .tsl.ts suffix.`,
        resourceName,
        filePath,
      });
    }
    let source;
    try {
      source = await readSource(project, resourceFile);
    } catch (error) {
      throw new TSLMaterialProjectCompilationError({
        code: 'TSL-MCP-FILE-NOT-FOUND',
        message: `Unable to read TSL material "${resourceName}": ${
          error && error.message ? error.message : 'source is unavailable'
        }`,
        resourceName,
        filePath,
      });
    }
    const sourceHashBeforeValidation = sha256(source);
    const result = await validateTSLMaterialSource({
      source,
      resourceName,
      filePath,
      projectApiDeclaration: javascriptArtifacts.projectApi,
      tslApiDeclaration: authoringArtifacts.tslApi,
      tslCatalogJson: authoringArtifacts.tslCatalog,
      validationLevel,
      target: TSL_CURRENT_TARGET,
      options: {
        portableProfileVersion: TSL_PORTABLE_PROFILE_VERSION,
      },
    });
    const validForPolicy =
      result.success &&
      result.valid &&
      (validationLevel === 'backend'
        ? result.activationReady
        : result.graphValidated);
    if (!validForPolicy) {
      const diagnostic = result.diagnostics && result.diagnostics[0];
      throw new TSLMaterialProjectCompilationError({
        code:
          result.infrastructureCode ||
          (diagnostic && diagnostic.code) ||
          'TSL-VAL-001',
        message:
          result.infrastructureMessage ||
          formatDiagnosticMessage(resourceName, filePath, diagnostic),
        resourceName,
        filePath,
        diagnostics: result.diagnostics || [],
      });
    }
    let sourceAfterValidation;
    try {
      sourceAfterValidation = await readSource(project, resourceFile);
    } catch (error) {
      throw new TSLMaterialProjectCompilationError({
        code: 'TSL-MCP-FILE-NOT-FOUND',
        message: `Unable to re-read TSL material "${resourceName}" after validation: ${
          error && error.message ? error.message : 'source is unavailable'
        }`,
        resourceName,
        filePath,
      });
    }
    if (sha256(sourceAfterValidation) !== sourceHashBeforeValidation) {
      throw new TSLMaterialProjectCompilationError({
        code: 'TSL-MCP-SOURCE-CHANGED',
        message: `TSL material "${resourceName}" changed during validation. Run preview or export again.`,
        resourceName,
        filePath,
      });
    }
    const validationId = createTSLValidationId({
      result,
      target: TSL_CURRENT_TARGET,
      validationLevel,
      fixture: {
        baseMaterial: 'standard',
        geometryFeatures: [],
        modelFilePath: null,
        parameterValues: {},
        backgroundPreset: 'dark',
        lightPreset: 'studio',
        previewSize: null,
        cameraAngle: 'front',
        animationTime: 0,
        includeOriginalModelPreview: false,
      },
      modelHash: null,
    });
    compiledDefinitions.push({
      resourceName,
      emitted: result.emitted,
      sourceMap: result.sourceMap,
      receipt: result.receipt,
      sourceHash: result.sourceHash,
      validationId,
      completedStages: result.completedStages,
    });
  }

  const bundleReceipt = {
    apiVersion: 1,
    compilerVersion: TSL_COMPILER_VERSION,
    authoringApiVersion: TSL_AUTHORING_API_VERSION,
    threeRevision: TSL_THREE_REVISION,
    portableProfileVersion: TSL_PORTABLE_PROFILE_VERSION,
    target: TSL_CURRENT_TARGET,
    definitionCount: compiledDefinitions.length,
    definitionsSha256: sha256(
      compiledDefinitions.map(definition => definition.emitted).join('\n')
    ),
    receipts: compiledDefinitions.map(definition => definition.receipt),
  };
  const header = `// Generated by GDevelop TSL material compiler. Do not edit.\n// Three runtime: TSL-enabled r${TSL_THREE_REVISION}\ngdjs.__tslMaterialBundleReceipt = Object.freeze(${stableStringifyTSLCatalog(
    bundleReceipt
  ).trim()});\ngdjs.__tslMaterialRegistry.beginBundle(gdjs.__tslMaterialBundleReceipt);\n`;
  const registryWithoutMap = `${header}${compiledDefinitions
    .map(definition => definition.emitted)
    .join('\n')}gdjs.__tslMaterialRegistry.endBundle();\n`;
  const registryCode = includeSourceMap
    ? `${registryWithoutMap}//# sourceMappingURL=${TSL_MATERIAL_REGISTRY_SOURCE_MAP_RELATIVE_PATH}\n`
    : registryWithoutMap;
  const bundleSha256 = sha256(registryCode);
  const manifest = {
    ...bundleReceipt,
    bundleSha256,
    registryFile: TSL_MATERIAL_REGISTRY_RELATIVE_PATH,
    sourceMapFile: includeSourceMap
      ? TSL_MATERIAL_REGISTRY_SOURCE_MAP_RELATIVE_PATH
      : null,
    resources: compiledDefinitions.map(definition => ({
      resourceName: definition.resourceName,
      sourceSha256: definition.sourceHash,
      emittedSha256: definition.receipt.emittedSha256,
      validationId: definition.validationId,
      completedStages: definition.completedStages,
    })),
  };
  return {
    resourceNames,
    registryCode,
    sourceMap: includeSourceMap
      ? makeIndexedSourceMap(compiledDefinitions, header)
      : '',
    manifest,
    manifestJson: stableStringifyTSLCatalog(manifest),
    bundleSha256,
  };
};

const joinExportPath = (directory: string, fileName: string): string =>
  `${directory.replace(/[\\/]+$/, '')}/${fileName}`;

export const writePreparedTSLMaterials = ({
  prepared,
  outputDirectory,
  fileSystem,
}: {
  prepared: PreparedTSLMaterialProject,
  outputDirectory: string,
  fileSystem: TSLMaterialFileWriter,
}): void => {
  const write = (relativePath: string, contents: string): void => {
    if (
      fileSystem.writeToFile(
        joinExportPath(outputDirectory, relativePath),
        contents
      ) === false
    ) {
      throw new TSLMaterialProjectCompilationError({
        code: 'TSL-PKG-001',
        message: `Unable to write generated TSL artifact "${relativePath}".`,
      });
    }
  };
  write(TSL_MATERIAL_REGISTRY_RELATIVE_PATH, prepared.registryCode);
  if (prepared.sourceMap) {
    write(TSL_MATERIAL_REGISTRY_SOURCE_MAP_RELATIVE_PATH, prepared.sourceMap);
  }
  write(TSL_MATERIAL_EXPORT_MANIFEST_RELATIVE_PATH, prepared.manifestJson);
};

export const getTSLMaterialRuntimeExportDirectory = (
  outputDirectory: string,
  target: string
): string => {
  if (target === 'cordova') return joinExportPath(outputDirectory, 'www');
  if (target === 'electron') return joinExportPath(outputDirectory, 'app');
  return outputDirectory;
};

export const exportWholePixiProjectWithTSL = async ({
  project,
  exporter,
  exportOptions,
  fileSystem,
  outputDirectory,
  target = '',
}: Object): Promise<boolean> => {
  const prepared = await compileReferencedTSLMaterials({
    project,
    includeSourceMap: false,
    validationLevel: 'backend',
  });
  const success = exporter.exportWholePixiProject(exportOptions);
  if (!success) return false;
  if (prepared.resourceNames.length) {
    writePreparedTSLMaterials({
      prepared,
      outputDirectory: getTSLMaterialRuntimeExportDirectory(
        outputDirectory,
        target
      ),
      fileSystem,
    });
  }
  console.info(
    prepared.resourceNames.length
      ? `Three runtime: TSL-enabled r${TSL_THREE_REVISION}`
      : `Three runtime: standard r${TSL_THREE_REVISION}`
  );
  return true;
};
