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
      value = Max(1, 2)
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

test('bare operands preserve strings, arithmetic, comments and parenthesized continuation', () => {
  const source = instruction(`Compare {
  first = From
  second = To + 1 // operand comment
  message = "Score: " + ToString(Score)
  text = "https://example.com/}}"
  count = (
    From +
    Max(To, Entries[0])
  )
}`);
  const syntax = parseSettingsSyntax(source.replace(/\n/g, '\r\n'));
  const args = syntax.root.children[0].children[0].arguments;
  expect(args.first.reference).toBe(true);
  expect(args.first.value).toBe('From');
  expect(args.second.value.expression).toBe('To + 1');
  expect(args.message.value.expression).toBe('"Score: " + ToString(Score)');
  expect(args.text.value).toBe('https://example.com/}}');
  expect(args.count.value.expression).toContain('Max(To, Entries[0])');
  const printed = printSettingsSyntax(syntax.root, syntax.comments);
  const reparsed = parseSettingsSyntax(printed);
  expect(printSettingsSyntax(reparsed.root, reparsed.comments)).toBe(printed);
  expect(printed.match(/operand comment/g)).toHaveLength(1);
});

test.each([
  'scene {\n count = Max(1, 2)\n}',
  instruction('A {\n value = From other = To\n}'),
])(
  'restricts expressions to semantic operands and keeps line boundaries: %s',
  source => {
    expect(() => parseSettingsSyntax(source)).toThrow();
  }
);

test.each(['1', '"Hello"', 'From +\nTo', '(\nFrom\n) + (\nTo\n)'])(
  'continuation wrappers preserve native expression source: %s',
  expression => {
    const source = instruction(`A {\n value = (\n${expression}\n)\n}`);
    const syntax = parseSettingsSyntax(source);
    const item = syntax.root.children[0].children[0].arguments.value;
    expect(item.expression).toBe(true);
    expect(item.value.expression).toBe(expression);
    const printed = printSettingsSyntax(syntax.root);
    expect(printSettingsSyntax(parseSettingsSyntax(printed).root)).toBe(
      printed
    );
  }
);
