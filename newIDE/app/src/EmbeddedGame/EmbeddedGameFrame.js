// @flow
import * as React from 'react';
import { Trans } from '@lingui/macro';
import { type PreviewDebuggerServer } from '../ExportAndShare/PreviewLauncher.flow';
import { objectWithContextReactDndType } from '../ObjectsList';
import {
  projectManagerItemReactDndType,
  isCustomObjectDragItem,
  type CustomObjectDragItem,
} from '../ProjectManager/ProjectManagerItemDragAndDrop';
import { makeDropTarget } from '../UI/DragAndDrop/DropTarget';
import Text from '../UI/Text';
import classes from './EmbeddedGameFrame.module.css';
import { type DropTargetMonitor } from 'react-dnd';
import { registerOpenedDialogsCountCallback } from '../UI/Dialog';
import {
  getActiveEmbeddedGameFrameHoleRect,
  registerActiveEmbeddedGameFrameHoleCountCallback,
  registerEmbeddedGameFrameHoleResizeCallback,
} from './EmbeddedGameFrameHole';
import KeyboardShortcuts from '../UI/KeyboardShortcuts';
import { useInGameEditorSettings } from './InGameEditorSettings';
import { get3DModelFilePathsFromDataTransfer } from '../SceneEditor/Create3DModelFromGLB';
import { hasProjectFileDragData } from '../Utils/ProjectFileDragData';
import { registerPreventGameFramePointerEventsCallback } from './EmbeddedGameFramePointerEvents';
import { safelyRemoveWindowEventListener } from './CrossOriginWindowEventListener';
import { startNativeAppActivity } from '../Utils/NativeAppLifecycle';
import isUserTyping from '../KeyboardShortcuts/IsUserTyping';

type AttachToPreviewOptions = {|
  previewIndexHtmlLocation: string,
|};

type EmbeddedGameFrame3DModelFilesDrop = {|
  modelFilePaths: Array<string>,
  x: number,
  y: number,
|};

type EmbeddedGameFrameCustomObjectDrop = {|
  customObjectDragItem: CustomObjectDragItem,
  x: number,
  y: number,
|};

export type PreviewInGameEditorTarget = {|
  editorId: string,
  sceneName: string | null,
  externalLayoutName: string | null,
  eventsBasedObjectType: string | null,
  eventsBasedObjectVariantName: string | null,
|};

export type HotReloadSteps = {|
  /**
   * Set to `true` when the `ProjectData` must be reloaded.
   */
  shouldReloadProjectData: boolean,
  /**
   * Set to `true` when GDJS libraries must be reloaded.
   */
  shouldReloadLibraries: boolean,
  /**
   * Set to `true` when the resources must be reloaded in memory.
   */
  shouldReloadResources: boolean,
  /**
   * Set to `true` when an hard reload is needed.
   */
  shouldHardReload: boolean,

  /**
   * The reason for the hot reload. Used for debugging purposes.
   */
  reasons: Array<string>,
|};

const mergeNeededHotReloadSteps = (
  stepsA: HotReloadSteps,
  stepsB: HotReloadSteps
): HotReloadSteps => ({
  shouldReloadProjectData:
    stepsA.shouldReloadProjectData || stepsB.shouldReloadProjectData,
  shouldReloadLibraries:
    stepsA.shouldReloadLibraries || stepsB.shouldReloadLibraries,
  shouldReloadResources:
    stepsA.shouldReloadResources || stepsB.shouldReloadResources,
  shouldHardReload: stepsA.shouldHardReload || stepsB.shouldHardReload,
  reasons: [...stepsA.reasons, ...stepsB.reasons],
});

const isHotReloadNeeded = (hotReloadSteps: HotReloadSteps): boolean =>
  hotReloadSteps.shouldReloadProjectData ||
  hotReloadSteps.shouldReloadLibraries ||
  hotReloadSteps.shouldReloadResources ||
  hotReloadSteps.shouldHardReload;

type ChangeViewPositionCommand =
  | 'centerViewOnLastSelectedInstance'
  | 'zoomToInitialPosition'
  | 'zoomToFitContent'
  | 'zoomToFitSelection';

type SwitchToSceneEditionOptions = {|
  ...PreviewInGameEditorTarget,
  ...HotReloadSteps,
|};

export type EditorCameraState = {|
  cameraMode: 'free' | 'orbit',
  positionX: number,
  positionY: number,
  positionZ: number,
  rotationAngle: number,
  elevationAngle: number,
  distance: number,
|};

let onSetEmbededGameFramePreviewLocation:
  | null
  | (AttachToPreviewOptions => void) = null;
let onSwitchToSceneEdition: null | (SwitchToSceneEditionOptions => void) = null;
let onSetEditorHotReloadNeeded:
  | null
  | ((hotReloadSteps: HotReloadSteps) => void) = null;
let onIsEditorHotReloadNeeded: null | (() => boolean) = null;
let onSwitchInGameEditorIfNoHotReloadIsNeeded:
  | null
  | (PreviewInGameEditorTarget => void) = null;
let onSetCameraState:
  | null
  | ((editorId: string, cameraState: EditorCameraState) => void) = null;
let onChangeViewPosition:
  | null
  | ((command: ChangeViewPositionCommand) => void) = null;
let on3DModelFilesDroppedInEmbeddedGameFrame:
  | null
  | (EmbeddedGameFrame3DModelFilesDrop => void | Promise<void>) = null;
let onCustomObjectDroppedInEmbeddedGameFrame:
  | null
  | (EmbeddedGameFrameCustomObjectDrop => void | Promise<void>) = null;

export const setEmbeddedGameFramePreviewLocation = ({
  previewIndexHtmlLocation,
}: AttachToPreviewOptions) => {
  if (!onSetEmbededGameFramePreviewLocation)
    throw new Error('No EmbeddedGameFrame registered.');
  onSetEmbededGameFramePreviewLocation({ previewIndexHtmlLocation });
};

export const switchToSceneEdition = (options: SwitchToSceneEditionOptions) => {
  if (!onSwitchToSceneEdition)
    throw new Error('No EmbeddedGameFrame registered.');
  onSwitchToSceneEdition(options);
};

export const setEditorHotReloadNeeded = (hotReloadSteps: HotReloadSteps) => {
  if (!onSetEditorHotReloadNeeded)
    throw new Error('No EmbeddedGameFrame registered.');
  onSetEditorHotReloadNeeded(hotReloadSteps);
};

export const isEditorHotReloadNeeded = (): boolean => {
  if (!onIsEditorHotReloadNeeded)
    throw new Error('No EmbeddedGameFrame registered.');
  return onIsEditorHotReloadNeeded();
};

export const setCameraState = (
  editorId: string,
  cameraState: EditorCameraState
) => {
  if (!onSetCameraState) throw new Error('No EmbeddedGameFrame registered.');
  onSetCameraState(editorId, cameraState);
};

export const switchInGameEditorIfNoHotReloadIsNeeded = (
  previewInGameEditorTarget: PreviewInGameEditorTarget
) => {
  if (!onSwitchInGameEditorIfNoHotReloadIsNeeded)
    throw new Error('No EmbeddedGameFrame registered.');
  onSwitchInGameEditorIfNoHotReloadIsNeeded(previewInGameEditorTarget);
};

export const changeViewPosition = (command: ChangeViewPositionCommand) => {
  if (!onChangeViewPosition) return;
  onChangeViewPosition(command);
};

export const register3DModelFilesDroppedInEmbeddedGameFrameCallback = (
  callback: EmbeddedGameFrame3DModelFilesDrop => void | Promise<void>
): (() => void) => {
  on3DModelFilesDroppedInEmbeddedGameFrame = callback;

  return () => {
    if (on3DModelFilesDroppedInEmbeddedGameFrame === callback) {
      on3DModelFilesDroppedInEmbeddedGameFrame = null;
    }
  };
};

export const registerCustomObjectDroppedInEmbeddedGameFrameCallback = (
  callback: EmbeddedGameFrameCustomObjectDrop => void | Promise<void>
): (() => void) => {
  onCustomObjectDroppedInEmbeddedGameFrame = callback;

  return () => {
    if (onCustomObjectDroppedInEmbeddedGameFrame === callback) {
      onCustomObjectDroppedInEmbeddedGameFrame = null;
    }
  };
};

const logSwitchingInfo = ({
  editorId,
  sceneName,
  externalLayoutName,
  eventsBasedObjectType,
  eventsBasedObjectVariantName,
  reasons,
}: {|
  ...PreviewInGameEditorTarget,
  reasons: Array<string>,
|}) => {
  console.info(
    eventsBasedObjectType
      ? `Switching in-game edition preview for variant "${eventsBasedObjectVariantName ||
          // $FlowFixMe[constant-condition]
          ''}" of "${eventsBasedObjectType || ''}". Reason(s): ${reasons.join(
          ', '
        )}.`
      : externalLayoutName
      ? // $FlowFixMe[constant-condition]
        `Switching in-game edition previews to external layout "${externalLayoutName ||
          ''}" (scene: "${sceneName || ''}". Reason(s): ${reasons.join(', ')}).`
      : `Switching in-game edition previews to scene "${sceneName ||
          ''}". Reason(s): ${reasons.join(', ')}.`
  );
};

type Props = {|
  previewDebuggerServer: PreviewDebuggerServer | null,
  enabled: boolean,
  onLaunchPreviewForInGameEdition: ({|
    ...PreviewInGameEditorTarget,
    ...HotReloadSteps,
    editorCameraState3D: EditorCameraState | null,
  |}) => Promise<void>,
|};

const DropTarget = makeDropTarget<any>([
  objectWithContextReactDndType,
  projectManagerItemReactDndType,
]);

const noHotReloadSteps = {
  shouldReloadProjectData: false,
  shouldReloadLibraries: false,
  shouldReloadResources: false,
  shouldHardReload: false,
  reasons: [],
};

export const EmbeddedGameFrame = ({
  previewDebuggerServer,
  onLaunchPreviewForInGameEdition,
  enabled,
}: Props): React.MixedElement => {
  const [
    previewIndexHtmlLocation,
    setPreviewIndexHtmlLocation,
  ] = React.useState<string>('');
  const [
    isPointerEventsPrevented,
    setIsPointerEventsPrevented,
  ] = React.useState(false);
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  // $FlowFixMe[incompatible-type]
  const hotReloadSteps = React.useRef<HotReloadSteps>(noHotReloadSteps);
  const lastPreviewContainer = React.useRef<PreviewInGameEditorTarget | null>(
    null
  );
  const isPreviewOngoing = React.useRef<boolean>(false);
  const cameraStates = React.useRef<Map<string, EditorCameraState>>(
    new Map<string, EditorCameraState>()
  );
  const keyboardShortcuts = React.useRef<KeyboardShortcuts>(
    new KeyboardShortcuts({
      isActive: () => true,
      shortcutCallbacks: {},
    })
  );
  const hasSomeDialogOpen = React.useRef<boolean>(false);

  // The game is displayed in an iframe, which is a separate document: it only receives
  // the keyboard events if it has the focus. Give it the focus as soon as it is hovered,
  // so that the in-game editor shortcuts (notably space to move the view) can be used
  // without having to click on the game first.
  const focusGameFrameOnHover = React.useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;

    // A dialog can be opened on top of the game, or show it through a "hole": don't
    // fight with its focus trap.
    if (hasSomeDialogOpen.current) return;

    // Nothing to do if the game is already focused, and don't interrupt the user while
    // a text is being edited (renaming an object, editing a property...).
    if (document.activeElement === iframe || isUserTyping()) return;

    iframe.contentWindow.focus();
  }, []);

  // Send the part of the game frame that is not covered by the editor panels,
  // either with a command changing the view or so that the in-game editor
  // can use it later (e.g. to focus on the selection).
  const sendVisibleScreenArea = React.useCallback(
    (command: ChangeViewPositionCommand | 'setVisibleScreenArea') => {
      const iframe = iframeRef.current;
      if (!iframe || !previewDebuggerServer) return;

      const embeddedGameFrameRect = iframe.getBoundingClientRect();
      const embeddedGameFrameHoleRect = getActiveEmbeddedGameFrameHoleRect();
      if (
        !embeddedGameFrameHoleRect ||
        !embeddedGameFrameRect.width ||
        !embeddedGameFrameRect.height
      )
        return;

      const visibleScreenArea = {
        minX:
          (embeddedGameFrameHoleRect.left - embeddedGameFrameRect.left) /
          embeddedGameFrameRect.width,
        minY:
          (embeddedGameFrameHoleRect.top - embeddedGameFrameRect.top) /
          embeddedGameFrameRect.height,
        maxX:
          (embeddedGameFrameHoleRect.right - embeddedGameFrameRect.left) /
          embeddedGameFrameRect.width,
        maxY:
          (embeddedGameFrameHoleRect.bottom - embeddedGameFrameRect.top) /
          embeddedGameFrameRect.height,
      };
      previewDebuggerServer
        .getExistingEmbeddedGameFrameDebuggerIds()
        .forEach(debuggerId => {
          previewDebuggerServer.sendMessage(debuggerId, {
            command,
            payload: { visibleScreenArea },
          });
        });
    },
    [previewDebuggerServer]
  );

  React.useEffect(
    () =>
      registerEmbeddedGameFrameHoleResizeCallback(() =>
        sendVisibleScreenArea('setVisibleScreenArea')
      ),
    [sendVisibleScreenArea]
  );

  const inGameEditorSettings = useInGameEditorSettings();
  React.useEffect(
    () => {
      if (!previewDebuggerServer) return;

      previewDebuggerServer
        .getExistingEmbeddedGameFrameDebuggerIds()
        .forEach((debuggerId: string) => {
          previewDebuggerServer.sendMessage(debuggerId, {
            command: 'setInGameEditorSettings',
            payload: { inGameEditorSettings },
          });
        });
    },
    [previewDebuggerServer, inGameEditorSettings]
  );

  React.useEffect(
    () => {
      // TODO: use a real context for this to handle several in-game editors.
      onSetEmbededGameFramePreviewLocation = (
        options: AttachToPreviewOptions
      ): void => {
        setPreviewIndexHtmlLocation(options.previewIndexHtmlLocation);
        const iframe = iframeRef.current;
        if (iframe) {
          iframe.contentWindow.focus();
        }
      };
      const unregisterPreventGameFramePointerEvents = registerPreventGameFramePointerEventsCallback(
        (enabled: boolean) => {
          setIsPointerEventsPrevented(enabled);
        }
      );
      onSetEditorHotReloadNeeded = (addedHotReloadSteps: HotReloadSteps) => {
        hotReloadSteps.current = mergeNeededHotReloadSteps(
          hotReloadSteps.current,
          addedHotReloadSteps
        );
      };
      onIsEditorHotReloadNeeded = (): boolean => {
        return isHotReloadNeeded(hotReloadSteps.current);
      };
      onSetCameraState = (editorId: string, cameraState: EditorCameraState) => {
        cameraStates.current.set(editorId, cameraState);
      };
      onSwitchToSceneEdition = (options: SwitchToSceneEditionOptions) => {
        if (!previewDebuggerServer) return;
        if (!enabled) return;

        const {
          editorId,
          sceneName,
          externalLayoutName,
          eventsBasedObjectType,
          eventsBasedObjectVariantName,
        } = options;

        lastPreviewContainer.current = {
          editorId,
          sceneName,
          externalLayoutName,
          eventsBasedObjectType,
          eventsBasedObjectVariantName,
        };
        if (isPreviewOngoing.current) {
          const {
            shouldReloadProjectData,
            shouldReloadLibraries,
            shouldReloadResources,
            shouldHardReload,
            reasons,
          } = options;
          setEditorHotReloadNeeded({
            shouldReloadProjectData,
            shouldReloadLibraries,
            shouldReloadResources,
            shouldHardReload,
            reasons,
          });
          return;
        }

        const {
          shouldReloadProjectData,
          shouldReloadLibraries,
          shouldReloadResources,
          shouldHardReload,
          reasons,
        } = mergeNeededHotReloadSteps(hotReloadSteps.current, {
          shouldReloadProjectData: options.shouldReloadProjectData,
          shouldReloadLibraries: options.shouldReloadLibraries,
          shouldReloadResources: options.shouldReloadResources,
          shouldHardReload: options.shouldHardReload,
          reasons: options.reasons,
        });
        const hotReload = isHotReloadNeeded({
          shouldReloadProjectData,
          shouldReloadLibraries,
          shouldReloadResources,
          shouldHardReload,
          reasons,
        });
        if (!previewIndexHtmlLocation || hotReload) {
          console.info(
            eventsBasedObjectType
              ? `Launching in-game edition preview for variant "${eventsBasedObjectVariantName ||
                  // $FlowFixMe[constant-condition]
                  ''}" of "${eventsBasedObjectType ||
                  ''}". Reason(s): ${reasons.join(', ')}.`
              : externalLayoutName
              ? // $FlowFixMe[constant-condition]
                `Launching in-game edition preview for external layout "${externalLayoutName ||
                  ''}" (scene: "${sceneName || ''}"). Reason(s): ${reasons.join(
                  ', '
                )}.`
              : `Launching in-game edition preview for scene "${sceneName ||
                  ''}". Reason(s): ${reasons.join(', ')}.`
          );
          // $FlowFixMe[incompatible-type]
          hotReloadSteps.current = noHotReloadSteps;
          isPreviewOngoing.current = true;

          onLaunchPreviewForInGameEdition({
            editorId,
            sceneName,
            externalLayoutName,
            eventsBasedObjectType,
            eventsBasedObjectVariantName,
            shouldReloadProjectData,
            shouldReloadLibraries,
            shouldReloadResources,
            shouldHardReload,
            reasons,
            editorCameraState3D: cameraStates.current.get(editorId) || null,
          }).finally(() => {
            isPreviewOngoing.current = false;
            if (
              isHotReloadNeeded(hotReloadSteps.current) &&
              lastPreviewContainer.current
            ) {
              switchToSceneEdition({
                ...lastPreviewContainer.current,
                shouldReloadProjectData: false,
                shouldReloadLibraries: false,
                shouldReloadResources: false,
                shouldHardReload: false,
                reasons: ['post-launch-preview'],
              });
            }
          });
        } else {
          logSwitchingInfo({
            editorId,
            sceneName,
            externalLayoutName,
            eventsBasedObjectType,
            eventsBasedObjectVariantName,
            reasons,
          });
          previewDebuggerServer
            .getExistingEmbeddedGameFrameDebuggerIds()
            .forEach(debuggerId => {
              previewDebuggerServer.sendMessage(debuggerId, {
                command: 'switchForInGameEdition',
                editorId,
                sceneName,
                externalLayoutName,
                eventsBasedObjectType,
                eventsBasedObjectVariantName,
                editorCamera3D: cameraStates.current.get(editorId),
              });
            });
          sendVisibleScreenArea('setVisibleScreenArea');
        }
      };
      onSwitchInGameEditorIfNoHotReloadIsNeeded = ({
        editorId,
        sceneName,
        externalLayoutName,
        eventsBasedObjectType,
        eventsBasedObjectVariantName,
      }: PreviewInGameEditorTarget) => {
        if (!previewDebuggerServer) return;
        if (!enabled) return;
        if (isHotReloadNeeded(hotReloadSteps.current)) {
          return;
        }
        lastPreviewContainer.current = {
          editorId,
          sceneName,
          externalLayoutName,
          eventsBasedObjectType,
          eventsBasedObjectVariantName,
        };
        logSwitchingInfo({
          editorId,
          sceneName,
          externalLayoutName,
          eventsBasedObjectType,
          eventsBasedObjectVariantName,
          reasons: ['switched-editor-and-no-hot-reload-is-needed'],
        });
        previewDebuggerServer
          .getExistingEmbeddedGameFrameDebuggerIds()
          .forEach(debuggerId => {
            previewDebuggerServer.sendMessage(debuggerId, {
              command: 'switchForInGameEdition',
              editorId,
              sceneName,
              externalLayoutName,
              eventsBasedObjectType,
              eventsBasedObjectVariantName,
              cameraState3D: cameraStates.current.get(editorId),
            });
          });
        sendVisibleScreenArea('setVisibleScreenArea');
      };
      onChangeViewPosition = (command: ChangeViewPositionCommand) => {
        sendVisibleScreenArea(command);
      };

      return () => {
        unregisterPreventGameFramePointerEvents();
      };
    },
    [
      previewDebuggerServer,
      previewIndexHtmlLocation,
      onLaunchPreviewForInGameEdition,
      enabled,
      sendVisibleScreenArea,
    ]
  );

  // A game loaded in the frame adds its whole memory to the one used by the editor.
  React.useEffect(
    () => {
      if (!previewIndexHtmlLocation) return undefined;

      return startNativeAppActivity('embedded-in-game-editor');
    },
    [previewIndexHtmlLocation]
  );

  // Register the iframe window in the debugger as soon as the iframe is shown.
  React.useEffect(() => {
    const iframe = iframeRef.current;
    const hasSomethingLoaded = !!previewIndexHtmlLocation;
    if (previewDebuggerServer && iframe && hasSomethingLoaded)
      previewDebuggerServer.registerEmbeddedGameFrame(iframe.contentWindow);
  });

  // Unregister the iframe window in the debugger when the EmbeddedGameFrame is unmounted
  // (or in the unlikely case the previewDebuggerServer is changed).
  React.useEffect(
    () => {
      const iframe = iframeRef.current;
      const previousPreviewDebuggerServer = previewDebuggerServer;
      return () => {
        if (previousPreviewDebuggerServer && iframe) {
          previousPreviewDebuggerServer.unregisterEmbeddedGameFrame(
            iframe.contentWindow
          );
        }
      };
    },
    [previewDebuggerServer]
  );

  const [isDraggedItem3D, setDraggedItem3D] = React.useState(false);
  const [isNativeFileDraggedOver, setNativeFileDraggedOver] = React.useState(
    false
  );
  const dropTargetRef = React.useRef<HTMLDivElement | null>(null);
  const nativeFileDragOverTimeoutId = React.useRef<?TimeoutID>(null);

  const hasImportableFileDragData = React.useCallback((event: any): boolean => {
    if (!on3DModelFilesDroppedInEmbeddedGameFrame) return false;

    const { dataTransfer } = event;
    if (!dataTransfer) return false;

    const dataTransferTypes = dataTransfer.types || [];
    return (
      Array.from(dataTransferTypes).includes('Files') ||
      hasProjectFileDragData(dataTransferTypes) ||
      get3DModelFilePathsFromDataTransfer(dataTransfer).length > 0
    );
  }, []);

  const isOverActiveEmbeddedGameFrameHole = React.useCallback(
    (event: DragEvent): boolean => {
      const embeddedGameFrameHoleRect = getActiveEmbeddedGameFrameHoleRect();
      if (!embeddedGameFrameHoleRect) return false;

      return (
        event.clientX >= embeddedGameFrameHoleRect.left &&
        event.clientX <= embeddedGameFrameHoleRect.right &&
        event.clientY >= embeddedGameFrameHoleRect.top &&
        event.clientY <= embeddedGameFrameHoleRect.bottom
      );
    },
    []
  );

  const clearNativeFileDragOverTimeout = React.useCallback(() => {
    if (nativeFileDragOverTimeoutId.current) {
      clearTimeout(nativeFileDragOverTimeoutId.current);
      nativeFileDragOverTimeoutId.current = null;
    }
  }, []);

  const showNativeFileDropTarget = React.useCallback(
    () => {
      clearNativeFileDragOverTimeout();
      setNativeFileDraggedOver(true);
      nativeFileDragOverTimeoutId.current = setTimeout(() => {
        setNativeFileDraggedOver(false);
        nativeFileDragOverTimeoutId.current = null;
      }, 150);
    },
    [clearNativeFileDragOverTimeout]
  );

  const keepNativeFileDropTargetVisible = React.useCallback(
    (event: any) => {
      if (!hasImportableFileDragData(event)) return;

      event.preventDefault();
      event.stopPropagation();

      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }

      showNativeFileDropTarget();
    },
    [hasImportableFileDragData, showNativeFileDropTarget]
  );

  const hideNativeFileDropTarget = React.useCallback(
    () => {
      clearNativeFileDragOverTimeout();
      setNativeFileDraggedOver(false);
    },
    [clearNativeFileDragOverTimeout]
  );

  const onNativeFileDrop = React.useCallback(
    (event: any) => {
      if (!hasImportableFileDragData(event)) return;

      event.preventDefault();
      event.stopPropagation();
      hideNativeFileDropTarget();

      if (!isOverActiveEmbeddedGameFrameHole(event)) {
        return;
      }

      const dropTarget = dropTargetRef.current;
      const on3DModelFilesDropped = on3DModelFilesDroppedInEmbeddedGameFrame;
      if (!dropTarget || !on3DModelFilesDropped) return;

      const modelFilePaths = get3DModelFilePathsFromDataTransfer(
        event.dataTransfer
      );
      if (!modelFilePaths.length) return;

      const dropTargetRect = dropTarget.getBoundingClientRect();
      Promise.resolve(
        on3DModelFilesDropped({
          modelFilePaths,
          x: event.clientX - dropTargetRect.left,
          y: event.clientY - dropTargetRect.top,
        })
      ).catch(error => {
        console.error('Unable to drop 3D model files in the 3D editor:', error);
      });
    },
    [
      hasImportableFileDragData,
      hideNativeFileDropTarget,
      isOverActiveEmbeddedGameFrameHole,
    ]
  );

  const toParentNativeFileDragEvent = React.useCallback((event: any): any => {
    const iframe = iframeRef.current;
    const iframeRect = iframe ? iframe.getBoundingClientRect() : null;

    return {
      dataTransfer: event.dataTransfer,
      clientX: event.clientX + (iframeRect ? iframeRect.left : 0),
      clientY: event.clientY + (iframeRect ? iframeRect.top : 0),
      preventDefault: () => event.preventDefault(),
      stopPropagation: () => event.stopPropagation(),
    };
  }, []);

  React.useEffect(
    () => {
      const onWindowDragEnter = (event: DragEvent) => {
        if (!getActiveEmbeddedGameFrameHoleRect()) return;
        if (!hasImportableFileDragData(event)) return;
        showNativeFileDropTarget();
      };
      const onWindowDragOver = (event: DragEvent) => {
        if (isOverActiveEmbeddedGameFrameHole(event)) {
          keepNativeFileDropTargetVisible(event);
          return;
        }
        if (!getActiveEmbeddedGameFrameHoleRect()) return;
        if (!hasImportableFileDragData(event)) return;
        showNativeFileDropTarget();
      };
      const onWindowDrop = (event: DragEvent) => {
        if (!isOverActiveEmbeddedGameFrameHole(event)) return;
        onNativeFileDrop(event);
      };

      window.addEventListener('dragenter', onWindowDragEnter);
      window.addEventListener('dragover', onWindowDragOver);
      window.addEventListener('drop', onWindowDrop);

      return () => {
        window.removeEventListener('dragenter', onWindowDragEnter);
        window.removeEventListener('dragover', onWindowDragOver);
        window.removeEventListener('drop', onWindowDrop);
      };
    },
    [
      hasImportableFileDragData,
      isOverActiveEmbeddedGameFrameHole,
      keepNativeFileDropTargetVisible,
      onNativeFileDrop,
      showNativeFileDropTarget,
    ]
  );

  React.useEffect(
    () => () => {
      clearNativeFileDragOverTimeout();
    },
    [clearNativeFileDragOverTimeout]
  );

  React.useEffect(
    () => {
      const iframe = iframeRef.current;
      if (!iframe) return;

      let registeredIframeWindow: any = null;
      const onIframeDragEnter = (event: any) => {
        const parentEvent = toParentNativeFileDragEvent(event);
        if (!hasImportableFileDragData(parentEvent)) return;

        parentEvent.preventDefault();
        parentEvent.stopPropagation();
        showNativeFileDropTarget();
      };
      const onIframeDragOver = (event: any) => {
        keepNativeFileDropTargetVisible(toParentNativeFileDragEvent(event));
      };
      const onIframeDrop = (event: any) => {
        onNativeFileDrop(toParentNativeFileDragEvent(event));
      };

      const unregisterIframeWindow = () => {
        if (!registeredIframeWindow) return;
        const iframeWindow = registeredIframeWindow;
        // Clear the reference first: reading properties on this WindowProxy can
        // throw once the iframe has navigated from the editor origin to the
        // file:// preview origin.
        registeredIframeWindow = null;
        safelyRemoveWindowEventListener(
          iframeWindow,
          'dragenter',
          onIframeDragEnter,
          true
        );
        safelyRemoveWindowEventListener(
          iframeWindow,
          'dragover',
          onIframeDragOver,
          true
        );
        safelyRemoveWindowEventListener(
          iframeWindow,
          'drop',
          onIframeDrop,
          true
        );
      };

      const registerIframeWindow = () => {
        unregisterIframeWindow();

        try {
          registeredIframeWindow = iframe.contentWindow;
          if (!registeredIframeWindow) return;
          registeredIframeWindow.addEventListener(
            'dragenter',
            onIframeDragEnter,
            true
          );
          registeredIframeWindow.addEventListener(
            'dragover',
            onIframeDragOver,
            true
          );
          registeredIframeWindow.addEventListener('drop', onIframeDrop, true);
        } catch (error) {
          registeredIframeWindow = null;
        }
      };

      iframe.addEventListener('load', registerIframeWindow);
      registerIframeWindow();

      return () => {
        iframe.removeEventListener('load', registerIframeWindow);
        unregisterIframeWindow();
      };
    },
    [
      hasImportableFileDragData,
      keepNativeFileDropTargetVisible,
      onNativeFileDrop,
      showNativeFileDropTarget,
      toParentNativeFileDragEvent,
    ]
  );

  const dragNewInstance = React.useCallback(
    ({
      monitor,
      dropped,
      isAltPressed,
    }: {
      monitor: DropTargetMonitor,
      dropped: boolean,
      isAltPressed: boolean,
    }) => {
      const dropTarget = dropTargetRef.current;
      if (!previewDebuggerServer || !dropTarget) return;

      const item = monitor.getItem();
      const name = item.name;
      if (!name) return;

      setDraggedItem3D(!!item.is3D);

      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const dropTargetRect = dropTarget.getBoundingClientRect();

      if (isCustomObjectDragItem(item)) {
        const onCustomObjectDropped = onCustomObjectDroppedInEmbeddedGameFrame;
        if (!dropped || !item.is3D || !onCustomObjectDropped) {
          return;
        }

        Promise.resolve(
          onCustomObjectDropped({
            customObjectDragItem: item,
            x: clientOffset.x - dropTargetRect.left,
            y: clientOffset.y - dropTargetRect.top,
          })
        ).catch(error => {
          console.error('Unable to drop the prefab in the 3D editor:', error);
        });
        return;
      }

      previewDebuggerServer
        .getExistingEmbeddedGameFrameDebuggerIds()
        .forEach(debuggerId => {
          previewDebuggerServer.sendMessage(debuggerId, {
            command: 'dragNewInstance',
            x: clientOffset.x - dropTargetRect.left,
            y: clientOffset.y - dropTargetRect.top,
            name,
            dropped,
            isAltPressed: keyboardShortcuts.current.shouldNotSnapToGrid(),
          });
        });
    },
    [previewDebuggerServer]
  );

  React.useEffect(
    () => {
      let hasSomeEmbeddedGameFrameHoleActive = false;

      const sendInGameEditorVisibleStatus = () => {
        if (previewDebuggerServer) {
          previewDebuggerServer
            .getExistingEmbeddedGameFrameDebuggerIds()
            .forEach(debuggerId => {
              previewDebuggerServer.sendMessage(debuggerId, {
                command: 'setVisibleStatus',
                visible:
                  !hasSomeDialogOpen.current &&
                  hasSomeEmbeddedGameFrameHoleActive,
              });
            });
        }
      };

      const unregisterDialogOpenCallback = registerOpenedDialogsCountCallback(
        ({ openedDialogsCount }) => {
          hasSomeDialogOpen.current = openedDialogsCount > 0;
          sendInGameEditorVisibleStatus();
        }
      );

      const unregisterEmbeddedGameFrameHoleActiveCallback = registerActiveEmbeddedGameFrameHoleCountCallback(
        ({ activeEmbeddedGameFrameHoleCount }) => {
          hasSomeEmbeddedGameFrameHoleActive =
            activeEmbeddedGameFrameHoleCount > 0;
          sendInGameEditorVisibleStatus();
        }
      );

      return () => {
        unregisterDialogOpenCallback();
        unregisterEmbeddedGameFrameHoleActiveCallback();
      };
    },
    [previewDebuggerServer]
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: 38 + 40, // Height of the tabs + toolbar.
        left: 0,
        right: 0,
        bottom: 0,
      }}
      onKeyDown={keyboardShortcuts.current.onKeyDown}
      onKeyUp={keyboardShortcuts.current.onKeyUp}
    >
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <iframe
          ref={iframeRef}
          title="Game Preview"
          src={previewIndexHtmlLocation}
          tabIndex={0}
          // Listened on the iframe itself and not on its container, so that the overlay
          // covering it (drop target, pointer events blocker) doesn't take the focus.
          onMouseOver={focusGameFrameOnHover}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 'none',
          }}
        />
        <DropTarget
          canDrop={(item, monitor) => {
            if (
              !monitor ||
              monitor.getItemType() !== projectManagerItemReactDndType
            ) {
              return true;
            }

            return (
              !!onCustomObjectDroppedInEmbeddedGameFrame &&
              isCustomObjectDragItem(item) &&
              !!item.is3D
            );
          }}
          // TODO: "isAltPressed" is hardcoded to false, but we should detect it instead.
          hover={monitor =>
            dragNewInstance({ monitor, dropped: false, isAltPressed: false })
          }
          drop={monitor =>
            dragNewInstance({ monitor, dropped: true, isAltPressed: false })
          }
        >
          {({ connectDropTarget, canDrop, isOver }) => {
            if (!isOver) {
              // TODO: Move these into a helper.
              if (previewDebuggerServer) {
                previewDebuggerServer
                  .getExistingEmbeddedGameFrameDebuggerIds()
                  .forEach(debuggerId => {
                    previewDebuggerServer.sendMessage(debuggerId, {
                      command: 'cancelDragNewInstance',
                    });
                  });
              }
            }

            return connectDropTarget(
              <div
                style={{
                  // Display the div that acts either as a drop target or as a "blocker"
                  // to avoid the iframe stealing drag/resize mouse/touch events.
                  display:
                    canDrop ||
                    isPointerEventsPrevented ||
                    isNativeFileDraggedOver
                      ? 'flex'
                      : 'none',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                id="embedded-game-frame-drop-target"
                ref={dropTargetRef}
                onDragEnter={keepNativeFileDropTargetVisible}
                onDragOver={keepNativeFileDropTargetVisible}
                onDrop={onNativeFileDrop}
              >
                {(canDrop || isNativeFileDraggedOver) && (
                  <div className={classes.hintText}>
                    {isNativeFileDraggedOver ? (
                      <Text color="inherit">
                        <Trans>Drop to add the 3D model to the scene</Trans>
                      </Text>
                    ) : isDraggedItem3D ? (
                      <Text color="inherit">
                        <Trans>Drag here to add to the scene</Trans>
                      </Text>
                    ) : (
                      <Text color="inherit">
                        <Trans>
                          2D objects can't be edited when in 3D mode
                        </Trans>
                      </Text>
                    )}
                  </div>
                )}
              </div>
            );
          }}
        </DropTarget>
      </div>
    </div>
  );
};
