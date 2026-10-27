// @noflow
import { SEMANTICS_RULE_EVIDENCE } from './RuleEvidence';
// These rules describe reviewed GDJS generators, not author-supplied prose.
export const SEMANTICS_VERSION = 1;
export const SEMANTICS_RULES_REVISION = 'gdjs-picking-1';
export const INSTRUCTION_CATALOG_VERSION = 4;

const unknown = reason => ({ status: 'unknown', reason });
const objectParameters = entry =>
  entry.parameters.filter(p => !p.isCodeOnly && p.valueKind === 'object');

export const getInstructionSemantics = (kind, entry) => {
  const type = entry.type;
  const objects = objectParameters(entry);
  const rule = (id, unit, selection = [], worldEffects = [], extra = {}) => ({
    status: 'known',
    ruleId: `gdjs.${id}`,
    ruleVersion: 1,
    invocation: { unit },
    selection,
    worldEffects,
    inversion: kind === 'condition' ? 'unknown' : 'not-applicable',
    evidenceIds: [`gdjs.${id}.evidence`],
    ...extra,
  });
  const selected = effect =>
    objects.map(p => ({ parameter: p.dslName, effect }));
  if (entry.isAsync || entry.isOptionallyAsync)
    return unknown('async-continuation');
  if (kind === 'condition') {
    if (type === 'CollisionNP' && objects.length === 2)
      return rule(
        'collision.pair-filter',
        'selection-lists',
        selected('filter'),
        [],
        {
          relations: { preservesPairs: false },
        }
      );
    if (['PosX', 'PosY'].includes(type) && objects.length === 1)
      return rule(
        'object.compare-position',
        'each-selected-instance',
        selected('filter'),
        [],
        {
          targetParameter: objects[0].dslName,
        }
      );
    if (
      [
        'NumberVariable',
        'StringVariable',
        'BooleanVariable',
        'SceneJustBegins',
      ].includes(type)
    )
      return rule('condition.boolean-gate', 'event-body', [], [], {
        inversion: 'boolean-negation',
      });
    if (type === 'SignalReceived')
      return rule('signal.received', 'event-body', [], [], {
        status: 'partial',
        reason: 'requires-scene-update-dispatch-context',
      });
    if (
      [
        'Or',
        'And',
        'Not',
        'BuiltinCommonInstructions::Or',
        'BuiltinCommonInstructions::And',
        'BuiltinCommonInstructions::Not',
      ].includes(type)
    )
      return rule(
        `logical.${type
          .split('::')
          .pop()
          .toLowerCase()}`,
        'custom',
        [],
        [],
        {
          status: 'partial',
          reason: 'logical-selection-merge-requires-specialized-analysis',
        }
      );
  }
  if (kind === 'action') {
    if (type === 'Delete' && objects.length === 1)
      return rule(
        'object.delete',
        'each-selected-instance',
        selected('preserve'),
        [{ kind: 'delete-instance', parameter: objects[0].dslName }],
        {
          targetParameter: objects[0].dslName,
          deletionLists: 'may-retain-deleted-references',
        }
      );
    if (
      ['SetNumberVariable', 'SetStringVariable', 'SetBooleanVariable'].includes(
        type
      )
    )
      return rule(
        'variable.write',
        'event-body',
        [],
        [{ kind: 'write-variable' }],
        {
          targetResolution: 'variable-or-property',
        }
      );
    if (['Create', 'CreateByName'].includes(type) && objects.length === 1)
      return rule(
        'object.create',
        'event-body',
        selected('append-created'),
        [{ kind: 'create-instance', parameter: objects[0].dslName }],
        {
          status: 'partial',
          reason: 'creation-success-and-list-materialization-dependent',
        }
      );
  }
  if (
    ['PickAllInstances', 'PickRandomInstance'].includes(type) &&
    objects.length === 1
  )
    return rule(
      type === 'PickAllInstances' ? 'selection.all' : 'selection.random',
      'selection-lists',
      selected(
        type === 'PickAllInstances' ? 'replace-from-container' : 'choose-one'
      ),
      [],
      { inversion: kind === 'condition' ? 'unknown' : 'not-applicable' }
    );
  return unknown('unregistered-instruction');
};

export const validateInstructionSemantics = (semantics, entry) => {
  if (!semantics || !['known', 'partial', 'unknown'].includes(semantics.status))
    throw new Error(`Missing or invalid semantics for ${entry.type}.`);
  if (semantics.status === 'unknown') {
    if (typeof semantics.reason !== 'string' || !semantics.reason)
      throw new Error(`Unknown semantics needs a reason: ${entry.type}.`);
    return;
  }
  if (
    typeof semantics.ruleId !== 'string' ||
    !Number.isInteger(semantics.ruleVersion) ||
    semantics.ruleVersion < 1 ||
    !semantics.invocation ||
    ![
      'event-body',
      'each-selected-instance',
      'selection-lists',
      'custom',
      'unknown',
    ].includes(semantics.invocation.unit) ||
    !Array.isArray(semantics.selection) ||
    !Array.isArray(semantics.worldEffects) ||
    !Array.isArray(semantics.evidenceIds) ||
    !semantics.evidenceIds.length ||
    !['unknown', 'boolean-negation', 'not-applicable'].includes(
      semantics.inversion
    )
  )
    throw new Error(`Invalid semantic rule for ${entry.type}.`);
  if (
    semantics.evidenceIds.some(
      id => !Object.prototype.hasOwnProperty.call(SEMANTICS_RULE_EVIDENCE, id)
    )
  )
    throw new Error(`Unknown semantics evidence for ${entry.type}.`);
  const isObject = name =>
    entry.parameters.some(
      p => p.dslName === name && p.valueKind === 'object' && !p.isCodeOnly
    );
  if (
    semantics.invocation.unit === 'each-selected-instance' &&
    !isObject(semantics.targetParameter)
  )
    throw new Error(`Invalid semantics target parameter for ${entry.type}.`);
  for (const effect of semantics.selection) {
    if (
      !effect ||
      !isObject(effect.parameter) ||
      ![
        'preserve',
        'filter',
        'replace-from-container',
        'choose-one',
        'append-created',
        'custom',
        'unknown',
      ].includes(effect.effect)
    )
      throw new Error(
        `Invalid selection parameter or effect for ${entry.type}.`
      );
  }
  for (const effect of semantics.worldEffects) {
    if (
      !effect ||
      ![
        'write-variable',
        'create-instance',
        'delete-instance',
        'external-effect',
        'unknown',
      ].includes(effect.kind) ||
      (effect.parameter !== undefined && !isObject(effect.parameter))
    )
      throw new Error(`Invalid world effect for ${entry.type}.`);
  }
  if (semantics.status === 'partial' && !semantics.reason)
    throw new Error(`Partial semantics needs a reason: ${entry.type}.`);
};
