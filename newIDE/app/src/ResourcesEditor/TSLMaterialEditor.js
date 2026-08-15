// @flow
import { t, Trans } from '@lingui/macro';

import * as React from 'react';
import { AutoSizer } from 'react-virtualized';
import { sha256 } from 'js-sha256';
import { CodeEditor } from '../CodeEditor';
import Text from '../UI/Text';
import RaisedButton from '../UI/RaisedButton';
import MiniToolbar, { MiniToolbarText } from '../UI/MiniToolbar';
import SelectField from '../UI/SelectField';
import SelectOption from '../UI/SelectOption';
import PlaceholderLoader from '../UI/PlaceholderLoader';
import optionalRequire from '../Utils/OptionalRequire';
import ResourcesLoader from '../ResourcesLoader';
import { serializeToJSObject } from '../Utils/Serializer';
import { buildJavaScriptAuthoringArtifacts } from '../ProjectsStorage/JavaScriptAuthoringApi';
import {
  TSL_CURRENT_TARGET,
  TSL_MATERIAL_EXAMPLES,
  buildTSLMaterialAuthoringArtifacts,
} from '../ProjectsStorage/TSLMaterialAuthoring';
import { validateTSLMaterialSource } from '../TSLMaterial/TSLMaterialCompiler';

const fs = optionalRequire('fs');
const path = optionalRequire('path');

type Props = {|
  project: gdProject,
  resource: ?gdResource,
  absolutePath: string,
  relativePath: string,
  onProjectFilesChanged: () => Promise<void> | void,
|};

type ValidationResult = Object;

type TSLParameterDefinition = {
  type: string,
  default: any,
  label?: string,
  min?: number,
  max?: number,
  step?: number,
  ...
};
type TSLParameterSchema = { [string]: TSLParameterDefinition };

const hasOwn = (object: Object, propertyName: string): boolean =>
  Object.keys(object).includes(propertyName);

const validationStages = [
  'parse',
  'policy',
  'types',
  'manifest',
  'graph',
  'nodeBuilder',
  'gpu',
  'model',
];

const styles = {
  root: {
    display: 'flex',
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
  },
  editorColumn: {
    display: 'flex',
    flexDirection: 'column',
    flex: 3,
    minWidth: 320,
    minHeight: 0,
    overflow: 'hidden',
  },
  editor: {
    flex: 1,
    minHeight: 0,
  },
  sidePanel: {
    display: 'flex',
    flexDirection: 'column',
    flex: 2,
    minWidth: 300,
    maxWidth: 480,
    minHeight: 0,
    padding: 10,
    gap: 10,
    overflow: 'auto',
    boxSizing: 'border-box',
    borderLeft: '1px solid rgba(128, 128, 128, 0.28)',
  },
  preview: {
    width: '100%',
    maxHeight: 360,
    objectFit: 'contain',
    background:
      'repeating-conic-gradient(rgba(128,128,128,.15) 0 25%, transparent 0 50%) 50% / 16px 16px',
    borderRadius: 4,
  },
  section: {
    border: '1px solid rgba(128, 128, 128, 0.28)',
    borderRadius: 4,
    padding: 8,
  },
  stageList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  stage: {
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 11,
    border: '1px solid rgba(128,128,128,.35)',
  },
  diagnostic: {
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    fontFamily: 'Consolas, Monaco, monospace',
    fontSize: 11,
    marginTop: 6,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  parameterInput: {
    flex: 1,
    minWidth: 0,
  },
  modelInspection: {
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    fontFamily: 'Consolas, Monaco, monospace',
    fontSize: 11,
    maxHeight: 220,
    overflow: 'auto',
  },
};

const findTSLResourceForPath = (
  project: gdProject,
  preferredResource: ?gdResource,
  relativePath: string
): ?gdResource => {
  if (preferredResource && preferredResource.getKind() === 'tslMaterial') {
    return preferredResource;
  }
  const normalizedPath = relativePath.replace(/\\/g, '/');
  const resourcesManager = project.getResourcesManager();
  const resourceNames = resourcesManager.getAllResourceNames().toJSArray();
  for (const resourceName of resourceNames) {
    const resource = resourcesManager.getResource(resourceName);
    if (
      resource.getKind() === 'tslMaterial' &&
      resource.getFile().replace(/\\/g, '/') === normalizedPath
    ) {
      return resource;
    }
  }
  return null;
};

const getModelResources = (project: gdProject): Array<Object> => {
  const resourcesManager = project.getResourcesManager();
  return resourcesManager
    .getAllResourceNames()
    .toJSArray()
    .map(resourceName => resourcesManager.getResource(resourceName))
    .filter(resource => resource.getKind() === 'model3D')
    .map(resource => ({ name: resource.getName(), file: resource.getFile() }))
    .sort((left, right) => left.name.localeCompare(right.name));
};

const buildCurrentAuthoringContext = (project: gdProject): Object => {
  const projectData = serializeToJSObject(project, 'serializeTo');
  const javascriptArtifacts = buildJavaScriptAuthoringArtifacts(projectData);
  const tslArtifacts = buildTSLMaterialAuthoringArtifacts(
    javascriptArtifacts.projectApi
  );
  return {
    projectApi: javascriptArtifacts.projectApi,
    tslApi: tslArtifacts.tslApi,
    tslCatalog: tslArtifacts.tslCatalog,
    catalog: tslArtifacts.catalog,
    identity: tslArtifacts.catalog.identity,
    hashes: {
      projectApi: javascriptArtifacts.hashes.projectApi,
      tslApi: tslArtifacts.hashes.tslApiFile,
      tslCatalog: tslArtifacts.hashes.tslCatalogFile,
    },
  };
};

const authoringContextsAreEqual = (left: Object, right: Object): boolean =>
  left.hashes.projectApi === right.hashes.projectApi &&
  left.hashes.tslApi === right.hashes.tslApi &&
  left.hashes.tslCatalog === right.hashes.tslCatalog;

const readModelBytes = async (
  project: gdProject,
  resourceFile: string
): Promise<Uint8Array> => {
  if (fs && path && !/^(?:https?|blob|data):/i.test(resourceFile)) {
    const projectFile = project.getProjectFile();
    const absoluteModelPath = path.isAbsolute(resourceFile)
      ? resourceFile
      : projectFile
      ? path.resolve(path.dirname(projectFile), resourceFile)
      : null;
    if (absoluteModelPath) {
      const bytes = await fs.promises.readFile(absoluteModelPath);
      return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    }
  }
  const response = await fetch(
    ResourcesLoader.getFullUrl(project, resourceFile, {
      disableCacheBurst: true,
      isResourceForPixi: false,
    }),
    { cache: 'no-store' }
  );
  if (!response.ok)
    throw new Error(`Unable to load model (${response.status}).`);
  return new Uint8Array(await response.arrayBuffer());
};

const formatParameterValue = (value: any): string =>
  Array.isArray(value) ? JSON.stringify(value) : String(value);

const VectorParameterInput = ({
  value,
  expectedLength,
  onChange,
}: {|
  value: any,
  expectedLength: number,
  onChange: (value: Array<number>) => void,
|}): React.Node => {
  const formattedValue = formatParameterValue(value);
  const [draft, setDraft] = React.useState(formattedValue);
  React.useEffect(
    () => {
      setDraft(formattedValue);
    },
    [formattedValue]
  );
  const commitDraft = React.useCallback(
    (candidate: string) => {
      try {
        const parsed = JSON.parse(candidate);
        if (
          Array.isArray(parsed) &&
          parsed.length === expectedLength &&
          parsed.every(component => Number.isFinite(component))
        ) {
          onChange(parsed);
        }
      } catch (error) {
        // Keep an incomplete edit in the input until it becomes valid.
      }
    },
    [expectedLength, onChange]
  );
  return (
    <input
      style={styles.parameterInput}
      type="text"
      value={draft}
      onChange={event => {
        const candidate = event.currentTarget.value;
        setDraft(candidate);
        commitDraft(candidate);
      }}
      onBlur={() => {
        commitDraft(draft);
        setDraft(formatParameterValue(value));
      }}
    />
  );
};

const TSLMaterialEditor = ({
  project,
  resource,
  absolutePath,
  relativePath,
  onProjectFilesChanged,
}: Props): React.Node => {
  const [source, setSource] = React.useState('');
  const [lastSavedSource, setLastSavedSource] = React.useState('');
  const [loadError, setLoadError] = React.useState<?string>(null);
  const [saveError, setSaveError] = React.useState<?string>(null);
  const [externalConflict, setExternalConflict] = React.useState<?string>(null);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isValidating, setIsValidating] = React.useState(false);
  const [
    validationResult,
    setValidationResult,
  ] = React.useState<?ValidationResult>(null);
  const [
    lastSuccessfulValidation,
    setLastSuccessfulValidation,
  ] = React.useState<?Object>(null);
  const [previewDataUrl, setPreviewDataUrl] = React.useState('');
  const [previewShape, setPreviewShape] = React.useState('sphere');
  const [backgroundPreset, setBackgroundPreset] = React.useState('dark');
  const [lightPreset, setLightPreset] = React.useState('studio');
  const [environmentPreset, setEnvironmentPreset] = React.useState('studio');
  const [modelResourceName, setModelResourceName] = React.useState('');
  const [modelInspection, setModelInspection] = React.useState<?Object>(null);
  const [parameterValues, setParameterValues] = React.useState<Object>({});
  const editorRef = React.useRef<any>(null);
  const monacoRef = React.useRef<any>(null);
  const sourceRef = React.useRef(source);
  const lastSavedSourceRef = React.useRef(lastSavedSource);
  const saveSourceRef = React.useRef<?() => Promise<boolean>>(null);
  const validateSourceRef = React.useRef<?() => Promise<void>>(null);
  const validationRequestIdRef = React.useRef(0);
  const validationAbortControllerRef = React.useRef<any>(null);
  const shouldValidateExternalSourceRef = React.useRef(false);
  const isDirty = source !== lastSavedSource;
  const tslResource = findTSLResourceForPath(project, resource, relativePath);
  const resourceName = tslResource ? tslResource.getName() : '';
  const [modelResources, setModelResources] = React.useState<Array<Object>>(
    () => getModelResources(project)
  );
  const [authoringContext, setAuthoringContext] = React.useState<Object>(() =>
    buildCurrentAuthoringContext(project)
  );
  const refreshProjectAuthoringContext = React.useCallback(
    () => {
      const nextAuthoringContext = buildCurrentAuthoringContext(project);
      const nextModelResources = getModelResources(project);
      setAuthoringContext(current =>
        authoringContextsAreEqual(current, nextAuthoringContext)
          ? current
          : nextAuthoringContext
      );
      setModelResources(current => {
        const currentIdentity = current
          .map(model => `${model.name}\u0000${model.file}`)
          .join('\u0001');
        const nextIdentity = nextModelResources
          .map(model => `${model.name}\u0000${model.file}`)
          .join('\u0001');
        return currentIdentity === nextIdentity ? current : nextModelResources;
      });
      return {
        authoringContext: nextAuthoringContext,
        modelResources: nextModelResources,
      };
    },
    [project]
  );

  React.useEffect(
    () => {
      sourceRef.current = source;
    },
    [source]
  );
  React.useEffect(
    () => {
      lastSavedSourceRef.current = lastSavedSource;
    },
    [lastSavedSource]
  );

  const cancelActiveValidation = React.useCallback(() => {
    validationRequestIdRef.current++;
    if (validationAbortControllerRef.current) {
      validationAbortControllerRef.current.abort();
      validationAbortControllerRef.current = null;
    }
    setIsValidating(false);
  }, []);

  const extraLibraries = React.useMemo(
    () => [
      {
        filePath: 'file:///.gdevelop/project-api.d.ts',
        content: authoringContext.projectApi,
      },
      {
        filePath: 'file:///.gdevelop/tsl-api.d.ts',
        content: authoringContext.tslApi,
      },
    ],
    [authoringContext]
  );

  React.useEffect(
    () => {
      refreshProjectAuthoringContext();
    },
    [absolutePath, refreshProjectAuthoringContext]
  );

  React.useEffect(
    () => {
      let isMounted = true;
      cancelActiveValidation();
      setIsLoaded(false);
      setLoadError(null);
      setValidationResult(null);
      setPreviewDataUrl('');
      if (!fs) {
        setLoadError('Filesystem editing is unavailable in this editor mode.');
        setIsLoaded(true);
        return;
      }
      fs.promises
        .readFile(absolutePath, 'utf8')
        .then(content => {
          if (!isMounted) return;
          sourceRef.current = content;
          lastSavedSourceRef.current = content;
          setSource(content);
          setLastSavedSource(content);
          setIsLoaded(true);
        })
        .catch(error => {
          if (!isMounted) return;
          setLoadError(error.message);
          setIsLoaded(true);
        });
      return () => {
        isMounted = false;
        cancelActiveValidation();
      };
    },
    [absolutePath, cancelActiveValidation]
  );

  React.useEffect(
    () => {
      if (!fs || !isLoaded) return;
      let debounceTimeout = null;
      let watcher = null;
      try {
        watcher = fs.watch(absolutePath, () => {
          if (debounceTimeout) clearTimeout(debounceTimeout);
          debounceTimeout = setTimeout(async () => {
            try {
              const diskSource = await fs.promises.readFile(
                absolutePath,
                'utf8'
              );
              if (diskSource === lastSavedSourceRef.current) return;
              if (sourceRef.current !== lastSavedSourceRef.current) {
                setExternalConflict(
                  'This file changed on disk while the editor has unsaved changes.'
                );
                return;
              }
              sourceRef.current = diskSource;
              lastSavedSourceRef.current = diskSource;
              cancelActiveValidation();
              shouldValidateExternalSourceRef.current = true;
              setSource(diskSource);
              setLastSavedSource(diskSource);
              setValidationResult(null);
              setExternalConflict(null);
            } catch (error) {
              setExternalConflict(error.message);
            }
          }, 100);
        });
      } catch (error) {
        // Some browser-backed filesystems do not expose a watch primitive.
      }
      return () => {
        if (debounceTimeout) clearTimeout(debounceTimeout);
        if (watcher) watcher.close();
      };
    },
    [absolutePath, cancelActiveValidation, isLoaded]
  );

  const saveSource = React.useCallback(
    async () => {
      if (!fs) return false;
      setIsSaving(true);
      setSaveError(null);
      try {
        await fs.promises.writeFile(absolutePath, source, 'utf8');
        sourceRef.current = source;
        lastSavedSourceRef.current = source;
        setLastSavedSource(source);
        setExternalConflict(null);
        await onProjectFilesChanged();
        refreshProjectAuthoringContext();
        return true;
      } catch (error) {
        setSaveError(error.message);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [
      absolutePath,
      onProjectFilesChanged,
      refreshProjectAuthoringContext,
      source,
    ]
  );
  saveSourceRef.current = saveSource;

  const validateSource = React.useCallback(
    async () => {
      const validationRequestId = ++validationRequestIdRef.current;
      if (validationAbortControllerRef.current) {
        validationAbortControllerRef.current.abort();
      }
      const abortController =
        typeof AbortController !== 'undefined' ? new AbortController() : null;
      validationAbortControllerRef.current = abortController;
      if (!resourceName) {
        setValidationResult({
          success: false,
          valid: false,
          diagnostics: [
            {
              code: 'TSL-MCP-RESOURCE-NOT-FOUND',
              severity: 'error',
              stage: 'parse',
              line: 1,
              column: 1,
              message: 'Register this file as a TSL material resource first.',
            },
          ],
          completedStages: [],
        });
        validationAbortControllerRef.current = null;
        return;
      }
      setIsValidating(true);
      setSaveError(null);
      try {
        const refreshedProjectContext = refreshProjectAuthoringContext();
        const browserValidator = await import(/* webpackChunkName: "tsl-material-validator" */ '../TSLMaterial/TSLMaterialBrowserValidator');
        browserValidator.ensureTSLMaterialBrowserValidatorRegistered();
        let modelBytes = null;
        let inspection = null;
        if (modelResourceName) {
          const modelResource = refreshedProjectContext.modelResources.find(
            candidate => candidate.name === modelResourceName
          );
          if (!modelResource) throw new Error('The selected GLB is missing.');
          modelBytes = await readModelBytes(project, modelResource.file);
          inspection = await browserValidator.inspectTSLMaterialModelBytes(
            modelBytes
          );
        }
        const result = await validateTSLMaterialSource({
          source,
          resourceName,
          filePath: relativePath.replace(/\\/g, '/'),
          projectApiDeclaration:
            refreshedProjectContext.authoringContext.projectApi,
          tslApiDeclaration: refreshedProjectContext.authoringContext.tslApi,
          tslCatalogJson: refreshedProjectContext.authoringContext.tslCatalog,
          validationLevel: modelBytes ? 'model' : 'backend',
          target: TSL_CURRENT_TARGET,
          fixture: {
            geometryFeatures: modelBytes
              ? []
              : [previewShape === 'skinned' ? 'skinning' : previewShape],
            modelBytes,
            parameterValues,
            backgroundPreset,
            lightPreset,
            environmentPreset,
            previewSize: 320,
            abortSignal: abortController ? abortController.signal : null,
          },
        });
        if (validationRequestIdRef.current !== validationRequestId) return;
        setValidationResult(result);
        setModelInspection(inspection);
        if (result.valid && result.activationReady) {
          if (result.previewDataUrl) setPreviewDataUrl(result.previewDataUrl);
          setLastSuccessfulValidation({
            sourceHash: result.sourceHash,
            time: new Date().toISOString(),
          });
          const schema: TSLParameterSchema = result.manifest
            ? result.manifest.parameters || {}
            : {};
          setParameterValues(currentValues => {
            const nextValues: { [string]: any } = {};
            Object.keys(schema).forEach(name => {
              nextValues[name] = hasOwn(currentValues, name)
                ? currentValues[name]
                : schema[name].default;
            });
            return nextValues;
          });
        }
      } catch (error) {
        if (validationRequestIdRef.current !== validationRequestId) return;
        setValidationResult({
          success: false,
          valid: false,
          infrastructureCode: error.code || 'TSL-MCP-VALIDATOR-UNAVAILABLE',
          infrastructureMessage: error.message,
          diagnostics: [],
          completedStages: [],
        });
      } finally {
        if (validationRequestIdRef.current === validationRequestId) {
          if (validationAbortControllerRef.current === abortController) {
            validationAbortControllerRef.current = null;
          }
          setIsValidating(false);
        }
      }
    },
    [
      backgroundPreset,
      environmentPreset,
      lightPreset,
      modelResourceName,
      parameterValues,
      previewShape,
      project,
      refreshProjectAuthoringContext,
      relativePath,
      resourceName,
      source,
    ]
  );
  validateSourceRef.current = validateSource;

  React.useEffect(
    () => {
      if (
        !shouldValidateExternalSourceRef.current ||
        source !== lastSavedSource
      ) {
        return;
      }
      shouldValidateExternalSourceRef.current = false;
      if (validateSourceRef.current) validateSourceRef.current();
    },
    [lastSavedSource, source]
  );

  const diagnostics = validationResult
    ? validationResult.diagnostics || []
    : [];
  const markers = diagnostics.map(diagnostic => ({
    code: diagnostic.code,
    message: `[${diagnostic.code}] ${diagnostic.message}`,
    severity: diagnostic.severity,
    line: diagnostic.line || 1,
    column: diagnostic.column || 1,
    endLine: diagnostic.end_line || diagnostic.line || 1,
    endColumn: diagnostic.end_column || (diagnostic.column || 1) + 1,
  }));
  const manifest = validationResult && validationResult.manifest;
  const parameterSchema: TSLParameterSchema = manifest
    ? manifest.parameters || {}
    : {};
  const completedStages = new Set(
    validationResult ? validationResult.completedStages || [] : []
  );
  const failureStage = diagnostics.length ? diagnostics[0].stage : null;
  const stalePreview =
    !!previewDataUrl &&
    (isDirty || !validationResult || !validationResult.activationReady);

  const updateParameterValue = (name: string, value: any) => {
    setParameterValues(current => ({ ...current, [name]: value }));
    if (previewDataUrl) {
      setValidationResult(current =>
        current ? { ...current, activationReady: false } : current
      );
    }
  };

  if (!isLoaded) return <PlaceholderLoader />;
  if (loadError) return <Text>{loadError}</Text>;

  return (
    <div style={styles.root}>
      <div style={styles.editorColumn}>
        <MiniToolbar>
          <RaisedButton
            label={isSaving ? <Trans>Saving...</Trans> : <Trans>Save</Trans>}
            onClick={async () => {
              await saveSource();
            }}
            disabled={!isDirty || isSaving}
          />
          <RaisedButton
            primary
            label={
              isValidating ? (
                <Trans>Validating...</Trans>
              ) : (
                <Trans>Validate</Trans>
              )
            }
            onClick={validateSource}
            disabled={isValidating}
          />
          <RaisedButton
            label={<Trans>Format</Trans>}
            onClick={() => {
              if (editorRef.current) {
                editorRef.current
                  .getAction('editor.action.formatDocument')
                  .run();
              }
            }}
          />
          <MiniToolbarText>
            {isDirty ? <Trans>Unsaved changes</Trans> : <Trans>Saved</Trans>}
          </MiniToolbarText>
          {!!saveError && <MiniToolbarText>{saveError}</MiniToolbarText>}
          {!!externalConflict && (
            <MiniToolbarText>{externalConflict}</MiniToolbarText>
          )}
        </MiniToolbar>
        <div style={styles.editor}>
          <AutoSizer>
            {({ width, height }) => (
              <CodeEditor
                value={source}
                onChange={nextSource => {
                  cancelActiveValidation();
                  setSource(nextSource);
                  setValidationResult(null);
                }}
                language="typescript"
                modelPath={`file:///${relativePath.replace(/\\/g, '/')}`}
                extraLibraries={extraLibraries}
                markers={markers}
                initialScrollTop={0}
                initialCursorColumn={1}
                initialCursorLine={1}
                saveEditorState={() => {}}
                width={width}
                height={height}
                onEditorMounted={(editor, monaco) => {
                  editorRef.current = editor;
                  monacoRef.current = monaco;
                  editor.addCommand(
                    monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
                    () => {
                      if (saveSourceRef.current) saveSourceRef.current();
                    }
                  );
                }}
                onFocus={() => {
                  refreshProjectAuthoringContext();
                }}
                onBlur={() => {}}
              />
            )}
          </AutoSizer>
        </div>
      </div>
      <div style={styles.sidePanel}>
        <div style={styles.section}>
          <Text noMargin size="sub-title">
            <Trans>Material preview</Trans>
          </Text>
          <SelectField
            floatingLabelText={<Trans>Project GLB (optional)</Trans>}
            value={modelResourceName}
            onChange={(event, index, value) => setModelResourceName(value)}
            fullWidth
          >
            <SelectOption value="" label={t`Standard fixture`} />
            {modelResources.map(model => (
              <SelectOption
                key={model.name}
                value={model.name}
                label={model.name}
              />
            ))}
          </SelectField>
          <div style={styles.row}>
            {!modelResourceName && (
              <select
                value={previewShape}
                onChange={event => setPreviewShape(event.currentTarget.value)}
              >
                <option value="sphere">Sphere</option>
                <option value="plane">Plane</option>
                <option value="skinned">Skinned fixture</option>
              </select>
            )}
            <select
              value={environmentPreset}
              onChange={event =>
                setEnvironmentPreset(event.currentTarget.value)
              }
            >
              <option value="studio">Studio environment</option>
              <option value="warm">Warm environment</option>
              <option value="none">No environment</option>
            </select>
            <select
              value={backgroundPreset}
              onChange={event => setBackgroundPreset(event.currentTarget.value)}
            >
              <option value="dark">Dark background</option>
              <option value="light">Light background</option>
              <option value="transparent">Alpha background</option>
            </select>
            <select
              value={lightPreset}
              onChange={event => setLightPreset(event.currentTarget.value)}
            >
              <option value="studio">Studio light</option>
              <option value="soft">Soft light</option>
              <option value="bright">Bright light</option>
            </select>
          </div>
          {!!previewDataUrl && (
            <React.Fragment>
              <img
                src={previewDataUrl}
                alt="Validated TSL material preview"
                style={styles.preview}
              />
              {stalePreview && (
                <Text noMargin color="secondary">
                  <Trans>Last-known-good preview (stale)</Trans>
                </Text>
              )}
            </React.Fragment>
          )}
        </div>

        <div style={styles.section}>
          <Text noMargin size="sub-title">
            <Trans>Validation stages</Trans>
          </Text>
          <div style={styles.stageList}>
            {validationStages.map(stage => {
              const isComplete = completedStages.has(stage);
              const isFailure = stage === failureStage;
              const isOptionalModel = stage === 'model' && !modelResourceName;
              return (
                <span
                  key={stage}
                  style={{
                    ...styles.stage,
                    color: isFailure
                      ? '#ff6b6b'
                      : isComplete
                      ? '#45d9a1'
                      : undefined,
                  }}
                >
                  {stage}:{' '}
                  {isFailure
                    ? 'failed'
                    : isComplete
                    ? 'passed'
                    : isOptionalModel
                    ? 'optional'
                    : 'pending'}
                </span>
              );
            })}
          </div>
          {!!validationResult && !diagnostics.length && (
            <Text noMargin>
              {validationResult.activationReady
                ? 'Portable WebGL2 backend compatible.'
                : validationResult.infrastructureMessage ||
                  'Validation did not reach activation readiness.'}
            </Text>
          )}
          {diagnostics.map((diagnostic, index) => (
            <div key={`${diagnostic.code}-${index}`} style={styles.diagnostic}>
              [{diagnostic.code}] {diagnostic.message}
              {diagnostic.line
                ? ` (${diagnostic.line}:${diagnostic.column || 1})`
                : ''}
            </div>
          ))}
          {!!validationResult && !!validationResult.infrastructureMessage && (
            <div style={styles.diagnostic}>
              [{validationResult.infrastructureCode}]{' '}
              {validationResult.infrastructureMessage}
            </div>
          )}
          {!!lastSuccessfulValidation && (
            <Text noMargin color="secondary">
              Last success: {lastSuccessfulValidation.time} ·{' '}
              {lastSuccessfulValidation.sourceHash.slice(0, 12)}
            </Text>
          )}
        </div>

        <div style={styles.section}>
          <Text noMargin size="sub-title">
            <Trans>Parameters</Trans>
          </Text>
          {!Object.keys(parameterSchema).length && (
            <Text noMargin color="secondary">
              <Trans>Validate to extract the parameter schema.</Trans>
            </Text>
          )}
          {Object.keys(parameterSchema).map(name => {
            const definition = parameterSchema[name];
            const value = hasOwn(parameterValues, name)
              ? parameterValues[name]
              : definition.default;
            return (
              <label key={name} style={styles.row}>
                <span>{definition.label || name}</span>
                {definition.type === 'boolean' ? (
                  <input
                    type="checkbox"
                    checked={!!value}
                    onChange={event =>
                      updateParameterValue(name, event.currentTarget.checked)
                    }
                  />
                ) : definition.type === 'number' ? (
                  <input
                    style={styles.parameterInput}
                    type="number"
                    value={value}
                    min={definition.min}
                    max={definition.max}
                    step={definition.step || 'any'}
                    onChange={event =>
                      updateParameterValue(
                        name,
                        Number(event.currentTarget.value)
                      )
                    }
                  />
                ) : definition.type === 'color' ? (
                  <input
                    type="color"
                    value={value}
                    onChange={event =>
                      updateParameterValue(name, event.currentTarget.value)
                    }
                  />
                ) : definition.type === 'texture' ? (
                  <span>Validation texture</span>
                ) : (
                  <VectorParameterInput
                    value={value}
                    expectedLength={Number(definition.type.slice(-1))}
                    onChange={nextValue =>
                      updateParameterValue(name, nextValue)
                    }
                  />
                )}
              </label>
            );
          })}
          {!!Object.keys(parameterSchema).length && (
            <RaisedButton
              label={<Trans>Refresh validated preview</Trans>}
              onClick={validateSource}
              disabled={isValidating}
            />
          )}
        </div>

        <div style={styles.section}>
          <Text noMargin size="sub-title">
            <Trans>Compatibility</Trans>
          </Text>
          <Text noMargin>
            Target: {TSL_CURRENT_TARGET}; Three r
            {authoringContext.identity.threeRevision}; base:{' '}
            {manifest ? manifest.base : 'unknown'}.
          </Text>
          <Text noMargin color="secondary">
            The matrix below is shared by the editor, compiler, runtime, MCP,
            and AI authoring catalog.
          </Text>
          {authoringContext.catalog.capabilities.matrix.map(capability => (
            <Text noMargin color="secondary" key={capability.id}>
              {capability.capability}: {capability.status} —{' '}
              {capability.behavior}
            </Text>
          ))}
        </div>

        {!!modelInspection && (
          <div style={styles.section}>
            <Text noMargin size="sub-title">
              <Trans>GLB meshes and materials</Trans>
            </Text>
            <pre style={styles.modelInspection}>
              {JSON.stringify(modelInspection, null, 2)}
            </pre>
          </div>
        )}

        <div style={styles.section}>
          <Text noMargin size="sub-title">
            <Trans>Authoring contract</Trans>
          </Text>
          <Text noMargin color="secondary">
            {TSL_MATERIAL_EXAMPLES.length} validated templates · catalog{' '}
            {sha256(authoringContext.tslCatalog).slice(0, 12)} · only
            @gdevelop/tsl and three/tsl imports are accepted.
          </Text>
        </div>
      </div>
    </div>
  );
};

export default TSLMaterialEditor;
