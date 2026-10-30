// @noflow
import { maskSettingsRawStrings } from '../ProjectsStorage/SettingsDsl/Syntax';
import { MULTI_FILE_ENTRY_NAME } from '../ProjectsStorage/ProjectEntry';
import {
  ALL_INSTRUCTION_CATALOG_PATHS,
  assembleInstructionCatalogFiles,
} from '../ProjectsStorage/SettingsDsl/InstructionCatalog';
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
    if (fs.existsSync(path.join(directory, MULTI_FILE_ENTRY_NAME))) {
      const projectRoot = directory;
      try {
        const paths = ALL_INSTRUCTION_CATALOG_PATHS;
        const signature = paths
          .map(file => {
            const stat = fs.statSync(path.join(projectRoot, file));
            if (stat.size > 32 * 1024 * 1024)
              throw new Error('Catalog too large');
            return `${stat.mtimeMs}:${stat.ctimeMs}:${stat.size}`;
          })
          .join('|');
        const cached = diskCatalogs.get(projectRoot);
        if (cached && cached.signature === signature) return cached.catalog;
        const catalog = assembleInstructionCatalogFiles(
          Object.fromEntries(
            paths.map(file => [
              file,
              JSON.parse(fs.readFileSync(path.join(projectRoot, file), 'utf8')),
            ])
          ),
          true
        );
        diskCatalogs.set(projectRoot, { signature, catalog });
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
  const masked = maskSettingsRawStrings(source);
  if (masked.inRawString) return [];
  source = masked.source;
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
  const candidates = owner === 'actions' ? catalog.actions : catalog.conditions;
  const entries = candidates;
  if (!Array.isArray(entries)) return [];
  const parent = entries.find(
    entry =>
      entry.dslName === stack[stack.length - 1] ||
      entry.type === stack[stack.length - 1]
  );
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
        label: entry.dslName || entry.type,
        replacePrefixLength: line.length,
        insertText: /\s/.test(entry.dslName || entry.type)
          ? JSON.stringify(entry.dslName || entry.type)
          : entry.dslName || entry.type,
        detail: (entry.parameters || [])
          .filter(p => !p.isCodeOnly)
          .map(p => `${p.dslName}: ${p.valueKind}`)
          .join(', '),
        documentation: `${entry.type}\n${entry.description || ''}`,
      }));
  let type = parsed[1];
  if (type.startsWith('"')) {
    try {
      type = JSON.parse(type);
    } catch (_) {
      return [];
    }
  }
  const entry = entries.find(
    entry => entry.dslName === type || entry.type === type
  );
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
