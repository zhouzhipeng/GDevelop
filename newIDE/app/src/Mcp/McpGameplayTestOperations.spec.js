// @flow

import {
  createMcpGameplayTestOperations,
  type McpGameplayTestDescriptor,
} from './McpGameplayTestOperations';

const makeProject = (): any => ({
  getName: () => 'Test project',
  getProjectFile: () => 'C:\\Games\\Test\\project.gdevelop',
});

const descriptors: Array<McpGameplayTestDescriptor> = [
  {
    scope: 'project',
    name: 'Player can jump',
    file: 'tests/Player%20can%20jump.js',
  },
  {
    scope: 'extension',
    extension: 'Combat',
    name: 'Enemy takes damage',
    file: 'tests/Combat%20-%20Enemy%20takes%20damage.js',
  },
];

const makeResult = (testName: string, status: string = 'passed'): any => ({
  testName,
  status,
  framesExecuted: 60,
  durationMs: 20,
  loadingMs: 2,
  timeoutMs: 30000,
  gameTimeMs: 1000,
  assertions: [],
  errors: [],
  consoleLogs: [],
  eventLog: [],
  finalState: null,
  screenshots: [
    { label: 'must not be retained', frame: 1, jpegBase64: 'bytes' },
  ],
  profiles: [],
  performance: null,
});

const flushBackgroundStart = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('McpGameplayTestOperations', () => {
  it('returns queued immediately and tracks partial lifecycle/results', async () => {
    let runRequest: any = null;
    let resolveRun: (Array<any>) => void = () => {};
    const runPromise: Promise<Array<any>> = new Promise(resolve => {
      resolveRun = resolve;
    });
    const beginPreviewLaunchSequence: any = jest.fn(() => true);
    const endPreviewLaunchSequence: any = jest.fn();
    const operations = createMcpGameplayTestOperations({
      runGameplayTests: request => {
        runRequest = request;
        return runPromise;
      },
      isGameplayTestRunInProgress: () => false,
      beginPreviewLaunchSequence,
      endPreviewLaunchSequence,
      createOperationId: () => 'gameplay-tests-operation-1',
      now: () => Date.parse('2026-08-10T10:00:00.000Z'),
    });

    const started = operations.start({
      project: makeProject(),
      descriptors,
      args: { timeout_ms: 45000 },
    });
    expect(started).toEqual(
      expect.objectContaining({
        success: true,
        operation_id: 'gameplay-tests-operation-1',
        status: 'queued',
        selection: { mode: 'all', test_count: 2 },
      })
    );
    expect(runRequest).toBe(null);
    expect(beginPreviewLaunchSequence).toHaveBeenCalledTimes(1);

    await flushBackgroundStart();
    expect(runRequest.tests).toEqual([
      { scope: { type: 'project' }, testName: 'Player can jump' },
      {
        scope: { type: 'extension', extensionName: 'Combat' },
        testName: 'Enemy takes damage',
      },
    ]);
    expect(runRequest.options).toEqual(
      expect.objectContaining({
        timeoutMs: 45000,
        screenshots: 'off',
        closeFrameWhenFinished: true,
      })
    );

    runRequest.options.onRunStarted();
    expect(
      operations.get({ operation_id: 'gameplay-tests-operation-1' }).status
    ).toBe('launching');

    runRequest.options.onTestStarted(runRequest.tests[0]);
    runRequest.options.onProgress(runRequest.tests[0], 48);
    runRequest.options.onTestFinished(
      runRequest.tests[0],
      makeResult('Player can jump')
    );
    // A duplicate completion callback is ignored.
    runRequest.options.onTestFinished(
      runRequest.tests[0],
      makeResult('Player can jump')
    );
    const partial = operations.get({
      operation_id: 'gameplay-tests-operation-1',
      limit: 1,
    });
    expect(partial.status).toBe('running');
    expect(partial.progress).toEqual(
      expect.objectContaining({
        current_index: 1,
        current_file: 'tests/Player%20can%20jump.js',
        frame: 60,
      })
    );
    expect(partial.summary).toEqual(
      expect.objectContaining({ completed: 1, passed: 1, all_passed: false })
    );
    expect(partial.results[0]).toEqual(
      expect.objectContaining({
        file: 'tests/Player%20can%20jump.js',
        scope: 'project',
        name: 'Player can jump',
        status: 'passed',
        screenshots: [],
      })
    );
    expect(partial.results[0]).not.toHaveProperty('testName');

    const secondResult = makeResult('Enemy takes damage', 'failed');
    runRequest.options.onTestStarted(runRequest.tests[1]);
    runRequest.options.onTestFinished(runRequest.tests[1], secondResult);
    resolveRun([makeResult('Player can jump'), secondResult]);
    await flushBackgroundStart();

    const completed = operations.get({
      operation_id: 'gameplay-tests-operation-1',
      offset: 1,
      limit: 1,
    });
    expect(completed.status).toBe('completed');
    expect(completed.summary).toEqual(
      expect.objectContaining({
        total: 2,
        completed: 2,
        passed: 1,
        failed: 1,
        all_passed: false,
      })
    );
    expect(completed.results[0]).toEqual(
      expect.objectContaining({
        scope: 'extension',
        extension: 'Combat',
        name: 'Enemy takes damage',
      })
    );
    expect(completed.page).toEqual(
      expect.objectContaining({
        offset: 1,
        returned: 1,
        available: 2,
        has_more: false,
        next_offset: null,
      })
    );
    expect(endPreviewLaunchSequence).toHaveBeenCalledTimes(1);
  });

  it('selects one exact file and rejects unsafe paths and aliases', () => {
    const operations = createMcpGameplayTestOperations({
      runGameplayTests: () => new Promise(() => {}),
      isGameplayTestRunInProgress: () => false,
      createOperationId: () => 'gameplay-tests-file',
    });
    const selected = operations.start({
      project: makeProject(),
      descriptors,
      args: { file: 'tests/Player%20can%20jump.js' },
    });
    expect(selected.selection).toEqual({
      mode: 'file',
      file: 'tests/Player%20can%20jump.js',
      test_count: 1,
    });

    const makeFresh = () =>
      createMcpGameplayTestOperations({
        runGameplayTests: () => new Promise(() => {}),
        isGameplayTestRunInProgress: () => false,
      });
    [
      '',
      'game://tests/Player%20can%20jump.js',
      '../tests/Player%20can%20jump.js',
      'tests/nested/Player.js',
      'tests/Player can jump.js',
      'tests/%50layer.js',
      'tests/Player~notahash.js',
      'C:\\tests\\Player.js',
    ].forEach(file => {
      expect(() =>
        makeFresh().start({
          project: makeProject(),
          descriptors,
          args: { file },
        })
      ).toThrow(
        expect.objectContaining({ code: 'INVALID_GAMEPLAY_TEST_FILE' })
      );
    });
    expect(() =>
      makeFresh().start({
        project: makeProject(),
        descriptors,
        args: { file: 'tests/Unknown.js' },
      })
    ).toThrow(
      expect.objectContaining({
        code: 'GAMEPLAY_TEST_FILE_NOT_FOUND',
        details: {
          available_files: descriptors.map(descriptor => descriptor.file),
        },
      })
    );
  });

  it('uses a prefixed RFC 4122 version 4 UUID by default', () => {
    const operations = createMcpGameplayTestOperations({
      runGameplayTests: () => new Promise(() => {}),
      isGameplayTestRunInProgress: () => false,
    });

    expect(
      operations.start({ project: makeProject(), descriptors, args: {} })
        .operation_id
    ).toMatch(
      /^gameplay-tests-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it('enforces conflicts and always releases a reservation on failure', async () => {
    const endPreviewLaunchSequence: any = jest.fn();
    const operations = createMcpGameplayTestOperations({
      runGameplayTests: async request => {
        request.options.onRunStarted();
        request.options.onTestStarted(request.tests[0]);
        request.options.onTestFinished(
          request.tests[0],
          makeResult('Player can jump')
        );
        throw new Error('persistence failed with a private stack');
      },
      isGameplayTestRunInProgress: () => false,
      beginPreviewLaunchSequence: () => true,
      endPreviewLaunchSequence,
      createOperationId: () => 'gameplay-tests-failed',
    });
    operations.start({ project: makeProject(), descriptors, args: {} });
    expect(() =>
      operations.start({ project: makeProject(), descriptors, args: {} })
    ).toThrow(
      expect.objectContaining({ code: 'GAMEPLAY_TEST_RUN_IN_PROGRESS' })
    );
    await flushBackgroundStart();
    await flushBackgroundStart();
    const failed = operations.get({
      operation_id: 'gameplay-tests-failed',
    });
    expect(failed.status).toBe('failed');
    expect(failed.results).toHaveLength(1);
    expect(failed.operation_error).toBe(
      'persistence failed with a private stack'
    );
    expect(endPreviewLaunchSequence).toHaveBeenCalledTimes(1);

    const uiConflict = createMcpGameplayTestOperations({
      runGameplayTests: async () => [],
      isGameplayTestRunInProgress: () => true,
    });
    expect(() =>
      uiConflict.start({ project: makeProject(), descriptors, args: {} })
    ).toThrow(
      expect.objectContaining({ code: 'GAMEPLAY_TEST_RUN_IN_PROGRESS' })
    );
    const previewConflict = createMcpGameplayTestOperations({
      runGameplayTests: async () => [],
      isGameplayTestRunInProgress: () => false,
      beginPreviewLaunchSequence: () => false,
    });
    expect(() =>
      previewConflict.start({ project: makeProject(), descriptors, args: {} })
    ).toThrow(
      expect.objectContaining({
        code: 'PREVIEW_LAUNCH_SEQUENCE_ALREADY_IN_PROGRESS',
      })
    );
    const unavailableRunner = createMcpGameplayTestOperations({
      runGameplayTests: async () => [],
      isGameplayTestRunInProgress: () => false,
      isGameplayTestRunnerAvailable: () => false,
    });
    expect(() =>
      unavailableRunner.start({
        project: makeProject(),
        descriptors,
        args: {},
      })
    ).toThrow(
      expect.objectContaining({ code: 'GAMEPLAY_TEST_RUNNER_UNAVAILABLE' })
    );

    const releaseAfterSnapshotFailure: any = jest.fn();
    const snapshotFailure = createMcpGameplayTestOperations({
      runGameplayTests: async () => [],
      isGameplayTestRunInProgress: () => false,
      beginPreviewLaunchSequence: () => true,
      endPreviewLaunchSequence: releaseAfterSnapshotFailure,
    });
    expect(() =>
      snapshotFailure.start({
        project: ({
          getName: () => {
            throw new Error('project snapshot failed');
          },
          getProjectFile: () => '',
        }: any),
        descriptors,
        args: {},
      })
    ).toThrow('project snapshot failed');
    expect(releaseAfterSnapshotFailure).toHaveBeenCalledTimes(1);
  });

  it('looks up the latest operation and prunes expired/old terminal runs', async () => {
    let now = 0;
    let nextId = 0;
    const operations = createMcpGameplayTestOperations({
      runGameplayTests: async request => {
        request.options.onRunStarted();
        const result = makeResult(request.tests[0].testName);
        request.options.onTestFinished(request.tests[0], result);
        return [result];
      },
      isGameplayTestRunInProgress: () => false,
      now: () => now,
      createOperationId: () => `gameplay-tests-${++nextId}`,
      retentionMs: 100,
      maxRetainedTerminalOperations: 2,
    });
    for (let index = 0; index < 3; index++) {
      operations.start({
        project: makeProject(),
        descriptors: descriptors.slice(0, 1),
        args: {},
      });
      await flushBackgroundStart();
      now += 10;
    }
    expect(operations.get().operation_id).toBe('gameplay-tests-3');
    expect(operations.get().summary.all_passed).toBe(true);
    expect(() => operations.get({ operation_id: 'gameplay-tests-1' })).toThrow(
      expect.objectContaining({ code: 'GAMEPLAY_TEST_OPERATION_NOT_FOUND' })
    );
    now = 1000;
    expect(() => operations.get()).toThrow(
      expect.objectContaining({ code: 'NO_GAMEPLAY_TEST_OPERATION' })
    );
  });

  it('aggregates every gameplay-test terminal status', async () => {
    const statuses = ['passed', 'failed', 'error', 'stopped', 'timeout'];
    const statusDescriptors: Array<McpGameplayTestDescriptor> = statuses.map(
      (status, index) => ({
        scope: 'project',
        name: `Test ${index}`,
        file: `tests/Test%20${index}.js`,
      })
    );
    const operations = createMcpGameplayTestOperations({
      runGameplayTests: async request => {
        request.options.onRunStarted();
        return request.tests.map((test, index) => {
          request.options.onTestStarted(test);
          const result = makeResult(test.testName, statuses[index]);
          request.options.onTestFinished(test, result);
          return result;
        });
      },
      isGameplayTestRunInProgress: () => false,
      createOperationId: () => 'gameplay-tests-statuses',
    });

    operations.start({
      project: makeProject(),
      descriptors: statusDescriptors,
      args: {},
    });
    await flushBackgroundStart();
    const result = operations.get({
      operation_id: 'gameplay-tests-statuses',
    });

    expect(result.status).toBe('completed');
    expect(result.summary).toEqual({
      total: 5,
      completed: 5,
      passed: 1,
      failed: 1,
      error: 1,
      stopped: 1,
      timeout: 1,
      all_passed: false,
    });
  });

  it('retains only the newest ten terminal operations by default', async () => {
    let nextId = 0;
    const operations = createMcpGameplayTestOperations({
      runGameplayTests: async request => {
        request.options.onRunStarted();
        const result = makeResult(request.tests[0].testName);
        request.options.onTestFinished(request.tests[0], result);
        return [result];
      },
      isGameplayTestRunInProgress: () => false,
      createOperationId: () => `gameplay-tests-default-${++nextId}`,
    });

    for (let index = 0; index < 11; index++) {
      operations.start({
        project: makeProject(),
        descriptors: descriptors.slice(0, 1),
        args: {},
      });
      await flushBackgroundStart();
    }

    expect(() =>
      operations.get({ operation_id: 'gameplay-tests-default-1' })
    ).toThrow(
      expect.objectContaining({ code: 'GAMEPLAY_TEST_OPERATION_NOT_FOUND' })
    );
    expect(operations.get().operation_id).toBe('gameplay-tests-default-11');
  });

  it('validates empty projects, timeouts, operation ids, and pagination', () => {
    const makeOperations = () =>
      createMcpGameplayTestOperations({
        runGameplayTests: () => new Promise(() => {}),
        isGameplayTestRunInProgress: () => false,
      });
    expect(() =>
      makeOperations().start({
        project: makeProject(),
        descriptors: [],
        args: {},
      })
    ).toThrow(expect.objectContaining({ code: 'NO_GAMEPLAY_TESTS' }));
    expect(() =>
      makeOperations().start({
        project: makeProject(),
        descriptors,
        args: { timeout_ms: 999 },
      })
    ).toThrow(
      expect.objectContaining({ code: 'INVALID_GAMEPLAY_TEST_TIMEOUT' })
    );
    const operations = makeOperations();
    expect(() => operations.get()).toThrow(
      expect.objectContaining({ code: 'NO_GAMEPLAY_TEST_OPERATION' })
    );
    expect(() => operations.get({ operation_id: '' })).toThrow(
      expect.objectContaining({ code: 'INVALID_GAMEPLAY_TEST_OPERATION_ID' })
    );

    operations.start({ project: makeProject(), descriptors, args: {} });
    expect(() => operations.get({ offset: -1 })).toThrow(
      expect.objectContaining({ code: 'INVALID_GAMEPLAY_TEST_PAGINATION' })
    );
    expect(() => operations.get({ limit: 101 })).toThrow(
      expect.objectContaining({ code: 'INVALID_GAMEPLAY_TEST_PAGINATION' })
    );
    expect(() =>
      makeOperations().start({
        project: makeProject(),
        descriptors,
        args: { source: 'harness.fail("inline");' },
      })
    ).toThrow(
      expect.objectContaining({ code: 'INVALID_GAMEPLAY_TEST_ARGUMENTS' })
    );
    expect(() => operations.get({ retry: true })).toThrow(
      expect.objectContaining({ code: 'INVALID_GAMEPLAY_TEST_QUERY' })
    );
  });
});
