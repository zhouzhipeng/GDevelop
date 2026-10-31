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
    extensions: ['.gdl'],
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

test('offers named containers, typed variable descriptors and metadata without old scope syntax', () => {
  const labels = source =>
    getSettingsVariableCompletions(source).map(item => item.label);
  expect(labels('scene {\n ')).toContain('variables');
  expect(labels('scene {\n ')).not.toContain('variable');
  expect(labels('extension {\n ')).toEqual(
    expect.arrayContaining(['global_variables', 'scene_variables'])
  );
  expect(labels('function {\n ')).toContain('parameters');
  expect(labels('behavior {\n ')).toEqual(
    expect.arrayContaining(['properties', 'shared_properties'])
  );
  expect(labels('scene {\n variables {\n ')).toEqual([
    'declaration',
    'structure',
    'array',
  ]);
  expect(labels('scene {\n variables {\n Position {\n ')).toContain('value');
  expect(labels('scene {\n variables {\n A {\n ')).not.toContain('name');
  expect(labels('scene {\n variables {\n A {\n ')).not.toContain('scope');
  expect(labels('scene {\n variables {\n A {\n type = "array"\n ')).toContain(
    'elements'
  );
  expect(
    labels('scene {\n variables {\n A {\n type = "structure"\n ')
  ).toContain('members');
  expect(
    labels('scene {\n variables {\n A {\n items {\n item {\n ')
  ).not.toContain('name');
  expect(labels('function {\n parameters {\n Target {\n ')).toContain('type');
  expect(labels('function {\n parameters {\n Target {\n ')).not.toContain(
    'name'
  );
  expect(labels('scene {\n variables {\n A = [\n ')).toEqual([]);
});

test('offers unified event structure without old keywords or redundant child wrappers', () => {
  const labels = source =>
    getSettingsVariableCompletions(source).map(item => item.label);
  expect(labels('function {\n ')).toContain('events');
  expect(labels('function {\n events {\n ')).toEqual([
    'event',
    'else',
    'repeat',
    'while',
    'for_each',
    'for_each_child',
    'javascript',
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
  expect(body).not.toContain('type');
  expect(body).not.toContain('events');
  expect(body).not.toContain('if');
  expect(body).not.toContain('do');
  expect(labels('function {\n events {\n javascript {\n ')).toEqual(
    expect.arrayContaining(['code', 'strict'])
  );
  expect(labels('function {\n events {\n javascript {\n ')).not.toContain(
    'actions'
  );
});

test.each(['raw', 'json'])(
  'routes %s JavaScript string completions through a JS worker and disposes its virtual model',
  async kind => {
    const source =
      kind === 'raw'
        ? 'function {\n events {\n javascript {\n code = """\nconsole.\n\n"""\n }\n }\n}\n'
        : 'function {\n events {\n javascript {\n code = "console."\n }\n }\n}\n';
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
    const sourceLines = source.split('\n');
    const row = sourceLines.findIndex(line => line.includes('console.'));
    const result = await provider.provideCompletionItems(model, {
      lineNumber: row + 1,
      column: sourceLines[row].indexOf('console.') + 9,
    });
    expect(result.suggestions[0].label).toBe('log');
    expect(getCompletionsAtPosition).toHaveBeenCalledTimes(1);
    onWillDispose.mock.calls[0][0]();
    expect(dispose).toHaveBeenCalledTimes(1);
  }
);

test('raw code completion preserves body layout and resumes GDL scopes after a literal', () => {
  const prefix = 'function {\n events {\n javascript {\n ';
  const code = getSettingsVariableCompletions(prefix).find(
    item => item.label === 'code'
  );
  expect(code.insertText).toBe('code = """\n$0\n"""');
  expect(getSettingsVariableCompletions(prefix + 'code = """\n ')).toEqual([]);
  const after = getSettingsVariableCompletions(
    prefix + 'code = """\nif (x) {\n"""\n '
  );
  expect(after.map(item => item.label)).not.toContain('code');
  expect(after.map(item => item.label)).toContain('strict');
});

test('nested variable diagnostics and completions use recursive descriptors', () => {
  const languages = Object.fromEntries(
    [
      'register',
      'setMonarchTokensProvider',
      'setLanguageConfiguration',
      'registerDocumentFormattingEditProvider',
      'registerCompletionItemProvider',
    ].map(name => [name, jest.fn()])
  );
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
  const source =
    'scene {\n variables {\n Data {\n type = "structure"\n members {\n X {\n type = "number"\n value = "bad"\n }\n }\n }\n }\n}';
  monaco.editor.onDidCreateModel.mock.calls[0][0]({
    getValue: () => source,
    uri: { toString: () => 'game://scene.gdl' },
    getModeId: () => 'gdevelop-gdl',
    isDisposed: () => false,
    onDidChangeContent: jest.fn(() => ({ dispose: jest.fn() })),
    onWillDispose: jest.fn(),
  });
  expect(monaco.editor.setModelMarkers.mock.calls[0][2][0]).toMatchObject({
    code: 'SETTINGS_INVALID_VARIABLE',
    startLineNumber: 8,
    startColumn: 10,
  });
  const snippets = getSettingsVariableCompletions('scene {\n variables {\n ');
  expect(snippets.every(item => item.insertText.includes('type ='))).toBe(true);
  const descriptor = getSettingsVariableCompletions(
    'scene {\n variables {\n Data {\n type = "structure"\n '
  );
  expect(descriptor.map(item => item.label)).toEqual(
    expect.arrayContaining(['members', 'folded', 'hasMixedValues'])
  );
  for (const name of ['value', 'variables', 'items', 'json', 'metadata'])
    expect(descriptor.map(item => item.label)).not.toContain(name);
});

test('recursive descriptor completion recognizes array items and business member names', () => {
  const prefix =
    'scene {\n variables {\n Data {\n type = "array"\n elements {\n ';
  expect(
    getSettingsVariableCompletions(prefix).every(entry =>
      entry.insertText.startsWith('item {')
    )
  ).toBe(true);
  const item = getSettingsVariableCompletions(
    prefix + 'item {\n type = "structure"\n '
  );
  expect(item.map(entry => entry.label)).toContain('members');
  const nested = getSettingsVariableCompletions(
    prefix +
      'item {\n type = "structure"\n members {\n elements {\n type = "enum"\n '
  );
  expect(nested.map(entry => entry.label)).toEqual(
    expect.arrayContaining(['value', 'values'])
  );
  const used = getSettingsVariableCompletions(
    prefix + 'item {\n type = "structure"\n members {}\n '
  );
  expect(used.map(entry => entry.label)).not.toContain('members');
});
