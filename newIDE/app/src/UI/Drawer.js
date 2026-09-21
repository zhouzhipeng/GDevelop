// @flow
import * as React from 'react';
// This is the only boundary allowed to use the underlying MUI drawer.
// eslint-disable-next-line no-restricted-imports
import MuiDrawer from '@material-ui/core/Drawer';
import PortalContainerContext from './PortalContainerContext';

type Props = React.ElementConfig<typeof MuiDrawer>;

const closedModalStyle = {
  visibility: 'hidden',
  pointerEvents: 'none',
};

/**
 * A closed drawer must release the editor even if its Slide never calls
 * onExited (for example, when an Electron pop-out disappears during a
 * transition). MUI otherwise leaves a transparent, full-window modal behind.
 *
 * Keep input ownership tied to `open`, not to animation completion. Retain
 * React's portal and keepMounted content so drafts and reopening still work.
 */
const Drawer: React.ComponentType<{
  ...Props,
  +ref?: React.RefSetter<HTMLDivElement>,
}> = React.forwardRef<Props, HTMLDivElement>(
  (
    {
      open = false,
      variant = 'temporary',
      style,
      ModalProps,
      container,
      ...props
    },
    ref
  ) => {
    const portalContainer = React.useContext(PortalContainerContext);

    return (
      <MuiDrawer
        {...props}
        ref={ref}
        open={open}
        variant={variant}
        container={container || portalContainer || undefined}
        style={style}
        ModalProps={
          variant === 'temporary'
            ? {
                ...ModalProps,
                open,
                // Release ModalManager's focus and scroll locks immediately,
                // including when a caller supplied closeAfterTransition.
                closeAfterTransition: false,
                'data-gdevelop-drawer-open': open ? 'true' : 'false',
                // Also prevent tabbing into retained content or descendants
                // that explicitly override inherited pointer-events styles.
                inert: open ? undefined : '',
                style: {
                  ...style,
                  ...(ModalProps ? ModalProps.style : undefined),
                  ...(!open ? closedModalStyle : undefined),
                },
              }
            : ModalProps
        }
      />
    );
  }
);

export default Drawer;
