// @noflow
import {
  registerSettingsLanguage,
  getSettingsVariableCompletions,
} from './SettingsLanguage';
test('registers GDL, formatting and live syntax diagnostics once', () => {
  const languages = {
    register: jest.fn(),
    setMonarchTokensProvider: jest.fn(),
    setLanguageConfiguration: jest.fn(),
    registerDocumentFormattingEditProvider: jest.fn(),
    registerCompletionItemProvider: jest.fn(),
  };
  const monaco = {
    languages,
    editor: {
      onDidCreateModel: jest.fn(),
      onDidChangeModelLanguage: jest.fn(),
      getModels: () => [],
      setModelMarkers: jest.fn(),
    },
    MarkerSeverity: { Error: 8 },
  };
  registerSettingsLanguage(monaco);
  registerSettingsLanguage(monaco);
  expect(languages.register).toHaveBeenCalledTimes(1);
  expect(languages.register).toHaveBeenCalledWith({
    id: 'gdevelop-gdl',
    extensions: ['.gdl', '.gdevelop'],
    aliases: ['GDevelop Language', 'GDL'],
  });
  const formatting =
    languages.registerDocumentFormattingEditProvider.mock.calls[0][1];
  const model = {
    getFullModelRange: () => ({}),
    getValue: () => 'scene {\n name="Main"\n}\n',
    uri: { toString: () => 'game://scene.gdl' },
  };
  expect(formatting.provideDocumentFormattingEdits(model)[0].text).toContain(
    '  name = "Main"'
  );
  const attach = monaco.editor.onDidCreateModel.mock.calls[0][0];
  attach({
    ...model,
    getModeId: () => 'gdevelop-gdl',
    isDisposed: () => false,
    onDidChangeContent: jest.fn(() => ({ dispose: jest.fn() })),
    onWillDispose: jest.fn(),
    getValue: () => '[layout]\n',
  });
  expect(monaco.editor.setModelMarkers.mock.calls[0][2][0]).toMatchObject({
    code: 'SETTINGS_SYNTAX',
    severity: 8,
    startLineNumber: 1,
  });
});

test('offers direct variable declarations and nested children without suggesting nodes inside literal values', () => {
  const suggestions = source =>
    getSettingsVariableCompletions(source).map(item => item.label);
  expect(suggestions('scene {\n ')).toEqual(['variable']);
  expect(
    getSettingsVariableCompletions('scene {\n ')[0].insertText
  ).not.toContain('variables {');
  expect(suggestions('scene {\n variable {\n name = "A"\n ')).toContain(
    'value'
  );
  expect(suggestions('scene {\n variable {\n name = "A"\n ')).not.toContain(
    'name'
  );
  expect(suggestions('scene {\n variable {\n ')).not.toContain('scope');
  expect(suggestions('extension {\n variable {\n ')).toContain('scope');
  expect(suggestions('scene {\n variable {\n value = [{\n ')).toEqual([]);
  expect(suggestions('scene {\n variable {\n metadata {\n ')).toEqual([]);
  expect(suggestions('scene {\n variable {\n ')).not.toContain('metadata');
  expect(suggestions('scene {\n variable {\n type = "array"\n ')).toContain(
    'variable'
  );
  expect(
    suggestions('scene {\n variable {\n type = "array"\n variable {\n ')
  ).not.toContain('name');
  expect(
    suggestions('scene {\n variable {\n type = "structure"\n variable {\n ')
  ).toContain('name');
  expect(suggestions('scene {\n variable {\n value = []\n ')).not.toContain(
    'variable'
  );
  expect(suggestions('scene {\n variable {\n value = ')).toEqual([]);
});

test('offers unified event structure without old keywords or redundant child wrappers', () => {
  const labels = source =>
    getSettingsVariableCompletions(source).map(item => item.label);
  expect(labels('function {\n ')).toContain('events');
  expect(labels('function {\n events {\n ')).toEqual([
    'event',
    'group',
    'comment',
    'link',
  ]);
  const body = labels('function {\n events {\n event {\n ');
  expect(body).toEqual(
    expect.arrayContaining([
      'conditions',
      'actions',
      'event',
      'group',
      'comment',
      'link',
    ])
  );
  expect(body).not.toContain('events');
  expect(body).not.toContain('if');
  expect(body).not.toContain('do');
  expect(
    labels('function {\n events {\n event {\n type = "javascript"\n ')
  ).toEqual(expect.arrayContaining(['code', 'strict']));
  expect(
    labels('function {\n events {\n event {\n type = "javascript"\n ')
  ).not.toContain('actions');
});

test('routes embedded JavaScript completions through a JS worker and disposes its virtual model', async () => {
  const source =
    'function {\n events {\n event {\n type = "javascript"\n code {\nconsole.\n }\n }\n }\n}\n';
  const getCompletionsAtPosition = jest.fn(async () => ({
    entries: [{ name: 'log' }],
  }));
  const dispose = jest.fn();
  const languages = {
    register: jest.fn(),
    setMonarchTokensProvider: jest.fn(),
    setLanguageConfiguration: jest.fn(),
    registerDocumentFormattingEditProvider: jest.fn(),
    registerCompletionItemProvider: jest.fn(),
    CompletionItemKind: { Variable: 1, Snippet: 2 },
    CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
    typescript: {
      getJavaScriptWorker: async () => async () => ({
        getCompletionsAtPosition,
      }),
    },
  };
  const monaco = {
    languages,
    Uri: { parse: value => ({ toString: () => value }) },
    editor: {
      onDidCreateModel: jest.fn(),
      onDidChangeModelLanguage: jest.fn(),
      getModels: () => [],
      setModelMarkers: jest.fn(),
      createModel: (value, language, uri) => ({
        getValue: () => value,
        uri,
        dispose,
      }),
    },
  };
  registerSettingsLanguage(monaco);
  const onWillDispose = jest.fn();
  const model = {
    getValue: () => source,
    uri: { toString: () => 'file:///Test.gdl' },
    onWillDispose,
    getOffsetAt: ({ lineNumber, column }) =>
      source
        .split('\n')
        .slice(0, lineNumber - 1)
        .reduce((sum, line) => sum + line.length + 1, 0) +
      column -
      1,
    getWordUntilPosition: () => ({ startColumn: 9, endColumn: 9 }),
  };
  const provider = languages.registerCompletionItemProvider.mock.calls[0][1];
  const result = await provider.provideCompletionItems(model, {
    lineNumber: 6,
    column: 9,
  });
  expect(result.suggestions[0].label).toBe('log');
  expect(getCompletionsAtPosition).toHaveBeenCalledTimes(1);
  onWillDispose.mock.calls[0][0]();
  expect(dispose).toHaveBeenCalledTimes(1);
});
