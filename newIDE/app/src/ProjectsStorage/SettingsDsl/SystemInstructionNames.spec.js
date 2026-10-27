// @noflow
import fs from 'fs';
import path from 'path';
import {
  SYSTEM_INSTRUCTION_NAMES,
  getSystemInstructionName,
} from './SystemInstructionNames';
import { buildCompleteProjectInstructionCatalog } from '../../Mcp/McpEventKnowledge';
import {
  validateProjectInstructionCatalog,
  createCatalogInstructionResolver,
  createCatalogInstructionFormatter,
} from './InstructionCatalog';

let project, catalog;
beforeAll(() => {
  // Exercise the actual bundled JS registrations as well as the WASM builtins.
  const root = path.resolve(__dirname, '../../../../../Extensions');
  fs.readdirSync(root).forEach(name => {
    const file = path.join(root, name, 'JsExtension.js');
    if (!fs.existsSync(file) || name === 'ExampleJsExtension') return;
    const extension = require(file).createExtension(value => value, global.gd);
    global.gd.JsPlatform.get().addNewExtension(extension);
    extension.delete();
  });
  project = global.gd.ProjectHelper.createNewGDJSProject();
  catalog = buildCompleteProjectInstructionCatalog({
    project,
    includeDeprecatedAndHidden: true,
  });
});
afterAll(() => project.delete());

test('every registered system instruction has a fixed, unambiguous author name and preserves native identity', () => {
  validateProjectInstructionCatalog(catalog);
  const resolve = createCatalogInstructionResolver(catalog);
  const format = createCatalogInstructionFormatter(catalog);
  for (const [kind, entries] of [
    ['action', catalog.actions],
    ['condition', catalog.conditions],
  ]) {
    for (const entry of entries) {
      const o = entry.owner || {};
      const key = [
        kind,
        o.extension || '',
        o.objectType || '',
        o.behaviorType || '',
        entry.type,
      ].join('|');
      expect(SYSTEM_INSTRUCTION_NAMES).toHaveProperty([key]);
      expect(entry.dslName).toMatch(/^[a-z][A-Za-z0-9_]*$/);
      const short = resolve({ kind, source: entry.dslName, line: 1 });
      const native = resolve({
        kind,
        source: JSON.stringify(entry.type),
        line: 1,
      });
      expect(short).toEqual(native);
      expect(short.type.value).toBe(entry.type);
      expect(format({ kind, instruction: native })).toBe(entry.dslName);
    }
  }
  expect(
    catalog.actions.find(e => e.type === 'SetNumberVariable').dslName
  ).toBe('setNumber');
  expect(catalog.conditions.find(e => e.type === 'CollisionNP').dslName).toBe(
    'collision'
  );
  expect(
    catalog.actions.find(e => e.type === 'DebuggerTools::ConsoleLog').dslName
  ).toBe('log');
  expect(
    validateProjectInstructionCatalog({
      ...catalog,
      actions: [...catalog.actions].reverse(),
    })
  ).toBeTruthy();
});

test('unknown and differently owned instructions retain full type; project extensions cannot inherit system aliases', () => {
  expect(
    getSystemInstructionName('action', 'ThirdParty::SetNumberVariable', {
      extension: 'ThirdParty',
    })
  ).toBe('ThirdParty::SetNumberVariable');
  expect(
    getSystemInstructionName('action', 'SetNumberVariable', {
      extension: 'Other',
    })
  ).toBe('SetNumberVariable');
  const extension = new global.gd.PlatformExtension();
  extension.setExtensionInformation('ThirdParty', 'Third Party', '', '', 'MIT');
  extension.addAction('SetNumberVariable', 'Set number', '', '', '', '', '');
  try {
    const extended = buildCompleteProjectInstructionCatalog({
      project,
      additionalExtensions: [extension],
      includeDeprecatedAndHidden: true,
    });
    expect(
      extended.actions.find(e => e.type === 'ThirdParty::SetNumberVariable')
        .dslName
    ).toBe('ThirdParty::SetNumberVariable');
    expect(
      catalog.actions.every(
        entry =>
          extended.actions.find(e => e.type === entry.type).dslName ===
          entry.dslName
      )
    ).toBe(true);
  } finally {
    extension.delete();
  }
  project.insertNewEventsFunctionsExtension('DebuggerTools', 0);
  try {
    const changed = buildCompleteProjectInstructionCatalog({ project });
    expect(
      changed.actions.find(e => e.type === 'DebuggerTools::ConsoleLog').dslName
    ).toBe('DebuggerTools::ConsoleLog');
    expect(
      changed.actions.find(e => e.type === 'SetNumberVariable').dslName
    ).toBe('setNumber');
  } finally {
    project.removeEventsFunctionsExtension('DebuggerTools');
  }
});

test('rejects missing/illegal names and every same-kind short/native collision', () => {
  const entry = { ...catalog.actions[0] };
  const invalid = (actions, conditions = []) =>
    validateProjectInstructionCatalog({ ...catalog, actions, conditions });
  delete entry.dslName;
  expect(() => invalid([entry])).toThrow('invalid dslName');
  expect(() => invalid([{ ...entry, dslName: 'bad name' }])).toThrow(
    'invalid dslName'
  );
  const first = { ...catalog.actions[0], type: 'First', dslName: 'short' };
  const second = { ...catalog.actions[0], type: 'Second', dslName: 'short' };
  expect(() => invalid([first, second])).toThrow('conflicts between');
  expect(() =>
    invalid([first, { ...second, type: 'short', dslName: 'other' }])
  ).toThrow('conflicts between');
  expect(() =>
    invalid(
      [first],
      [{ ...catalog.conditions[0], type: 'Third', dslName: 'short' }]
    )
  ).not.toThrow();
});
