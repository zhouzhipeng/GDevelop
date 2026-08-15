// @flow

export const REPORT_ISSUE_SHORTCUT_MAX_DELAY_MS = 500;

export const updateReportIssueShortcut = ({
  event,
  previousPressTime,
}: {|
  event: KeyboardEvent,
  previousPressTime: ?number,
|}): {|
  shouldTrigger: boolean,
  nextPressTime: ?number,
|} => {
  if (
    event.code !== 'KeyR' ||
    event.repeat ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey
  ) {
    return { shouldTrigger: false, nextPressTime: null };
  }

  let shouldTrigger = false;
  if (typeof previousPressTime === 'number') {
    shouldTrigger =
      event.timeStamp >= previousPressTime &&
      event.timeStamp - previousPressTime <= REPORT_ISSUE_SHORTCUT_MAX_DELAY_MS;
  }

  return {
    shouldTrigger,
    nextPressTime: shouldTrigger ? null : event.timeStamp,
  };
};
