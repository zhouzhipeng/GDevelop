// @flow
import {
  analyzeSettingsBuffer,
  getSettingsEventSemanticsHover,
} from './SettingsEventSemantics';
import {
  getSettingsInstructionCatalog,
  getSettingsInstructionCompletions,
} from './SettingsInstructionCompletions';
import {
  EVENT_NODE_TYPES,
  compileSettingsEvents,
  extractSettingsJavaScriptBlocks,
} from '../ProjectsStorage/SettingsDsl/Events';
/* eslint-disable no-template-curly-in-string -- Monaco snippet placeholders are intentionally literal. */
import {
  parseSettingsSyntax,
  formatSettingsDsl,
  getSettingsSchemas,
} from '../ProjectsStorage/SettingsDsl';

import { maskSettingsRawStrings } from '../ProjectsStorage/SettingsDsl/Syntax';

// Completion uses a small lexical stack so incomplete documents are supported.
// Braces following '=' (and array elements) are data, never component scopes.
export const getSettingsVariableCompletions = (
  source: string
): Array<Object> => {
  const masked = maskSettingsRawStrings(source);
  if (masked.inRawString) return [];
  source = masked.source;
  const currentLine = source.slice(source.lastIndexOf('\n') + 1);
  if (!/^\s*[A-Za-z_0-9]*$/.test(currentLine)) return [];
  const stack: Array<{
    literal: boolean,
    name: string,
    fields: Set<string>,
    lastField?: string,
    containerType?: string,
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
      if (!literal && parent) parent.fields.add(`@${previous}`);
      if (!literal && previous === 'variable' && parent)
        parent.fields.add('$children');
      stack.push({ literal, name: literal ? '' : previous, fields: new Set() });
    } else if (token === '}' || token === ']') stack.pop();
    else if (token === '=' && parent && !parent.literal) {
      parent.fields.add(previous);
      parent.lastField = previous;
    } else if (parent && previous === '=' && parent.lastField === 'type') {
      parent.containerType = token;
    }
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
  if (frame.name === 'variable') {
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
    if (
      !(
        parent &&
        parent.name === 'variable' &&
        parent.containerType === '"array"'
      )
    )
      fields.unshift(field('name', 'name = "${1:Name}"'));
    if (!frame.fields.has('$children'))
      fields.unshift(
        field(
          'value',
          'value = ${1:0}',
          'Scalar, [] array or {} structure literal.'
        )
      );
    if (parent && parent.name === 'extension')
      fields.unshift(field('scope', 'scope = "${1|global,scene|}"'));
    if (
      !frame.fields.has('value') &&
      (frame.containerType === '"structure"' ||
        frame.containerType === '"array"')
    )
      fields.push(
        field(
          'variable',
          frame.containerType === '"array"'
            ? 'variable {\n  value = ${1:0}\n}'
            : 'variable {\n  name = "${1:Name}"\n  value = ${2:0}\n}',
          'Declare a child with its identity and constraints beside its value.'
        )
      );
    return fields.filter(
      entry => entry.label === 'variable' || !frame.fields.has(entry.label)
    );
  }
  if (stack.some(entry => entry.name === 'code')) return [];
  const eventSuggestions = [];
  const snippet = (label, text) => eventSuggestions.push(field(label, text));
  if (['function', 'fragment'].includes(frame.name)) {
    if (!frame.fields.has('@events'))
      snippet('events', 'events {\n  event {\n    $0\n  }\n}');
  }
  if (['events', ...EVENT_NODE_TYPES].includes(frame.name)) {
    const leaf = ['javascript', 'comment', 'link'].includes(frame.name);
    if (!leaf) {
      EVENT_NODE_TYPES.filter(
        name => !['group', 'comment', 'link'].includes(name)
      ).forEach(name => snippet(name, `${name} {\n  $0\n}`));
      snippet('group', 'group {\n  name = "${1:Group}"\n  $0\n}');
      snippet('comment', 'comment {\n  text = "${1:Comment}"\n}');
      snippet('link', 'link {\n  target = "${1:Fragment}"\n}');
    }
    if (!['events', 'group', 'comment', 'link'].includes(frame.name)) {
      if (leaf) {
        if (!frame.fields.has('strict')) snippet('strict', 'strict = true');
        if (!frame.fields.has('code')) snippet('code', 'code = """\n$0\n"""');
      } else {
        if (!frame.fields.has('@conditions'))
          snippet('conditions', 'conditions {\n  $0\n}');
        if (!frame.fields.has('@actions'))
          snippet('actions', 'actions {\n  $0\n}');
        snippet(
          'variable',
          'variable {\n  name = "${1:Name}"\n  value = ${2:0}\n}'
        );
        if (frame.name === 'while' && !frame.fields.has('@while_conditions'))
          snippet('while_conditions', 'while_conditions {\n  $0\n}');
      }
    }
    return eventSuggestions;
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
  if (!schema || !schema.children.variable) return eventSuggestions;
  return [
    field(
      'variable',
      frame.name === 'extension'
        ? 'variable {\n  scope = "${1|global,scene|}"\n  name = "${2:Name}"\n  value = ${3:0}\n}'
        : 'variable {\n  name = "${1:Name}"\n  value = ${2:0}\n}',
      'Declare a variable directly on its owner; no collection wrapper.'
    ),
    ...eventSuggestions,
  ];
};

const initialized: WeakSet<any> = new WeakSet();
export const registerSettingsLanguage = (monaco: any) => {
  if (initialized.has(monaco)) return;
  initialized.add(monaco);
  const language = 'gdevelop-gdl';
  monaco.languages.register({
    id: language,
    extensions: ['.gdl'],
    aliases: ['GDevelop Language', 'GDL'],
  });
  monaco.languages.setMonarchTokensProvider(language, {
    tokenizer: {
      raw: [
        [
          /^[ \t]*("{3,})[ \t]*$/,
          {
            cases: {
              '$1==$S2': { token: 'string', next: '@pop' },
              '@default': 'string',
            },
          },
        ],
        [/.*$/, 'string'],
      ],
      root: [
        [/\/\/.*$/, 'comment'],
        [/("{3,})[ \t]*$/, { token: 'string', next: '@raw.$1' }],
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
  const embeddedModels = new WeakMap();
  const embeddedAt = (model, position) => {
    if (!monaco.Uri || !monaco.editor.createModel) return null;
    let blocks;
    try {
      blocks = extractSettingsJavaScriptBlocks(
        model.getValue(),
        model.uri.toString()
      );
    } catch (_) {
      return null;
    }
    const index = blocks.findIndex(
      block =>
        position.lineNumber >= block.bodyLine &&
        position.lineNumber <= block.endLine &&
        (block.stringLiteral.raw ||
          (model.getOffsetAt(position) >=
            block.stringLiteral.contentLocation.offset &&
            model.getOffsetAt(position) <=
              block.stringLiteral.contentLocation.endOffset))
    );
    if (index < 0) return null;
    const block = blocks[index];
    let models = embeddedModels.get(model);
    if (!models) {
      models = new Map();
      embeddedModels.set(model, models);
      model.onWillDispose(() => {
        models.forEach(embedded => embedded.dispose());
        embeddedModels.delete(model);
      });
    }
    const prefix =
      '/** @param {gdjs.RuntimeScene} runtimeScene @param {gdjs.RuntimeObject[]} objects */\nfunction __event(runtimeScene, objects, eventsFunctionContext) {\n';
    const value = `${prefix}${block.inlineCode}\n}`;
    let embedded = models.get(index);
    if (!embedded) {
      embedded = monaco.editor.createModel(
        value,
        'javascript',
        monaco.Uri.parse(
          `file:///settings-embedded/${encodeURIComponent(
            model.uri.toString()
          )}/${index}.js`
        )
      );
      models.set(index, embedded);
    } else if (embedded.getValue() !== value) embedded.setValue(value);
    const originalStart = model.getOffsetAt({
      lineNumber: block.bodyLine,
      column: 1,
    });
    const literal = block.stringLiteral;
    const originalOffset = model.getOffsetAt(position);
    const decodedOffset = literal.valueOffsets
      ? literal.valueOffsets.findIndex(offset => offset >= originalOffset)
      : block.inlineCode
          .split('\n')
          .slice(0, position.lineNumber - block.bodyLine)
          .reduce((sum, text) => sum + text.length + 1, 0) +
        position.column -
        1;
    return {
      model: embedded,
      offset: prefix.length + decodedOffset,
      prefixLength: prefix.length,
      originalStart,
    };
  };
  monaco.languages.registerCompletionItemProvider(language, {
    provideCompletionItems: async (model, position) => {
      const embedded = embeddedAt(model, position);
      if (embedded && monaco.languages.typescript.getJavaScriptWorker) {
        const getWorker = await monaco.languages.typescript.getJavaScriptWorker();
        const worker = await getWorker(embedded.model.uri);
        const result = await worker.getCompletionsAtPosition(
          embedded.model.uri.toString(),
          embedded.offset
        );
        const word = model.getWordUntilPosition(position);
        return {
          suggestions: (result ? result.entries : []).map(entry => ({
            label: entry.name,
            insertText: entry.insertText || entry.name,
            kind: monaco.languages.CompletionItemKind.Variable,
            range: {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: word.startColumn,
              endColumn: word.endColumn,
            },
          })),
        };
      }
      const source = model.getValue().slice(0, model.getOffsetAt(position));
      const word = model.getWordUntilPosition(position);
      return {
        suggestions: [
          ...getSettingsVariableCompletions(source),
          ...getSettingsInstructionCompletions(
            source,
            getSettingsInstructionCatalog(model.uri)
          ),
        ].map(suggestion => ({
          ...suggestion,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet |
            (suggestion.label === 'code'
              ? monaco.languages.CompletionItemInsertTextRule.KeepWhitespace
              : 0),
          range: {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn:
              suggestion.replacePrefixLength !== undefined
                ? position.column - suggestion.replacePrefixLength
                : word.startColumn,
            endColumn: word.endColumn,
          },
        })),
      };
    },
  });
  if (monaco.languages.registerHoverProvider)
    monaco.languages.registerHoverProvider(language, {
      provideHover: async (model, position, cancellation) => {
        if (cancellation && cancellation.isCancellationRequested) return null;
        const embedded = embeddedAt(model, position);
        if (!embedded) {
          const analysis = analyzeSettingsBuffer(
            model,
            getSettingsInstructionCatalog(model.uri)
          );
          return (
            analysis &&
            getSettingsEventSemanticsHover(
              analysis,
              model.getOffsetAt(position)
            )
          );
        }
        if (!monaco.languages.typescript.getJavaScriptWorker) return null;
        const getWorker = await monaco.languages.typescript.getJavaScriptWorker();
        const worker = await getWorker(embedded.model.uri);
        const info = await worker.getQuickInfoAtPosition(
          embedded.model.uri.toString(),
          embedded.offset
        );
        if (!info) return null;
        const text = (info.displayParts || []).map(part => part.text).join('');
        const documentation = (info.documentation || [])
          .map(part => part.text)
          .join('');
        return {
          contents: [
            { language: 'javascript', value: text },
            { value: documentation },
          ],
        };
      },
    });
  const parseOutline = model => {
    try {
      return parseSettingsSyntax(model.getValue(), model.uri.toString()).root;
    } catch (_) {
      return null;
    }
  };
  if (monaco.languages.registerFoldingRangeProvider)
    monaco.languages.registerFoldingRangeProvider(language, {
      provideFoldingRanges: model => {
        const ranges = [];
        const visit = node => {
          if (node.location && node.location.endLine > node.location.line)
            ranges.push({
              start: node.location.line,
              end: node.location.endLine,
            });
          Object.values(node.properties).forEach(property => {
            if (property.raw)
              ranges.push({
                start: property.location.line,
                end: property.location.endLine,
              });
          });
          node.children.forEach(visit);
        };
        const root = parseOutline(model);
        if (root) visit(root);
        return ranges;
      },
    });
  if (monaco.languages.registerDocumentSymbolProvider)
    monaco.languages.registerDocumentSymbolProvider(language, {
      provideDocumentSymbols: model => {
        const root = parseOutline(model);
        if (!root) return [];
        const symbol = node => {
          const at = node.location;
          const range = {
            startLineNumber: at.line,
            startColumn: at.column,
            endLineNumber: at.endLine,
            endColumn: at.endColumn,
          };
          const name =
            node.properties.name ||
            node.properties.type ||
            node.properties.target;
          return {
            name: `${node.type}${name ? `: ${String(name.value)}` : ''}`,
            detail: node.instruction ? node.source : '',
            kind: monaco.languages.SymbolKind.Object,
            range,
            selectionRange: range,
            children: node.children.map(symbol),
          };
        };
        return [symbol(root)];
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
        const syntax = parseSettingsSyntax(
          model.getValue(),
          model.uri.toString()
        );
        if (['function', 'fragment'].includes(syntax.root.type))
          compileSettingsEvents(
            model.getValue(),
            {
              resolveInstruction: ({ source }) => ({
                type: { value: source },
                parameters: [],
              }),
            },
            model.uri.toString()
          );
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
