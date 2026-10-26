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
      'function {\n events {\n event {\n code {\n ',
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
