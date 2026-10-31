// @noflow
import {
  analyzeSettingsBuffer,
  getSettingsEventSemanticsHover,
} from './SettingsEventSemantics';
import { buildProjectInstructionCatalog } from '../ProjectsStorage/SettingsDsl/InstructionCatalog';

test('hover describes the targeted action and invalidates cached buffer snapshots after edits', () => {
  const project = global.gd.ProjectHelper.createNewGDJSProject();
  try {
    const catalog = buildProjectInstructionCatalog(project);
    let source =
      'function {\n name = "Test"\n events {\n event {\n actions {\n Delete {\n object=Coin\n }\n }\n }\n }\n}\n';
    const model = {
      getValue: () => source,
      uri: { toString: () => 'game://Test.gdl' },
    };
    const analysis = analyzeSettingsBuffer(model, catalog);
    expect(analysis.sourceKind).toBe('buffer');
    expect(analysis.status).toBe('partial'); // No project object bindings are invented.
    expect(analyzeSettingsBuffer(model, catalog)).toBe(analysis);
    const hover = getSettingsEventSemanticsHover(
      analysis,
      source.indexOf('Delete')
    );
    expect(hover.contents[0].value).toContain('each-selected-instance');
    expect(hover.contents[0].value).toContain(
      'runtime behavior is not verified'
    );
    source = source.replace('Coin', 'Enemy');
    const changed = analyzeSettingsBuffer(model, catalog);
    expect(changed.snapshot).not.toBe(analysis.snapshot);
    expect(
      getSettingsEventSemanticsHover(changed, source.indexOf('Delete'))
        .contents[0].value
    ).toContain('Target Enemy');
    expect(analyzeSettingsBuffer(model, null)).toBeNull();
  } finally {
    project.delete();
  }
});
