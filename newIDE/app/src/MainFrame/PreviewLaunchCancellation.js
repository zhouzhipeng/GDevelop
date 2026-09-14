// @flow

export type PreviewLaunchPhase = 'idle' | 'preparing' | 'launching';

// Native close notifications must clear loading before touching a closing
// debugger document or its connections. Recovery still runs if teardown fails.
export const handlePreviewWindowClosed = ({
  remainingPreviewWindowsForParent,
  cancelLaunch,
  closeConnections,
  clearStatuses,
  restoreInput,
}: {|
  remainingPreviewWindowsForParent: ?number,
  cancelLaunch: () => void,
  closeConnections: () => void,
  clearStatuses: () => void,
  restoreInput: () => void,
|}) => {
  try {
    if (remainingPreviewWindowsForParent === 0) {
      cancelLaunch();
      try {
        closeConnections();
      } finally {
        clearStatuses();
      }
    }
  } finally {
    restoreInput();
  }
};

export const beginPreviewFileWriting = ({
  isLaunchCancelled,
  onBeginWriting,
}: {|
  isLaunchCancelled: () => boolean,
  onBeginWriting: () => void,
|}): boolean => {
  if (isLaunchCancelled()) return false;

  onBeginWriting();
  return true;
};

export const canReleaseCancelledPreviewPreparation = ({
  launchInProgress,
  activePreviewLaunchId,
  isActivePreviewLaunchCancelled,
  launchPhase,
}: {|
  launchInProgress: boolean,
  activePreviewLaunchId: ?number,
  isActivePreviewLaunchCancelled: boolean,
  launchPhase: PreviewLaunchPhase,
|}): boolean =>
  launchInProgress &&
  activePreviewLaunchId != null &&
  isActivePreviewLaunchCancelled &&
  launchPhase === 'preparing';
