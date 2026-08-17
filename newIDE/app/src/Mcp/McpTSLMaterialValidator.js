// @flow

import optionalRequire from '../Utils/OptionalRequire';
import {
  PROJECT_TSL_API_RELATIVE_PATH,
  PROJECT_TSL_CATALOG_RELATIVE_PATH,
  TSL_AUTHORING_API_VERSION,
  TSL_CURRENT_TARGET,
  TSL_PORTABLE_PROFILE_VERSION,
  TSL_SOURCE_MAX_BYTES,
  TSL_THREE_REVISION,
  getVirtualTSLMaterialAuthoringArtifacts,
  verifyTSLMaterialAuthoringArtifacts,
} from '../ProjectsStorage/TSLMaterialAuthoring';
import { PROJECT_API_RELATIVE_PATH } from '../ProjectsStorage/JavaScriptAuthoringApi';
import {
  createTSLValidationId,
  validateTSLMaterialSource,
} from '../TSLMaterial/TSLMaterialCompiler';

const fs = optionalRequire('fs-extra');
const path = optionalRequire('path');
const crypto = optionalRequire('crypto');
const nodeBuffer = optionalRequire('buffer');

const maximumCatalogBytes = 4 * 1024 * 1024;
const maximumModelBytes = 256 * 1024 * 1024;
const maximumDiagnosticMessageLength = 1000;
const maximumSourceExcerptLength = 240;
let gpuValidationTail: Promise<mixed> = Promise.resolve();

const enqueueGpuValidation = (task: () => Promise<Object>): Promise<Object> => {
  const result = gpuValidationTail.catch(() => {}).then(task);
  gpuValidationTail = result.catch(() => {});
  return result;
};

export class TSLMcpValidationError extends Error {
  code: string;
  details: Object;

  constructor(code: string, message: string, details?: Object) {
    super(message);
    this.name = 'TSLMcpValidationError';
    this.code = code;
    this.details = details || {};
  }
}

const sha256Bytes = (bytes: any): string => {
  if (!crypto) {
    throw new TSLMcpValidationError(
      'TSL-MCP-VALIDATOR-UNAVAILABLE',
      'Cryptographic hashing is unavailable in this editor environment.'
    );
  }
  return crypto
    .createHash('sha256')
    .update(bytes)
    .digest('hex');
};

const isWithinRoot = (rootPath: string, candidatePath: string): boolean => {
  const relative = path.relative(rootPath, candidatePath);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== '..' &&
      !path.isAbsolute(relative))
  );
};

const validateCanonicalRelativePath = (
  value: mixed,
  expectedSuffix: string,
  invalidCode: string
): string => {
  if (typeof value !== 'string' || !value || value !== value.trim()) {
    throw new TSLMcpValidationError(
      invalidCode,
      'The path must be a non-empty project-relative path without leading or trailing whitespace.'
    );
  }
  if (
    value.length > 4096 ||
    path.isAbsolute(value) ||
    /^[a-z][a-z0-9+.-]*:/i.test(value) ||
    /^[/\\]{2}/.test(value) ||
    /[\0*?[\]{}]/.test(value)
  ) {
    throw new TSLMcpValidationError(
      invalidCode,
      'Absolute paths, URIs, globs, malformed paths, and network paths are not allowed.'
    );
  }
  const normalized = value.replace(/\\/g, '/');
  const segments = normalized.split('/');
  if (
    !segments.length ||
    segments.some(segment => !segment || segment === '.' || segment === '..')
  ) {
    throw new TSLMcpValidationError(
      invalidCode,
      'The path must be canonical and cannot contain empty, dot, or parent segments.'
    );
  }
  if (!normalized.toLowerCase().endsWith(expectedSuffix.toLowerCase())) {
    throw new TSLMcpValidationError(
      expectedSuffix === '.tsl.ts'
        ? 'TSL-MCP-FILE-EXTENSION-INVALID'
        : invalidCode,
      `The path must end in ${expectedSuffix}.`
    );
  }
  return normalized;
};

const resolveContainedRegularFile = ({
  projectRoot,
  relativePath,
  expectedSuffix,
  invalidCode,
  notFoundCode,
  outsideCode = 'TSL-MCP-FILE-PATH-OUTSIDE-PROJECT',
}: Object): {| relativePath: string, absolutePath: string |} => {
  const normalizedPath = validateCanonicalRelativePath(
    relativePath,
    expectedSuffix,
    invalidCode
  );
  const lexicalPath = path.resolve(projectRoot, ...normalizedPath.split('/'));
  if (!isWithinRoot(projectRoot, lexicalPath)) {
    throw new TSLMcpValidationError(
      outsideCode,
      'The requested path escapes the open project root.'
    );
  }
  if (!fs.existsSync(lexicalPath)) {
    throw new TSLMcpValidationError(
      notFoundCode,
      `The requested file does not exist: ${normalizedPath}`
    );
  }
  let realRoot;
  let realFile;
  try {
    realRoot = fs.realpathSync(projectRoot);
    realFile = fs.realpathSync(lexicalPath);
  } catch (error) {
    throw new TSLMcpValidationError(
      notFoundCode,
      `The requested file cannot be resolved: ${normalizedPath}`
    );
  }
  if (!isWithinRoot(realRoot, realFile)) {
    throw new TSLMcpValidationError(
      outsideCode,
      'The resolved path escapes the open project root through a link or junction.'
    );
  }
  if (!fs.statSync(realFile).isFile()) {
    throw new TSLMcpValidationError(
      invalidCode,
      'The requested path must resolve to a regular file.'
    );
  }
  return { relativePath: normalizedPath, absolutePath: realFile };
};

const decodeUtf8 = (bytes: any, filePath: string): string => {
  try {
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    }
    const decoded = bytes.toString('utf8');
    if (nodeBuffer && !nodeBuffer.Buffer.from(decoded, 'utf8').equals(bytes)) {
      throw new Error('Invalid UTF-8 byte sequence.');
    }
    return decoded;
  } catch (error) {
    throw new TSLMcpValidationError(
      'TSL-MCP-FILE-PATH-INVALID',
      `${filePath} is not valid UTF-8 text.`
    );
  }
};

const readBoundedText = (
  filePath: string,
  byteLimit: number,
  tooLargeCode: string
): {| bytes: any, source: string |} => {
  const stat = fs.statSync(filePath);
  if (stat.size > byteLimit) {
    throw new TSLMcpValidationError(
      tooLargeCode,
      `The file is ${stat.size} bytes; the limit is ${byteLimit}.`
    );
  }
  const bytes = fs.readFileSync(filePath);
  if (bytes.length > byteLimit) {
    throw new TSLMcpValidationError(
      tooLargeCode,
      `The file exceeds the ${byteLimit}-byte limit.`
    );
  }
  return { bytes, source: decodeUtf8(bytes, filePath) };
};

const readVerifiedCatalogs = (projectRoot: string): Object => {
  const projectApiPath = path.join(
    projectRoot,
    ...PROJECT_API_RELATIVE_PATH.split('/')
  );
  const tslApiPath = path.join(
    projectRoot,
    ...PROJECT_TSL_API_RELATIVE_PATH.split('/')
  );
  const tslCatalogPath = path.join(
    projectRoot,
    ...PROJECT_TSL_CATALOG_RELATIVE_PATH.split('/')
  );
  const diskFileStates = [projectApiPath, tslApiPath, tslCatalogPath].map(
    filePath => {
      try {
        return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
      } catch (error) {
        return false;
      }
    }
  );
  const diskFilesExist = diskFileStates.every(Boolean);
  if (!diskFilesExist && diskFileStates.some(Boolean)) {
    throw new TSLMcpValidationError(
      'TSL-MCP-CATALOG-MISSING',
      'The project has only a partial TSL authoring catalog set.',
      { nextAction: 'Call generate-catalogs and retry validation.' }
    );
  }
  if (diskFilesExist) {
    let projectApiDeclaration;
    let tslApiDeclaration;
    let tslCatalogJson;
    try {
      projectApiDeclaration = readBoundedText(
        projectApiPath,
        maximumCatalogBytes,
        'TSL-MCP-CATALOG-STALE'
      ).source;
      tslApiDeclaration = readBoundedText(
        tslApiPath,
        maximumCatalogBytes,
        'TSL-MCP-CATALOG-STALE'
      ).source;
      tslCatalogJson = readBoundedText(
        tslCatalogPath,
        maximumCatalogBytes,
        'TSL-MCP-CATALOG-STALE'
      ).source;
    } catch (error) {
      if (error instanceof TSLMcpValidationError) throw error;
      throw new TSLMcpValidationError(
        'TSL-MCP-CATALOG-MISSING',
        'The generated TSL catalog set changed or became unreadable.',
        { nextAction: 'Call generate-catalogs and retry validation.' }
      );
    }
    const verification = verifyTSLMaterialAuthoringArtifacts({
      projectApiDeclaration,
      tslApiDeclaration,
      tslCatalogJson,
    });
    if (!verification.valid) {
      throw new TSLMcpValidationError(
        verification.code || 'TSL-MCP-CATALOG-STALE',
        verification.message || 'The generated TSL catalogs are stale.',
        { nextAction: 'Call generate-catalogs and retry validation.' }
      );
    }
    return {
      source: 'disk',
      projectApiDeclaration,
      tslApiDeclaration,
      tslCatalogJson,
      catalog: verification.catalog,
      hashes: verification.hashes,
    };
  }

  const virtual = getVirtualTSLMaterialAuthoringArtifacts(projectRoot);
  if (virtual) {
    const verification = verifyTSLMaterialAuthoringArtifacts({
      projectApiDeclaration: virtual.projectApiDeclaration,
      tslApiDeclaration: virtual.tslApiDeclaration,
      tslCatalogJson: virtual.tslCatalogJson,
    });
    if (verification.valid) {
      return {
        source: 'memory',
        projectApiDeclaration: virtual.projectApiDeclaration,
        tslApiDeclaration: virtual.tslApiDeclaration,
        tslCatalogJson: virtual.tslCatalogJson,
        catalog: verification.catalog,
        hashes: verification.hashes,
      };
    }
  }
  throw new TSLMcpValidationError(
    'TSL-MCP-CATALOG-MISSING',
    'The project has no complete verified TSL authoring catalog set.',
    { nextAction: 'Call generate-catalogs and retry validation.' }
  );
};

const getRegisteredResourceName = (
  project: gdProject,
  projectRoot: string,
  sourceAbsolutePath: string
): ?string => {
  const resourcesManager = project.getResourcesManager();
  const names = resourcesManager
    .getAllResourceNames()
    .toJSArray()
    .sort();
  const realProjectRoot = fs.realpathSync(projectRoot);
  for (const name of names) {
    const resource = resourcesManager.getResource(name);
    if (resource.getKind() !== 'tslMaterial') continue;
    const file = resource.getFile();
    if (!file || /^[a-z][a-z0-9+.-]*:/i.test(file)) continue;
    const lexicalResourcePath = path.isAbsolute(file)
      ? path.resolve(file)
      : path.resolve(projectRoot, file);
    if (
      !isWithinRoot(projectRoot, lexicalResourcePath) ||
      !fs.existsSync(lexicalResourcePath)
    ) {
      continue;
    }
    let resourcePath;
    try {
      resourcePath = fs.realpathSync(lexicalResourcePath);
    } catch (error) {
      continue;
    }
    if (!isWithinRoot(realProjectRoot, resourcePath)) continue;
    const isCaseInsensitiveFileSystem = path.sep === '\\';
    const left = isCaseInsensitiveFileSystem
      ? resourcePath.toLowerCase()
      : resourcePath;
    const right = isCaseInsensitiveFileSystem
      ? sourceAbsolutePath.toLowerCase()
      : sourceAbsolutePath;
    if (left === right) return name;
  }
  return null;
};

const sanitizeText = (value: mixed, limit: number): string =>
  String(value || '')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '') // eslint-disable-line no-control-regex
    .slice(0, limit);

const sanitizeDiagnostic = (diagnostic: Object, filePath: string): Object => {
  const result: Object = {
    code: sanitizeText(diagnostic.code, 80),
    severity:
      diagnostic.severity === 'warning' || diagnostic.severity === 'info'
        ? diagnostic.severity
        : 'error',
    stage: sanitizeText(diagnostic.stage || 'policy', 40),
    message: sanitizeText(diagnostic.message, maximumDiagnosticMessageLength),
    file_path: filePath,
  };
  ['line', 'column', 'end_line', 'end_column'].forEach(name => {
    if (Number.isInteger(diagnostic[name]) && diagnostic[name] >= 1) {
      result[name] = diagnostic[name];
    }
  });
  if (diagnostic.source_excerpt) {
    result.source_excerpt = sanitizeText(
      diagnostic.source_excerpt,
      maximumSourceExcerptLength
    );
  }
  if (diagnostic.suggestion) {
    result.suggestion = sanitizeText(diagnostic.suggestion, 500);
  }
  return result;
};

const makeNextAction = ({
  valid,
  activationReady,
  validationLevel,
  registeredResourceName,
}: Object): string => {
  if (!valid) {
    return 'Repair the complete saved .tsl.ts file from the structured diagnostics, then call validate_tsl_file again.';
  }
  if (validationLevel === 'static' || validationLevel === 'graph') {
    return 'Run validate_tsl_file at backend level before activating this material.';
  }
  if (!registeredResourceName) {
    return 'Add this file as a tslMaterial project resource, call generate-catalogs, and validate the unchanged source hash again.';
  }
  if (!activationReady) {
    return 'Keep the material inactive and repeat the required backend or selected-model validation.';
  }
  return 'Run validate_project_files for any related project edits, then verify the visual result in a paused preview.';
};

export const validateTSLFileForMcp = async ({
  project,
  projectRoot,
  args,
  editorMemoryMayDiffer = false,
  includePreviewData = false,
  fixtureOverrides = {},
}: Object): Promise<Object> => {
  if (!fs || !path) {
    throw new TSLMcpValidationError(
      'TSL-MCP-PROJECT-PATH-UNAVAILABLE',
      'Filesystem path support is unavailable in this editor environment.'
    );
  }
  const validationLevel = args.validation_level || 'backend';
  const requestedTarget = args.target || 'current';
  if (
    !['static', 'graph', 'backend', 'model'].includes(validationLevel) ||
    !['current', 'webgl2-node-compat', 'webgpu'].includes(requestedTarget)
  ) {
    throw new TSLMcpValidationError(
      'TSL-MCP-FILE-PATH-INVALID',
      'validation_level or target is not one of the documented values.'
    );
  }
  const baseMaterial = args.fixture_base_material || 'standard';
  if (!['basic', 'standard', 'physical'].includes(baseMaterial)) {
    throw new TSLMcpValidationError(
      'TSL-MCP-FILE-PATH-INVALID',
      'fixture_base_material is not one of basic, standard, or physical.'
    );
  }
  const geometryFeatures =
    args.geometry_features === undefined ? [] : args.geometry_features;
  if (
    !Array.isArray(geometryFeatures) ||
    geometryFeatures.length > 4 ||
    new Set(geometryFeatures).size !== geometryFeatures.length ||
    geometryFeatures.some(
      feature =>
        !['skinning', 'morph_targets', 'material_array', 'instancing'].includes(
          feature
        )
    )
  ) {
    throw new TSLMcpValidationError(
      'TSL-MCP-FILE-PATH-INVALID',
      'geometry_features contains an unsupported or duplicate fixture.'
    );
  }
  if (
    args.timeout_ms !== undefined &&
    (!Number.isInteger(args.timeout_ms) ||
      args.timeout_ms < 1000 ||
      args.timeout_ms > 120000)
  ) {
    throw new TSLMcpValidationError(
      'TSL-MCP-FILE-PATH-INVALID',
      'timeout_ms must be an integer from 1000 through 120000.'
    );
  }
  if (
    args.diagnostic_limit !== undefined &&
    (!Number.isInteger(args.diagnostic_limit) ||
      args.diagnostic_limit < 1 ||
      args.diagnostic_limit > 500)
  ) {
    throw new TSLMcpValidationError(
      'TSL-MCP-FILE-PATH-INVALID',
      'diagnostic_limit must be an integer from 1 through 500.'
    );
  }
  const target =
    requestedTarget === 'current' ? TSL_CURRENT_TARGET : requestedTarget;
  if (target === 'webgpu') {
    throw new TSLMcpValidationError(
      'TSL-MCP-TARGET-UNAVAILABLE',
      'Version one validates only webgl2-node-compat; WebGPU validation is unavailable.'
    );
  }
  if (
    validationLevel === 'model' &&
    (typeof args.model_file_path !== 'string' || !args.model_file_path)
  ) {
    throw new TSLMcpValidationError(
      'TSL-MCP-MODEL-REQUIRED',
      'model_file_path is required for model validation.'
    );
  }
  if (validationLevel !== 'model' && args.model_file_path !== undefined) {
    throw new TSLMcpValidationError(
      'TSL-MCP-MODEL-PATH-INVALID',
      'model_file_path is accepted only when validation_level is model.'
    );
  }
  const sourceFile = resolveContainedRegularFile({
    projectRoot,
    relativePath: args.file_path,
    expectedSuffix: '.tsl.ts',
    invalidCode: 'TSL-MCP-FILE-PATH-INVALID',
    notFoundCode: 'TSL-MCP-FILE-NOT-FOUND',
  });
  const sourceRead = readBoundedText(
    sourceFile.absolutePath,
    TSL_SOURCE_MAX_BYTES,
    'TSL-MCP-FILE-TOO-LARGE'
  );
  const sourceHash = sha256Bytes(sourceRead.bytes);
  const catalogs = readVerifiedCatalogs(projectRoot);

  let modelFile = null;
  let modelBytes = null;
  let modelHash = null;
  if (validationLevel === 'model') {
    modelFile = resolveContainedRegularFile({
      projectRoot,
      relativePath: args.model_file_path,
      expectedSuffix: '.glb',
      invalidCode: 'TSL-MCP-MODEL-PATH-INVALID',
      notFoundCode: 'TSL-MCP-MODEL-PATH-INVALID',
      outsideCode: 'TSL-MCP-MODEL-PATH-INVALID',
    });
    if (fs.statSync(modelFile.absolutePath).size > maximumModelBytes) {
      throw new TSLMcpValidationError(
        'TSL-MCP-MODEL-PATH-INVALID',
        `The selected GLB exceeds the ${maximumModelBytes}-byte validation limit.`
      );
    }
    modelBytes = fs.readFileSync(modelFile.absolutePath);
    modelHash = sha256Bytes(modelBytes);
  }

  const fixture: Object = {
    baseMaterial,
    geometryFeatures: geometryFeatures.slice(),
    modelFilePath: modelFile ? modelFile.relativePath : null,
    modelBytes,
    parameterValues: fixtureOverrides.parameterValues || {},
    backgroundPreset: fixtureOverrides.backgroundPreset || 'dark',
    lightPreset: fixtureOverrides.lightPreset || 'studio',
    previewSize: fixtureOverrides.previewSize,
    cameraAngle: fixtureOverrides.cameraAngle || 'front',
    animationTime: Number.isFinite(fixtureOverrides.animationTime)
      ? fixtureOverrides.animationTime
      : 0,
    includeOriginalModelPreview: !!fixtureOverrides.includeOriginalModelPreview,
    abortSignal: null,
  };
  if (!modelBytes && Array.isArray(fixtureOverrides.geometryFeatures)) {
    fixture.geometryFeatures = fixtureOverrides.geometryFeatures.slice();
  }
  const timeoutMs = Number.isInteger(args.timeout_ms) ? args.timeout_ms : 30000;
  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : null;
  fixture.abortSignal = controller ? controller.signal : null;
  let timeoutId = null;
  let validationResult: any;
  try {
    const runValidation = () => {
      if (controller && controller.signal.aborted) {
        return Promise.reject(
          new TSLMcpValidationError(
            'TSL-MCP-TIMEOUT',
            `TSL validation exceeded the ${timeoutMs}ms hard deadline.`
          )
        );
      }
      return validateTSLMaterialSource({
        source: sourceRead.source,
        resourceName: '',
        filePath: sourceFile.relativePath,
        projectApiDeclaration: catalogs.projectApiDeclaration,
        tslApiDeclaration: catalogs.tslApiDeclaration,
        tslCatalogJson: catalogs.tslCatalogJson,
        validationLevel,
        target,
        fixture,
      });
    };
    const validationPromise =
      validationLevel === 'backend' || validationLevel === 'model'
        ? enqueueGpuValidation(runValidation)
        : runValidation();
    validationResult = await (Promise.race([
      validationPromise,
      new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => {
          if (controller) controller.abort();
          reject(
            new TSLMcpValidationError(
              'TSL-MCP-TIMEOUT',
              `TSL validation exceeded the ${timeoutMs}ms hard deadline.`
            )
          );
        }, timeoutMs);
      }),
    ]): any);
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }

  if (!validationResult.success) {
    throw new TSLMcpValidationError(
      validationResult.infrastructureCode || 'TSL-MCP-VALIDATOR-UNAVAILABLE',
      validationResult.infrastructureMessage ||
        'The TSL validator could not produce a trustworthy result.'
    );
  }
  let sourceAfterValidation;
  try {
    sourceAfterValidation = readBoundedText(
      sourceFile.absolutePath,
      TSL_SOURCE_MAX_BYTES,
      'TSL-MCP-SOURCE-CHANGED'
    ).bytes;
  } catch (error) {
    if (error instanceof TSLMcpValidationError) {
      throw new TSLMcpValidationError(
        'TSL-MCP-SOURCE-CHANGED',
        'The saved TSL source changed size or encoding while validation was running; retry with the new bytes.'
      );
    }
    throw error;
  }
  if (sha256Bytes(sourceAfterValidation) !== sourceHash) {
    throw new TSLMcpValidationError(
      'TSL-MCP-SOURCE-CHANGED',
      'The saved TSL source changed while validation was running; retry with the new bytes.'
    );
  }

  const registeredResourceName = getRegisteredResourceName(
    project,
    projectRoot,
    sourceFile.absolutePath
  );
  const diagnosticLimit = Number.isInteger(args.diagnostic_limit)
    ? args.diagnostic_limit
    : 100;
  const allDiagnostics = (validationResult.diagnostics || []).map(diagnostic =>
    sanitizeDiagnostic(diagnostic, sourceFile.relativePath)
  );
  const diagnostics = allDiagnostics.slice(0, diagnosticLimit);
  const activationReady = !!(
    validationResult.activationReady &&
    (validationLevel === 'backend' || validationLevel === 'model') &&
    registeredResourceName
  );
  const validationId = createTSLValidationId({
    result: { ...validationResult, sourceHash },
    target,
    validationLevel,
    fixture: {
      baseMaterial: fixture.baseMaterial,
      geometryFeatures: fixture.geometryFeatures,
      modelFilePath: fixture.modelFilePath,
      parameterValues: fixture.parameterValues,
      backgroundPreset: fixture.backgroundPreset,
      lightPreset: fixture.lightPreset,
      previewSize: fixture.previewSize || null,
      cameraAngle: fixture.cameraAngle,
      animationTime: fixture.animationTime,
      includeOriginalModelPreview: fixture.includeOriginalModelPreview,
    },
    modelHash,
  });
  const identity = catalogs.catalog.identity;
  const result: Object = {
    success: true,
    valid: !!validationResult.valid,
    activation_ready: activationReady,
    source_mode: 'disk',
    file_path: sourceFile.relativePath,
    registered_resource_name: registeredResourceName,
    editor_memory_may_differ: !!editorMemoryMayDiffer,
    source_sha256: sourceHash,
    requested_target: requestedTarget,
    target,
    validation_level: validationLevel,
    completed_stages: validationResult.completedStages || [],
    structurally_valid: !!validationResult.structurallyValid,
    graph_validated: !!validationResult.graphValidated,
    node_builder_validated: !!validationResult.nodeBuilderValidated,
    gpu_validated: !!validationResult.gpuValidated,
    model_validated: !!validationResult.modelValidated,
    validation_id: validationId,
    catalogs: {
      source: catalogs.source,
      project_api_sha256: catalogs.hashes.projectApi,
      tsl_api_sha256: catalogs.hashes.tslApi,
      tsl_catalog_sha256: catalogs.hashes.tslCatalog,
      authoring_api_version:
        identity.authoringApiVersion || TSL_AUTHORING_API_VERSION,
      portable_profile_version:
        identity.portableProfileVersion || TSL_PORTABLE_PROFILE_VERSION,
      three_revision: identity.threeRevision || TSL_THREE_REVISION,
    },
    fixture: {
      base_material: fixture.baseMaterial,
      geometry_features: fixture.geometryFeatures,
      model_file_path: fixture.modelFilePath,
      model_sha256: modelHash,
    },
    capabilities:
      (catalogs.catalog.capabilities &&
        catalogs.catalog.capabilities.supported) ||
      [],
    metrics: validationResult.metrics || {
      source_bytes: sourceRead.bytes.length,
      ast_node_count: 0,
      parse_milliseconds: 0,
    },
    diagnostics,
    diagnostics_truncated: diagnostics.length < allDiagnostics.length,
    next_action: makeNextAction({
      valid: !!validationResult.valid,
      activationReady,
      validationLevel,
      registeredResourceName,
    }),
  };
  if (validationResult.manifest) {
    result.manifest = validationResult.manifest;
  }
  if (includePreviewData) {
    result.preview_data_url = validationResult.previewDataUrl || null;
    result.preview_render_stats = validationResult.previewRenderStats || null;
    result.reference_preview_data_url =
      validationResult.referencePreviewDataUrl || null;
    result.reference_render_stats =
      validationResult.referenceRenderStats || null;
  }
  return result;
};
