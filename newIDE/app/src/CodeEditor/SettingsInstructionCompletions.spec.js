// @noflow
import {
  bindSettingsInstructionCatalog,
  getSettingsInstructionCatalog,
  getSettingsInstructionCompletions,
} from './SettingsInstructionCompletions';
const catalog = {
  actions: [
    {
      type: 'Delete',
      parameters: [
        { dslName: 'object', valueKind: 'object' },
        { dslName: 'runtime', isCodeOnly: true },
      ],
    },
  ],
  conditions: [{ type: 'CollisionNP', parameters: [] }],
};
test('catalog kind comes from its explicit container, and named completion omits code-only/present arguments', () => {
  expect(
    getSettingsInstructionCompletions(
      'function {\n events {\n event {\n actions {\n D',
      catalog
    ).map(s => s.label)
  ).toEqual(['Delete']);
  expect(
    getSettingsInstructionCompletions(
      'function {\n events {\n event {\n conditions {\n C',
      catalog
    ).map(s => s.label)
  ).toEqual(['CollisionNP']);
  expect(
    getSettingsInstructionCompletions(
      'function {\n events {\n event {\n actions {\n Delete o',
      catalog
    ).map(s => s.label)
  ).toEqual(['object']);
  expect(
    getSettingsInstructionCompletions(
      'function {\n events {\n event {\n actions {\n Delete object="Player" ',
      catalog
    )
  ).toEqual([]);
  expect(
    getSettingsInstructionCompletions(
      'function {\n events {\n event {\n code = """\n ',
      catalog
    )
  ).toEqual([]);
});
test('cloud and custom editors can bind an exact project catalog without filesystem access', () => {
  const uri = { toString: () => 'game://Test.gdl' };
  const binding = bindSettingsInstructionCatalog(uri.toString(), catalog);
  expect(getSettingsInstructionCatalog(uri)).toBe(catalog);
  binding.dispose();
  expect(getSettingsInstructionCatalog(uri)).toBeNull();
});

test('inserts catalog short names and completes their arguments while accepting native identifiers', () => {
  const shortCatalog = {
    actions: [{ ...catalog.actions[0], dslName: 'deleteObject' }],
    conditions: [{ ...catalog.conditions[0], dslName: 'collision' }],
  };
  const prefix = 'function {\n events {\n event {\n actions {\n ';
  expect(
    getSettingsInstructionCompletions(prefix + 'd', shortCatalog)[0]
  ).toMatchObject({ label: 'deleteObject', insertText: 'deleteObject' });
  for (const name of ['deleteObject', 'Delete'])
    expect(
      getSettingsInstructionCompletions(prefix + name + ' ', shortCatalog).map(
        s => s.label
      )
    ).toEqual(['object']);
});

test('loads all three files, invalidates the disk cache, and hides deprecated entries', () => {
  const fs = require('fs-extra');
  const path = require('path');
  const os = require('os');
  const {
    serializeInstructionCatalogFiles,
  } = require('../ProjectsStorage/SettingsDsl/InstructionCatalog');
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'instruction-completion-')
  );
  const uri = {
    scheme: 'file',
    fsPath: path.join(directory, 'events.gdl'),
    toString: () => `file://${directory}/events.gdl`,
  };
  const makeCatalog = type => ({
    format: 'gdevelop-gdl-instruction-catalog',
    formatVersion: 7,
    semanticsVersion: 1,
    semanticsRulesRevision: 'gdjs-picking-1',
    actions: [
      {
        type,
        dslName: type,
        parameters: [],
        semantics: { status: 'unknown', reason: 'test' },
      },
    ],
    conditions: [],
    expressions: [],
  });
  const write = type => {
    const files = serializeInstructionCatalogFiles(
      makeCatalog(type),
      makeCatalog('OldAction')
    );
    for (const [file, contents] of Object.entries(files))
      fs.outputFileSync(path.join(directory, file), contents);
  };
  try {
    fs.outputFileSync(path.join(directory, 'project.gdl'), 'project {}');
    write('FirstAction');
    const first = getSettingsInstructionCatalog(uri);
    expect(first.actions.map(entry => entry.type)).toEqual(['FirstAction']);
    expect(getSettingsInstructionCatalog(uri)).toBe(first);
    write('SecondAction');
    expect(
      getSettingsInstructionCatalog(uri).actions.map(entry => entry.type)
    ).toEqual(['SecondAction']);
    fs.removeSync(path.join(directory, '.gdevelop/conditions-catalog.json'));
    expect(getSettingsInstructionCatalog(uri)).toBeNull();
  } finally {
    fs.removeSync(directory);
  }
});
