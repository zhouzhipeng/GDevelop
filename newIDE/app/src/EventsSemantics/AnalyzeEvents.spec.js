// @noflow
import { analyzeGdlEvents, createSourceSnapshot } from './AnalyzeEvents';
import {
  buildProjectContexts,
  createCatalogSourceFingerprint,
} from './ProjectContext';
import { analyzeProjectGdl } from './ProjectAnalysis';
import {
  buildProjectInstructionCatalog,
  validateProjectInstructionCatalog,
} from '../ProjectsStorage/SettingsDsl/InstructionCatalog';
import { getInstructionSemantics } from './InstructionSemanticsRegistry';

const wrap = body =>
  `function {\n name = "sceneUpdate"\n functionType = "Action"\n events {\n${body}\n }\n}\n`;
const symbols = {
  Player: { id: 'scene:Player' },
  Coin: { id: 'scene:Coin' },
  Enemy: { id: 'scene:Enemy' },
};
const owner = {
  kind: 'scene',
  identity: 'Main',
  functionName: 'sceneUpdate',
  variables: { Score: 'scene' },
};
const collision = 'CollisionNP { first_object="Player" second_object="Coin" }';
const score =
  'SetNumberVariable { variable="Score" modification_sign="+" value=1 }';
let project, catalog;
beforeAll(() => {
  project = global.gd.ProjectHelper.createNewGDJSProject();
  const scene = project.insertNewLayout('Main', 0);
  ['Player', 'Coin', 'Enemy'].forEach(name =>
    scene
      .getObjects()
      .insertNewObject(
        project,
        'Sprite',
        name,
        scene.getObjects().getObjectsCount()
      )
  );
  catalog = buildProjectInstructionCatalog(project);
});
afterAll(() => project.delete());
const analyze = (body, options = {}) =>
  analyzeGdlEvents({
    source: wrap(body),
    file: 'game://scenes/Main/functions/sceneUpdate.gdl',
    catalog,
    symbols,
    owner,
    ...options,
  });
const codes = result => result.diagnostics.map(item => item.code);

test('exact reviewed signatures and validated semantics', () => {
  expect(catalog.formatVersion).toBe(7);
  expect(
    catalog.conditions
      .find(entry => entry.type === 'CollisionNP')
      .semantics.selection.map(effect => effect.parameter)
  ).toEqual(['first_object', 'second_object']);
  expect(
    catalog.actions.find(entry => entry.type === 'Delete').semantics.invocation
      .unit
  ).toBe('each-selected-instance');
  expect(
    getInstructionSemantics('action', {
      type: 'MyDelete',
      parameters: [{ dslName: 'object', valueKind: 'object' }],
    }).status
  ).toBe('unknown');
  const broken = JSON.parse(JSON.stringify(catalog));
  delete broken.actions[0].semantics;
  expect(() => validateProjectInstructionCatalog(broken)).not.toThrow();
  const invalid = JSON.parse(JSON.stringify(catalog));
  invalid.conditions.find(
    entry => entry.type === 'CollisionNP'
  ).semantics.selection[0].parameter = 'missing';
  expect(() => validateProjectInstructionCatalog(invalid)).toThrow(
    'selection parameter'
  );
});
test('multi-coin deletion differs from one write per event body, without frame claims', () => {
  const result = analyze(
    `event {\n conditions {\n ${collision}\n }\n actions {\n Delete { object="Coin" }\n ${score}\n }\n}`
  );
  expect(result.status).toBe('complete');
  expect(codes(result)).toContain('GDL_MULTI_SELECTION_SINGLE_EFFECT');
  expect(result.runtimeVerified).toBe(false);
  expect(result.events[0].actions.map(step => step.invocation.unit)).toEqual([
    'each-selected-instance',
    'event-body',
  ]);
  expect(result.events[0].execution.dimensions[0]).toEqual(
    expect.objectContaining({
      unit: 'function-call',
      count: 'runtime-dependent',
    })
  );
});
test('post-filter ForEach narrows Coin only and avoids false single-effect advice', () => {
  const result = analyze(
    `event {\n conditions {\n ${collision}\n }\n for_each {\n object = "Coin"\n actions {\n Delete { object="Coin" }\n ${score}\n }\n }\n}`
  );
  expect(result.success).toBe(true);
  expect(codes(result)).not.toContain('GDL_MULTI_SELECTION_SINGLE_EFFECT');
  expect(
    result.events[1].actions[0].targets[0].selections[0].cardinality
  ).toEqual({ min: 1, max: 1 });
  expect(
    result.events[1].childrenEntry['scene:Player'].cardinality.max
  ).toBeNull();
});
test('ForEach does not make another action target a singleton', () => {
  expect(
    codes(
      analyze(
        'for_each {\n object = "Coin"\n actions {\n Delete { object="Player" }\n }\n}'
      )
    )
  ).toContain('GDL_FOREACH_OTHER_OBJECTS_MULTIPLE');
});
test('PickAll invalidates singleton facts before later actions and child entry', () => {
  const parameter = catalog.actions
    .find(entry => entry.type === 'PickAllInstances')
    .parameters.find(p => p.valueKind === 'object').dslName;
  const result = analyze(
    `for_each {\n object = "Coin"\n actions {\n PickAllInstances { ${parameter}="Coin" }\n Delete { object="Coin" }\n ${score}\n }\n event {}\n}`
  );
  expect(result.status).toBe('complete');
  expect(codes(result)).toEqual(
    expect.arrayContaining([
      'GDL_SELECTION_REPLACED',
      'GDL_MULTI_SELECTION_SINGLE_EFFECT',
    ])
  );
  expect(result.events[1].entry.selection['scene:Coin'].origin).toBe(
    'repicked'
  );
});
test('siblings do not inherit temporary filtering', () => {
  const result = analyze(
    `event {\n conditions {\n ${collision}\n }\n}\nevent {\n actions {\n Delete { object="Coin" }\n }\n}`
  );
  expect(result.events[1].actions[0].targets[0].selections[0].origin).toBe(
    'container'
  );
});
test('unknown inversion taints objects first referenced afterward', () => {
  const result = analyze(
    `event {\n conditions {\n ${collision.slice(
      0,
      -1
    )}\n flags {\ninverted = true\n}\n }\n }\n actions {\n Delete { object="Enemy" }\n }\n}`
  );
  expect(result.status).toBe('partial');
  expect(result.events[0].actions[0].targets[0].selections[0].precision).toBe(
    'unknown'
  );
  expect(result.unknownReasons.map(item => item.reason)).toContain(
    'inverted-selection-rule-unknown'
  );
});
test('logical merge remains partial and does not produce a confident cardinality hint', () => {
  const or = catalog.conditions.find(entry =>
    /^(BuiltinCommonInstructions::)?Or$/.test(entry.type)
  ).type;
  const result = analyze(
    `event {\n conditions {\n ${or} {\n ${collision}\n }\n }\n actions {\n Delete { object="Coin" }\n ${score}\n }\n}`
  );
  expect(result.status).toBe('partial');
  expect(codes(result)).not.toContain('GDL_MULTI_SELECTION_SINGLE_EFFECT');
});
test('disabled events and instructions do not execute or taint a sibling', () => {
  const result = analyze(
    'event {\n disabled = true\n javascript {\n code {\nthrow new Error("must not execute");\n }\n }\n}\nevent {\n actions {\n Delete { object="Coin"\n\n flags {\ndisabled = true\n}\n }\n }\n}'
  );
  expect(result.status).toBe('complete');
  expect(result.events).toHaveLength(3);
  expect(result.events[1].disabledByAncestor).toBe(true);
  expect(result.events[2].actions[0].skipped).toBe(true);
});
test('JS distinguishes passed selection from all container instances and remains unknown', () => {
  const result = analyze(
    'javascript {\n objects = "Coin"\n code {\nconst all = runtimeScene.getObjects("Coin");\n }\n}'
  );
  expect(result.status).toBe('partial');
  expect(result.events[0].javascript).toEqual(
    expect.objectContaining({
      passedObjects: 'Coin',
      passedObjectsSource: 'current-selection',
      containerGetObjectsSource: 'all-named-instances-live-list',
    })
  );
});
test('SignalReceived dispatch dimension matches native sceneUpdate special case', () => {
  // Some prebuilt native libraries predate the signal generator in this tree.
  // This tests matching the current source contract, not native signal execution.
  const entry = catalog.conditions.find(
    entry => entry.type === 'SignalReceived'
  ) || {
    type: 'SignalReceived',
    dslName: 'SignalReceived',
    parameters: [{ dslName: 'signal_name', valueKind: 'text' }],
  };
  const signalCatalog = {
    ...catalog,
    conditions: [
      ...catalog.conditions.filter(item => item.type !== entry.type),
      { ...entry, semantics: getInstructionSemantics('condition', entry) },
    ],
  };
  const args = entry.parameters
    .filter(p => !p.isCodeOnly)
    .map(p => `${p.dslName}="Attack"`)
    .join(' ');
  const body = `event {\n conditions {\n SignalReceived { ${args} }\n }\n actions {\n ${score}\n }\n}`;
  expect(
    analyze(body, {
      catalog: signalCatalog,
    }).events[0].execution.dimensions.some(d => d.unit === 'delivered-signal')
  ).toBe(true);
  expect(
    analyze(body, {
      catalog: signalCatalog,
      owner: { ...owner, functionName: 'sceneLoad' },
    }).events[0].execution.dimensions.some(d => d.unit === 'delivered-signal')
  ).toBe(false);
});
test('strict author Else adjacency stays authoritative', () => {
  const result = analyze(
    `event {\n conditions {\n ${collision}\n }\n}\ncomment {\n text = "breaks adjacency"\n}\nelse {\n}`
  );
  expect(result.status).toBe('blocked');
  expect(codes(result)).toContain('SETTINGS_ELSE_TARGET');
});
test('maps full multiline operands and distinguishes both While condition lists', () => {
  const source = wrap(
    'while {\n while_conditions {\n NumberVariable { variable="Score" comparison_sign=">" value=0 }\n }\n conditions {\n NumberVariable { variable="Score" comparison_sign="<" value=10 }\n }\n actions {\n SetNumberVariable { variable="Score" modification_sign="+" value={{\n1 + 2\n}} }\n }\n}'
  );
  const result = analyze('', { source, detail: 'steps' });
  expect(result.success).toBe(true);
  expect(
    result.sourceMap
      .filter(e => e.instructionPath && !e.parameter && !e.property)
      .map(e => e.list)
  ).toEqual(['while_conditions', 'conditions', 'actions']);
  const action = result.sourceMap.find(
    e =>
      e.list === 'actions' && e.instructionPath && !e.parameter && !e.property
  );
  expect(source.slice(action.source.offset, action.source.endOffset)).toContain(
    '1 + 2\n}}'
  );
});
test('snapshot identity, stale paths and budgets are explicit', () => {
  const source = wrap('event {}');
  const snapshot = createSourceSnapshot({ file: source }, catalog, 'buffer');
  expect(
    createSourceSnapshot({ file: `${source}//changed\n` }, catalog, 'buffer')
  ).not.toBe(snapshot);
  expect(analyze('event {}', { expectedSnapshot: 'old' }).status).toBe('stale');
  expect(analyze('event {}', { eventPath: [9] }).status).toBe('blocked');
  expect(analyze('event {}\nevent {}', { maxEvents: 1 }).truncated).toBe(true);
  expect(
    analyze('event {}\nevent {}', { maxNodes: 1 }).unknownReasons.map(
      item => item.reason
    )
  ).toContain('event-budget-exceeded');
});
test('project declaration fingerprints ignore event edits and detect changed owners', () => {
  const file = 'game://scenes/Main/functions/sceneUpdate.gdl';
  const files = {
    'game://project.gdl': 'project {\n name = "Test"\n}\n',
    'game://scenes/Main/scene.gdl':
      'scene {\n name = "Main"\n variable {\n name = "Score"\n value = 0\n }\n}\n',
    'game://scenes/Main/objects/Coin.gdl':
      'object {\n name = "Coin"\n type = "Sprite"\n}\n',
    [file]: wrap('event {}'),
  };
  const context = buildProjectContexts(files)(file);
  expect(context.symbols.Coin.id).toBe('game://scenes/Main/objects/Coin.gdl');
  expect(context.owner.variables.Score).toBe('scene');
  const fingerprint = createCatalogSourceFingerprint(files);
  const updated = {
    ...files,
    [file]: wrap(`event {\n actions {\n ${score}\n }\n}`),
  };
  expect(createCatalogSourceFingerprint(updated)).toBe(fingerprint);
  const diskCatalog = { ...catalog, sourceFingerprint: fingerprint };
  expect(
    analyzeProjectGdl({ files: updated, catalog: diskCatalog, file }).status
  ).toBe('complete');
  expect(
    analyzeProjectGdl({
      files: {
        ...updated,
        'game://scenes/Main/scene.gdl': 'scene {\n name = "Different"\n}\n',
      },
      catalog: diskCatalog,
      file,
    }).status
  ).toBe('catalog-stale');
});

test('subtree reads include parent action selection and map UTF-16 operands exactly', () => {
  const body = `group {\n name = "战斗😀"\n comment {\n text = "index zero"\n }\n event {\n conditions {\n ${collision}\n }\n event {\n actions {\n Delete { object="Coin" }\n }\n }\n }\n}`;
  const result = analyze(body, { eventPath: [0, 1, 0], detail: 'steps' });
  expect(result.events).toHaveLength(1);
  expect(result.events[0].actions[0].targets[0].selections[0].origin).toBe(
    'filtered'
  );
  const operand = result.sourceMap.find(entry => entry.parameter === 'object');
  expect(
    wrap(body).slice(operand.source.offset, operand.source.endOffset)
  ).toBe('"Coin"');
});

test('rule suppression never turns unknown effects into completed coverage', () => {
  const result = analyze(
    'javascript {\n code {\nconsole.log("unknown");\n }\n}',
    { disabledRules: ['GDL_SEMANTICS_UNKNOWN'] }
  );
  expect(result.status).toBe('partial');
  expect(result.runtimeVerified).toBe(false);
});

test('large documents retain bounded summaries while analyzing the full owning context', () => {
  const body = Array.from({ length: 3000 }, () => 'event {}').join('\n');
  const started = Date.now();
  const result = analyze(body);
  expect(result.coverage.analyzedEvents).toBe(3000);
  expect(result.events.length).toBeLessThanOrEqual(40);
  expect(result.truncated).toBe(true);
  expect(result.analysisTruncated).toBe(false);
  expect(JSON.stringify(result).length).toBeLessThanOrEqual(128 * 1024);
  // Record actual measurements when explicitly requested, without flaky speed assertions.
  if (process.env.GDEVELOP_SEMANTICS_BENCHMARK)
    console.info(
      JSON.stringify({
        events: 3000,
        durationMs: Date.now() - started,
        outputCharacters: JSON.stringify(result).length,
      })
    );
});

test('child events inherit parent local-variable scope without inventing scene bindings', () => {
  const result = analyze(
    `event {\n variable {\n name = "Score"\n value = 0\n }\n event {\n actions {\n ${score}\n }\n }\n}`,
    { owner: { ...owner, variables: {} } }
  );
  expect(result.status).toBe('complete');
  expect(result.events[1].actions[0].variableTarget.scope).toBe('event-local');
});

test('step maps retain recursive local variables and exact raw JS content slices', () => {
  const source = wrap(
    'event {\n variable {\n name = "Data"\n type = "structure"\n variable {\n name = "Label"\n value = "中文😀"\n }\n }\n javascript {\n code {\nconst label = `原始😀`;\n }\n }\n}'
  );
  const result = analyze('', { source, detail: 'steps' });
  expect(result.success).toBe(true);
  const variable = result.sourceMap.find(
    entry => entry.kind === 'variable' && entry.property === 'value'
  );
  expect(source.slice(variable.source.offset, variable.source.endOffset)).toBe(
    '"中文😀"'
  );
  const code = result.sourceMap.find(entry => entry.kind === 'code-content');
  expect(source.slice(code.source.offset, code.source.endOffset)).toBe(
    'const label = `原始😀`;\n'
  );
});

test('short instruction names retain reviewed picking semantics and native diagnostic identity', () => {
  const result = analyze(
    'event {\n conditions {\n collision { first_object="Player" second_object="Coin" }\n }\n actions {\n deleteObject { object="Coin" }\n setNumberVariable { variable="Score" modification_sign="+" value=1 }\n }\n}'
  );
  expect(result.success).toBe(true);
  expect(codes(result)).toContain('GDL_MULTI_SELECTION_SINGLE_EFFECT');
  expect(result.events[0].actions[0]).toMatchObject({
    instructionType: 'Delete',
    dslName: 'deleteObject',
  });
  expect(result.events[0].conditions[0]).toMatchObject({
    instructionType: 'CollisionNP',
    dslName: 'collision',
  });
});
