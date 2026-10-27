// @noflow
import optionalRequire from '../Utils/OptionalRequire';
const catalogs = new Map();
const diskCatalogs = new Map();

export const bindSettingsInstructionCatalog = (uri, catalog) => {
  catalogs.set(String(uri), catalog);
  return {
    dispose: () => {
      if (catalogs.get(String(uri)) === catalog) catalogs.delete(String(uri));
    },
  };
};
export const getSettingsInstructionCatalog = uri => {
  const bound = catalogs.get(uri.toString());
  if (bound) return bound;
  const fs = optionalRequire('fs'),
    path = optionalRequire('path');
  if (!fs || !path || uri.scheme !== 'file' || !uri.fsPath) return null;
  let directory = path.dirname(uri.fsPath);
  while (directory && directory !== path.dirname(directory)) {
    if (fs.existsSync(path.join(directory, 'project.gdevelop'))) {
      const file = path.join(directory, '.gdevelop/instructions-catalog.json');
      try {
        const stat = fs.statSync(file),
          cached = diskCatalogs.get(file);
        if (cached && cached.modified === stat.mtimeMs) return cached.catalog;
        const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (
          catalog.format !== 'gdevelop-settings-instruction-catalog' ||
          catalog.formatVersion !== 4
        )
          return null;
        diskCatalogs.set(file, { modified: stat.mtimeMs, catalog });
        return catalog;
      } catch (_) {
        return null;
      }
    }
    directory = path.dirname(directory);
  }
  return null;
};

// Incomplete-document completion only. The real parser remains authoritative.
export const getSettingsInstructionCompletions = (source, catalog) => {
  if (!catalog) return [];
  const start = source.lastIndexOf('\n') + 1;
  const line = source.slice(start).trimStart(),
    stack = [];
  let previous = '';
  for (const match of source
    .slice(0, start)
    .matchAll(
      /\/\/[^\r\n]*|"(?:[^"\\]|\\.)*"|[A-Za-z_][A-Za-z0-9_:]*|[{}[\]=]/g
    )) {
    const token = match[0];
    if (token.startsWith('//')) continue;
    if (token === '{' || token === '[')
      stack.push(previous === '=' || token === '[' ? '' : previous);
    else if (token === '}' || token === ']') stack.pop();
    previous = token;
  }
  if (stack.includes('code')) return [];
  const owner = [...stack]
    .reverse()
    .find(name => ['conditions', 'while_conditions', 'actions'].includes(name));
  if (!owner) return [];
  const entries = owner === 'actions' ? catalog.actions : catalog.conditions;
  if (!Array.isArray(entries)) return [];
  const parent = entries.find(entry => entry.type === stack[stack.length - 1]);
  if (parent && !parent.canHaveSubInstructions) {
    return (owner === 'actions'
      ? [
          'disabled',
          ...(parent.isAsync || parent.isOptionallyAsync ? ['awaited'] : []),
        ]
      : ['disabled', 'inverted']
    ).map(name => ({
      label: name,
      insertText: `${name} = true`,
      detail: 'Instruction flag',
    }));
  }
  const parsed = /^("(?:[^"\\]|\\.)*"|[^\s=]+)(?:\s+(.*))?$/.exec(line);
  if (!parsed || parsed[2] === undefined)
    return entries
      .filter(entry => typeof entry.type === 'string')
      .map(entry => ({
        label: entry.type,
        replacePrefixLength: line.length,
        insertText: /\s/.test(entry.type)
          ? JSON.stringify(entry.type)
          : entry.type,
        detail: (entry.parameters || [])
          .filter(p => !p.isCodeOnly)
          .map(p => `${p.dslName}: ${p.valueKind}`)
          .join(', '),
        documentation: entry.description || '',
      }));
  let type = parsed[1];
  if (type.startsWith('"')) {
    try {
      type = JSON.parse(type);
    } catch (_) {
      return [];
    }
  }
  const entry = entries.find(entry => entry.type === type);
  if (!entry) return [];
  const present = new Set(
    Array.from(
      (parsed[2] || '').matchAll(/(?:^|\s)([A-Za-z_][A-Za-z0-9_]*)\s*=/g),
      match => match[1]
    )
  );
  return (entry.parameters || [])
    .filter(
      parameter => !parameter.isCodeOnly && !present.has(parameter.dslName)
    )
    .map(parameter => {
      const value =
        parameter.defaultValue !== undefined
          ? parameter.defaultValue
          : parameter.valueKind === 'number'
          ? 0
          : parameter.valueKind === 'boolean'
          ? false
          : '';
      return {
        label: parameter.dslName,
        insertText: `${parameter.dslName}=\${1:${JSON.stringify(value)}}`,
        detail: parameter.valueKind,
        documentation: parameter.description || '',
      };
    });
};
