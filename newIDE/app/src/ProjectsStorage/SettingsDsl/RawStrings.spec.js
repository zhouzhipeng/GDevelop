// @noflow
/* eslint-disable no-template-curly-in-string -- Assert that raw contents are never interpolated. */
import {
  parseSettingsSyntax,
  printSettingsSyntax,
  maskSettingsRawStrings,
} from './Syntax';
import {
  compileSettingsEvents,
  appendSettingsEvents,
  extractSettingsJavaScriptBlocks,
  EVENT_TYPES,
  EVENT_SCHEMAS,
} from './Events';
import { decodeSettingsDocument, serializeSettingsDocument } from '.';
import { parseCatalogInstructionArguments } from './InstructionOperands';
import { buildEventSourceMap } from '../../EventsSemantics/SourceMap';
const source = (body, fence = '"""', closing = fence) =>
  `function {\n events {\n javascript {\n code = ${fence}\n${body}${closing}\n }\n }\n}\n`;
const raw = text => parseSettingsSyntax(text).root.properties.text;

test.each([
  '',
  'x',
  '\n',
  '\n\n',
  'x\n',
  'x\n\n',
  '  x\t  \n\t y  ',
  '"\\n" ${x} {{Y()}} // raw',
  '中文😀',
])('raw values preserve whitespace and round trip: %j', value => {
  const text = `scene {\n text = """\n${value ? value + '\n' : ''}"""\n}\n`;
  const syntax = parseSettingsSyntax(text);
  expect(syntax.root.properties.text.value).toBe(value);
  const formatted = printSettingsSyntax(syntax.root, syntax.comments);
  expect(raw(formatted).value).toBe(value);
  expect(printSettingsSyntax(parseSettingsSyntax(formatted).root)).toBe(
    formatted
  );
});

test('closing indentation never removes body whitespace; CRLF maps to original offsets', () => {
  const text = 'scene {\r\n text = """\r\n  x\t \r\n\ty\r\n    """\r\n}\r\n';
  const item = raw(text);
  expect(item.value).toBe('  x\t \n\ty');
  expect(item.lineOffsets).toEqual([text.indexOf('  x'), text.indexOf('\ty')]);
  expect(raw(printSettingsSyntax(parseSettingsSyntax(text).root)).value).toBe(
    item.value
  );
});

test('delimiter collision uses longer fences and formatter preserves an existing longer fence', () => {
  const text = 'scene {\n text = """"\n"""\n""""\n}\n';
  expect(raw(text).value).toBe('"""');
  expect(printSettingsSyntax(parseSettingsSyntax(text).root)).toContain(
    'text = """"\n'
  );
  const events = [
    { type: EVENT_TYPES.javascript, inlineCode: 'const text = `\n"""\n`;' },
  ];
  const emitted = appendSettingsEvents('function {}\n', events);
  expect(emitted).toContain('code = """"\n');
  expect(compileSettingsEvents(emitted)[0].inlineCode).toBe(
    events[0].inlineCode
  );
});

test.each([
  '"""same line\n"""',
  '""" // comment\n"""',
  '"""\nx\n""""',
  '"""\nx\r"""',
  '"""\n\u0000\n"""',
])('rejects malformed raw literal %j', literal => {
  expect(() =>
    parseSettingsSyntax(`scene {\n text = ${literal}\n}\n`)
  ).toThrow();
});

test('raw literals compose with arrays, structures and instruction operands', () => {
  const text = 'scene {\n data = [\n"""\nx\n"""\n,\n"""\ny\n"""\n]\n}\n';
  const syntax = parseSettingsSyntax(text);
  const emitted = printSettingsSyntax(syntax.root);
  expect(parseSettingsSyntax(emitted).root.properties.data.value).toEqual([
    'x',
    'y',
  ]);
  const instruction =
    'function {\n events {\n event {\n actions {\n A {\n text = """\nx\n"""\n }\n }\n }\n }\n}\n';
  expect(parseCatalogInstructionArguments('text = """\nx\n"""')).toEqual({
    text: 'x',
  });
  expect(printSettingsSyntax(parseSettingsSyntax(instruction).root)).toContain(
    'text = """'
  );
});

test('JS errors do not affect GDL boundaries; JS diagnostics map CRLF positions', () => {
  const text = source('const first = 1;\nconst broken = ;\n').replace(
    /\n/g,
    '\r\n'
  );
  const syntax = parseSettingsSyntax(text);
  expect(extractSettingsJavaScriptBlocks(text)[0].code).toBe(
    'const first = 1;\nconst broken = ;'
  );
  try {
    compileSettingsEvents(text);
    throw new Error('expected JS diagnostic');
  } catch (error) {
    expect(error.code).toBe('SETTINGS_JAVASCRIPT');
    expect(error.line).toBe(6);
    expect(error.offset).toBe(text.indexOf('const broken = ;') + 15);
  }
  const entry = buildEventSourceMap(syntax.root, 'game://test.gdl').find(
    entry => entry.kind === 'code-content'
  );
  expect(text.slice(entry.source.offset, entry.source.endOffset)).toBe(
    'const first = 1;\r\nconst broken = ;'
  );
});

test('completion masking handles incomplete JS and resumes outer scopes after exact closing fences', () => {
  const unfinished = source('actions {\n if (\n').split('"""\n }')[0];
  expect(maskSettingsRawStrings(unfinished).inRawString).toBe(true);
  const text = source('actions {\n if (\n', '""""');
  const masked = maskSettingsRawStrings(text);
  expect(masked.inRawString).toBe(false);
  expect(masked.source).not.toContain('actions');
  expect(masked.source.length).toBe(text.length);
  expect(masked.source.split('\n')).toHaveLength(text.split('\n').length);
});

test('code is a required string field, not a child container', () => {
  expect(EVENT_SCHEMAS.javascript.fields.code).toMatchObject({
    required: true,
    type: 'string',
  });
  expect(EVENT_SCHEMAS.javascript.containers.code).toBeUndefined();
  expect(
    compileSettingsEvents(
      'function {\n events {\n javascript {\n code = "console.log(1);"\n }\n }\n}\n'
    )[0].inlineCode
  ).toBe('console.log(1);');
  expect(() => parseSettingsSyntax('function {\n code {\n}\n}\n')).toThrow(
    'no longer supported'
  );
});

test.each([
  'first line\nsecond line',
  '  first\n\tsecond  \n',
  'embedded """ quotes\nnext',
])(
  'comment text and function description share generic multiline string output: %j',
  text => {
    const events = [
      { type: EVENT_TYPES.comment, comment: text, comment2: 'secondary\ntext' },
    ];
    const document = appendSettingsEvents('function {}\n', events);
    expect(document).toMatch(/text = "{3,}\n/);
    const decoded = compileSettingsEvents(document)[0];
    expect(decoded.comment).toBe(text);
    expect(decoded.comment2).toBe('secondary\ntext');
    const settings = serializeSettingsDocument('function', {
      name: 'Test',
      functionType: 'Action',
      description: text,
    });
    expect(settings).toMatch(/description = "{3,}\n/);
    expect(decodeSettingsDocument(settings).payload.description).toBe(text);
  }
);

test('single-line JSON strings and multiline raw strings are interchangeable for comments and descriptions', () => {
  const text = 'line 1\nline 2';
  const single = `function {\n description = ${JSON.stringify(
    text
  )}\n events {\n comment {\n text = ${JSON.stringify(text)}\n }\n }\n}\n`;
  const formatted = printSettingsSyntax(parseSettingsSyntax(single).root);
  expect(formatted).toContain('description = """\nline 1\nline 2\n"""');
  expect(compileSettingsEvents(single)).toEqual(
    compileSettingsEvents(formatted)
  );
});

test('decoded single-line JS source maps escaped characters and virtual newlines back to its GDL line', () => {
  const value = 'const label = "中文😀";\nconst broken = ;';
  const text = `function {\n events {\n javascript {\n code = ${JSON.stringify(
    value
  )}\n }\n }\n}\n`;
  expect(extractSettingsJavaScriptBlocks(text)[0].code).toBe(value);
  try {
    compileSettingsEvents(text);
    throw new Error('expected JS diagnostic');
  } catch (error) {
    expect(error.code).toBe('SETTINGS_JAVASCRIPT');
    expect(error.line).toBe(4);
    expect(error.offset).toBe(text.indexOf('const broken = ;') + 15);
  }
});

test('string arrays, nested variable values and instruction operands use generic multiline output', () => {
  const text =
    'scene {\n name = "Test"\n variables {\n Label {\n type = "string"\n value = "first\\nsecond"\n }\n Data {\n type = "structure"\n json = "{\\"lines\\":[\\"a\\\\nb\\",\\"short\\"]}"\n }\n }\n}\n';
  const syntax = parseSettingsSyntax(text);
  const formatted = printSettingsSyntax(syntax.root);
  expect(formatted).toContain('value = """\nfirst\nsecond\n"""');
  const decoded = decodeSettingsDocument(formatted).payload.variables;
  expect(decoded[0].value).toBe('first\nsecond');
  expect(decoded[1].children[0].children[0].value).toBe('a\nb');
  const instructions =
    'function {\n events {\n event {\n actions {\n A {\n text="first\\nsecond"\n }\n }\n }\n }\n}\n';
  const result = printSettingsSyntax(parseSettingsSyntax(instructions).root);
  expect(result).toContain('text = """\nfirst\nsecond\n"""');
});

test.each([
  '',
  'short',
  '第一行\n第二行',
  '  indented\n\tkept  \n',
  '"quoted" \\ path',
])(
  'all string assignments accept either literal form with the same decoded value: %j',
  value => {
    const literalForms = [JSON.stringify(value), `"""\n${value}\n"""`];
    for (const literal of literalForms) {
      const document = `function {
  name = """
Test
"""
  functionType = "Action"
  description = ${literal}
  events {
    comment {
      text = ${literal}
      text2 = ${literal}
    }
    event {
      actions {
        Extension::Action {
          message = ${literal}
        }
      }
    }
  }
}
`;
      const syntax = parseSettingsSyntax(document);
      expect(syntax.root.properties.name.value).toBe('Test');
      expect(syntax.root.properties.description.value).toBe(value);
      expect(decodeSettingsDocument(document).payload.description).toBe(value);
      const events = syntax.root.children[0];
      expect(events.children[0].properties.text.value).toBe(value);
      expect(events.children[0].properties.text2.value).toBe(value);
      expect(
        events.children[1].children[0].children[0].arguments.message.value
      ).toBe(value);
      const formatted = printSettingsSyntax(syntax.root);
      expect(printSettingsSyntax(parseSettingsSyntax(formatted).root)).toBe(
        formatted
      );
      const commentsOnly = `function {\n events {\n comment {\n text = ${literal}\n }\n }\n}\n`;
      expect(compileSettingsEvents(commentsOnly)[0].comment).toBe(value);
    }
  }
);
