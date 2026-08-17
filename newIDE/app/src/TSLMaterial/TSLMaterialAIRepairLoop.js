// @flow

import { sha256 } from 'js-sha256';
import { isTSLModelQualifiedForAutomaticGeneration } from './TSLMaterialModelQualification';

export const TSL_AI_REPAIR_ATTEMPT_LIMIT = 3;

export class TSLAutomaticGenerationError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'TSLAutomaticGenerationError';
    this.code = code;
  }
}

export const runBoundedTSLMaterialRepairLoop = async ({
  initialSource,
  saveCandidate,
  validateSavedCandidate,
  repairCandidate,
}: {|
  initialSource: string,
  saveCandidate: (source: string) => Promise<void>,
  validateSavedCandidate: () => Promise<Object>,
  repairCandidate: (request: {|
    source: string,
    diagnostics: $ReadOnlyArray<Object>,
    attempt: number,
  |}) => Promise<string>,
|}): Promise<Object> => {
  let source = initialSource;
  const attempts = [];
  for (let attempt = 1; attempt <= TSL_AI_REPAIR_ATTEMPT_LIMIT; attempt++) {
    await saveCandidate(source);
    const validation = await validateSavedCandidate();
    const validatedSourceHash =
      validation.source_sha256 || validation.sourceHash || null;
    const sourceSha256 = sha256(source);
    if (!validatedSourceHash || validatedSourceHash !== sourceSha256) {
      throw new TSLAutomaticGenerationError(
        'TSL-AI-STALE-VALIDATION',
        'The validator receipt does not describe the complete candidate that was just saved.'
      );
    }
    attempts.push({
      attempt,
      sourceSha256,
      validationId: validation.validation_id || validation.validationId || null,
      valid: !!validation.valid,
      activationReady: !!(
        validation.activation_ready || validation.activationReady
      ),
      diagnostics: Array.isArray(validation.diagnostics)
        ? validation.diagnostics
        : [],
    });
    if (
      validation.valid &&
      (validation.activation_ready || validation.activationReady)
    ) {
      return {
        success: true,
        activationAllowed: true,
        source,
        attempts,
        validation,
        stoppedReason: 'validated',
      };
    }
    if (attempt === TSL_AI_REPAIR_ATTEMPT_LIMIT) {
      return {
        success: false,
        activationAllowed: false,
        source,
        attempts,
        validation,
        stoppedReason: 'repair-attempt-limit',
      };
    }
    const repairedSource = await repairCandidate({
      source,
      diagnostics: attempts[attempts.length - 1].diagnostics,
      attempt,
    });
    if (typeof repairedSource !== 'string' || !repairedSource.trim()) {
      throw new TSLAutomaticGenerationError(
        'TSL-AI-INVALID-CANDIDATE',
        'The repair step did not return one complete TSL source module.'
      );
    }
    source = repairedSource;
  }
  throw new TSLAutomaticGenerationError(
    'TSL-AI-INTERNAL',
    'The bounded repair loop reached an impossible state.'
  );
};

export const runQualifiedTSLMaterialAutomaticGeneration = async ({
  modelId,
  modelVersion,
  packIdentity,
  ...loopOptions
}: Object): Promise<Object> => {
  if (
    !isTSLModelQualifiedForAutomaticGeneration({
      modelId,
      modelVersion,
      packIdentity,
    })
  ) {
    throw new TSLAutomaticGenerationError(
      'TSL-AI-MODEL-UNQUALIFIED',
      'This exact model version has not passed the checked-in bilingual benchmark for the current TSL authoring pack.'
    );
  }
  return runBoundedTSLMaterialRepairLoop(loopOptions);
};
