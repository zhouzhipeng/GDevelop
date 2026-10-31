// @noflow
import fs from 'fs';
import path from 'path';
import { parseSettingsSyntax, decodeSettingsDocument } from '.';
const directory = path.resolve(
  __dirname,
  '../../../resources/gd-project-template/skills/gdevelop-project-files/references'
);
test('bundled authoring guidance documents the bare expression syntax', () => {
  const skill = fs.readFileSync(path.join(directory, '..', 'SKILL.md'), 'utf8');
  const usage = fs.readFileSync(path.join(directory, 'gdl-usage.md'), 'utf8');
  expect(skill).toContain('GDevelop expressions retain their existing names.');
  expect(usage).toContain('angle_in_degrees = MousePointerLock::MovementX()');
  expect(usage).toContain('`expr(...)` wrapper is not supported');
  expect(usage).not.toMatch(/=\s*expr\(/);
});
for (const file of [
  'gdl-usage.md',
  'create-extensions.md',
  'gameplay-test-harness.md',
  'signal-system.md',
  'springbone-behavior.md',
  'tsl-materials.md',
]) {
  test(`bundled ${file} uses current GDevelop Language (GDL) examples`, () => {
    const text = fs.readFileSync(path.join(directory, file), 'utf8');
    const blocks = Array.from(
      text.matchAll(/^([ \t]*)```settings\n([\s\S]*?)^\1```/gm)
    );
    expect(blocks.length).toBeGreaterThan(0);
    for (const [, indent, body] of blocks) {
      const source = body
        .split('\n')
        .map(line =>
          line.startsWith(indent) ? line.slice(indent.length) : line
        )
        .join('\n');
      const syntax = parseSettingsSyntax(source);
      if (!(syntax.root.type === 'behavior' && syntax.root.properties.type))
        decodeSettingsDocument(source, `${file}:example`);
    }
  });
}
