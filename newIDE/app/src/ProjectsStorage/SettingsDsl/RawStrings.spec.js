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
    'function {\n events {\n event {\n actions {\n A { text = """\nx\n"""\n }\n }\n }\n }\n}\n';
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

test('code is a required raw string field, not a child container', () => {
  expect(EVENT_SCHEMAS.javascript.fields.code).toMatchObject({
    required: true,
    type: 'string',
  });
  expect(EVENT_SCHEMAS.javascript.containers.code).toBeUndefined();
  expect(() =>
    compileSettingsEvents(
      'function {\n events {\n javascript {\n code = "x"\n }\n }\n}\n'
    )
  ).toThrow('multiline raw string');
  expect(() => parseSettingsSyntax('function {\n code {\n}\n}\n')).toThrow(
    'no longer supported'
  );
});
