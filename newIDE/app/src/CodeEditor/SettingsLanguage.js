// @flow
/* eslint-disable no-template-curly-in-string -- Monaco snippet placeholders are intentionally literal. */
import {
  parseSettingsSyntax,
  formatSettingsDsl,
  getSettingsSchemas,
} from '../ProjectsStorage/SettingsDsl';

// Completion uses a small lexical stack so incomplete documents are supported.
// Braces following '=' (and array elements) are data, never component scopes.
export const getSettingsVariableCompletions = (
  source: string
): Array<Object> => {
  const currentLine = source.slice(source.lastIndexOf('\n') + 1);
  if (!/^\s*[A-Za-z_0-9]*$/.test(currentLine)) return [];
  const stack: Array<{
    literal: boolean,
    name: string,
    fields: Set<string>,
  }> = [];
  let previous = '';
  for (const match of source.matchAll(
    /\/\/[^\r\n]*|"(?:[^"\\]|\\.)*"|[A-Za-z_][A-Za-z0-9_]*|[{}[\]=]/g
  )) {
    const token = match[0];
    if (token.startsWith('//')) continue;
    const parent = stack[stack.length - 1];
    if (token === '[' || token === '{') {
      const literal =
        token === '[' || previous === '=' || (parent && parent.literal);
      stack.push({ literal, name: literal ? '' : previous, fields: new Set() });
    } else if (token === '}' || token === ']') stack.pop();
    else if (token === '=' && parent && !parent.literal)
      parent.fields.add(previous);
    previous = token;
  }
  const frame = stack[stack.length - 1];
  if (!frame || frame.literal) return [];
  const parent = stack[stack.length - 2];
  const field = (
    label: string,
    insertText: string,
    detail: string = ''
  ): Object => ({ label, insertText, detail });
  if (frame.name === 'variable' || frame.name === 'metadata') {
    const fields = [
      field(
        'type',
        'type = "${1|number,string,boolean,structure,array,enum|}"',
        'Optional; inferred from value except enum.'
      ),
      field(
        'values',
        'values = ["${1:Idle}"]',
        'Nonempty choices for enum variables.'
      ),
      field(
        'id',
        'id = "$1"',
        'Optional persistent identity; not required to read a variable.'
      ),
      field('folded', 'folded = ${1|true,false|}'),
      field('hasMixedValues', 'hasMixedValues = ${1|false,true|}'),
    ];
    if (frame.name === 'metadata')
      fields.unshift(
        field(
          'path',
          'path = [${1:0}, "${2:Field}"]',
          'Existing descendant: string structure keys and integer array indexes.'
        )
      );
    else {
      fields.unshift(
        field('name', 'name = "${1:Name}"'),
        field(
          'value',
          'value = ${1:0}',
          'Scalar, [] array or {} structure literal.'
        )
      );
      if (parent && parent.name === 'extension')
        fields.unshift(field('scope', 'scope = "${1|global,scene|}"'));
      fields.push(
        field(
          'metadata',
          'metadata {\n  path = [${1:0}]\n  folded = ${2:true}\n}',
          'Optional descendant metadata.'
        )
      );
    }
    return fields.filter(
      entry => entry.label === 'metadata' || !frame.fields.has(entry.label)
    );
  }
  const schemas = getSettingsSchemas();
  const kind = Object.keys(schemas.roots).find(
    key => schemas.roots[key] === frame.name
  );
  const schema =
    frame.name === 'instance'
      ? schemas.layout.instance
      : kind
      ? schemas.components[kind]
      : null;
  if (!schema || !schema.children.variable) return [];
  return [
    field(
      'variable',
      frame.name === 'extension'
        ? 'variable {\n  scope = "${1|global,scene|}"\n  name = "${2:Name}"\n  value = ${3:0}\n}'
        : 'variable {\n  name = "${1:Name}"\n  value = ${2:0}\n}',
      'Declare a variable directly on its owner; no collection wrapper.'
    ),
  ];
};

const initialized: WeakSet<any> = new WeakSet();
export const registerSettingsLanguage = (monaco: any) => {
  if (initialized.has(monaco)) return;
  initialized.add(monaco);
  const language = 'gdevelop-settings';
  monaco.languages.register({
    id: language,
    extensions: ['.settings', '.gdevelop'],
    aliases: ['GDevelop Settings'],
  });
  monaco.languages.setMonarchTokensProvider(language, {
    tokenizer: {
      root: [
        [/\/\/.*$/, 'comment'],
        [/"(?:[^"\\]|\\.)*"/, 'string'],
        [/\b(?:true|false)\b/, 'keyword'],
        [/-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/, 'number'],
        [/[A-Za-z_][A-Za-z0-9_]*(?=\s*\{)/, 'type.identifier'],
        [/[A-Za-z_][A-Za-z0-9_]*(?=\s*=)/, 'identifier'],
        [/[{}[\]]/, '@brackets'],
        [/[=,]/, 'delimiter'],
      ],
    },
  });
  monaco.languages.setLanguageConfiguration(language, {
    comments: { lineComment: '//' },
    brackets: [['{', '}'], ['[', ']']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '"', close: '"', notIn: ['string', 'comment'] },
    ],
  });
  monaco.languages.registerDocumentFormattingEditProvider(language, {
    provideDocumentFormattingEdits: model => [
      {
        range: model.getFullModelRange(),
        text: formatSettingsDsl(model.getValue(), model.uri.toString()),
      },
    ],
  });
  monaco.languages.registerCompletionItemProvider(language, {
    provideCompletionItems: (model, position) => {
      const source = model.getValue().slice(0, model.getOffsetAt(position));
      const word = model.getWordUntilPosition(position);
      return {
        suggestions: getSettingsVariableCompletions(source).map(suggestion => ({
          ...suggestion,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          },
        })),
      };
    },
  });
  const attached: WeakSet<any> = new WeakSet();
  const attach = (model: any) => {
    if (model.getModeId() !== language) {
      monaco.editor.setModelMarkers(model, language, []);
      return;
    }
    if (attached.has(model)) return;
    attached.add(model);
    const validate = () => {
      if (model.isDisposed()) return;
      if (model.getModeId() !== language) {
        monaco.editor.setModelMarkers(model, language, []);
        return;
      }
      try {
        parseSettingsSyntax(model.getValue(), model.uri.toString());
        monaco.editor.setModelMarkers(model, language, []);
      } catch (error) {
        monaco.editor.setModelMarkers(model, language, [
          {
            severity: monaco.MarkerSeverity.Error,
            message: error.message,
            code: error.code,
            startLineNumber: error.line || 1,
            startColumn: error.column || 1,
            endLineNumber: error.endLine || error.line || 1,
            endColumn: error.endColumn || (error.column || 1) + 1,
          },
        ]);
      }
    };
    let timer: any;
    const change = model.onDidChangeContent(() => {
      clearTimeout(timer);
      timer = setTimeout(validate, 150);
    });
    model.onWillDispose(() => {
      clearTimeout(timer);
      change.dispose();
    });
    validate();
  };
  monaco.editor.onDidCreateModel(attach);
  monaco.editor.onDidChangeModelLanguage(({ model }) => attach(model));
  monaco.editor.getModels().forEach(attach);
};
