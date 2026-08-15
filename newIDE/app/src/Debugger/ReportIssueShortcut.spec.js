// @noflow
import { updateReportIssueShortcut } from './ReportIssueShortcut';

const makeEvent = (timeStamp, overrides = {}) => ({
  code: 'KeyR',
  timeStamp,
  repeat: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...overrides,
});

describe('ReportIssueShortcut', () => {
  it('triggers after two quick R key presses and resets the sequence', () => {
    const firstPress = updateReportIssueShortcut({
      event: makeEvent(100),
      previousPressTime: null,
    });
    const secondPress = updateReportIssueShortcut({
      event: makeEvent(550),
      previousPressTime: firstPress.nextPressTime,
    });

    expect(firstPress.shouldTrigger).toBe(false);
    expect(secondPress).toEqual({
      shouldTrigger: true,
      nextPressTime: null,
    });
  });

  it('does not trigger for slow, repeated or modified key presses', () => {
    expect(
      updateReportIssueShortcut({
        event: makeEvent(601),
        previousPressTime: 100,
      }).shouldTrigger
    ).toBe(false);
    expect(
      updateReportIssueShortcut({
        event: makeEvent(200, { repeat: true }),
        previousPressTime: 100,
      })
    ).toEqual({ shouldTrigger: false, nextPressTime: null });
    expect(
      updateReportIssueShortcut({
        event: makeEvent(200, { ctrlKey: true }),
        previousPressTime: 100,
      })
    ).toEqual({ shouldTrigger: false, nextPressTime: null });
  });
});
