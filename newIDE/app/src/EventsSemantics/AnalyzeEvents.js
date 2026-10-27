// @noflow
import { sha256 } from 'js-sha256';
import { compileSettingsEventsWithSyntax } from '../ProjectsStorage/SettingsDsl/Events';
import {
  createCatalogInstructionResolver,
  validateProjectInstructionCatalog,
} from '../ProjectsStorage/SettingsDsl/InstructionCatalog';
import {
  SEMANTICS_VERSION,
  SEMANTICS_RULES_REVISION,
} from './InstructionSemanticsRegistry';
import {
  buildEventSourceMap,
  eventChildren,
  nodeValue,
  sourceLocation,
} from './SourceMap';

export const createSourceSnapshot = (files, catalog, sourceKind = 'disk') => {
  const hash = sha256.create();
  hash.update(
    JSON.stringify([sourceKind, SEMANTICS_VERSION, SEMANTICS_RULES_REVISION])
  );
  Object.keys(files)
    .sort()
    .forEach(file => hash.update(JSON.stringify([file, files[file]])));
  hash.update(JSON.stringify(catalog));
  return `sha256:${hash.hex()}`;
};
const clone = value => JSON.parse(JSON.stringify(value));
const pathMatches = (path, prefix) =>
  prefix.every((value, index) => path[index] === value);
const bounded = (value, fallback, max) =>
  Number.isInteger(value) && value > 0 ? Math.min(value, max) : fallback;
const range = (min = 0, max = null) => ({ min, max });
const fact = (symbol, origin = 'container') => ({
  objectSymbol: symbol,
  origin,
  materialization: 'not-materialized',
  cardinality: range(),
  membership: 'symbolic',
  precision: 'conservative',
  basis: 'derived',
  lineage: [],
  reasons: [],
});

export const analyzeGdlEvents = ({
  source,
  file = '<buffer>',
  catalog,
  owner = {},
  symbols = {},
  sourceKind = 'buffer',
  snapshot,
  expectedSnapshot,
  eventPath = [],
  detail = 'summary',
  maxEvents = 40,
  maxNodes = 10000,
  maxInstructions = 50000,
  disabledRules = [],
}) => {
  const identity =
    snapshot || createSourceSnapshot({ [file]: source }, catalog, sourceKind);
  const result = {
    success: true,
    status: 'complete',
    snapshot: identity,
    sourceKind,
    semanticsVersion: SEMANTICS_VERSION,
    semanticsRulesRevision: SEMANTICS_RULES_REVISION,
    runtimeVerified: false,
    owner: {
      identity: owner.identity,
      kind: owner.kind,
      functionName: owner.functionName,
      sceneName: owner.sceneName,
    },
    coverage: {
      analyzedEvents: 0,
      knownInstructions: 0,
      partialInstructions: 0,
      unknownInstructions: 0,
    },
    events: [],
    diagnostics: [],
    unknownReasons: [],
    truncated: false,
    continuation: null,
  };
  if (expectedSnapshot && expectedSnapshot !== identity)
    return {
      ...result,
      success: false,
      status: 'stale',
      unknownReasons: [{ reason: 'source-snapshot-changed' }],
    };
  if (
    !Array.isArray(eventPath) ||
    eventPath.some(index => !Number.isInteger(index) || index < 0)
  )
    return {
      ...result,
      success: false,
      status: 'blocked',
      diagnostics: [
        {
          code: 'GDL_EVENT_PATH_INVALID',
          severity: 'error',
          message: 'event_path must contain non-negative integer indexes.',
        },
      ],
    };
  let compiled;
  try {
    validateProjectInstructionCatalog(catalog);
    compiled = compileSettingsEventsWithSyntax(
      source,
      { resolveInstruction: createCatalogInstructionResolver(catalog) },
      file
    );
  } catch (error) {
    return {
      ...result,
      success: false,
      status: 'blocked',
      diagnostics: [
        {
          code: error.code || 'GDL_ANALYSIS_INPUT',
          severity: 'error',
          message: error.message,
          source: {
            file,
            line: error.line || 1,
            column: error.column || 1,
            endLine: error.endLine || error.line || 1,
            endColumn: error.endColumn || (error.column || 1) + 1,
          },
        },
      ],
    };
  }
  const { root } = compiled.syntax;
  const maps = detail === 'steps' ? buildEventSourceMap(root, file) : [];
  const lookups = {
    conditions: new Map(
      catalog.conditions.flatMap(entry => [
        [entry.type, entry],
        [entry.dslName, entry],
      ])
    ),
    while_conditions: new Map(
      catalog.conditions.flatMap(entry => [
        [entry.type, entry],
        [entry.dslName, entry],
      ])
    ),
    actions: new Map(
      catalog.actions.flatMap(entry => [
        [entry.type, entry],
        [entry.dslName, entry],
      ])
    ),
  };
  const taintedStates = new WeakSet();
  const symbolOrigins = new Map(
    Object.values(symbols)
      .filter(symbol => symbol && symbol.id)
      .map(symbol => [symbol.id, symbol.origin || 'container'])
  );
  const allEvents = [];
  const outputEventLimit = bounded(maxEvents, 40, 200);
  let requestedCount = 0;
  let foundPath = eventPath.length === 0;
  let omittedSteps = false;
  let diagnosticsOmitted = false;
  const allDiagnostics = [];
  const unknowns = new Map();
  const suppressed = new Set(disabledRules);
  const nodeLimit = bounded(maxNodes, 10000, 10000);
  const instructionLimit = bounded(maxInstructions, 50000, 50000);
  const instructionBudget = { visited: 0 };
  let visitedEvents = 0;
  const unknown = (reason, node, path) => {
    if (!unknowns.has(reason) && unknowns.size >= 100)
      reason = 'additional-unknown-reasons';
    if (!unknowns.has(reason))
      unknowns.set(reason, {
        reason,
        count: 0,
        source: sourceLocation(node, file),
        eventPath: path,
      });
    unknowns.get(reason).count++;
    result.status = 'partial';
  };
  const diagnostic = (code, message, node, path, related = []) => {
    if (suppressed.has(code)) return;
    if (allDiagnostics.length >= 200) {
      diagnosticsOmitted = true;
      return;
    }
    allDiagnostics.push({
      code,
      severity: 'info',
      message,
      source: sourceLocation(node, file),
      eventPath: path,
      precision: 'conservative',
      ruleId: code,
      relatedLocations: related,
      preconditions: [
        'registered-instruction-rule',
        'current-selection-context',
      ],
    });
  };
  const resolve = (name, state, node, path) => {
    const symbol = Object.prototype.hasOwnProperty.call(symbols, name)
      ? symbols[name]
      : null;
    if (!symbol) {
      unknown(`unresolved-object:${name}`, node, path);
      return [
        { id: `${owner.identity || file}:unresolved:${name}`, resolved: false },
      ];
    }
    if (symbol.members) {
      if (symbol.members.length > 64) {
        unknown('group-member-budget-exceeded', node, path);
        return [{ id: symbol.id || `${file}:group:${name}`, resolved: false }];
      }
      return symbol.members.map(member => ({ id: member, resolved: true }));
    }
    return [{ id: symbol.id, resolved: true }];
  };
  const touch = (id, state) => {
    if (!Object.prototype.hasOwnProperty.call(state, id)) {
      if (Object.keys(state).length >= 64) {
        unknown('selection-symbol-budget-exceeded', root, []);
        return {
          ...fact(id, 'unknown'),
          precision: 'unknown',
          membership: 'unknown',
        };
      }
      state[id] = fact(
        id,
        root.type === 'external_events'
          ? 'unknown'
          : symbolOrigins.get(id) || 'container'
      );
      if (taintedStates.has(state)) {
        state[id].origin = 'unknown';
        state[id].precision = 'unknown';
        state[id].membership = 'unknown';
      }
    }
    state[id].materialization = 'available';
    return state[id];
  };
  const invalidate = (state, reason) => {
    taintedStates.add(state);
    Object.values(state).forEach(value => {
      value.origin = 'unknown';
      value.precision = 'unknown';
      value.cardinality = range();
      value.membership = 'unknown';
      value.reasons = [...new Set([...value.reasons, reason])];
    });
  };
  const listInstructions = (node, listKind) => {
    const list = node.children.find(child => child.type === listKind);
    return list ? list.children : [];
  };
  // Native side effects may escape an event even though its temporary selection does not.
  const runList = (
    nodes,
    base,
    execution,
    ancestors,
    parentPath = [],
    world = { unknown: false, changed: new Set() },
    inheritedLocals = new Set(),
    inactive = false
  ) => {
    for (let index = 0; index < nodes.length; index++) {
      const node = nodes[index];
      const path = [...parentPath, index];
      if (++visitedEvents > nodeLimit) {
        unknown('event-budget-exceeded', node, path);
        break;
      }
      const state = clone(base);
      if (world.unknown) invalidate(state, 'preceding-world-effects-unknown');
      world.changed.forEach(id => {
        if (state[id])
          invalidate({ [id]: state[id] }, 'preceding-create-or-delete');
      });
      const type =
        node.type === 'event' ? nodeValue(node, 'type', 'standard') : node.type;
      const disabled = inactive || nodeValue(node, 'disabled', false);
      const requested = pathMatches(path, eventPath);
      if (path.length === eventPath.length && requested) foundPath = true;
      if (requested) requestedCount++;
      const capture = requested && allEvents.length < outputEventLimit;
      const entryExecution = [...execution];
      const summary = {
        eventPath: path,
        type,
        source: sourceLocation(node, file),
        disabled,
        disabledByAncestor: inactive,
        aiGeneratedEventId: nodeValue(node, 'aiGeneratedEventId', null),
        entry: { parentChain: ancestors, selection: clone(state) },
        execution: {
          dimensions: entryExecution,
          gate: disabled ? 'disabled' : 'conditions-dependent',
          localInitialization: 'native-event-rule',
        },
        conditions: [],
        actions: [],
        childrenEntry: {},
        unknowns: [],
        explanation: [],
      };
      if (capture) allEvents.push(summary);
      const startReasons = new Map(
        Array.from(unknowns, ([reason, value]) => [reason, value.count])
      );
      if (disabled || type === 'comment') {
        summary.execution.gate = disabled ? 'disabled' : 'non-executable';
        summary.childrenEntry = clone(state);
        if (disabled)
          runList(
            eventChildren(node),
            state,
            entryExecution,
            [...ancestors, { eventPath: path, type }],
            path,
            { unknown: false, changed: new Set() },
            inheritedLocals,
            true
          );
        continue;
      }
      const childExecution = [...entryExecution];
      if (type === 'for_each') {
        const object = nodeValue(node, 'object', '');
        const refs = resolve(object, state, node, path);
        refs.forEach(({ id, resolved }) => {
          const value = touch(id, state);
          value.origin = resolved ? 'iteration' : 'unknown';
          value.cardinality = resolved
            ? range(refs.length === 1 ? 1 : 0, 1)
            : range();
          value.precision = resolved
            ? refs.length === 1
              ? 'exact'
              : 'conservative'
            : 'unknown';
          value.lineage.push(`for_each:${path.join('.')}`);
        });
        childExecution.push({
          unit: 'selected-instance',
          object,
          symbols: refs.map(ref => ref.id),
          groupTotalPerIteration: 1,
          count: 'runtime-dependent',
          orderBy: nodeValue(node, 'order_by', null),
          limit: nodeValue(node, 'limit', null),
        });
        summary.execution.localInitialization = 'before-loop';
        summary.explanation.push(
          `Iterate selected ${object} instances; only the iteration target is a singleton.`
        );
      } else if (['repeat', 'while', 'for_each_child'].includes(type)) {
        childExecution.push({
          unit: type,
          count: 'runtime-dependent',
          expression: nodeValue(
            node,
            type === 'repeat' ? 'count' : 'iterable',
            null
          ),
        });
        // A single symbolic iteration cannot establish a loop invariant.
        invalidate(state, 'loop-carried-effects');
        unknown('loop-fixed-point-not-analyzed', node, path);
        summary.execution.localInitialization = 'before-loop';
      } else if (type === 'else') {
        summary.execution.gate =
          'preceding-chain-not-satisfied-and-own-conditions';
        summary.explanation.push(
          'Else is event-level branching; it is not the complement of previously picked instances.'
        );
      } else if (type === 'link' || type === 'javascript') {
        unknown(
          type === 'link'
            ? 'caller-dependent-link-not-expanded'
            : 'javascript-effects-unknown',
          node,
          path
        );
        if (type === 'javascript') {
          const object = nodeValue(node, 'objects', '');
          summary.javascript = {
            passedObjects: object || null,
            passedObjectsSource: object ? 'current-selection' : 'none',
            containerGetObjectsSource: 'all-named-instances-live-list',
          };
          if (object)
            resolve(object, state, node, path).forEach(({ id }) =>
              touch(id, state)
            );
          summary.explanation.push(
            'JS objects uses current selection; container.getObjects accesses all named instances. Arbitrary JS effects are unknown.'
          );
        }
        invalidate(state, `${type}-effects-unknown`);
        world.unknown = true;
      }
      const locals = new Set([
        ...inheritedLocals,
        ...node.children
          .filter(child => child.type === 'variable')
          .map(child => nodeValue(child, 'name', '')),
      ]);
      const process = (instruction, listKind, instructionPath = []) => {
        if (++instructionBudget.visited > instructionLimit) {
          unknown('instruction-budget-exceeded', instruction, path);
          invalidate(state, 'instruction-budget-exceeded');
          world.unknown = true;
          return null;
        }
        const metadata = lookups[listKind].get(instruction.type);
        const semantics = metadata.semantics;
        const step = {
          instructionType: metadata.type,
          dslName: metadata.dslName,
          instructionPath,
          list: listKind,
          source: sourceLocation(instruction, file),
          ruleId: semantics.ruleId || null,
          ruleVersion: semantics.ruleVersion || null,
          evidenceIds: semantics.evidenceIds || [],
          basis: semantics.ruleId ? 'registered-rule' : 'unknown',
          precision: semantics.status === 'known' ? 'conservative' : 'unknown',
          invocation: clone(semantics.invocation || { unit: 'unknown' }),
          targets: [],
          ...(detail === 'steps' && capture
            ? { selectionBefore: clone(state), selectionAfter: {} }
            : {}),
          effects: clone(semantics.worldEffects || []),
          unknowns: [],
        };
        const action = listKind === 'actions';
        if (nodeValue(instruction, 'disabled', false)) {
          step.skipped = true;
          if (detail === 'steps' && capture) step.selectionAfter = clone(state);
          return step;
        }
        const unsupportedInversion =
          nodeValue(instruction, 'inverted', false) &&
          semantics.inversion !== 'boolean-negation';
        const async = nodeValue(instruction, 'awaited', false);
        const expressionEffects = Object.values(instruction.arguments).some(
          argument => argument.expression
        );
        const isUnknown =
          semantics.status !== 'known' ||
          unsupportedInversion ||
          async ||
          expressionEffects;
        result.coverage[
          isUnknown
            ? semantics.status === 'partial'
              ? 'partialInstructions'
              : 'unknownInstructions'
            : 'knownInstructions'
        ]++;
        if (isUnknown) {
          const reason = expressionEffects
            ? 'expression-effects-not-analyzed'
            : async
            ? 'async-continuation'
            : unsupportedInversion
            ? 'inverted-selection-rule-unknown'
            : semantics.reason || 'unregistered-instruction';
          step.unknowns.push(reason);
          step.precision = 'unknown';
          unknown(reason, instruction, path);
          invalidate(state, reason);
          // Registered partial logical/create rules have known footprints only after specialization.
          world.unknown = true;
          if (!action) step.truth = 'unknown';
        }
        const argument = name =>
          instruction.arguments[name] && instruction.arguments[name].value;
        for (const parameter of metadata.parameters.filter(
          p => p.valueKind === 'object' && !p.isCodeOnly
        )) {
          const name = argument(parameter.dslName);
          if (typeof name !== 'string') continue;
          const refs = resolve(name, state, instruction, path);
          if (refs.some(ref => !ref.resolved)) {
            step.precision = 'unknown';
            step.unknowns.push('object-binding-unknown');
          }
          const effect = (semantics.selection || []).find(
            effect => effect.parameter === parameter.dslName
          );
          const target = {
            parameter: parameter.dslName,
            object: name,
            symbols: refs.map(ref => ref.id),
            selections: [],
          };
          refs.forEach(({ id, resolved }) => {
            const current = touch(id, state);
            if (!resolved) {
              current.precision = 'unknown';
              current.origin = 'unknown';
              current.membership = 'unknown';
            }
            if (!isUnknown && effect) {
              if (effect.effect === 'filter') {
                current.origin = 'filtered';
                current.cardinality.min = 0;
                current.lineage = [
                  ...current.lineage.slice(-15),
                  `${listKind}:${instruction.type}:${path.join(
                    '.'
                  )}:${instructionPath.join('.')}`,
                ];
              } else if (effect.effect === 'replace-from-container') {
                current.origin = 'repicked';
                current.cardinality = range();
                current.membership = 'symbolic';
                current.precision = 'conservative';
                diagnostic(
                  'GDL_SELECTION_REPLACED',
                  `This instruction replaces the ${name} selection with all available instances. Earlier filtering or singleton facts no longer apply.`,
                  instruction,
                  path
                );
              } else if (effect.effect === 'choose-one') {
                current.origin = 'repicked';
                current.cardinality = range(0, 1);
                current.precision = 'conservative';
              }
            }
            target.selections.push(clone(current));
          });
          step.targets.push(target);
        }
        if (!action) step.truth = 'runtime-dependent';
        const write = action && semantics.ruleId === 'gdjs.variable.write';
        if (write) {
          const parameter = metadata.parameters.find(
            p => p.valueKind === 'variable'
          );
          const variable = parameter && argument(parameter.dslName);
          // Dotted/indexed references may resolve to properties or dynamic variable paths.
          const simple =
            typeof variable === 'string' &&
            /^[A-Za-z_][A-Za-z0-9_]*$/.test(variable);
          step.variableTarget = {
            name: variable || null,
            scope: simple
              ? locals.has(variable)
                ? 'event-local'
                : (owner.variables &&
                    Object.prototype.hasOwnProperty.call(
                      owner.variables,
                      variable
                    ) &&
                    owner.variables[variable]) ||
                  'unresolved'
              : 'unresolved',
          };
          if (step.variableTarget.scope === 'unresolved') {
            step.precision = 'unknown';
            step.unknowns.push('variable-target-unresolved');
            unknown('variable-target-unresolved', instruction, path);
            invalidate(state, 'variable-target-unresolved');
            world.unknown = true;
          }
        }
        if (action && semantics.ruleId === 'gdjs.object.delete') {
          step.targets.forEach(target =>
            target.symbols.forEach(id => world.changed.add(id))
          );
          step.explanation =
            'Delete acts on the selected instances; selection arrays may retain deleted references.';
        } else if (action && semantics.ruleId === 'gdjs.variable.write') {
          step.explanation =
            'This write is reached once per event-body execution, not automatically once per selected object.';
        }
        instruction.children.forEach((child, index) => {
          const nested = process(child, listKind, [...instructionPath, index]);
          if (nested) {
            if (!step.children) step.children = [];
            step.children.push(nested);
          }
        });
        if (detail === 'steps' && capture) step.selectionAfter = clone(state);
        return step;
      };
      // The generator special case is restricted to enabled, non-inverted top-level conditions.
      const signal = listInstructions(node, 'conditions').find(
        instruction =>
          lookups.conditions.get(instruction.type).type === 'SignalReceived' &&
          !nodeValue(instruction, 'disabled', false) &&
          !nodeValue(instruction, 'inverted', false)
      );
      if (
        type === 'standard' &&
        owner.kind === 'scene' &&
        owner.functionName === 'sceneUpdate' &&
        signal
      ) {
        childExecution.push({
          unit: 'delivered-signal',
          count: 'runtime-dependent',
        });
        summary.explanation.push(
          'This standard event is evaluated for each delivered scene signal, not simply once per frame.'
        );
      }
      summary.execution.dimensions = childExecution;
      const filtered = new Map();
      const deleted = new Map();
      for (const listKind of ['while_conditions', 'conditions', 'actions']) {
        const instructions = listInstructions(node, listKind);
        for (let i = 0; i < instructions.length; i++) {
          const instruction = instructions[i];
          const step = process(instruction, listKind, [i]);
          if (!step) break;
          const outputSteps =
            listKind === 'actions' ? summary.actions : summary.conditions;
          if (outputSteps.length < 100) outputSteps.push(step);
          else omittedSteps = true;
          if (step.skipped) continue;
          if (
            listKind !== 'actions' &&
            step.ruleId === 'gdjs.collision.pair-filter' &&
            !step.unknowns.length
          )
            step.targets.forEach(target =>
              filtered.set(target.object, { target, source: step.source })
            );
          if (
            listKind === 'actions' &&
            step.ruleId === 'gdjs.object.delete' &&
            !step.unknowns.length
          )
            step.targets.forEach(target =>
              deleted.set(target.object, { target, source: step.source })
            );
          if (
            listKind === 'actions' &&
            step.ruleId === 'gdjs.variable.write' &&
            step.variableTarget &&
            ['scene', 'global', 'event-local'].includes(
              step.variableTarget.scope
            )
          ) {
            deleted.forEach(({ target, source: related }) => {
              const selections = target.symbols.map(id => state[id]);
              if (
                selections.length &&
                selections.every(
                  value => value && value.precision !== 'unknown'
                ) &&
                selections.some(
                  value =>
                    value.cardinality.max === null || value.cardinality.max > 1
                )
              )
                diagnostic(
                  'GDL_MULTI_SELECTION_SINGLE_EFFECT',
                  `Deleting selected ${
                    target.object
                  } can affect multiple instances, but this variable write occurs once per event-body execution. If each instance should count, iterate ${
                    target.object
                  } after filtering.`,
                  instruction,
                  path,
                  [related]
                );
            });
          }
          if (
            listKind === 'actions' &&
            step.ruleId === 'gdjs.object.create' &&
            filtered.size
          )
            diagnostic(
              'GDL_CREATE_AFTER_SELECTION',
              'Create does not automatically repeat for every instance picked by a condition. Use ForEach only if per-instance creation is intended.',
              instruction,
              path
            );
          if (instructionBudget.visited >= instructionLimit) break;
        }
      }
      if (type === 'for_each') {
        summary.actions
          .filter(
            step =>
              !step.skipped && step.invocation.unit === 'each-selected-instance'
          )
          .forEach(step => {
            step.targets.forEach(target => {
              if (target.object === nodeValue(node, 'object', '')) return;
              if (
                target.selections.some(
                  value =>
                    value.cardinality.max === null || value.cardinality.max > 1
                )
              )
                diagnostic(
                  'GDL_FOREACH_OTHER_OBJECTS_MULTIPLE',
                  `ForEach does not make ${
                    target.object
                  } a singleton; this action can still target multiple instances.`,
                  { location: step.source },
                  path
                );
            });
          });
      }
      summary.childrenEntry = clone(state);
      const children = eventChildren(node);
      if (children.length) {
        // Parent actions have already updated `state`. Their world effects must
        // not erase the selection handed to the first child a second time.
        const childWorld = {
          unknown: taintedStates.has(state),
          changed: new Set(),
        };
        runList(
          children,
          state,
          childExecution,
          [...ancestors, { eventPath: path, type }],
          path,
          childWorld,
          locals
        );
        world.unknown = world.unknown || childWorld.unknown;
        childWorld.changed.forEach(id => world.changed.add(id));
      }
      // Loop bodies/conditions may change later iterations; never retain an unproved invariant.
      if (
        ['repeat', 'while', 'for_each_child', 'for_each'].includes(type) &&
        children.length
      )
        world.unknown = true;
      summary.unknowns = Array.from(unknowns)
        .filter(
          ([reason, value]) => value.count > (startReasons.get(reason) || 0)
        )
        .map(([reason]) => reason);
      if (summary.actions.length)
        summary.explanation.push(
          'Conditions run before actions; parent actions finish before child events. Sibling temporary selections are isolated, world side effects are not.'
        );
    }
  };
  const container = root.children.find(child => child.type === 'events');
  const dimensions = [
    {
      unit:
        root.type === 'external_events' ? 'caller-context' : 'function-call',
      count: 'runtime-dependent',
      lifecycle: owner.functionName || null,
    },
  ];
  runList(container ? eventChildren(container) : [], {}, dimensions, []);
  if (!foundPath && visitedEvents <= nodeLimit)
    return {
      ...result,
      success: false,
      status: 'blocked',
      events: [],
      diagnostics: [
        {
          code: 'GDL_EVENT_PATH_NOT_FOUND',
          severity: 'error',
          message: 'No event exists at this mixed author-list path.',
        },
      ],
    };
  result.events = allEvents;
  result.coverage.analyzedEvents = Math.min(visitedEvents, nodeLimit);
  result.coverage.visitedInstructions = Math.min(
    instructionBudget.visited,
    instructionLimit
  );
  result.analysisTruncated =
    visitedEvents > nodeLimit ||
    instructionBudget.visited > instructionLimit ||
    unknowns.has('selection-symbol-budget-exceeded');
  result.coverage.scope = 'owning-document-including-required-context';
  result.diagnostics = allDiagnostics
    .filter(item => pathMatches(item.eventPath, eventPath))
    .slice(0, 200);
  result.unknownReasons = Array.from(unknowns.values()).slice(0, 100);
  result.truncated =
    requestedCount > outputEventLimit ||
    omittedSteps ||
    diagnosticsOmitted ||
    allDiagnostics.length > 200 ||
    unknowns.size > 100 ||
    visitedEvents > nodeLimit ||
    instructionBudget.visited > instructionLimit;
  if (result.truncated) result.status = 'partial';
  if (detail === 'steps')
    result.sourceMap = maps
      .filter(entry =>
        result.events.some(
          event => event.eventPath.join('.') === entry.eventPath.join('.')
        )
      )
      .slice(0, 2000);
  else
    result.events.forEach(event => {
      [...event.conditions, ...event.actions].forEach(step => {
        delete step.selectionBefore;
        delete step.selectionAfter;
        delete step.children;
      });
    });
  // Keep even large-identifier responses bounded; omissions are always explicit.
  const outputLimit = 128 * 1024;
  while (JSON.stringify(result).length > outputLimit) {
    result.truncated = true;
    result.status = 'partial';
    if (result.sourceMap && result.sourceMap.length)
      result.sourceMap.length = Math.floor(result.sourceMap.length / 2);
    else if (result.events.length) result.events.pop();
    else if (result.diagnostics.length)
      result.diagnostics.length = Math.floor(result.diagnostics.length / 2);
    else if (result.unknownReasons.length)
      result.unknownReasons.length = Math.floor(
        result.unknownReasons.length / 2
      );
    else break;
  }
  return result;
};
