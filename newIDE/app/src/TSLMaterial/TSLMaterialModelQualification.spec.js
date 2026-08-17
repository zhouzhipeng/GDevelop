// @flow

import { sha256 } from 'js-sha256';
import {
  TSL_CHECKED_IN_MODEL_QUALIFICATION_REPORTS,
  TSL_MODEL_QUALIFICATION_BENCHMARK,
  TSL_MODEL_QUALIFICATION_BENCHMARK_SHA256,
  evaluateTSLModelQualificationReport,
  isTSLModelQualifiedForAutomaticGeneration,
} from './TSLMaterialModelQualification';
import {
  TSLAutomaticGenerationError,
  runBoundedTSLMaterialRepairLoop,
  runQualifiedTSLMaterialAutomaticGeneration,
} from './TSLMaterialAIRepairLoop';

describe('TSL model qualification and bounded repair', () => {
  it('ships a deterministic bilingual benchmark covering generation, repair, narrowing, and rejection', () => {
    expect(TSL_MODEL_QUALIFICATION_BENCHMARK_SHA256).toMatch(/^[0-9a-f]{64}$/);
    expect(
      TSL_MODEL_QUALIFICATION_BENCHMARK.tasks.some(task => task.locale === 'en')
    ).toBe(true);
    expect(
      TSL_MODEL_QUALIFICATION_BENCHMARK.tasks.some(
        task => task.locale === 'zh-CN'
      )
    ).toBe(true);
    expect(
      new Set(TSL_MODEL_QUALIFICATION_BENCHMARK.tasks.map(task => task.kind))
    ).toEqual(new Set(['generate', 'repair', 'reject', 'narrow']));
    expect(
      TSL_MODEL_QUALIFICATION_BENCHMARK.tasks.some(task =>
        task.concepts.includes('raw-shader')
      )
    ).toBe(true);
  });

  it('evaluates every published release gate and rejects incomplete reports', () => {
    const completeReport = {
      benchmarkVersion: TSL_MODEL_QUALIFICATION_BENCHMARK.benchmarkVersion,
      benchmarkSha256: TSL_MODEL_QUALIFICATION_BENCHMARK_SHA256,
      templateConformanceRate: 1,
      taskResults: TSL_MODEL_QUALIFICATION_BENCHMARK.tasks.map(task => ({
        taskId: task.id,
        firstAttemptParsePolicyTypes: true,
        firstAttemptGraphBackend: true,
        deterministicValidationPassed: true,
        attempts: 1,
        acceptedSecurityViolations: ([]: Array<string>),
        silentlyActivatedUnsupportedRequest: false,
      })),
    };
    expect(evaluateTSLModelQualificationReport(completeReport)).toMatchObject({
      complete: true,
      qualified: true,
    });
    expect(
      evaluateTSLModelQualificationReport({
        ...completeReport,
        taskResults: completeReport.taskResults.slice(1),
      })
    ).toMatchObject({ complete: false, qualified: false });
  });

  it('does not advertise any model as an automatic generator without a checked-in passing report', async () => {
    expect(TSL_CHECKED_IN_MODEL_QUALIFICATION_REPORTS).toEqual([]);
    expect(
      isTSLModelQualifiedForAutomaticGeneration({
        modelId: 'example',
        modelVersion: '1',
        packIdentity: { packVersion: '1' },
      })
    ).toBe(false);
    await expect(
      runQualifiedTSLMaterialAutomaticGeneration({
        modelId: 'example',
        modelVersion: '1',
        packIdentity: { packVersion: '1' },
      })
    ).rejects.toMatchObject({ code: 'TSL-AI-MODEL-UNQUALIFIED' });
  });

  it('revalidates each complete saved candidate and stops after three failures', async () => {
    let savedSource = '';
    const saveCandidate = jest.fn(
      async (source: string): Promise<void> => {
        savedSource = source;
      }
    );
    const validateSavedCandidate = jest.fn(async () => ({
      valid: false,
      activation_ready: false,
      source_sha256: sha256(savedSource),
      validation_id: `validation-${savedSource}`,
      diagnostics: [{ code: 'TSL-SRC-004', line: 1, column: 1 }],
    }));
    const repairCandidate = jest.fn(
      async ({
        source,
      }: {|
        source: string,
        diagnostics: $ReadOnlyArray<Object>,
        attempt: number,
      |}): Promise<string> => `${source}\n// fix`
    );
    const result = await runBoundedTSLMaterialRepairLoop({
      initialSource: 'candidate',
      saveCandidate,
      validateSavedCandidate,
      repairCandidate,
    });

    expect(result).toMatchObject({
      success: false,
      activationAllowed: false,
      stoppedReason: 'repair-attempt-limit',
    });
    expect(result.attempts).toHaveLength(3);
    expect(saveCandidate).toHaveBeenCalledTimes(3);
    expect(validateSavedCandidate).toHaveBeenCalledTimes(3);
    expect(repairCandidate).toHaveBeenCalledTimes(2);
  });

  it('rejects a stale or fabricated validator receipt', async () => {
    await expect(
      runBoundedTSLMaterialRepairLoop({
        initialSource: 'candidate',
        saveCandidate: async () => {},
        validateSavedCandidate: async () => ({
          valid: true,
          activation_ready: true,
          source_sha256: sha256('different candidate'),
          diagnostics: [],
        }),
        repairCandidate: async () => 'unused',
      })
    ).rejects.toBeInstanceOf(TSLAutomaticGenerationError);
  });
});
