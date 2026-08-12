// @flow
import * as React from 'react';
import { I18n } from '@lingui/react';
import Paper from '@material-ui/core/Paper';

import { type MessageDescriptor } from '../Utils/i18n/MessageDescriptor.flow';
import CircularProgress from './CircularProgress';
import Text from './Text';

const styles = {
  container: {
    position: 'fixed',
    bottom: 16,
    left: '50%',
    maxWidth: 'calc(100vw - 32px)',
    pointerEvents: 'none',
    transform: 'translateX(-50%)',
    zIndex: 2000,
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
  },
};

function useDelayedBoolean(target: boolean, delayMs: number): boolean {
  const [value, setValue] = React.useState<boolean>(false);
  const timerRef = React.useRef<?TimeoutID>(null);

  React.useEffect(
    () => {
      if (target) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setValue(true);
          timerRef.current = null;
        }, delayMs);
      } else {
        setValue(false);
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      }
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    },
    [target, delayMs]
  );

  return value;
}

type Props = {|
  showImmediately: boolean,
  showAfterDelay?: boolean,
  message: MessageDescriptor,
|};

/**
 * Displays progress without a modal, backdrop or focus trap. The whole
 * indicator ignores pointer input so work in the editor can continue even if
 * the operation takes longer than expected.
 */
const NonBlockingLoader = ({
  message,
  showImmediately,
  showAfterDelay,
}: Props): React.Node => {
  const delayedShow = useDelayedBoolean(!!showAfterDelay, 150);
  if (!showImmediately && !delayedShow) return null;

  return (
    <I18n>
      {({ i18n }) => (
        <div
          aria-live="polite"
          data-gdevelop-non-blocking-loader
          role="status"
          style={styles.container}
        >
          <Paper elevation={8} style={styles.content}>
            <CircularProgress size={24} disableShrink />
            <Text
              noMargin
              noShrink
              displayInlineAsSpan
              style={{ marginLeft: 8, whiteSpace: 'nowrap' }}
            >
              {i18n._(message)}
            </Text>
          </Paper>
        </div>
      )}
    </I18n>
  );
};

export default NonBlockingLoader;
