/**
 * @flow
 * @jest-environment jsdom
 * @jest-environment-options {"url":"http://localhost/"}
 */
import * as React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import Drawer from './Drawer';
import PortalContainerContext from './PortalContainerContext';
import {
  captureMaterialUiOverlayCleanupCandidates,
  cleanupLeakedOverlaysAfterPopOutClose,
} from './MaterialUISpecificUtil';

// Reproduce the observed Electron failure: the paper slides out, but the
// transition never notifies Modal that it exited. Use the real MUI Modal,
// backdrop, focus trap and ModalManager, not a mock of the drawer itself.
const InterruptedSlide = React.forwardRef<any, HTMLElement>(
  ({ children, in: open, onEnter, tabIndex }, ref) => {
    const wasOpen = React.useRef(false);
    React.useLayoutEffect(
      () => {
        const entering = open && !wasOpen.current;
        wasOpen.current = open;
        if (entering && onEnter) onEnter();
      },
      [open, onEnter]
    );
    return React.cloneElement(children, {
      ref,
      tabIndex,
      style: {
        ...children.props.style,
        transform: open ? 'none' : 'translateX(-320px)',
      },
    });
  }
);

describe('Drawer input ownership', () => {
  let root;
  let host;
  let editorInput;
  let previousActEnvironment;

  const renderDrawer = (open: boolean, props: any = {}) => {
    act(() => {
      root.render(
        <Drawer
          open={open}
          ModalProps={{ keepMounted: true }}
          TransitionComponent={InterruptedSlide}
          {...props}
        >
          <input aria-label="Drawer input" defaultValue="Preserved draft" />
        </Drawer>
      );
    });
  };

  const getOverlay = (): HTMLElement => {
    const overlay = document.querySelector('.MuiDrawer-modal');
    if (!(overlay instanceof HTMLElement)) throw new Error('Drawer not found');
    return overlay;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    previousActEnvironment = (global: any).IS_REACT_ACT_ENVIRONMENT;
    (global: any).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    editorInput = document.createElement('input');
    const body = document.body;
    if (!body) throw new Error('Document body not found');
    body.appendChild(editorInput);
    body.appendChild(host);
    editorInput.focus();
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    editorInput.remove();
    jest.clearAllTimers();
    jest.useRealTimers();
    (global: any).IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  });

  test('releases input, focus and scroll locks even if the exit callback is lost', () => {
    renderDrawer(true);
    const overlay = getOverlay();
    expect(document.body && document.body.style.overflow).toBe('hidden');
    expect(editorInput.getAttribute('aria-hidden')).toBe('true');
    expect(overlay.contains(document.activeElement)).toBe(true);

    renderDrawer(false);

    // Do not advance timers: closing must not depend on animation callbacks.
    expect(window.getComputedStyle(overlay).pointerEvents).toBe('none');
    expect(window.getComputedStyle(overlay).visibility).toBe('hidden');
    expect(overlay.hasAttribute('inert')).toBe(true);
    expect(editorInput.getAttribute('aria-hidden')).toBe(null);
    expect(document.body && document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(editorInput);
  });

  test('can reopen repeatedly without losing mounted content or stale styles', () => {
    renderDrawer(true);
    const overlay = getOverlay();
    const input = overlay.querySelector('input');
    if (!(input instanceof HTMLInputElement))
      throw new Error('Input not found');
    input.value = 'Unsaved drawer state';

    for (let cycle = 0; cycle < 4; cycle++) {
      renderDrawer(false);
      expect(window.getComputedStyle(overlay).pointerEvents).toBe('none');
      expect(overlay.hasAttribute('inert')).toBe(true);

      // A debugger/pop-out cleanup pass may run while a side drawer is closed.
      cleanupLeakedOverlaysAfterPopOutClose(
        captureMaterialUiOverlayCleanupCandidates()
      );
      expect(overlay.isConnected).toBe(true);
      expect(overlay.getAttribute('aria-hidden')).toBe('true');
      expect(overlay.hasAttribute('inert')).toBe(true);
      expect(overlay.hasAttribute('data-gdevelop-stale-overlay')).toBe(false);

      renderDrawer(true);
      expect(getOverlay()).toBe(overlay);
      expect(overlay.querySelector('input')).toBe(input);
      expect(input.value).toBe('Unsaved drawer state');
      expect(window.getComputedStyle(overlay).visibility).toBe('visible');
      expect(window.getComputedStyle(overlay).pointerEvents).not.toBe('none');
      expect(overlay.hasAttribute('inert')).toBe(false);
      expect(overlay.getAttribute('aria-hidden')).not.toBe('true');
    }
  });

  test('does not let modal styles or closeAfterTransition retain a closed input blocker', () => {
    const props = {
      style: { zIndex: 1502 },
      ModalProps: {
        keepMounted: true,
        closeAfterTransition: true,
        style: { pointerEvents: 'auto', visibility: 'visible', color: 'red' },
      },
    };
    renderDrawer(true, props);
    renderDrawer(false, props);
    const overlay = getOverlay();
    expect(overlay.style.pointerEvents).toBe('none');
    expect(overlay.style.visibility).toBe('hidden');
    expect(overlay.style.zIndex).toBe('1502');
    expect(overlay.style.color).toBe('red');
    expect(document.body && document.body.style.overflow).toBe('');

    renderDrawer(true, props);
    expect(overlay.style.pointerEvents).toBe('auto');
    expect(overlay.style.visibility).toBe('visible');
  });

  test('keeps an open drawer usable during delayed pop-out cleanup', () => {
    renderDrawer(false);
    const candidates = captureMaterialUiOverlayCleanupCandidates();
    renderDrawer(true);
    const overlay = getOverlay();
    cleanupLeakedOverlaysAfterPopOutClose(candidates);
    expect(window.getComputedStyle(overlay).visibility).toBe('visible');
    expect(window.getComputedStyle(overlay).pointerEvents).not.toBe('none');
    expect(overlay.hasAttribute('data-gdevelop-stale-overlay')).toBe(false);
    expect(editorInput.getAttribute('aria-hidden')).toBe('true');
    expect(document.body && document.body.style.overflow).toBe('hidden');
  });

  test('uses its pop-out document and restores only that document when closing', () => {
    const iframe = document.createElement('iframe');
    if (!document.body) throw new Error('Document body not found');
    document.body.appendChild(iframe);
    const externalDocument = iframe.contentDocument;
    if (!externalDocument || !externalDocument.body)
      throw new Error('External document not found');
    const externalBody = externalDocument.body;
    const externalEditor = externalDocument.createElement('input');
    externalBody.appendChild(externalEditor);
    const renderInPopOut = (open: boolean) => {
      act(() => {
        root.render(
          <PortalContainerContext.Provider value={externalBody}>
            <Drawer
              open={open}
              ModalProps={{ keepMounted: true }}
              TransitionComponent={InterruptedSlide}
            >
              <input aria-label="Pop-out drawer input" />
            </Drawer>
          </PortalContainerContext.Provider>
        );
      });
    };

    try {
      renderInPopOut(true);
      expect(document.querySelector('.MuiDrawer-modal')).toBe(null);
      const overlay = externalBody.querySelector('.MuiDrawer-modal');
      expect(overlay).not.toBe(null);
      expect(externalEditor.getAttribute('aria-hidden')).toBe('true');
      expect(editorInput.getAttribute('aria-hidden')).toBe(null);

      renderInPopOut(false);
      expect(overlay && overlay.style.pointerEvents).toBe('none');
      expect(externalEditor.getAttribute('aria-hidden')).toBe(null);
      expect(externalBody.style.overflow).toBe('');
      act(() => root.render(null));
    } finally {
      iframe.remove();
    }
  });
});
