// @noflow
import { parse as parseJavaScript } from 'acorn';
import { sha256 } from 'js-sha256';
import optionalRequire from '../Utils/OptionalRequire';
import { unserializeFromJSObject } from '../Utils/Serializer';
import { scanProjectForValidationErrors } from '../Utils/EventsValidationScanner';
import { generateEventsCodeForScope } from '../EventsSheet/GenerateEventsCode';
import { temporarilyLoadProjectExtensionMetadataForValidation } from './McpProjectTools';
import { readGdlSemanticsCatalog } from './McpGdlSemantics';
import { createCatalogSourceFingerprint } from '../EventsSemantics/ProjectContext';
import { createSourceSnapshot } from '../EventsSemantics/AnalyzeEvents';
import {
  registerSettingsTypes,
  withIsolatedSettingsTypes,
} from '../ProjectsStorage/SettingsDsl';
import { parseSettingsSyntax } from '../ProjectsStorage/SettingsDsl/Syntax';
import { createCatalogInstructionResolver } from '../ProjectsStorage/SettingsDsl/InstructionCatalog';
import {
  composeLegacyProjectFromFiles,
  MULTI_FILE_ENTRY_NAME,
} from '../ProjectsStorage/MultiFileProjectFormat';
import {
  buildBehaviorPropertySchemasByType,
  validateProjectGdlCatalog,
} from '../ProjectsStorage/ProjectSourceCatalog';
import {
  readMultiFileSourceTree,
  resolveGameUriToPath,
} from '../ProjectsStorage/LocalFileStorageProvider/LocalMultiFileProject';

const gd = global.gd;
const fs = optionalRequire('fs');
const path = optionalRequire('path');
const GENERATION_REVISION = 'gdl-javascript-review-1';
// A loaded WASM compiler is immutable for this renderer session. Do not reuse
// receipts across a restart, including custom builds with identical versions.
const compilerSession = sha256(`${Date.now()}:${Math.random()}`);
const MAX_CODE_CHARACTERS = 16 * 1024 * 1024;
let busy = false;
const fail = (status, message) => {
  const error = new Error(message);
  error.code = status;
  throw error;
};

const managedFile = (projectRoot, files, relative) => {
  if (
    typeof relative !== 'string' ||
    !relative ||
    path.isAbsolute(relative) ||
    relative.includes('\\') ||
    relative.split('/').some(part => !part || part === '.' || part === '..')
  )
    fail('invalid-file', 'Expected a managed project-relative GDL path.');
  const absolute = path.resolve(projectRoot, relative);
  const uri = Object.keys(files).find(
    file =>
      file.endsWith('.gdl') &&
      resolveGameUriToPath(projectRoot, file) === absolute
  );
  if (!uri) fail('invalid-file', 'File is not a managed GDL source.');
  return uri;
};

// Resolve only supported function paths, using declarations for identity and
// path segments for ownership. Never infer an owner from an instruction name.
export const resolveGdlJavaScriptScope = (project, files, file) => {
  const root = parseSettingsSyntax(files[file], file).root;
  if (root.type !== 'function')
    fail(
      'unsupported-file-kind',
      'Only event function files have an executable compilation scope.'
    );
  const parts = file
    .slice('game://'.length)
    .split('/')
    .map(decodeURIComponent);
  const functionName = root.properties.name.value;
  if (parts.length === 4 && parts[0] === 'scenes' && parts[2] === 'functions') {
    const layout = project.getLayout(parts[1]);
    if (!layout.getLifecycleEventsFunctions().hasByName(functionName))
      fail('unsupported-file-kind', 'Unknown scene lifecycle function.');
    return {
      scope: { layout },
      generatedScope: 'scene',
      owner: { scene: parts[1] },
      includesOtherFunctions: true,
    };
  }
  if (parts[0] === 'extensions' && [4, 6].includes(parts.length)) {
    const extension = project.getEventsFunctionsExtension(parts[1]);
    if (parts.length === 4 && parts[2] === 'functions')
      return {
        scope: {
          eventsFunctionsExtension: extension,
          eventsFunction: extension
            .getEventsFunctions()
            .getEventsFunction(functionName),
        },
        generatedScope: 'function',
        owner: { extension: parts[1], function: functionName },
        includesOtherFunctions: false,
      };
    if (
      parts[4] === 'functions' &&
      ['behaviors', 'prefabs'].includes(parts[2])
    ) {
      const behavior = parts[2] === 'behaviors';
      const entity = (behavior
        ? extension.getEventsBasedBehaviors()
        : extension.getEventsBasedObjects()
      ).get(parts[3]);
      return {
        scope: {
          eventsFunctionsExtension: extension,
          eventsFunction: entity
            .getEventsFunctions()
            .getEventsFunction(functionName),
          [behavior ? 'eventsBasedBehavior' : 'eventsBasedObject']: entity,
        },
        generatedScope: behavior ? 'behavior' : 'object',
        owner: {
          extension: parts[1],
          [behavior ? 'behavior' : 'object']: parts[3],
        },
        includesOtherFunctions: true,
      };
    }
  }
  fail('unsupported-file-kind', 'Unsupported function owner.');
};

// Link expansion depends on the caller. Verify a real transitive call chain,
// including nested events, without compiling the fragment in an artificial scope.
const resolveCaller = (files, fragmentFile, callerFile) => {
  const roots = new Map(
    Object.entries(files)
      .filter(([uri]) => uri.endsWith('.gdl'))
      .map(([uri, source]) => [uri, parseSettingsSyntax(source, uri).root])
  );
  const target = roots.get(fragmentFile);
  const caller = roots.get(callerFile);
  if (!caller || caller.type !== 'function')
    fail('invalid-context', 'context_file must be an event function.');
  if (!/^game:\/\/scenes\/[^/]+\/functions\/[^/]+\.gdl$/.test(callerFile))
    fail('invalid-context', 'The caller must be a scene lifecycle function.');
  let found = false;
  let visited = 0;
  const walk = (node, active) => {
    if (++visited > 100000)
      fail('resource-limit', 'Link traversal budget exceeded.');
    if (node.properties.disabled?.value === true) return;
    if (node.type === 'link') {
      const name = node.properties.target?.value;
      const entry = [...roots].find(
        ([uri, root]) =>
          uri.includes('/external-events/') &&
          root.type === 'fragment' &&
          root.properties.name?.value === name
      );
      if (!entry)
        fail('invalid-link', `Missing linked fragment: ${String(name)}`);
      if (active.has(entry[0])) fail('invalid-link', 'Cyclic fragment Link.');
      if (entry[0] === fragmentFile) found = true;
      walk(entry[1], new Set([...active, entry[0]]));
    }
    node.children.forEach(child => walk(child, active));
  };
  walk(caller, new Set());
  if (!found)
    fail(
      'invalid-context',
      `context_file does not link to ${target.properties.name.value}.`
    );
  return callerFile;
};

// Every component of the owned cache path is checked before creation/use.
// Exclusive file creation prevents overwriting existing files or following a
// final-component symlink. Each invocation gets its own directory.
const writeArtifact = (projectRoot, snapshot, code) => {
  let directory = projectRoot;
  for (const segment of ['tmp', 'gdl-javascript-review', snapshot]) {
    directory = path.join(directory, segment);
    if (!fs.existsSync(directory)) fs.mkdirSync(directory);
    const stat = fs.lstatSync(directory);
    if (stat.isSymbolicLink() || !stat.isDirectory())
      fail(
        'invalid-cache-path',
        'Review cache must contain real directories only.'
      );
  }
  const invocation = fs.mkdtempSync(path.join(directory, 'generation-'));
  const output = path.join(invocation, 'generated.js');
  fs.writeFileSync(output, code, { encoding: 'utf8', flag: 'wx' });
  return {
    path: output,
    characters: code.length,
    fingerprint: `sha256:${sha256(code)}`,
  };
};

export const generateGdlJavaScript = async (
  editorProject,
  args,
  getCurrentProject = () => editorProject
) => {
  const projectFile = editorProject && editorProject.getProjectFile();
  if (
    !fs ||
    !path ||
    !projectFile ||
    path.basename(projectFile) !== MULTI_FILE_ENTRY_NAME
  )
    fail('invalid-project', 'A saved local project.gdl is required.');
  if (
    !args ||
    Object.keys(args).some(key => !['file', 'context_file'].includes(key))
  )
    fail('invalid-input', 'Expected file and optional context_file.');
  if (busy) fail('busy', 'A GDL JavaScript generation is already running.');
  busy = true;
  try {
    const { projectRoot, files } = await readMultiFileSourceTree(projectFile, {
      readOnly: true,
    });
    const requested = managedFile(projectRoot, files, args.file);
    const root = parseSettingsSyntax(files[requested], requested).root;
    let target = requested;
    if (root.type === 'fragment') {
      if (!args.context_file)
        fail(
          'context-required',
          'External fragments require context_file for each affected caller compilation unit.'
        );
      target = resolveCaller(
        files,
        requested,
        managedFile(projectRoot, files, args.context_file)
      );
    } else if (args.context_file !== undefined)
      fail(
        'invalid-context',
        'context_file is only supported for external fragments.'
      );
    else if (root.type !== 'function')
      fail(
        'unsupported-file-kind',
        'Configuration files do not have independent executable JavaScript.'
      );

    let catalog, gdlCatalog, gdlSource;
    try {
      catalog = readGdlSemanticsCatalog(projectRoot);
      if (
        fs.statSync(path.join(projectRoot, '.gdevelop/gdl-catalog.json')).size >
        32 * 1024 * 1024
      )
        fail('resource-limit', 'GDL catalog exceeds 32 MiB.');
      gdlSource = fs.readFileSync(
        path.join(projectRoot, '.gdevelop/gdl-catalog.json'),
        'utf8'
      );
      if (gdlSource.length > MAX_CODE_CHARACTERS * 2)
        fail('resource-limit', 'GDL catalog is too large.');
      gdlCatalog = validateProjectGdlCatalog(JSON.parse(gdlSource));
      if (catalog.sourceFingerprint !== createCatalogSourceFingerprint(files))
        throw new Error('Catalog declarations changed.');
    } catch (error) {
      fail(
        'catalog-stale',
        `Run generate-catalogs, then retry: ${error.message}`
      );
    }

    if (getCurrentProject() !== editorProject)
      fail('stale', 'The active project changed during source loading.');
    // Composition, native loading, metadata replacement and generation stay in
    // one synchronous section. No other renderer task can see temporary state.
    const generated = withIsolatedSettingsTypes(() => {
      registerSettingsTypes(gdlCatalog);
      const serialized = composeLegacyProjectFromFiles(files, {
        compileOptions: {
          resolveInstruction: createCatalogInstructionResolver(catalog),
        },
        behaviorPropertySchemasByType: buildBehaviorPropertySchemasByType(
          gdlCatalog
        ),
      });
      const project = gd.ProjectHelper.createNewGDJSProject();
      let restore = () => {};
      try {
        unserializeFromJSObject(project, serialized);
        restore = temporarilyLoadProjectExtensionMetadataForValidation(
          project,
          editorProject
        );
        const errors = scanProjectForValidationErrors(project).filter(
          error => error.severity !== 'warning'
        );
        if (errors.length)
          fail('validation-failed', JSON.stringify(errors.slice(0, 30)));
        const resolved = resolveGdlJavaScriptScope(project, files, target);
        const output = generateEventsCodeForScope(project, resolved.scope);
        if (output.error || !output.code)
          fail('generation-failed', output.error || 'No JavaScript generated.');
        if (output.diagnostics?.length)
          fail('generation-failed', JSON.stringify(output.diagnostics));
        if (output.code.length > MAX_CODE_CHARACTERS)
          fail(
            'resource-limit',
            'Generated JavaScript exceeds 16 Mi characters.'
          );
        parseJavaScript(output.code, {
          ecmaVersion: 2022,
          sourceType: 'script',
        });
        const { scope, ...description } = resolved;
        return { ...description, ...output };
      } finally {
        try {
          restore();
        } finally {
          project.delete();
        }
      }
    });
    const mode = 'runtime';
    // Source receipts remain stable within the loaded compiler session. The
    // artifact separately identifies the exact generated output (which may
    // contain fresh internal identifiers on otherwise identical compilations).
    const identity = {
      catalog,
      gdlSource,
      generatorRevision: GENERATION_REVISION,
      generatorVersion: gd.VersionWrapper.fullString(),
      mode,
      compilerSession,
    };
    const sourceSnapshot = createSourceSnapshot(files, identity, 'disk');
    const reread = await readMultiFileSourceTree(projectFile, {
      readOnly: true,
    });
    if (
      createSourceSnapshot(reread.files, identity, 'disk') !== sourceSnapshot ||
      JSON.stringify(readGdlSemanticsCatalog(projectRoot)) !==
        JSON.stringify(catalog) ||
      fs.readFileSync(
        path.join(projectRoot, '.gdevelop/gdl-catalog.json'),
        'utf8'
      ) !== gdlSource
    )
      fail('stale', 'Sources or catalogs changed during generation. Retry.');
    if (getCurrentProject() !== editorProject)
      fail('stale', 'The active project changed during generation.');
    const artifact = writeArtifact(
      projectRoot,
      sourceSnapshot.replace(':', '-'),
      generated.code
    );
    return {
      success: true,
      status: 'generated',
      requestedFile: args.file,
      contextFile: args.context_file,
      sourceSnapshot,
      mode,
      generatorRevision: GENERATION_REVISION,
      generatorVersion: identity.generatorVersion,
      generatedScope: generated.generatedScope,
      owner: generated.owner,
      includesOtherFunctions: generated.includesOtherFunctions,
      artifacts: [artifact],
      dependencies: generated.dependencies || [],
      diagnostics: generated.diagnostics || [],
      runtimeVerified: false,
      nextAction:
        'Read the generated JavaScript artifact and review the changed GDL event logic, picking lists, iteration counts and side effects. Source changes invalidate this review. Generation is not runtime verification.',
    };
  } finally {
    busy = false;
  }
};
