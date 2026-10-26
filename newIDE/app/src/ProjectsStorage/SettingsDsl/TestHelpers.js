// @noflow
// Test fixtures use the current unified grammar only.
import { parseSettingsSyntax, printSettingsSyntax } from './Syntax';
export const replaceEmbeddedEventBody = (source, body) => {
  const existing = parseSettingsSyntax(source || 'function {}\n');
  const replacement = parseSettingsSyntax(body);
  existing.root.children = existing.root.children.filter(
    c => c.type !== 'events'
  );
  existing.root.children.push(
    ...replacement.root.children.filter(c => c.type === 'events')
  );
  return printSettingsSyntax(existing.root, existing.comments);
};
