// @flow

import { LogsManager, type Log } from './DebuggerConsole';

describe('LogsManager', () => {
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('snapshots committed and pending logs without exposing mutable state', () => {
    jest.useFakeTimers();
    const logsManager = new LogsManager();
    const pendingLog: Log = {
      message: 'A pending error',
      type: 'error',
      group: 'JavaScript',
      timestamp: 12.5,
    };

    logsManager.addLog(pendingLog);
    const pendingSnapshot = logsManager.getAllLogs();
    expect(pendingSnapshot).toEqual([pendingLog]);
    expect(pendingSnapshot[0]).not.toBe(pendingLog);

    jest.runOnlyPendingTimers();
    expect(logsManager.getAllLogs()).toEqual([pendingLog]);
  });
});
