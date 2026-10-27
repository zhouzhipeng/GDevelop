// @noflow
import {
  preserveSettingsSourceComments,
  parseSettingsSyntax,
  printSettingsSyntax,
} from './Syntax';
test('preserves source comments and raw template whitespace across model saves', () => {
  const old =
    'function {\n name = "Test"\n events {\n // before event\n event {\n // before actions\n actions {\n // before instruction\n A {}\n }\n event {\n type = "javascript"\n code {\nconst message = `first\n  second`;\n// belongs to JS\n }\n }\n }\n }\n}\n';
  const current = old
    .replace(/ *\/\/ (?:before event|before actions|before instruction)\n/g, '')
    .replace('\n A {}\n', '\n B {}\n');
  const result = preserveSettingsSourceComments(current, old);
  expect(result).toContain('// before event');
  expect(result).toContain('// before actions');
  expect(result).toContain('// before instruction');
  expect(result.match(/\/\/ belongs to JS/g)).toHaveLength(1);
  expect(result).toContain('`first\n  second`');
  expect(preserveSettingsSourceComments(current, result)).toBe(result);
  expect(
    printSettingsSyntax(
      parseSettingsSyntax(result).root,
      parseSettingsSyntax(result).comments
    )
  ).toBe(result);
});

test('keeps comments anchored to arguments across a model rewrite', () => {
  const previous = `function {
  events {
    event {
      actions {
        A {
          // explain the first operand
          first = 1
          // explain the second operand
          second = 2
        }
        B {
          // empty call explanation
        }
      }
    }
  }
}`;
  const current = previous
    .replace(/ *\/\/[^\n]*\n/g, '')
    .replace('first = 1', 'first = 3')
    .replace(/A \{\s+first = 3\s+second = 2\s+\}/, 'A { first = 3 second = 2 }')
    .replace(/B \{\s+\}/, 'B {}');
  const result = preserveSettingsSourceComments(current, previous);
  expect(result).toMatch(/\/\/ explain the first operand\n\s+first = 3/);
  expect(result).toMatch(/\/\/ explain the second operand\n\s+second = 2/);
  expect(result).toMatch(/B \{\n\s+\/\/ empty call explanation\n\s+\}/);
  expect(preserveSettingsSourceComments(current, result)).toBe(result);
});
