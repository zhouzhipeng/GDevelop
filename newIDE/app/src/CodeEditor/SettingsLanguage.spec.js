// @noflow
import {
  registerSettingsLanguage,
  getSettingsVariableCompletions,
} from './SettingsLanguage';
test('registers a settings language, formatting and live syntax diagnostics once', () => {
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
  const formatting =
    languages.registerDocumentFormattingEditProvider.mock.calls[0][1];
  const model = {
    getFullModelRange: () => ({}),
    getValue: () => 'scene {\n name="Main"\n}\n',
    uri: { toString: () => 'game://scene.settings' },
  };
  expect(formatting.provideDocumentFormattingEdits(model)[0].text).toContain(
    '  name = "Main"'
  );
  const attach = monaco.editor.onDidCreateModel.mock.calls[0][0];
  attach({
    ...model,
    getModeId: () => 'gdevelop-settings',
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

test('offers direct variable declarations and metadata without suggesting nodes inside literal values', () => {
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
  expect(suggestions('scene {\n variable {\n metadata {\n ')).toContain('path');
  expect(suggestions('scene {\n variable {\n metadata {\n ')).not.toContain(
    'name'
  );
  expect(suggestions('scene {\n variable {\n value = ')).toEqual([]);
});
