// @flow
import { Trans } from '@lingui/macro';

import * as React from 'react';
import PlaceholderLoader from '../UI/PlaceholderLoader';
import RaisedButton from '../UI/RaisedButton';
import Text from '../UI/Text';
import PreferencesContext from '../MainFrame/Preferences/PreferencesContext';
import PortalContainerContext from '../UI/PortalContainerContext';
import PoppedOutMonacoEditor from './PoppedOutMonacoEditor';
import {
  registerThemes,
  initializeCompletions,
  enableJsTypeDiagnostics,
  applyElectronClipboardPatch,
  suppressDiagnosticsMessagesForModel,
  unsuppressDiagnosticsMessagesForModel,
  baseEditorOptions,
} from './MonacoSetup';

export type State = {|
  MonacoEditor: ?any,
  error: ?Error,
|};
export type CodeEditorExtraLibrary = {|
  filePath: string,
  content: string,
|};
export type CodeEditorMarker = {|
  code?: string,
  message: string,
  severity?: 'error' | 'warning' | 'info',
  line: number,
  column: number,
  endLine?: number,
  endColumn?: number,
|};
export type Props = {|
  value: string,
  onChange: string => void,
  initialScrollTop: number,
  initialCursorColumn: number,
  initialCursorLine: number,
  saveEditorState: ({
    scrollTop: number,
    cursorColumn: number,
    cursorLine: number,
  }) => void,
  width?: number,
  height?: number,
  onEditorMounted?: (editor: any, monaco: any) => void,
  onFocus: () => void,
  onBlur: () => void,
  /**
   * Diagnostics whose message contains one of these texts are not shown
   * in this editor. Useful when the code is run in a way the TypeScript
   * language service can not know about (a gameplay test, for example, is
   * run inside an async function, so top-level `await` is allowed).
   */
  suppressedDiagnosticsMessages?: Array<string>,
  language?: 'javascript' | 'typescript',
  modelPath?: string,
  extraLibraries?: Array<CodeEditorExtraLibrary>,
  markers?: Array<CodeEditorMarker>,
|};

export const CodeEditor = ({
  value,
  onChange,
  initialScrollTop,
  initialCursorColumn,
  initialCursorLine,
  saveEditorState,
  width,
  height,
  onEditorMounted,
  onFocus,
  onBlur,
  suppressedDiagnosticsMessages,
  language = 'javascript',
  modelPath,
  extraLibraries = [],
  markers = [],
}: Props): React.Node => {
  const [MonacoEditor, setMonacoEditor] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const editorRef = React.useRef<any>(null);
  const monacoRef = React.useRef<any>(null);
  const extraLibraryDisposablesRef = React.useRef<Array<any>>([]);

  const { values: preferences } = React.useContext(PreferencesContext);
  const portalContainer = React.useContext(PortalContainerContext);

  const installExtraLibraries = React.useCallback(
    (monaco: any) => {
      extraLibraryDisposablesRef.current.forEach(disposable =>
        disposable.dispose()
      );
      extraLibraryDisposablesRef.current = [];
      if (language === 'typescript') {
        extraLibraryDisposablesRef.current = extraLibraries.map(library =>
          monaco.languages.typescript.typescriptDefaults.addExtraLib(
            library.content,
            library.filePath
          )
        );
      }
    },
    [extraLibraries, language]
  );

  const setupEditorThemes = React.useCallback(
    (monaco: any) => {
      registerThemes(monaco);
      installExtraLibraries(monaco);
    },
    [installExtraLibraries]
  );

  const setUpSaveOnEditorBlur = React.useCallback(
    (editor: any) => {
      editor.onDidBlurEditorText(onBlur);
    },
    [onBlur]
  );
  const setUpEditorFocus = React.useCallback(
    (editor: any) => {
      editor.onDidFocusEditorText(onFocus);
    },
    [onFocus]
  );

  const setupEditorCompletions = React.useCallback(
    (editor: any, monaco: any) => {
      editorRef.current = editor;
      monacoRef.current = monaco;
      setUpEditorFocus(editor);
      setUpSaveOnEditorBlur(editor);
      initializeCompletions(monaco);
      applyElectronClipboardPatch(editor, monaco);

      if (preferences.showJsTypeError) {
        enableJsTypeDiagnostics(monaco);
      }
      if (suppressedDiagnosticsMessages) {
        suppressDiagnosticsMessagesForModel(
          monaco,
          editor.getModel(),
          suppressedDiagnosticsMessages
        );
      }

      editor.setScrollTop(initialScrollTop);
      editor.setPosition({
        column: initialCursorColumn,
        lineNumber: initialCursorLine,
      });

      if (onEditorMounted) onEditorMounted(editor, monaco);
    },
    [
      initialCursorColumn,
      initialCursorLine,
      initialScrollTop,
      onEditorMounted,
      preferences.showJsTypeError,
      setUpEditorFocus,
      setUpSaveOnEditorBlur,
      suppressedDiagnosticsMessages,
    ]
  );

  React.useEffect(
    () => {
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      const model = editor && editor.getModel();
      if (!monaco || !model) return;
      const currentMarkers = language === 'typescript' ? markers : [];
      monaco.editor.setModelMarkers(
        model,
        'gdevelop-tsl-material',
        currentMarkers.map(marker => ({
          code: marker.code,
          message: marker.message,
          severity:
            marker.severity === 'warning'
              ? monaco.MarkerSeverity.Warning
              : marker.severity === 'info'
              ? monaco.MarkerSeverity.Info
              : monaco.MarkerSeverity.Error,
          startLineNumber: marker.line,
          startColumn: marker.column,
          endLineNumber: marker.endLine || marker.line,
          endColumn: marker.endColumn || marker.column + 1,
        }))
      );
    },
    [language, markers]
  );

  React.useEffect(
    () => {
      if (monacoRef.current) installExtraLibraries(monacoRef.current);
    },
    [installExtraLibraries]
  );

  React.useEffect(() => {
    return () => {
      extraLibraryDisposablesRef.current.forEach(disposable =>
        disposable.dispose()
      );
      extraLibraryDisposablesRef.current = [];
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      if (editor && monaco && editor.getModel()) {
        monaco.editor.setModelMarkers(
          editor.getModel(),
          'gdevelop-tsl-material',
          []
        );
      }
      editorRef.current = null;
      monacoRef.current = null;
    };
  }, []);

  const handleLoadError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  const loadMonacoEditor = React.useCallback(
    () => {
      setError(null);

      // Define the global variable used by Monaco Editor to find its worker
      // (used, at least, for auto-completions).
      window.MonacoEnvironment = {
        getWorkerUrl: function(workerId, label) {
          return 'external/monaco-editor-min/vs/base/worker/workerMain.js';
        },
      };

      import(/* webpackChunkName: "react-monaco-editor" */ 'react-monaco-editor')
        .then(module => setMonacoEditor(oldValue => module.default))
        .catch(handleLoadError);
    },
    [handleLoadError]
  );

  // Load the editor on mount.
  React.useEffect(() => {
    loadMonacoEditor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const _handleContextMenu = React.useCallback((event: SyntheticEvent<>) => {
    // Prevent right click to bubble up and trigger the context menu
    // of the event.
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const _saveEditorState = React.useCallback(
    (editor: any, monaco: any) => {
      const cursorPosition = editor.getPosition();
      saveEditorState({
        scrollTop: editor.getScrollTop(),
        cursorColumn: cursorPosition.column,
        cursorLine: cursorPosition.lineNumber,
      });
      unsuppressDiagnosticsMessagesForModel(monaco, editor.getModel());
    },
    [saveEditorState]
  );

  // When rendered inside a popped-out window (PortalContainerContext
  // is set), use PoppedOutMonacoEditor which loads Monaco via the
  // AMD loader in the target window's context. This is necessary
  // because the webpack-bundled Monaco (react-monaco-editor) has
  // internal DOM checks that compare against the main window's
  // document.body — elements in a different window's document are
  // treated as detached and never rendered.
  if (portalContainer) {
    return (
      <PoppedOutMonacoEditor
        value={value}
        onChange={onChange}
        width={width || 600}
        height={height || 200}
        theme={preferences.codeEditorThemeName}
        fontSize={preferences.eventsSheetZoomLevel}
        showJsTypeError={preferences.showJsTypeError}
        initialScrollTop={initialScrollTop}
        initialCursorColumn={initialCursorColumn}
        initialCursorLine={initialCursorLine}
        saveEditorState={saveEditorState}
        onEditorMounted={onEditorMounted}
        onFocus={onFocus}
        onBlur={onBlur}
        suppressedDiagnosticsMessages={suppressedDiagnosticsMessages}
        language={language}
        modelPath={modelPath}
        extraLibraries={extraLibraries}
        markers={markers}
      />
    );
  }

  if (error) {
    return (
      <React.Fragment>
        <Text>
          <Trans>Unable to load the code editor</Trans>
        </Text>
        <RaisedButton label={<Trans>Retry</Trans>} onClick={loadMonacoEditor} />
      </React.Fragment>
    );
  }

  if (!MonacoEditor) {
    // Reserve the same dimensions as the editor that will replace this loader,
    // so that the surrounding container keeps a stable height while Monaco is
    // being loaded asynchronously. Without this, the height would grow once the
    // editor mounts, which - in the events sheet - reports a new event height
    // and makes the virtualized list jump the scroll position.
    return (
      <div style={{ width: width || 600, height: height || 200 }}>
        <PlaceholderLoader />
      </div>
    );
  }

  return (
    <div onContextMenu={_handleContextMenu}>
      <MonacoEditor
        width={width || 600}
        height={height || 200}
        language={language}
        path={modelPath}
        theme={preferences.codeEditorThemeName}
        value={value}
        onChange={onChange}
        editorWillMount={setupEditorThemes}
        editorDidMount={setupEditorCompletions}
        editorWillUnmount={_saveEditorState}
        options={{
          ...baseEditorOptions,
          fontSize: preferences.eventsSheetZoomLevel,
        }}
      />
    </div>
  );
};
