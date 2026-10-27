// @noflow
// Repository-relative evidence is inspectable without running user code.
const common = 'GDJS/GDJS/Extensions/Builtin/CommonInstructionsExtension.cpp';
const objects = 'GDJS/GDJS/Extensions/Builtin/BaseObjectExtension.cpp';
const variables = 'GDJS/GDJS/Extensions/Builtin/VariablesExtension.cpp';
const runtime = 'GDJS/Runtime/events-tools/objecttools.ts';
const nativeTests =
  'newIDE/app/src/ProjectsStorage/SettingsDsl/NativeEvents.spec.js';
const runtimeTests = 'scripts/fixtures/unified-settings-runtime-test.js';
const analysisTests = 'newIDE/app/src/EventsSemantics/AnalyzeEvents.spec.js';
const evidence = (implementation, tests, runtimeCases = []) => ({
  implementation,
  tests,
  runtimeCases,
});
export const SEMANTICS_RULE_EVIDENCE = {
  'gdjs.collision.pair-filter.evidence': evidence(
    [objects, runtime],
    [nativeTests, runtimeTests],
    ['multi-delete-single-score', 'post-filter-for-each']
  ),
  'gdjs.object.delete.evidence': evidence(
    [objects, runtime],
    [nativeTests, runtimeTests],
    ['multi-delete-single-score', 'sibling-selection-reset']
  ),
  'gdjs.variable.write.evidence': evidence(
    [variables],
    [nativeTests, runtimeTests],
    ['multi-delete-single-score', 'post-filter-for-each']
  ),
  'gdjs.selection.all.evidence': evidence(
    [objects, runtime],
    [nativeTests, runtimeTests],
    ['repick-all-after-filter']
  ),
  'gdjs.selection.random.evidence': evidence(
    [objects, runtime],
    [nativeTests, runtimeTests],
    ['random-current-selection']
  ),
  'gdjs.object.compare-position.evidence': evidence([objects], [analysisTests]),
  'gdjs.condition.boolean-gate.evidence': evidence(
    [common, variables],
    [nativeTests, analysisTests]
  ),
  'gdjs.object.create.evidence': evidence([objects, runtime], [analysisTests]),
  'gdjs.logical.or.evidence': evidence([common], [nativeTests, analysisTests]),
  'gdjs.logical.and.evidence': evidence([common], [analysisTests]),
  'gdjs.logical.not.evidence': evidence([common], [analysisTests]),
  // Current C++ source has this dispatch rule; some test WASM builds predate it.
  'gdjs.signal.received.evidence': evidence([common], [analysisTests]),
};
