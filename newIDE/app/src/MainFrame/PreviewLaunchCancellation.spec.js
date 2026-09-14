// @flow

import {
  beginPreviewFileWriting,
  canReleaseCancelledPreviewPreparation,
  handlePreviewWindowClosed,
} from './PreviewLaunchCancellation';

describe('PreviewLaunchCancellation', () => {
  it('clears a loading preview before attempting window and debugger cleanup', () => {
    const calls = [];
    handlePreviewWindowClosed({
      remainingPreviewWindowsForParent: 0,
      cancelLaunch: () => calls.push('cancel'),
      closeConnections: () => calls.push('connections'),
      clearStatuses: () => calls.push('statuses'),
      restoreInput: () => calls.push('input'),
    });
    expect(calls).toEqual(['cancel', 'connections', 'statuses', 'input']);
  });

  it('clears loading and restores input even if debugger teardown throws', () => {
    let loading = true;
    const clearStatuses = jest.fn();
    const restoreInput = jest.fn();
    expect(() =>
      handlePreviewWindowClosed({
        remainingPreviewWindowsForParent: 0,
        cancelLaunch: () => {
          loading = false;
        },
        closeConnections: () => {
          throw new Error('Debugger already destroyed');
        },
        clearStatuses,
        restoreInput,
      })
    ).toThrow('Debugger already destroyed');
    expect(loading).toBe(false);
    expect(clearStatuses).toHaveBeenCalledTimes(1);
    expect(restoreInput).toHaveBeenCalledTimes(1);
  });

  it('keeps other preview windows running when only one window closes', () => {
    const cancelLaunch = jest.fn();
    const closeConnections = jest.fn();
    const clearStatuses = jest.fn();
    const restoreInput = jest.fn();
    handlePreviewWindowClosed({
      remainingPreviewWindowsForParent: 1,
      cancelLaunch,
      closeConnections,
      clearStatuses,
      restoreInput,
    });
    expect(cancelLaunch).not.toHaveBeenCalled();
    expect(closeConnections).not.toHaveBeenCalled();
    expect(clearStatuses).not.toHaveBeenCalled();
    expect(restoreInput).toHaveBeenCalledTimes(1);
  });

  it('does not let a released, cancelled launcher start writing preview files', () => {
    let beginWritingCallCount = 0;
    const onBeginWriting = () => {
      beginWritingCallCount++;
    };

    expect(
      beginPreviewFileWriting({
        isLaunchCancelled: () => true,
        onBeginWriting,
      })
    ).toBe(false);
    expect(beginWritingCallCount).toBe(0);
  });

  it('marks an active launcher as writing at the file-write boundary', () => {
    let beginWritingCallCount = 0;
    const onBeginWriting = () => {
      beginWritingCallCount++;
    };

    expect(
      beginPreviewFileWriting({
        isLaunchCancelled: () => false,
        onBeginWriting,
      })
    ).toBe(true);
    expect(beginWritingCallCount).toBe(1);
  });

  it('allows a cancelled preparation to release a stale launch lock', () => {
    expect(
      canReleaseCancelledPreviewPreparation({
        launchInProgress: true,
        activePreviewLaunchId: 23,
        isActivePreviewLaunchCancelled: true,
        launchPhase: 'preparing',
      })
    ).toBe(true);
  });

  it('keeps the lock while the preview launcher may be writing files', () => {
    expect(
      canReleaseCancelledPreviewPreparation({
        launchInProgress: true,
        activePreviewLaunchId: 23,
        isActivePreviewLaunchCancelled: true,
        launchPhase: 'launching',
      })
    ).toBe(false);
  });

  it('does not release an active launch that was not cancelled', () => {
    expect(
      canReleaseCancelledPreviewPreparation({
        launchInProgress: true,
        activePreviewLaunchId: 23,
        isActivePreviewLaunchCancelled: false,
        launchPhase: 'preparing',
      })
    ).toBe(false);
  });
});
