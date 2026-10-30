// @noflow
import { parseSettingsSyntax, printSettingsSyntax } from './Syntax';

const instruction = body => `function {\n actions {\n${body}\n }\n}\n`;

test.each([
  'scene { a=1 b=2 }',
  'scene { a=1 }',
  'function {\n actions {\n A {}}\n}\n',
  instruction('foo::bar { a=1 b=2 }'),
  instruction('foo::bar { a=1 }'),
  instruction('foo::bar {\n a=1 b=2\n}'),
  instruction('foo::bar {\n a=1b=2\n}'),
  instruction('foo::bar {\n a=1 }'),
  instruction('foo::bar {\n flags { disabled=true }\n}'),
  instruction('foo::bar {\n flags {\n disabled=true awaited=true\n }\n}'),
  instruction('foo::bar {\n child {} child {}\n}'),
])(
  'rejects non-empty single-line nodes and missing member newlines: %s',
  source => {
    expect(() => parseSettingsSyntax(source)).toThrow(/newline/i);
  }
);

test('namespaced nodes, instructions, flags and empty blocks round trip with multiline members', () => {
  const source = `foo::bar {
  name = "Test"
  empty {}
  actions {
    Extension::Action {
      value = {{ Max(1, 2) }}
      flags {
        disabled = false
        awaited = true
      }
      child {}
    }
  }
}
`;
  const syntax = parseSettingsSyntax(source);
  const formatted = printSettingsSyntax(syntax.root);
  expect(formatted).toContain('foo::bar {\n');
  expect(parseSettingsSyntax('foo::bar {}').root.type).toBe('foo::bar');
  expect(formatted).toContain('Extension::Action {\n');
  expect(printSettingsSyntax(parseSettingsSyntax(formatted).root)).toBe(
    formatted
  );
});

test('even a single short instruction argument is always printed on its own line', () => {
  const formatted = printSettingsSyntax(
    parseSettingsSyntax(instruction('A {\n value=1\n}')).root
  );
  expect(formatted).toMatch(/A \{\n\s+value = 1\n\s+\}/);
});
