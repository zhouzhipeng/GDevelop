// @noflow
import {
  preserveSettingsSourceComments,
  parseSettingsSyntax,
  printSettingsSyntax,
} from './Syntax';
test('preserves source comments and raw template whitespace across model saves', () => {
  const old =
    'function {\n name = "Test"\n events {\n // before event\n event {\n // before actions\n actions {\n // before instruction\n A\n }\n event {\n type = "javascript"\n code {\nconst message = `first\n  second`;\n// belongs to JS\n }\n }\n }\n }\n}\n';
  const current = old
    .replace(/ *\/\/ (?:before event|before actions|before instruction)\n/g, '')
    .replace('\n A\n', '\n B\n');
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
