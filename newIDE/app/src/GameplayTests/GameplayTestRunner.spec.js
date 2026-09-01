// @flow
import {
  createHiddenStallTracker,
  getIsGameplayTestRunInProgress,
  runGameplayTests,
  stopRunningGameplayTest,
  type GameplayTestToRun,
} from './GameplayTestRunner';
import {
  clearGameplayTestFramePreview,
  setGameplayTestFrameRunStatus,
} from './GameplayTestFrame';

jest.mock('./GameplayTestStateInspectors', () => ({
  enumerateGameplayTestStateInspectors: () => ({}),
}));
jest.mock('./GameplayTestFrame', () => ({
  clearGameplayTestFramePreview: jest.fn(),
  setGameplayTestFrameHiddenPause: jest.fn(),
  setGameplayTestFrameRunStatus: jest.fn(),
}));

const makeProject = (): any => ({
  getFirstLayout: () => 'Game',
  getTests: () => ({ hasTestNamed: () => false }),
  hasEventsFunctionsExtensionNamed: () => false,
});

const makeSuccessfulPreviewDebuggerServer = (): any => {
  const registeredCallbacks: Set<any> = new Set();
  return {
    registerCallbacks: (callbacks: any) => {
      registeredCallbacks.add(callbacks);
      // Any message from the gameplay-test frame signals that the preview is
      // booted. Wait until registration has returned before delivering it.
      Promise.resolve().then(() => {
        if (!registeredCallbacks.has(callbacks)) return;
        callbacks.onHandleParsedMessage({
          id: 'gameplay-test-frame',
          parsedMessage: { command: 'status' },
        });
      });
      return () => registeredCallbacks.delete(callbacks);
    },
    sendMessage: (id: string, message: any) => {
      if (message.command !== 'gameplayTest.run') return;
      Promise.resolve().then(() => {
        registeredCallbacks.forEach(callbacks =>
          callbacks.onHandleParsedMessage({
            id,
            parsedMessage: {
              command: 'gameplayTest.result',
              messageId: message.messageId,
              payload: {
                testName: message.payload.testName,
                status: 'passed',
                framesExecuted: 2,
                durationMs: 3,
              },
            },
          })
        );
      });
    },
  };
};

describe('runGameplayTests', () => {
  beforeEach(() => {
    ((clearGameplayTestFramePreview: any): JestMockFn<any, any>).mockReset();
    ((setGameplayTestFrameRunStatus: any): JestMockFn<any, any>).mockReset();
  });

  it('reports batch start and every normal or source-error result in order exactly once', async () => {
    const lifecycle: Array<string> = [];
    const finishedCalls: Array<any> = [];
    const storedTest: any = {
      getSource: jest.fn(() => 'await harness.stepFrames(1);'),
      setLastRunStatus: jest.fn(),
      setLastRunAt: jest.fn(),
      setLastRunDurationMs: jest.fn(),
      setLastRunFramesExecuted: jest.fn(),
    };
    const project = {
      ...makeProject(),
      getTests: () => ({
        hasTestNamed: (testName: string) => testName === 'Player can jump',
        getTest: () => storedTest,
      }),
    };
    const tests: Array<GameplayTestToRun> = [
      {
        scope: { type: 'project' },
        testName: 'Player can jump',
      },
      {
        scope: { type: 'extension', extensionName: 'Missing extension' },
        testName: 'Missing test',
      },
    ];
    const results = await runGameplayTests({
      project,
      tests,
      previewLauncher: ({
        launchPreview: async () => {
          lifecycle.push('preview-launched');
        },
      }: any),
      previewDebuggerServer: makeSuccessfulPreviewDebuggerServer(),
      options: {
        onRunStarted: () => {
          lifecycle.push('run-started');
        },
        onTestStarted: test => {
          lifecycle.push(`test-started:${test.testName}`);
        },
        onTestFinished: (test, result) => {
          lifecycle.push(`test-finished:${test.testName}:${result.status}`);
          finishedCalls.push({ test, result });
        },
      },
    });

    expect(results.map(result => result.status)).toEqual(['passed', 'error']);
    expect(lifecycle).toEqual([
      'run-started',
      'preview-launched',
      'test-started:Player can jump',
      'test-finished:Player can jump:passed',
      'test-finished:Missing test:error',
    ]);
    expect(finishedCalls).toHaveLength(2);
    expect(storedTest.getSource).toHaveBeenCalledTimes(1);
    expect(finishedCalls[0]).toEqual({ test: tests[0], result: results[0] });
    expect(finishedCalls[1]).toEqual({ test: tests[1], result: results[1] });
    // Interactive runs retain the completed floating frame by default. The
    // only clear is the stale-frame cleanup before launching this run.
    expect(clearGameplayTestFramePreview).toHaveBeenCalledTimes(1);
  });

  it('closes the floating game frame after a completed automated run', async () => {
    const results = await runGameplayTests({
      project: makeProject(),
      tests: [
        {
          scope: { type: 'project' },
          testName: 'Automated test',
          source: 'await harness.stepFrames(1);',
        },
      ],
      previewLauncher: ({ launchPreview: async () => {} }: any),
      previewDebuggerServer: makeSuccessfulPreviewDebuggerServer(),
      options: { closeFrameWhenFinished: true },
    });

    expect(results[0].status).toBe('passed');
    // Once before launch to remove stale content, once in finalization to
    // unload and hide the floating frame opened by this run.
    expect(clearGameplayTestFramePreview).toHaveBeenCalledTimes(2);
  });

  it('reports one synthetic result per test when preview launch fails', async () => {
    const onRunStarted: any = jest.fn();
    const onTestStarted: any = jest.fn();
    const onTestFinished: any = jest.fn();
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const tests: Array<GameplayTestToRun> = [
      {
        scope: { type: 'project' },
        testName: 'First',
        source: 'first',
      },
      {
        scope: { type: 'project' },
        testName: 'Second',
        source: 'second',
      },
    ];

    try {
      const results = await runGameplayTests({
        project: makeProject(),
        tests,
        previewLauncher: ({
          launchPreview: async () => {
            throw new Error('Preview export failed.');
          },
        }: any),
        previewDebuggerServer: ({ sendMessage: () => {} }: any),
        options: { onRunStarted, onTestStarted, onTestFinished },
      });

      expect(results.map(result => result.status)).toEqual(['error', 'error']);
      expect(onRunStarted).toHaveBeenCalledTimes(1);
      expect(onTestStarted).not.toHaveBeenCalled();
      expect(onTestFinished).toHaveBeenCalledTimes(2);
      expect(onTestFinished.mock.calls).toEqual([
        [tests[0], results[0]],
        [tests[1], results[1]],
      ]);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('reports every test and cleans up when stored source resolution throws', async () => {
    const onRunStarted: any = jest.fn();
    const onTestFinished: any = jest.fn();
    const previewLauncher: any = { launchPreview: jest.fn() };
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const tests: Array<GameplayTestToRun> = [
      {
        scope: { type: 'project' },
        testName: 'Broken stored test',
      },
      {
        scope: { type: 'project' },
        testName: 'Test after broken source',
        source: 'second',
      },
    ];
    const project = {
      ...makeProject(),
      getTests: () => ({
        hasTestNamed: () => true,
        getTest: () => ({
          getSource: () => {
            throw new Error('Unable to read the stored source.');
          },
        }),
      }),
    };

    try {
      const results = await runGameplayTests({
        project,
        tests,
        previewLauncher,
        previewDebuggerServer: ({ sendMessage: () => {} }: any),
        options: { onRunStarted, onTestFinished },
      });

      expect(results.map(result => result.status)).toEqual(['error', 'error']);
      expect(onRunStarted).toHaveBeenCalledTimes(1);
      expect(previewLauncher.launchPreview).not.toHaveBeenCalled();
      expect(onTestFinished.mock.calls).toEqual([
        [tests[0], results[0]],
        [tests[1], results[1]],
      ]);
      expect(getIsGameplayTestRunInProgress()).toBe(false);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('reports only unfinished tests and cleans up when frame status update throws', async () => {
    const onRunStarted: any = jest.fn();
    const onTestFinished: any = jest.fn();
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const tests: Array<GameplayTestToRun> = [
      {
        scope: { type: 'project' },
        testName: 'Completed before frame failure',
        source: 'first',
      },
      {
        scope: { type: 'project' },
        testName: 'Interrupted by frame failure',
        source: 'second',
      },
    ];
    ((setGameplayTestFrameRunStatus: any): JestMockFn<
      any,
      any
    >).mockImplementation(() => {
      if (
        ((setGameplayTestFrameRunStatus: any): JestMockFn<any, any>).mock.calls
          .length === 4
      ) {
        throw new Error('Unable to update the frame status.');
      }
    });

    try {
      const results = await runGameplayTests({
        project: makeProject(),
        tests,
        previewLauncher: ({ launchPreview: async () => {} }: any),
        previewDebuggerServer: makeSuccessfulPreviewDebuggerServer(),
        options: { onRunStarted, onTestFinished },
      });

      expect(results.map(result => result.status)).toEqual(['passed', 'error']);
      expect(onRunStarted).toHaveBeenCalledTimes(1);
      expect(onTestFinished.mock.calls).toEqual([
        [tests[0], results[0]],
        [tests[1], results[1]],
      ]);
      expect(getIsGameplayTestRunInProgress()).toBe(false);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('provides the cancellation contract required by preview launchers', async () => {
    let launchOptions: any = null;
    const onRunStarted: any = jest.fn();
    const onTestFinished: any = jest.fn();
    const previewDebuggerServer: any = {
      sendMessage: () => {},
    };
    const previewLauncher: any = {
      launchPreview: async (previewOptions: any) => {
        launchOptions = previewOptions;
        expect(previewOptions.isLaunchCancelled()).toBe(false);
        expect(previewOptions.onWillWritePreviewFiles()).toBe(true);

        stopRunningGameplayTest(previewDebuggerServer);

        expect(previewOptions.isLaunchCancelled()).toBe(true);
        expect(previewOptions.onWillWritePreviewFiles()).toBe(false);
      },
    };
    const project: any = ({ getFirstLayout: () => 'Game' }: any);

    const results = await runGameplayTests({
      project,
      tests: [
        {
          scope: { type: 'project' },
          testName: 'Player can jump',
          source: 'gameplayTest.wait(1);',
        },
      ],
      previewLauncher,
      previewDebuggerServer,
      options: { onRunStarted, onTestFinished },
    });

    expect(launchOptions).toEqual(
      expect.objectContaining({
        isLaunchCancelled: expect.any(Function),
        onWillWritePreviewFiles: expect.any(Function),
        displayCollisionShapes: false,
        displaySignalAnimations: false,
        forceAlwaysOnTopInPreview: false,
      })
    );
    expect(launchOptions.isLaunchCancelled()).toBe(true);
    expect(launchOptions.onWillWritePreviewFiles()).toBe(false);
    expect(results[0].status).toBe('stopped');
    expect(onRunStarted).toHaveBeenCalledTimes(1);
    expect(onTestFinished).toHaveBeenCalledTimes(1);
    expect(onTestFinished).toHaveBeenCalledWith(
      expect.objectContaining({ testName: 'Player can jump' }),
      results[0]
    );
  });
});

describe('createHiddenStallTracker', () => {
  /** A clock that can be moved forward by the test. */
  const makeFakeClock = (startMs: number = 1000) => {
    let nowMs = startMs;
    return {
      getNowMs: () => nowMs,
      advanceBy: (durationMs: number) => {
        nowMs += durationMs;
      },
    };
  };

  it('reports no stall when the editor is never hidden', () => {
    const clock = makeFakeClock();
    const tracker = createHiddenStallTracker({
      isHiddenAtStart: false,
      getNowMs: clock.getNowMs,
    });

    clock.advanceBy(5000);
    tracker.reportProgress();

    expect(tracker.getTotalStallMs()).toBe(0);
  });

  it('counts the time the game was frozen while the editor was hidden', () => {
    const clock = makeFakeClock();
    const tracker = createHiddenStallTracker({
      isHiddenAtStart: false,
      getNowMs: clock.getNowMs,
    });

    tracker.reportProgress();
    tracker.reportHidden();
    clock.advanceBy(30000);

    expect(tracker.reportVisible()).toBe(30000);
    expect(tracker.getTotalStallMs()).toBe(30000);
  });

  it('adds up several hidden periods', () => {
    const clock = makeFakeClock();
    const tracker = createHiddenStallTracker({
      isHiddenAtStart: false,
      getNowMs: clock.getNowMs,
    });

    tracker.reportHidden();
    clock.advanceBy(10000);
    tracker.reportVisible();

    tracker.reportProgress();
    clock.advanceBy(2000);
    tracker.reportHidden();
    clock.advanceBy(5000);
    tracker.reportVisible();

    expect(tracker.getTotalStallMs()).toBe(15000);
  });

  it('ignores a hidden period too short to have frozen anything', () => {
    const clock = makeFakeClock();
    const tracker = createHiddenStallTracker({
      isHiddenAtStart: false,
      getNowMs: clock.getNowMs,
    });

    tracker.reportProgress();
    tracker.reportHidden();
    clock.advanceBy(400);

    expect(tracker.reportVisible()).toBe(0);
    expect(tracker.getTotalStallMs()).toBe(0);
  });

  it('does not count a hidden period during which the game kept running', () => {
    // What happens in the desktop app, where background throttling is
    // disabled: the window is hidden, but the game keeps stepping and
    // sending progress.
    const clock = makeFakeClock();
    const tracker = createHiddenStallTracker({
      isHiddenAtStart: false,
      getNowMs: clock.getNowMs,
    });

    tracker.reportHidden();
    for (let i = 0; i < 20; i++) {
      clock.advanceBy(500);
      tracker.reportProgress();
    }

    expect(tracker.reportVisible()).toBe(0);
    expect(tracker.getTotalStallMs()).toBe(0);
  });

  it('only counts the silence following the last sign of life', () => {
    // The game stepped a few more frames after the editor was hidden,
    // then froze: only the freeze is a stall.
    const clock = makeFakeClock();
    const tracker = createHiddenStallTracker({
      isHiddenAtStart: false,
      getNowMs: clock.getNowMs,
    });

    tracker.reportHidden();
    clock.advanceBy(600);
    tracker.reportProgress();
    clock.advanceBy(20000);

    expect(tracker.reportVisible()).toBe(20000);
  });

  it('counts a run started while the editor was already hidden', () => {
    const clock = makeFakeClock();
    const tracker = createHiddenStallTracker({
      isHiddenAtStart: true,
      getNowMs: clock.getNowMs,
    });

    clock.advanceBy(45000);

    // The stall is readable before the editor comes back: this is what the
    // watchdog uses to give up on a run as 'paused'.
    expect(tracker.getTotalStallMs()).toBe(45000);
    expect(tracker.reportVisible()).toBe(45000);
    expect(tracker.getTotalStallMs()).toBe(45000);
  });

  it('reports nothing when the editor comes back without having been hidden', () => {
    const clock = makeFakeClock();
    const tracker = createHiddenStallTracker({
      isHiddenAtStart: false,
      getNowMs: clock.getNowMs,
    });

    clock.advanceBy(30000);

    expect(tracker.reportVisible()).toBe(0);
    expect(tracker.getTotalStallMs()).toBe(0);
  });
});
