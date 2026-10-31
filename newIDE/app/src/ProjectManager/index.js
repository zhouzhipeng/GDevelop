// @flow
import { Trans } from '@lingui/macro';
import { I18n } from '@lingui/react';
import { type I18n as I18nType } from '@lingui/core';
import { t } from '@lingui/macro';

import * as React from 'react';
import CompactSearchBar, {
  type CompactSearchBarInterface,
} from '../UI/CompactSearchBar';
import GlobalVariablesDialog from '../VariablesList/GlobalVariablesDialog';
import ProjectPropertiesDialog from './ProjectPropertiesDialog';
import ProjectExtensionsDialog from './ProjectExtensionsDialog';
import CreateEventsFunctionExtensionItemDialog, {
  type ExtensionItemKind,
  type CreateExtensionItemPayload,
} from './CreateEventsFunctionExtensionItemDialog';
import ExtensionFunctionSelectorDialog from '../EventsFunctionsExtensionEditor/ExtensionFunctionSelectorDialog';
import CreateSceneDialog from './CreateSceneDialog';
import CreateExternalDialog, {
  type CreateExternalPayload,
} from './CreateExternalDialog';
import ProjectItemUsageDialog from './ProjectItemUsageDialog';
import { type ProjectItemUsageTarget } from './ProjectItemUsageFinder';
import ProjectGlobalsDialog from './ProjectGlobalsDialog';
import ProjectSceneObjectsDialog from './ProjectSceneObjectsDialog';
import newNameGenerator from '../Utils/NewNameGenerator';
import ExtensionsSearchDialog from '../AssetStore/ExtensionStore/ExtensionsSearchDialog';
import ScenePropertiesDialog from '../SceneEditor/ScenePropertiesDialog';
import SceneVariablesDialog from '../VariablesList/SceneVariablesDialog';
import { isExtensionNameTaken } from './EventFunctionExtensionNameVerifier';
import UnsavedChangesContext, {
  type UnsavedChanges,
} from '../MainFrame/UnsavedChangesContext';
import { type ObjectGroupsOutsideEditorChanges } from '../MainFrame/EditorContainers/BaseEditor';
import { type ObjectWithContext } from '../ObjectsList/EnumerateObjects';
import ProjectManagerCommands from './ProjectManagerCommands';
import { type HotReloadPreviewButtonProps } from '../HotReload/HotReloadPreviewButton';
import { type GamesList } from '../GameDashboard/UseGamesList';
import { type ResourceManagementProps } from '../ResourcesList/ResourceSource';
import InstalledExtensionDetails from './InstalledExtensionDetails';
import { addDefaultLightToAllLayers } from '../ProjectCreation/CreateProject';
import ErrorBoundary from '../UI/ErrorBoundary';
import useForceUpdate from '../Utils/UseForceUpdate';

import { AutoSizer } from 'react-virtualized';
import Background from '../UI/Background';
import TreeView, {
  type TreeViewInterface,
  type MenuButton,
} from '../UI/TreeView';
import PreferencesContext, {
  type Preferences,
} from '../MainFrame/Preferences/PreferencesContext';
import { Column, Line } from '../UI/Grid';
import Add from '../UI/CustomSvgIcons/Add';
import InAppTutorialContext from '../InAppTutorial/InAppTutorialContext';
import { mapFor } from '../Utils/MapFor';
import KeyboardShortcuts from '../UI/KeyboardShortcuts';
import { useResponsiveWindowSize } from '../UI/Responsive/ResponsiveWindowMeasurer';
import {
  SceneTreeViewItemContent,
  SceneObjectsTreeViewItemContent,
  SceneEventsTreeViewItemContent,
  getSceneTreeViewItemId,
  getSceneEventsTreeViewItemId,
  sceneFoldersKind,
  type SceneTreeViewItemProps,
  type SceneTreeViewItemCallbacks,
} from './SceneTreeViewItemContent';
import {
  ProjectItemFolderTreeViewItemContent,
  type ProjectItemFolderTreeViewItemProps,
} from './ProjectItemFolderTreeViewItemContent';
import {
  type ProjectItemFoldersKind,
  type ProjectItemFolderOrItem,
  addFolderIn,
  getFolderTreeViewItemId,
  getSelectionTopLevelItems,
  dropDescendantsOfRemovedFolders,
  getParentFolderTreeViewItemId,
  moveNewItemToFolder,
  getClosestVisibleParentId,
  getFoldersAscendanceWithoutRootFolder,
  syncLayoutsOrderWithFolders,
} from './ProjectItemFolders';
import {
  getExtensionTreeViewItemId,
  type ExtensionTreeViewItemCallbacks,
} from './ExtensionTreeViewItemContent';
import {
  ExternalEventsTreeViewItemContent,
  getExternalEventsTreeViewItemId,
  externalEventsFoldersKind,
  type ExternalEventsTreeViewItemProps,
  type ExternalEventsTreeViewItemCallbacks,
} from './ExternalEventsTreeViewItemContent';
import {
  ExternalLayoutTreeViewItemContent,
  getExternalLayoutTreeViewItemId,
  externalLayoutFoldersKind,
  type ExternalLayoutTreeViewItemProps,
  type ExternalLayoutTreeViewItemCallbacks,
} from './ExternalLayoutTreeViewItemContent';
import {
  CustomObjectTreeViewItemContent,
  CustomObjectVariantTreeViewItemContent,
  getCustomObjectTreeViewItemId,
  getCustomObjectVariantTreeViewItemId,
  type CustomObjectTreeViewItemProps,
  type CustomObjectTreeViewItemCallbacks,
} from './CustomObjectTreeViewItemContent';
import {
  BehaviorShortcutTreeViewItemContent,
  getBehaviorShortcutTreeViewItemId,
  type BehaviorShortcutTreeViewItemProps,
  type BehaviorShortcutTreeViewItemCallbacks,
} from './BehaviorShortcutTreeViewItemContent';
import {
  FunctionShortcutTreeViewItemContent,
  getFunctionShortcutTreeViewItemId,
  type FunctionShortcutTreeViewItemProps,
  type FunctionShortcutTreeViewItemCallbacks,
} from './FunctionShortcutTreeViewItemContent';
import {
  GameplayTestTreeViewItemContent,
  getGameplayTestTreeViewItemId,
  gameplayTestFoldersKind,
  type GameplayTestTreeViewItemProps,
  type GameplayTestTreeViewItemCallbacks,
} from './GameplayTestTreeViewItemContent';
import { DEFAULT_GAMEPLAY_TEST_SOURCE } from '../GameplayTests/DefaultGameplayTestSource';
import { type MenuItemTemplate } from '../UI/Menu/Menu.flow';
import useAlertDialog from '../UI/Alert/useAlertDialog';
import { type ShowConfirmDeleteDialogOptions } from '../UI/Alert/AlertContext';
import GDevelopThemeContext from '../UI/Theme/GDevelopThemeContext';
import { type GDevelopTheme } from '../UI/Theme';
import { ExtensionStoreContext } from '../AssetStore/ExtensionStore/ExtensionStoreContext';
import { type HTMLDataset } from '../Utils/HTMLDataset';
import {
  type MainMenuCallbacks,
  type BuildMainMenuProps,
} from '../MainFrame/MainMenu';
import ProjectManagerMainMenu from './ProjectManagerMainMenu';
import EmptyMessage from '../UI/EmptyMessage';
import { ColumnStackLayout } from '../UI/Layout';
import { isMacLike } from '../Utils/Platform';
import optionalRequire from '../Utils/OptionalRequire';
import { useShouldAutofocusInput } from '../UI/Responsive/ScreenTypeMeasurer';
import { ProjectScopedContainersAccessor } from '../InstructionOrExpression/EventsScope';
import { enumerateFunctionsInFolder } from '../EventsFunctionsList/EnumerateFunctionFolderOrFunction';
import { type EventsFunctionCreationParameters } from '../EventsFunctionsList/EventsFunctionTreeViewItemContent';
import { projectManagerItemReactDndType } from './ProjectManagerItemDragAndDrop';
import EventsFunctionsExtensionsContext from '../EventsFunctionsExtensionsLoader/EventsFunctionsExtensionsContext';
import { createEventsFunctionExtensionItem } from './CreateEventsFunctionExtensionItem';
import { getGameRootTreeViewItemDescription } from './GameRootTreeViewItem';
import {
  enumerateExternalsByScene,
  type SceneExternals,
} from './EnumerateExternals';
import { useProjectItemsSelection } from './UseProjectItemsSelection';
import { getProjectItemFoldersKind } from './ProjectItemFoldersKinds';
import { useBulkProjectItemsOperations } from './UseBulkProjectItemsOperations';

const electron = optionalRequire('electron');

export const getProjectManagerItemId = (identifier: string): string =>
  `project-manager-tab-${identifier}`;

const projectRootFolderId = getProjectManagerItemId('project');
const gamePropertiesItemId = getProjectManagerItemId('game-properties');
const gameResourcesItemId = getProjectManagerItemId('game-resources');
const gameExtensionsItemId = getProjectManagerItemId('game-extensions');
export const globalVariablesItemId: string = getProjectManagerItemId(
  'global-variables'
);
const constantsItemId = getProjectManagerItemId('constants');
export const globalObjectsItemId: string = getProjectManagerItemId(
  'global-objects'
);
export const scenesRootFolderId: string = getProjectManagerItemId('scenes');
export const customObjectsRootFolderId: string = getProjectManagerItemId(
  'custom-objects'
);
export const behaviorsRootFolderId: string = getProjectManagerItemId(
  'behaviors'
);
export const functionsRootFolderId: string = getProjectManagerItemId(
  'functions'
);
export const extensionsRootFolderId: string = getProjectManagerItemId(
  'extensions'
);
export const externalsRootFolderId: string = getProjectManagerItemId(
  'externals'
);
export const externalEventsRootFolderId: string = getProjectManagerItemId(
  'external-events'
);
export const externalLayoutsRootFolderId: string = getProjectManagerItemId(
  'external-layout'
);
export const gameplayTestsRootFolderId: string = getProjectManagerItemId(
  'gameplay-tests'
);

const scenesEmptyPlaceholderId = 'scenes-placeholder';
const customObjectsEmptyPlaceholderId = 'custom-objects-placeholder';
const behaviorsEmptyPlaceholderId = 'behaviors-placeholder';
const functionsEmptyPlaceholderId = 'functions-placeholder';
const externalsEmptyPlaceholderId = 'externals-placeholder';

export const getSceneExternalsTreeViewItemId = (scene: gdLayout): string =>
  `scene-externals-${scene.ptr}`;

const getProjectManagerShortcutExtensionLabelId = (
  rootFolderId: string,
  eventsFunctionsExtension: gdEventsFunctionsExtension
): string => `${rootFolderId}-extension-${eventsFunctionsExtension.ptr}`;

/**
 * Given the currently focused editor tab (its kind and the name of the
 * layout/external layout/external events/extension/custom object it edits),
 * returns the id of the matching item in the project manager tree view, or null
 * if there is no corresponding item. This is used to highlight and scroll to
 * the item matching the focused page when the project manager is opened.
 *
 * `editorKind` and `projectItemName` come from the EditorTab and are kept as
 * plain values (rather than importing the EditorKind type) to avoid pulling
 * editor containers into the project manager module.
 */
export const getProjectManagerTreeViewItemIdForEditorTab = (
  project: ?gdProject,
  editorKind: ?string,
  projectItemName: ?string
): ?string => {
  if (!project || !editorKind) return null;

  switch (editorKind) {
    case 'resources':
      return gameResourcesItemId;
    case 'constants':
      return constantsItemId;
    case 'layout':
      return projectItemName && project.hasLayoutNamed(projectItemName)
        ? getSceneTreeViewItemId(project.getLayout(projectItemName))
        : null;
    case 'layout events':
      return projectItemName && project.hasLayoutNamed(projectItemName)
        ? getSceneEventsTreeViewItemId(project.getLayout(projectItemName))
        : null;
    case 'external layout':
      return projectItemName && project.hasExternalLayoutNamed(projectItemName)
        ? getExternalLayoutTreeViewItemId(
            project.getExternalLayout(projectItemName)
          )
        : null;
    case 'external events':
      return projectItemName && project.hasExternalEventsNamed(projectItemName)
        ? getExternalEventsTreeViewItemId(
            project.getExternalEvents(projectItemName)
          )
        : null;
    case 'events functions extension':
      return projectItemName &&
        project.hasEventsFunctionsExtensionNamed(projectItemName)
        ? getExtensionTreeViewItemId(
            project.getEventsFunctionsExtension(projectItemName)
          )
        : null;
    case 'behavior detail': {
      // projectItemName is "extensionName::behaviorName".
      if (!projectItemName) return null;
      const [extensionName, behaviorName] = projectItemName.split('::');
      if (
        !extensionName ||
        !behaviorName ||
        !project.hasEventsFunctionsExtensionNamed(extensionName)
      ) {
        return null;
      }
      const eventsFunctionsExtension = project.getEventsFunctionsExtension(
        extensionName
      );
      const eventsBasedBehaviors = eventsFunctionsExtension.getEventsBasedBehaviors();
      if (!eventsBasedBehaviors.has(behaviorName)) return null;
      return getBehaviorShortcutTreeViewItemId(
        eventsFunctionsExtension,
        eventsBasedBehaviors.get(behaviorName)
      );
    }
    case 'function detail': {
      // projectItemName is "extensionName::functionName".
      if (!projectItemName) return null;
      const [extensionName, functionName] = projectItemName.split('::');
      if (
        !extensionName ||
        !functionName ||
        !project.hasEventsFunctionsExtensionNamed(extensionName)
      ) {
        return null;
      }
      const eventsFunctionsExtension = project.getEventsFunctionsExtension(
        extensionName
      );
      const eventsFunctions = eventsFunctionsExtension.getEventsFunctions();
      if (!eventsFunctions.hasEventsFunctionNamed(functionName)) return null;
      return getFunctionShortcutTreeViewItemId(
        eventsFunctionsExtension,
        eventsFunctions.getEventsFunction(functionName)
      );
    }
    case 'prefab detail': {
      // projectItemName is "extensionName::objectName".
      if (!projectItemName) return null;
      const [extensionName, objectName] = projectItemName.split('::');
      if (
        !extensionName ||
        !objectName ||
        !project.hasEventsFunctionsExtensionNamed(extensionName)
      ) {
        return null;
      }
      const eventsFunctionsExtension = project.getEventsFunctionsExtension(
        extensionName
      );
      const eventsBasedObjects = eventsFunctionsExtension.getEventsBasedObjects();
      if (!eventsBasedObjects.has(objectName)) return null;
      return getCustomObjectTreeViewItemId(
        eventsFunctionsExtension,
        eventsBasedObjects.get(objectName)
      );
    }
    case 'custom object': {
      // projectItemName is "extensionName::objectName[::variantName]".
      if (!projectItemName) return null;
      const [extensionName, objectName, variantName] = projectItemName.split(
        '::'
      );
      if (
        !extensionName ||
        !objectName ||
        !project.hasEventsFunctionsExtensionNamed(extensionName)
      ) {
        return null;
      }
      const eventsFunctionsExtension = project.getEventsFunctionsExtension(
        extensionName
      );
      const eventsBasedObjects = eventsFunctionsExtension.getEventsBasedObjects();
      if (!eventsBasedObjects.has(objectName)) return null;
      const eventsBasedObject = eventsBasedObjects.get(objectName);
      if (
        variantName &&
        eventsBasedObject.getVariants().hasVariantNamed(variantName)
      ) {
        return getCustomObjectVariantTreeViewItemId(
          eventsFunctionsExtension,
          eventsBasedObject,
          eventsBasedObject.getVariants().getVariant(variantName)
        );
      }
      return getCustomObjectTreeViewItemId(
        eventsFunctionsExtension,
        eventsBasedObject
      );
    }
    default:
      return null;
  }
};
const gameplayTestsEmptyPlaceholderId = 'gameplay-tests-placeholder';

const styles = {
  listContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '0 8px 8px 8px',
  },
  autoSizerContainer: { flex: 1 },
  autoSizer: { width: '100%' },
};

const extensionItemReactDndType = projectManagerItemReactDndType;

const isProjectManagerShortcutRootId = (rootId: string): boolean =>
  rootId === customObjectsRootFolderId ||
  rootId === behaviorsRootFolderId ||
  rootId === functionsRootFolderId;

export interface TreeViewItemContent {
  getName(): string | React.Node;
  getId(): string;
  getHtmlId(index: number): ?string;
  getDataSet(): ?HTMLDataset;
  getThumbnail(): ?string;
  onClick(): void;
  buildMenuTemplate(i18n: I18nType, index: number): Array<MenuItemTemplate>;
  getRightButton(i18n: I18nType): ?MenuButton;
  renderRightComponent(i18n: I18nType): ?React.Node;
  rename(newName: string): void;
  edit(): void;
  delete(): void;
  copy(): void;
  paste(): void;
  cut(): void;
  getIndex(): number;
  moveAt(destinationIndex: number): void;
  // Only for the items organized in folders: the node holding the item.
  getFolderOrItem(): ?ProjectItemFolderOrItem;
  isDescendantOf(itemContent: TreeViewItemContent): boolean;
  getRootId(): string;
}

export interface TreeViewItem {
  isRoot?: boolean;
  isPlaceholder?: boolean;
  isLabel?: boolean;
  +content: TreeViewItemContent;
  getChildren(i18n: I18nType): ?Array<TreeViewItem>;
}

export type TreeItemProps = {|
  forceUpdate: () => void,
  forceUpdateList: () => void,
  unsavedChanges?: ?UnsavedChanges,
  preferences: Preferences,
  gdevelopTheme: GDevelopTheme,
  project: gdProject,
  editName: (itemId: string) => void,
  scrollToItem: (itemId: string) => void,
  openItems: (itemIds: Array<string>) => void,
  showDeleteConfirmation: (
    options: ShowConfirmDeleteDialogOptions
  ) => Promise<boolean>,
|};

class LeafTreeViewItem implements TreeViewItem {
  content: TreeViewItemContent;

  constructor(content: TreeViewItemContent) {
    this.content = content;
  }

  getChildren(i18n: I18nType): ?Array<TreeViewItem> {
    return null;
  }
}

class TreeViewItemWithChildren implements TreeViewItem {
  content: TreeViewItemContent;
  children: Array<TreeViewItem>;

  constructor(content: TreeViewItemContent, children: Array<TreeViewItem>) {
    this.content = content;
    this.children = children;
  }

  getChildren(i18n: I18nType): ?Array<TreeViewItem> {
    return this.children;
  }
}

// Scene links share the owning item's folder node but need distinct row IDs.
class ExternalLayoutShortcutTreeViewItemContent extends ExternalLayoutTreeViewItemContent {
  getId(): string {
    return `scene-shortcut-${super.getId()}`;
  }
}
class ExternalEventsShortcutTreeViewItemContent extends ExternalEventsTreeViewItemContent {
  getId(): string {
    return `scene-shortcut-${super.getId()}`;
  }
}

const makeExternalTreeViewItems = (
  sceneExternals: SceneExternals,
  externalLayoutTreeViewItemProps: ExternalLayoutTreeViewItemProps,
  externalEventsTreeViewItemProps: ExternalEventsTreeViewItemProps
): Array<TreeViewItem> => [
  ...sceneExternals.externalLayouts.map(
    externalLayout =>
      new LeafTreeViewItem(
        new ExternalLayoutShortcutTreeViewItemContent(
          externalLayout,
          externalLayoutTreeViewItemProps.project
            .getExternalLayoutsRootFolder()
            .getItemNamed(externalLayout.getName()),
          externalLayoutTreeViewItemProps
        )
      )
  ),
  ...sceneExternals.externalEvents.map(
    externalEvents =>
      new LeafTreeViewItem(
        new ExternalEventsShortcutTreeViewItemContent(
          externalEvents,
          externalEventsTreeViewItemProps.project
            .getExternalEventsRootFolder()
            .getItemNamed(externalEvents.getName()),
          externalEventsTreeViewItemProps
        )
      )
  ),
];

class FolderTreeViewItem implements TreeViewItem {
  content: TreeViewItemContent;
  getChildrenFunc: (i18n: I18nType) => ?Array<TreeViewItem>;

  constructor(
    content: TreeViewItemContent,
    getChildrenFunc: (i18n: I18nType) => ?Array<TreeViewItem>
  ) {
    this.content = content;
    this.getChildrenFunc = getChildrenFunc;
  }

  getChildren(i18n: I18nType): ?Array<TreeViewItem> {
    return this.getChildrenFunc(i18n);
  }
}

/**
 * Build the tree view items of the children of a folder of a folder structure
 * (folders and items, in the order they are stored).
 */
const buildFolderChildren = (
  folder: ProjectItemFolderOrItem,
  buildItemContent: (itemNode: ProjectItemFolderOrItem) => TreeViewItemContent,
  folderTreeViewItemProps: ProjectItemFolderTreeViewItemProps
): Array<TreeViewItem> =>
  mapFor(0, folder.getChildrenCount(), i => {
    const child = folder.getChildAt(i);
    if (child.isFolder()) {
      return new FolderTreeViewItem(
        new ProjectItemFolderTreeViewItemContent(
          child,
          folderTreeViewItemProps
        ),
        () =>
          buildFolderChildren(child, buildItemContent, folderTreeViewItemProps)
      );
    }
    return new LeafTreeViewItem(buildItemContent(child));
  });

/**
 * The children of the root of a section organized in folders, or its
 * placeholder when the section is empty.
 */
const buildFoldersSectionChildren = (
  emptyPlaceholder: TreeViewItem,
  buildItemContent: (itemNode: ProjectItemFolderOrItem) => TreeViewItemContent,
  folderTreeViewItemProps: ?ProjectItemFolderTreeViewItemProps
): Array<TreeViewItem> => {
  if (!folderTreeViewItemProps) return [];
  const rootFolder = folderTreeViewItemProps.kind.getRootFolder(
    folderTreeViewItemProps.project
  );
  if (rootFolder.getChildrenCount() === 0) return [emptyPlaceholder];
  return buildFolderChildren(
    rootFolder,
    buildItemContent,
    folderTreeViewItemProps
  );
};

/** The menu of the root of a section organized in folders. */
const buildAddItemOrFolderMenuTemplate = (
  kind: ProjectItemFoldersKind,
  addItem: (i18n: I18nType) => void,
  addNewFolder: (kind: ProjectItemFoldersKind) => void
) => (i18n: I18nType): Array<MenuItemTemplate> => [
  {
    label: i18n._(kind.addItemLabel),
    click: () => addItem(i18n),
  },
  {
    label: i18n._(t`Add a folder`),
    click: () => addNewFolder(kind),
  },
];

// $FlowFixMe[incompatible-type]
class PlaceHolderTreeViewItem implements TreeViewItem {
  isPlaceholder = true;
  content: TreeViewItemContent;

  constructor(id: string, label: string | React.Node) {
    this.content = new LabelTreeViewItemContent(id, label);
  }

  getChildren(i18n: I18nType): ?Array<TreeViewItem> {
    return null;
  }
}

class LabelTreeViewItemContent implements TreeViewItemContent {
  id: string;
  label: string | React.Node;
  dataSet: { [string]: string };
  buildMenuTemplateFunction: (
    i18n: I18nType,
    index: number
  ) => Array<MenuItemTemplate>;
  rightButton: ?MenuButton;

  constructor(
    id: string,
    label: string | React.Node,
    rightButton?: MenuButton,
    // When given, this replaces the menu built from the right button, for
    // roots offering more than the single action of their right button.
    buildMenuTemplateFunction?: (i18n: I18nType) => Array<MenuItemTemplate>
  ) {
    this.id = id;
    this.label = label;
    this.buildMenuTemplateFunction = (i18n: I18nType, index: number) => {
      if (buildMenuTemplateFunction) return buildMenuTemplateFunction(i18n);

      return rightButton
        ? [
            {
              id: rightButton.id,
              label: rightButton.label,
              click: rightButton.click,
            },
          ]
        : [];
    };
    this.rightButton = rightButton;
  }

  getName(): string | React.Node {
    return this.label;
  }

  getId(): string {
    return this.id;
  }

  getRightButton(i18n: I18nType): ?MenuButton {
    return this.rightButton;
  }

  getHtmlId(index: number): ?string {
    return this.id;
  }

  getDataSet(): ?HTMLDataset {
    return null;
  }

  getThumbnail(): ?string {
    return null;
  }

  onClick(): void {}

  // $FlowFixMe[missing-local-annot]
  buildMenuTemplate(i18n: I18nType, index: number) {
    return this.buildMenuTemplateFunction(i18n, index);
  }

  renderRightComponent(i18n: I18nType): ?React.Node {
    return null;
  }

  rename(newName: string): void {}

  edit(): void {}

  delete(): void {}

  copy(): void {}

  paste(): void {}

  cut(): void {}

  getIndex(): number {
    return 0;
  }

  moveAt(destinationIndex: number): void {}

  isDescendantOf(itemContent: TreeViewItemContent): boolean {
    return false;
  }

  getFolderOrItem(): ?ProjectItemFolderOrItem {
    return null;
  }

  getRootId(): string {
    return '';
  }
}

class ActionTreeViewItemContent implements TreeViewItemContent {
  id: string;
  label: string | React.Node;
  buildMenuTemplateFunction: (
    i18n: I18nType,
    index: number
  ) => Array<MenuItemTemplate>;
  thumbnail: ?string;
  onClickCallback: () => void;

  constructor(
    id: string,
    label: string | React.Node,
    onClickCallback: () => void,
    thumbnail?: string
  ) {
    this.id = id;
    this.label = label;
    this.onClickCallback = onClickCallback;
    this.thumbnail = thumbnail;
    this.buildMenuTemplateFunction = (i18n: I18nType, index: number) => [];
  }

  getName(): string | React.Node {
    return this.label;
  }

  getId(): string {
    return this.id;
  }

  getRightButton(i18n: I18nType): ?MenuButton {
    return null;
  }

  getEventsFunctionsContainer(): ?gdEventsFunctionsContainer {
    return null;
  }

  getHtmlId(index: number): ?string {
    return this.id;
  }

  getDataSet(): ?HTMLDataset {
    return null;
  }

  getThumbnail(): ?string {
    return this.thumbnail;
  }

  onClick(): void {
    this.onClickCallback();
  }

  // $FlowFixMe[missing-local-annot]
  buildMenuTemplate(i18n: I18nType, index: number) {
    return this.buildMenuTemplateFunction(i18n, index);
  }

  renderRightComponent(i18n: I18nType): ?React.Node {
    return null;
  }

  rename(newName: string): void {}

  edit(): void {}

  delete(): void {}

  copy(): void {}

  paste(): void {}

  cut(): void {}

  getIndex(): number {
    return 0;
  }

  moveAt(destinationIndex: number): void {}

  isDescendantOf(itemContent: TreeViewItemContent): boolean {
    return false;
  }

  getFolderOrItem(): ?ProjectItemFolderOrItem {
    return null;
  }

  getRootId(): string {
    return '';
  }
}

class ShortcutExtensionLabelTreeViewItemContent implements TreeViewItemContent {
  rootFolderId: string;
  eventsFunctionsExtension: gdEventsFunctionsExtension;
  itemNames: Array<string>;

  constructor(
    rootFolderId: string,
    eventsFunctionsExtension: gdEventsFunctionsExtension,
    itemNames: Array<string>
  ) {
    this.rootFolderId = rootFolderId;
    this.eventsFunctionsExtension = eventsFunctionsExtension;
    this.itemNames = itemNames;
  }

  getName(): string | React.Node {
    return this.eventsFunctionsExtension.getName();
  }

  getSearchText(): string {
    return [this.eventsFunctionsExtension.getName(), ...this.itemNames].join(
      ' '
    );
  }

  getId(): string {
    return getProjectManagerShortcutExtensionLabelId(
      this.rootFolderId,
      this.eventsFunctionsExtension
    );
  }

  getHtmlId(index: number): ?string {
    return `extension-group-item-${index}`;
  }

  getDataSet(): ?HTMLDataset {
    return {
      extension: this.eventsFunctionsExtension.getName(),
    };
  }

  getThumbnail(): ?string {
    return null;
  }

  onClick(): void {}

  // $FlowFixMe[missing-local-annot]
  buildMenuTemplate(i18n: I18nType, index: number) {
    return [];
  }

  getRightButton(i18n: I18nType): ?MenuButton {
    return null;
  }

  renderRightComponent(i18n: I18nType): ?React.Node {
    return null;
  }

  rename(newName: string): void {}

  edit(): void {}

  delete(): void {}

  copy(): void {}

  paste(): void {}

  cut(): void {}

  getIndex(): number {
    return 0;
  }

  moveAt(destinationIndex: number): void {}

  isDescendantOf(itemContent: TreeViewItemContent): boolean {
    return itemContent.getId() === this.rootFolderId;
  }

  getRootId(): string {
    return '';
  }
}

// Category labels are siblings of their items: they keep extension ownership
// visible without adding another collapsible level to the tree.
// $FlowFixMe[incompatible-type]
class ShortcutExtensionLabelTreeViewItem implements TreeViewItem {
  isPlaceholder = true;
  isLabel = true;
  content: TreeViewItemContent;

  constructor(
    rootFolderId: string,
    eventsFunctionsExtension: gdEventsFunctionsExtension,
    itemNames: Array<string>
  ) {
    this.content = new ShortcutExtensionLabelTreeViewItemContent(
      rootFolderId,
      eventsFunctionsExtension,
      itemNames
    );
  }

  getChildren(i18n: I18nType): ?Array<TreeViewItem> {
    return null;
  }
}

const getTreeViewItemName = (item: TreeViewItem) => item.content.getName();
const getTreeViewItemSearchText = (item: TreeViewItem): string => {
  const content: any = item.content;
  if (content.getSearchText) {
    return content.getSearchText();
  }
  const name = item.content.getName();
  return typeof name === 'string' ? name : '';
};
const getTreeViewItemId = (item: TreeViewItem) => item.content.getId();
const getTreeViewItemHtmlId = (item: TreeViewItem, index: number) =>
  item.content.getHtmlId(index);
const getTreeViewItemChildren = (i18n: I18nType) => (item: TreeViewItem) =>
  item.getChildren(i18n);
const getTreeViewItemThumbnail = (item: TreeViewItem) =>
  item.content.getThumbnail();
const getTreeViewItemDataSet = (item: TreeViewItem) =>
  item.content.getDataSet();
const buildMenuTemplate = (i18n: I18nType) => (
  item: TreeViewItem,
  index: number
) => item.content.buildMenuTemplate(i18n, index);
const renderTreeViewItemRightComponent = (i18n: I18nType) => (
  item: TreeViewItem
) => item.content.renderRightComponent(i18n);
const renameItem = (item: TreeViewItem, newName: string) => {
  item.content.rename(newName);
};
const onClickItem = (item: TreeViewItem) => {
  item.content.onClick();
};
const editItem = (item: TreeViewItem) => {
  item.content.edit();
};
const getTreeViewItemRightButton = (i18n: I18nType) => (item: TreeViewItem) =>
  item.content.getRightButton(i18n);

/**
 * Recursively search the tree for an item with the given id, collecting the
 * ids of its ancestors along the way (so they can be opened to make the item
 * visible). Returns null if no matching item is found.
 */
const findTreeViewItemById = (
  items: Array<TreeViewItem>,
  itemId: string,
  i18n: I18nType,
  ancestorIds: Array<string> = []
): ?{| item: TreeViewItem, ancestorIds: Array<string> |} => {
  for (const item of items) {
    if (item.content.getId() === itemId) {
      return { item, ancestorIds };
    }
    const children = item.getChildren(i18n);
    if (children) {
      const found = findTreeViewItemById(children, itemId, i18n, [
        ...ancestorIds,
        item.content.getId(),
      ]);
      if (found) return found;
    }
  }
  return null;
};

export type ProjectManagerCreateItemKind =
  | 'scene'
  | 'extension'
  | 'install-extension'
  | 'external'
  | ExtensionItemKind;

export type ProjectManagerInterface = {|
  forceUpdateList: () => void,
  focusSearchBar: () => void,
  openProjectVariables: () => void,
  selectAndScrollToItemFromId: (itemId: string) => void,
  activateItemFromId: (itemId: string) => void,
  createProjectItem: (itemKind: ProjectManagerCreateItemKind) => void,
|};

type Props = {|
  project: ?gdProject,
  onChangeProjectName: string => Promise<void>,
  onSaveProjectProperties: (options: { newName?: string }) => Promise<boolean>,
  ...SceneTreeViewItemCallbacks,
  ...ExtensionTreeViewItemCallbacks,
  ...ExternalEventsTreeViewItemCallbacks,
  ...ExternalLayoutTreeViewItemCallbacks,
  ...CustomObjectTreeViewItemCallbacks,
  ...BehaviorShortcutTreeViewItemCallbacks,
  ...FunctionShortcutTreeViewItemCallbacks,
  ...GameplayTestTreeViewItemCallbacks,
  onOpenResources: () => void,
  onOpenConstants: () => void,
  openBehaviorEvents: (extensionName: string, behaviorName: string) => void,
  onOpenEventBasedObjectEditor: (
    extensionName: string,
    eventsBasedObjectName: string
  ) => void,
  onOpenEventBasedObjectVariantEditor: (
    extensionName: string,
    eventsBasedObjectName: string,
    variantName: string
  ) => void,
  onGlobalObjectEdited: (object: gdObject) => void,
  onSceneObjectEdited: (
    scene: gdLayout,
    objectWithContext: ObjectWithContext
  ) => void,
  onReloadEventsFunctionsExtensions: () => void,
  isOpen: boolean,
  hotReloadPreviewButtonProps: HotReloadPreviewButtonProps,
  onEffectAdded: () => void,
  triggerHotReloadInGameEditorIfNeeded: () => void,
  onOpenHomePage: () => void,
  closeProjectManager: () => void,
  onWillInstallExtension: (extensionNames: Array<string>) => void,
  onExtensionInstalled: (extensionNames: Array<string>) => void,
  onSceneAdded: () => void,
  onExternalLayoutAdded: () => void,
  onObjectGroupsModifiedOutsideEditor: (
    changes: ObjectGroupsOutsideEditorChanges
  ) => void,
  onObjectListsModified: ({ isNewObjectTypeUsed: boolean }) => void,

  // Main menu
  mainMenuCallbacks: MainMenuCallbacks,
  buildMainMenuProps: BuildMainMenuProps,

  projectScopedContainersAccessor: ProjectScopedContainersAccessor | null,

  // For resources:
  resourceManagementProps: ResourceManagementProps,

  // Games
  gamesList: GamesList,
|};

const ProjectManager = React.forwardRef<Props, ProjectManagerInterface>(
  (
    {
      project,
      onChangeProjectName,
      onSaveProjectProperties,
      onDeleteLayouts,
      onDeleteExternalEventsList,
      onDeleteExternalLayouts,
      onDeleteEventsFunctionsExtension,
      onDeleteGameplayTests,
      onRenameLayout,
      onRenameExternalEvents,
      onRenameExternalLayout,
      onRenameEventsFunctionsExtension,
      onRenameGameplayTest,
      onOpenLayout,
      onOpenExternalEvents,
      onOpenExternalLayout,
      onOpenEventsFunctionsExtension,
      onOpenCustomObjectEditor,
      onOpenPrefabDetailEditor,
      onOpenPrefabSettings,
      onOpenBehaviorSettings,
      openBehaviorEvents,
      onOpenEventBasedObjectEditor,
      onOpenEventBasedObjectVariantEditor,
      onGlobalObjectEdited,
      onSceneObjectEdited,
      onRenamedEventsBasedObject,
      onDeletedEventsBasedObject,
      onRenamedEventsBasedObjectVariant,
      onDeletedEventsBasedObjectVariant,
      onEventsBasedObjectChildrenEdited,
      onEventBasedObjectTypeChanged,
      onOpenGameplayTest,
      onRunGameplayTest,
      onOpenResources,
      onOpenConstants,
      onReloadEventsFunctionsExtensions,
      isOpen,
      hotReloadPreviewButtonProps,
      onEffectAdded,
      triggerHotReloadInGameEditorIfNeeded,
      onWillInstallExtension,
      resourceManagementProps,
      projectScopedContainersAccessor,
      closeProjectManager,
      mainMenuCallbacks,
      buildMainMenuProps,
      onExtensionInstalled,
      onSceneAdded,
      onExternalLayoutAdded,
      onObjectGroupsModifiedOutsideEditor,
      onObjectListsModified,
    },
    ref
  ) => {
    const {
      selectedItems,
      setSelectedItems,
      getSelectedFolderOrItems,
      onCollapseItem,
    } = useProjectItemsSelection();
    const unsavedChanges = React.useContext(UnsavedChangesContext);
    const { triggerUnsavedChanges } = unsavedChanges;
    const preferences = React.useContext(PreferencesContext);
    const eventsFunctionsExtensionsState = React.useContext(
      EventsFunctionsExtensionsContext
    );
    const gdevelopTheme = React.useContext(GDevelopThemeContext);
    const { currentlyRunningInAppTutorial } = React.useContext(
      InAppTutorialContext
    );
    const treeViewRef = React.useRef<?TreeViewInterface<TreeViewItem>>(null);
    // Keep references to the latest i18n and tree data builder so imperative
    // methods (which run outside of the render's <I18n> render prop and before
    // getTreeViewData is declared) can traverse the tree.
    const i18nRef = React.useRef<?I18nType>(null);
    const getTreeViewDataRef = React.useRef<?(
      i18n: I18nType
    ) => Array<TreeViewItem>>(null);
    const forceUpdate = useForceUpdate();
    const { isMobile } = useResponsiveWindowSize();
    const { showDeleteConfirmation } = useAlertDialog();

    const forceUpdateList = React.useCallback(
      () => {
        // The folders may have been reorganized: the first scene of the list
        // is the one started when no first scene is set.
        if (project) syncLayoutsOrderWithFolders(project);
        forceUpdate();
        if (treeViewRef.current) treeViewRef.current.forceUpdateList();
      },
      [project, forceUpdate]
    );

    const [searchText, setSearchText] = React.useState('');
    const [
      usageTarget,
      setUsageTarget,
    ] = React.useState<?ProjectItemUsageTarget>(null);
    const onFindUsage = React.useCallback((target: ProjectItemUsageTarget) => {
      setUsageTarget(target);
    }, []);

    const scrollToItem = React.useCallback((itemId: string) => {
      if (treeViewRef.current) {
        treeViewRef.current.scrollToItemFromId(itemId);
      }
    }, []);
    const openItems = React.useCallback((itemIds: Array<string>) => {
      if (treeViewRef.current) {
        treeViewRef.current.openItems(itemIds);
      }
    }, []);

    const expandFolders = React.useCallback((folderIds: Array<string>) => {
      if (treeViewRef.current) {
        treeViewRef.current.openItems(folderIds);
      }
    }, []);

    const animateClosestVisibleParent = React.useCallback(
      (kind: ProjectItemFoldersKind, folderOrItem: ProjectItemFolderOrItem) => {
        const treeView = treeViewRef.current;
        if (!treeView) return;
        treeView.animateItemFromId(
          getClosestVisibleParentId(
            kind,
            treeView.areItemsOpenFromId,
            folderOrItem
          )
        );
      },
      []
    );

    const [
      projectPropertiesDialogOpen,
      setProjectPropertiesDialogOpen,
    ] = React.useState(false);
    const [
      projectPropertiesDialogInitialTab,
      setProjectPropertiesDialogInitialTab,
    ] = React.useState('properties');
    const openProjectProperties = React.useCallback(() => {
      setProjectPropertiesDialogOpen(true);
      setProjectPropertiesDialogInitialTab('properties');
    }, []);
    const openProjectLoadingScreen = React.useCallback(() => {
      setProjectPropertiesDialogOpen(true);
      setProjectPropertiesDialogInitialTab('loading-screen');
    }, []);
    const openProjectIcons = React.useCallback(() => {
      setProjectPropertiesDialogOpen(true);
      setProjectPropertiesDialogInitialTab('icons');
    }, []);
    const onProjectPropertiesApplied = React.useCallback(
      (options: { newName?: string }) => {
        triggerUnsavedChanges();

        if (options.newName) {
          onChangeProjectName(options.newName);
        }
        setProjectPropertiesDialogOpen(false);
      },
      [triggerUnsavedChanges, onChangeProjectName]
    );

    const [
      projectVariablesEditorOpen,
      setProjectVariablesEditorOpen,
    ] = React.useState(false);
    const openProjectVariables = React.useCallback(() => {
      setProjectVariablesEditorOpen(true);
    }, []);
    const [
      projectGlobalsDialogOpen,
      setProjectGlobalsDialogOpen,
    ] = React.useState(false);
    const openProjectGlobalsDialog = React.useCallback(() => {
      setProjectGlobalsDialogOpen(true);
    }, []);
    const [
      editedSceneObjectsLayout,
      setEditedSceneObjectsLayout,
    ] = React.useState<?gdLayout>(null);
    const openSceneObjectsDialog = React.useCallback((layout: gdLayout) => {
      setEditedSceneObjectsLayout(layout);
    }, []);

    const [
      editedPropertiesLayout,
      setEditedPropertiesLayout,
    ] = React.useState<?gdLayout>(null);
    const [
      editedVariablesLayout,
      setEditedVariablesLayout,
    ] = React.useState<?gdLayout>(null);
    const [
      createSceneDialogIndex,
      setCreateSceneDialogIndex,
    ] = React.useState<?number>(null);
    const onOpenLayoutProperties = React.useCallback((layout: ?gdLayout) => {
      setEditedPropertiesLayout(layout);
    }, []);
    const onOpenLayoutVariables = React.useCallback((layout: ?gdLayout) => {
      setEditedVariablesLayout(layout);
    }, []);

    const [
      extensionsSearchDialogOpen,
      setExtensionsSearchDialogOpen,
    ] = React.useState(false);
    const openSearchExtensionDialog = React.useCallback(() => {
      setExtensionsSearchDialogOpen(true);
    }, []);
    const [
      projectExtensionsDialogOpen,
      setProjectExtensionsDialogOpen,
    ] = React.useState(false);
    const openProjectExtensionsDialog = React.useCallback(() => {
      setProjectExtensionsDialogOpen(true);
    }, []);
    const [
      createExtensionItemKind,
      setCreateExtensionItemKind,
    ] = React.useState<?ExtensionItemKind>(null);
    const [
      extensionFunctionSelectorDialogOpen,
      setExtensionFunctionSelectorDialogOpen,
    ] = React.useState(false);
    const [
      createExtensionFunctionParameters,
      setCreateExtensionFunctionParameters,
    ] = React.useState<?EventsFunctionCreationParameters>(null);
    const closeCreateExtensionItemDialog = React.useCallback(() => {
      setCreateExtensionItemKind(null);
      setCreateExtensionFunctionParameters(null);
    }, []);
    const openCreateExtensionItemDialog = React.useCallback(
      (itemKind: ExtensionItemKind) => {
        setCreateExtensionFunctionParameters(null);
        if (itemKind === 'function') {
          setExtensionFunctionSelectorDialogOpen(true);
          return;
        }

        setCreateExtensionItemKind(itemKind);
      },
      []
    );
    const [
      createExternalDialogOpen,
      setCreateExternalDialogOpen,
    ] = React.useState(false);
    const [
      createExternalDialogInitialLayoutName,
      setCreateExternalDialogInitialLayoutName,
    ] = React.useState('');
    const createExternalFolderRef = React.useRef<?ProjectItemFolderOrItem>(
      null
    );
    const [
      createExternalDialogInitialKind,
      setCreateExternalDialogInitialKind,
    ] = React.useState<'external-layout' | 'external-events'>(
      'external-layout'
    );
    const openCreateExternalDialog = React.useCallback(
      (
        initialLayoutName?: string,
        folder?: ProjectItemFolderOrItem,
        kind?: 'external-layout' | 'external-events'
      ) => {
        createExternalFolderRef.current = folder || null;
        setCreateExternalDialogInitialKind(kind || 'external-layout');
        setCreateExternalDialogInitialLayoutName(initialLayoutName || '');
        setCreateExternalDialogOpen(true);
      },
      []
    );
    const [
      openedExtensionShortHeader,
      setOpenedExtensionShortHeader,
    ] = React.useState(null);
    const [openedExtensionName, setOpenedExtensionName] = React.useState(null);

    const searchBarRef = React.useRef<?CompactSearchBarInterface>(null);

    const selectAndScrollToTreeViewItemFromId = React.useCallback(
      (itemId: string): ?TreeViewItem => {
        const i18n = i18nRef.current;
        const getTreeViewData = getTreeViewDataRef.current;
        const treeView = treeViewRef.current;
        if (!i18n || !getTreeViewData || !treeView) return null;

        const found = findTreeViewItemById(getTreeViewData(i18n), itemId, i18n);
        if (!found) return null;

        // Open ancestor folders so the item is visible, then select and scroll
        // to it. Selecting the actual item (not just the id) keeps keyboard
        // shortcuts (rename, delete...) working on it.
        if (found.ancestorIds.length > 0) {
          treeView.openItems(found.ancestorIds);
        }
        setSelectedItems([found.item]);
        // Wait a few ms for the newly opened folders to render before scrolling.
        setTimeout(() => {
          if (treeViewRef.current) {
            treeViewRef.current.scrollToItemFromId(itemId, 'smart');
          }
        }, 100);

        return found.item;
      },
      [setSelectedItems]
    );

    const onProjectItemModified = React.useCallback(
      () => {
        forceUpdate();
        triggerUnsavedChanges();
      },
      [forceUpdate, triggerUnsavedChanges]
    );

    const editName = React.useCallback(
      (itemId: string) => {
        const treeView = treeViewRef.current;
        if (treeView) {
          if (isMobile) {
            // Position item at top of the screen to make sure it will be visible
            // once the keyboard is open.
            treeView.scrollToItemFromId(itemId, 'start');
          }
          treeView.renameItemFromId(itemId);
        }
      },
      [isMobile]
    );

    // The props of the folders of a kind are built with the tree, which needs
    // `onNewFolderCreated`: they are read from this ref to select a new folder.
    const getFolderTreeViewItemPropsRef = React.useRef<?(
      kind: ProjectItemFoldersKind
    ) => ?ProjectItemFolderTreeViewItemProps>(null);

    const onNewFolderCreated = React.useCallback(
      (kind: ProjectItemFoldersKind, newFolder: ProjectItemFolderOrItem) => {
        const getFolderTreeViewItemProps =
          getFolderTreeViewItemPropsRef.current;
        const folderTreeViewItemProps = getFolderTreeViewItemProps
          ? getFolderTreeViewItemProps(kind)
          : null;
        if (folderTreeViewItemProps) {
          setSelectedItems([
            new FolderTreeViewItem(
              new ProjectItemFolderTreeViewItemContent(
                newFolder,
                folderTreeViewItemProps
              ),
              () => []
            ),
          ]);
        }
        const itemsToOpen = getFoldersAscendanceWithoutRootFolder(
          newFolder
        ).map(folder => getFolderTreeViewItemId(kind, folder));
        itemsToOpen.push(kind.getRootId());
        expandFolders(itemsToOpen);

        editName(getFolderTreeViewItemId(kind, newFolder));
        forceUpdateList();
      },
      [expandFolders, editName, forceUpdateList, setSelectedItems]
    );

    /**
     * Move a newly added item in the folder it was added from (if any).
     */
    const placeNewItemInFolder = React.useCallback(
      (
        kind: ProjectItemFoldersKind,
        itemName: string,
        folder: ?ProjectItemFolderOrItem
      ) => {
        if (!project || !folder) return;

        moveNewItemToFolder(
          kind,
          project,
          itemName,
          folder,
          folder.getChildrenCount()
        );
        forceUpdateList();
        expandFolders([getParentFolderTreeViewItemId(kind, folder)]);
      },
      [project, forceUpdateList, expandFolders]
    );

    const addNewScene = React.useCallback(
      (index: number, sceneName: string, folder?: ProjectItemFolderOrItem) => {
        if (!project) return;

        const newScene = project.insertNewLayout(sceneName, index + 1);
        newScene.setName(sceneName);
        newScene.updateBehaviorsSharedData(project);
        addDefaultLightToAllLayers(newScene);

        onSceneAdded();

        onProjectItemModified();
        placeNewItemInFolder(sceneFoldersKind, sceneName, folder);

        const sceneItemId = getSceneTreeViewItemId(newScene);
        if (treeViewRef.current) {
          treeViewRef.current.openItems([sceneItemId, scenesRootFolderId]);
        }
        // Scroll to the new scene.
        // Ideally, we'd wait for the list to be updated to scroll, but
        // to simplify the code, we just wait a few ms for a new render
        // to be done.
        setTimeout(() => {
          scrollToItem(sceneItemId);
        }, 100); // A few ms is enough for a new render to be done.

        onOpenLayout(sceneName, {
          openEventsEditor: true,
          openSceneEditor: true,
          focusWhenOpened: 'scene',
        });
      },
      [
        onOpenLayout,
        project,
        onProjectItemModified,
        scrollToItem,
        onSceneAdded,
        placeNewItemInFolder,
      ]
    );

    const createSceneFolderRef = React.useRef<?ProjectItemFolderOrItem>(null);
    const openCreateSceneDialog = React.useCallback(
      (index: number, folder?: ProjectItemFolderOrItem) => {
        createSceneFolderRef.current = folder || null;
        setCreateSceneDialogIndex(index);
      },
      []
    );

    const closeCreateSceneDialog = React.useCallback(() => {
      setCreateSceneDialogIndex(null);
    }, []);

    const onCreateScene = React.useCallback(
      (sceneName: string) => {
        if (createSceneDialogIndex === null) return;

        addNewScene(
          createSceneDialogIndex,
          sceneName,
          createSceneFolderRef.current || undefined
        );
        setCreateSceneDialogIndex(null);
      },
      [addNewScene, createSceneDialogIndex]
    );

    const onCreateNewExtension = React.useCallback(
      (project: gdProject, i18n: I18nType) => {
        const newName = newNameGenerator(i18n._(t`UntitledExtension`), name =>
          isExtensionNameTaken(name, project)
        );
        const eventsFunctionsExtension = project.insertNewEventsFunctionsExtension(
          newName,
          project.getEventsFunctionsExtensionsCount()
        );
        setExtensionsSearchDialogOpen(false);
        onProjectItemModified();
        onOpenEventsFunctionsExtension(
          eventsFunctionsExtension.getName(),
          null,
          null,
          null
        );
      },
      [onOpenEventsFunctionsExtension, onProjectItemModified]
    );

    const onCreateExtensionItem = React.useCallback(
      (payload: CreateExtensionItemPayload) => {
        if (!project) return;

        closeCreateExtensionItemDialog();
        const createdItem = createEventsFunctionExtensionItem({
          project,
          payload,
          reloadExtensionMetadata:
            eventsFunctionsExtensionsState.reloadProjectEventsFunctionsExtensionMetadata,
        });
        const { eventsFunctionsExtension } = createdItem;

        if (createdItem.itemKind === 'prefab') {
          const { eventsBasedObject } = createdItem;
          onProjectItemModified();
          forceUpdateList();

          const itemId = getCustomObjectTreeViewItemId(
            eventsFunctionsExtension,
            eventsBasedObject
          );
          openItems([customObjectsRootFolderId, itemId]);
          setTimeout(() => scrollToItem(itemId), 100);
          onOpenCustomObjectEditor(
            eventsFunctionsExtension,
            eventsBasedObject,
            ''
          );
          return;
        }

        if (createdItem.itemKind === 'behavior') {
          const { eventsBasedBehavior } = createdItem;
          onProjectItemModified();
          forceUpdateList();

          const itemId = getBehaviorShortcutTreeViewItemId(
            eventsFunctionsExtension,
            eventsBasedBehavior
          );
          openItems([behaviorsRootFolderId]);
          setTimeout(() => scrollToItem(itemId), 100);
          onOpenEventsFunctionsExtension(
            eventsFunctionsExtension.getName(),
            null,
            eventsBasedBehavior.getName(),
            null
          );
          return;
        }

        const { eventsFunction } = createdItem;
        onProjectItemModified();
        forceUpdateList();

        const itemId = getFunctionShortcutTreeViewItemId(
          eventsFunctionsExtension,
          eventsFunction
        );
        openItems([functionsRootFolderId]);
        setTimeout(() => scrollToItem(itemId), 100);
        onOpenEventsFunctionsExtension(
          eventsFunctionsExtension.getName(),
          eventsFunction.getName(),
          null,
          null
        );
      },
      [
        forceUpdateList,
        onOpenCustomObjectEditor,
        onOpenEventsFunctionsExtension,
        onProjectItemModified,
        openItems,
        project,
        scrollToItem,
        closeCreateExtensionItemDialog,
        eventsFunctionsExtensionsState,
      ]
    );

    const { translatedExtensionShortHeadersByName } = React.useContext(
      ExtensionStoreContext
    );

    const onEditEventsFunctionExtensionOrSeeDetails = React.useCallback(
      (eventsFunctionsExtension: gdEventsFunctionsExtension) => {
        const name = eventsFunctionsExtension.getName();
        // If the extension is coming from the store, open its details.
        // If that's not the case, or if it cannot be found in the store, edit it directly.
        const originName = eventsFunctionsExtension.getOriginName();
        if (originName !== 'gdevelop-extension-store') {
          onOpenEventsFunctionsExtension(name);
          return;
        }
        const originIdentifier = eventsFunctionsExtension.getOriginIdentifier();
        const extensionShortHeader =
          translatedExtensionShortHeadersByName[originIdentifier];
        if (!extensionShortHeader) {
          console.warn(
            `This extension was downloaded from the store but its reference ${originIdentifier} couldn't be found in the store. Opening the extension in the editor...`
          );
          onOpenEventsFunctionsExtension(name);
          return;
        }
        // $FlowFixMe[incompatible-type]
        setOpenedExtensionShortHeader(extensionShortHeader);
        // $FlowFixMe[incompatible-type]
        setOpenedExtensionName(name);
      },
      [translatedExtensionShortHeadersByName, onOpenEventsFunctionsExtension]
    );

    const addExternalEvents = React.useCallback(
      (
        index: number,
        name: string,
        associatedLayoutName: string,
        folder?: ProjectItemFolderOrItem
      ) => {
        if (!project) return;

        const newExternalEvents = project.insertNewExternalEvents(
          name,
          index + 1
        );
        newExternalEvents.setAssociatedLayout(associatedLayoutName);
        onProjectItemModified();
        placeNewItemInFolder(externalEventsFoldersKind, name, folder);

        const externalEventsItemId = getExternalEventsTreeViewItemId(
          newExternalEvents
        );
        const treeView = treeViewRef.current;
        if (treeView) {
          const scene = project.getLayout(associatedLayoutName);
          treeView.openItems([
            scenesRootFolderId,
            getSceneTreeViewItemId(scene),
            getSceneExternalsTreeViewItemId(scene),
          ]);
        }
        // Scroll to the new behavior.
        // Ideally, we'd wait for the list to be updated to scroll, but
        // to simplify the code, we just wait a few ms for a new render
        // to be done.
        setTimeout(() => {
          scrollToItem(externalEventsItemId);
        }, 100); // A few ms is enough for a new render to be done.

        onOpenExternalEvents(newExternalEvents.getName());
      },
      [
        onOpenExternalEvents,
        project,
        onProjectItemModified,
        scrollToItem,
        placeNewItemInFolder,
      ]
    );

    const addGameplayTest = React.useCallback(
      (index: number, i18n: I18nType, folder?: ProjectItemFolderOrItem) => {
        if (!project) return;

        const newName = newNameGenerator(i18n._(t`Untitled test`), name =>
          project.getTests().hasTestNamed(name)
        );
        const newTest = project.getTests().insertNewTest(newName, index + 1);
        newTest.setSource(DEFAULT_GAMEPLAY_TEST_SOURCE);
        onProjectItemModified();
        placeNewItemInFolder(gameplayTestFoldersKind, newName, folder);

        const gameplayTestItemId = getGameplayTestTreeViewItemId(newTest);
        if (treeViewRef.current) {
          treeViewRef.current.openItems([
            gameplayTestItemId,
            gameplayTestsRootFolderId,
          ]);
        }
        // Scroll to the new test (after a new render was done).
        setTimeout(() => {
          scrollToItem(gameplayTestItemId);
        }, 100); // A few ms is enough for a new render to be done.

        // We focus it so the user can edit the name directly.
        editName(gameplayTestItemId);
      },
      [
        project,
        onProjectItemModified,
        editName,
        scrollToItem,
        placeNewItemInFolder,
      ]
    );

    const addExternalLayout = React.useCallback(
      (
        index: number,
        name: string,
        associatedLayoutName: string,
        folder?: ProjectItemFolderOrItem
      ) => {
        if (!project) return;

        const newExternalLayout = project.insertNewExternalLayout(
          name,
          index + 1
        );
        newExternalLayout.setAssociatedLayout(associatedLayoutName);

        onExternalLayoutAdded();

        onProjectItemModified();
        placeNewItemInFolder(externalLayoutFoldersKind, name, folder);

        const externalLayoutItemId = getExternalLayoutTreeViewItemId(
          newExternalLayout
        );
        const treeView = treeViewRef.current;
        if (treeView) {
          const scene = project.getLayout(associatedLayoutName);
          treeView.openItems([
            scenesRootFolderId,
            getSceneTreeViewItemId(scene),
            getSceneExternalsTreeViewItemId(scene),
          ]);
        }
        // Scroll to the new behavior.
        // Ideally, we'd wait for the list to be updated to scroll, but
        // to simplify the code, we just wait a few ms for a new render
        // to be done.
        setTimeout(() => {
          scrollToItem(externalLayoutItemId);
        }, 100); // A few ms is enough for a new render to be done.

        onOpenExternalLayout(newExternalLayout.getName());
      },
      [
        project,
        onProjectItemModified,
        onOpenExternalLayout,
        scrollToItem,
        onExternalLayoutAdded,
        placeNewItemInFolder,
      ]
    );

    const onCreateExternal = React.useCallback(
      (payload: CreateExternalPayload) => {
        if (!project) return;

        setCreateExternalDialogOpen(false);

        if (payload.kind === 'external-layout') {
          addExternalLayout(
            project.getExternalLayoutsCount() - 1,
            payload.name,
            payload.layoutName,
            createExternalFolderRef.current || undefined
          );
          return;
        }

        addExternalEvents(
          project.getExternalEventsCount() - 1,
          payload.name,
          payload.layoutName,
          createExternalFolderRef.current || undefined
        );
      },
      [addExternalEvents, addExternalLayout, project]
    );

    const createProjectItem = React.useCallback(
      (itemKind: ProjectManagerCreateItemKind) => {
        if (!project) return;

        if (itemKind === 'scene') {
          openCreateSceneDialog(project.getLayoutsCount() - 1);
          return;
        }

        if (itemKind === 'extension') {
          const i18n = i18nRef.current;
          if (!i18n) return;

          onCreateNewExtension(project, i18n);
          return;
        }

        if (itemKind === 'install-extension') {
          openSearchExtensionDialog();
          return;
        }

        if (itemKind === 'external') {
          openCreateExternalDialog();
          return;
        }

        openCreateExtensionItemDialog(itemKind);
      },
      [
        onCreateNewExtension,
        openCreateSceneDialog,
        openCreateExternalDialog,
        openCreateExtensionItemDialog,
        openSearchExtensionDialog,
        project,
      ]
    );

    React.useImperativeHandle(
      ref,
      () => ({
        forceUpdateList: () => {
          forceUpdate();
          if (treeViewRef.current) treeViewRef.current.forceUpdateList();
        },
        focusSearchBar: () => {
          if (searchBarRef.current) searchBarRef.current.focus();
        },
        openProjectVariables,
        selectAndScrollToItemFromId: (itemId: string) => {
          selectAndScrollToTreeViewItemFromId(itemId);
        },
        activateItemFromId: (itemId: string) => {
          const item = selectAndScrollToTreeViewItemFromId(itemId);
          if (item) item.content.onClick();
        },
        createProjectItem,
      }),
      [
        createProjectItem,
        forceUpdate,
        openProjectVariables,
        selectAndScrollToTreeViewItemFromId,
      ]
    );

    const onTreeModified = React.useCallback(
      (shouldForceUpdateList: boolean) => {
        triggerUnsavedChanges();

        if (shouldForceUpdateList) forceUpdateList();
        else forceUpdate();
      },
      [forceUpdate, forceUpdateList, triggerUnsavedChanges]
    );

    // Initialize keyboard shortcuts as empty.
    // onDelete callback is set outside because it deletes the selected
    // item (that is a props). As it is stored in a ref, the keyboard shortcut
    // instance does not update with selectedItems changes.
    const keyboardShortcutsRef = React.useRef<KeyboardShortcuts>(
      new KeyboardShortcuts({
        shortcutCallbacks: {},
      })
    );
    React.useEffect(
      () => {
        if (keyboardShortcutsRef.current) {
          keyboardShortcutsRef.current.setShortcutCallback('onRename', () => {
            if (selectedItems.length > 0) {
              editName(selectedItems[0].content.getId());
            }
          });
          keyboardShortcutsRef.current.setShortcutCallback('onPaste', () => {
            if (selectedItems.length > 0) {
              selectedItems[0].content.paste();
            }
          });
        }
      },
      [editName, selectedItems]
    );

    const sceneTreeViewItemProps = React.useMemo<?SceneTreeViewItemProps>(
      () =>
        project
          ? {
              project,
              unsavedChanges,
              preferences,
              gdevelopTheme,
              forceUpdate,
              forceUpdateList,
              showDeleteConfirmation,
              editName,
              scrollToItem,
              openItems,
              onSceneAdded,
              onDeleteLayouts,
              onRenameLayout,
              onOpenLayout,
              onOpenSceneObjects: openSceneObjectsDialog,
              onOpenLayoutProperties,
              onOpenLayoutVariables,
              openSceneVariables: onOpenLayoutVariables,
              onProjectItemModified,
              expandFolders,
              onMovedFolderOrItemToAnotherFolder: animateClosestVisibleParent,
              onNewFolderCreated,
            }
          : null,
      [
        project,
        unsavedChanges,
        preferences,
        gdevelopTheme,
        forceUpdate,
        forceUpdateList,
        showDeleteConfirmation,
        editName,
        scrollToItem,
        openItems,
        onSceneAdded,
        onDeleteLayouts,
        onRenameLayout,
        onOpenLayout,
        openSceneObjectsDialog,
        onOpenLayoutProperties,
        onOpenLayoutVariables,
        onProjectItemModified,
        expandFolders,
        animateClosestVisibleParent,
        onNewFolderCreated,
      ]
    );

    const folderTreeViewItemCommonProps = React.useMemo(
      () =>
        project
          ? {
              project,
              unsavedChanges,
              preferences,
              gdevelopTheme,
              forceUpdate,
              forceUpdateList,
              editName,
              scrollToItem,
              showDeleteConfirmation,
              onProjectItemModified,
              expandFolders,
              onMovedFolderOrItemToAnotherFolder: animateClosestVisibleParent,
              onNewFolderCreated,
              // A removed folder is destroyed: it must not stay selected, or
              // the shortcuts (paste...) would act on it.
              onFolderRemoved: () => setSelectedItems([]),
            }
          : null,
      [
        project,
        unsavedChanges,
        preferences,
        gdevelopTheme,
        forceUpdate,
        forceUpdateList,
        setSelectedItems,
        editName,
        scrollToItem,
        showDeleteConfirmation,
        onProjectItemModified,
        expandFolders,
        animateClosestVisibleParent,
        onNewFolderCreated,
      ]
    );

    const addNewFolder = React.useCallback(
      (kind: ProjectItemFoldersKind) => {
        if (!folderTreeViewItemCommonProps) return;

        addFolderIn(
          { ...folderTreeViewItemCommonProps, kind },
          kind.getRootFolder(folderTreeViewItemCommonProps.project)
        );
      },
      [folderTreeViewItemCommonProps]
    );

    const {
      bulkMoveToNewFolder,
      deleteSelection,
      copySelection,
      buildBulkMenuTemplate,
    } = useBulkProjectItemsOperations({
      project,
      selectedItems,
      setSelectedItems,
      getSelectedFolderOrItems,
      onDeleteLayouts,
      onDeleteExternalLayouts,
      onDeleteExternalEventsList,
      onDeleteGameplayTests,
      onProjectItemModified,
      forceUpdateList,
      animateClosestVisibleParent,
      onNewFolderCreated,
    });

    React.useEffect(
      () => {
        const keyboardShortcuts = keyboardShortcutsRef.current;
        keyboardShortcuts.setShortcutCallback(
          'onGroupInFolder',
          bulkMoveToNewFolder
        );
        keyboardShortcuts.setShortcutCallback('onDelete', deleteSelection);
        keyboardShortcuts.setShortcutCallback('onCopy', copySelection);
        keyboardShortcuts.setShortcutCallback('onCut', () => {
          copySelection();
          deleteSelection();
        });
      },
      [bulkMoveToNewFolder, deleteSelection, copySelection]
    );

    const buildContextMenuTemplate = React.useCallback(
      (i18n: I18nType) => (
        item: TreeViewItem,
        index: number
      ): Array<MenuItemTemplate> => {
        const isPartOfMultiSelection =
          selectedItems.length > 1 &&
          selectedItems.some(
            selected => selected.content.getId() === item.content.getId()
          );
        return isPartOfMultiSelection
          ? buildBulkMenuTemplate(i18n)
          : buildMenuTemplate(i18n)(item, index);
      },
      [selectedItems, buildBulkMenuTemplate]
    );

    const customObjectTreeViewItemProps = React.useMemo<?CustomObjectTreeViewItemProps>(
      () =>
        project
          ? {
              project,
              unsavedChanges,
              preferences,
              gdevelopTheme,
              forceUpdate,
              forceUpdateList,
              showDeleteConfirmation,
              editName,
              scrollToItem,
              openItems,
              onOpenCustomObjectEditor,
              onOpenPrefabDetailEditor,
              onOpenPrefabSettings,
              onRenamedEventsBasedObject,
              onDeletedEventsBasedObject,
              onRenamedEventsBasedObjectVariant,
              onDeletedEventsBasedObjectVariant,
              onEventsBasedObjectChildrenEdited,
              onEventBasedObjectTypeChanged,
              onObjectListsModified,
              onFindUsage,
            }
          : null,
      [
        project,
        unsavedChanges,
        preferences,
        gdevelopTheme,
        forceUpdate,
        forceUpdateList,
        showDeleteConfirmation,
        editName,
        scrollToItem,
        openItems,
        onOpenCustomObjectEditor,
        onOpenPrefabDetailEditor,
        onOpenPrefabSettings,
        onRenamedEventsBasedObject,
        onDeletedEventsBasedObject,
        onRenamedEventsBasedObjectVariant,
        onDeletedEventsBasedObjectVariant,
        onEventsBasedObjectChildrenEdited,
        onEventBasedObjectTypeChanged,
        onObjectListsModified,
        onFindUsage,
      ]
    );

    const behaviorShortcutTreeViewItemProps = React.useMemo<?BehaviorShortcutTreeViewItemProps>(
      () =>
        project
          ? {
              project,
              unsavedChanges,
              preferences,
              gdevelopTheme,
              forceUpdate,
              forceUpdateList,
              showDeleteConfirmation,
              editName,
              scrollToItem,
              openItems,
              onOpenEventsFunctionsExtension,
              onOpenBehaviorSettings,
              onFindUsage,
            }
          : null,
      [
        project,
        unsavedChanges,
        preferences,
        gdevelopTheme,
        forceUpdate,
        forceUpdateList,
        showDeleteConfirmation,
        editName,
        scrollToItem,
        openItems,
        onOpenEventsFunctionsExtension,
        onOpenBehaviorSettings,
        onFindUsage,
      ]
    );

    const functionShortcutTreeViewItemProps = React.useMemo<?FunctionShortcutTreeViewItemProps>(
      () =>
        project
          ? {
              project,
              unsavedChanges,
              preferences,
              gdevelopTheme,
              forceUpdate,
              forceUpdateList,
              showDeleteConfirmation,
              editName,
              scrollToItem,
              openItems,
              onOpenEventsFunctionsExtension,
              onFindUsage,
            }
          : null,
      [
        project,
        unsavedChanges,
        preferences,
        gdevelopTheme,
        forceUpdate,
        forceUpdateList,
        showDeleteConfirmation,
        editName,
        scrollToItem,
        openItems,
        onOpenEventsFunctionsExtension,
        onFindUsage,
      ]
    );

    const externalEventsTreeViewItemProps = React.useMemo<?ExternalEventsTreeViewItemProps>(
      () =>
        project
          ? {
              project,
              unsavedChanges,
              preferences,
              gdevelopTheme,
              forceUpdate,
              forceUpdateList,
              showDeleteConfirmation,
              editName,
              scrollToItem,
              openItems,
              expandFolders,
              onMovedFolderOrItemToAnotherFolder: animateClosestVisibleParent,
              onNewFolderCreated,
              onDeleteExternalEventsList,
              onRenameExternalEvents,
              onOpenExternalEvents,
              onFindUsage,
            }
          : null,
      [
        project,
        unsavedChanges,
        preferences,
        gdevelopTheme,
        forceUpdate,
        forceUpdateList,
        showDeleteConfirmation,
        editName,
        scrollToItem,
        openItems,
        expandFolders,
        animateClosestVisibleParent,
        onNewFolderCreated,
        onDeleteExternalEventsList,
        onRenameExternalEvents,
        onOpenExternalEvents,
        onFindUsage,
      ]
    );

    const externalLayoutTreeViewItemProps = React.useMemo<?ExternalLayoutTreeViewItemProps>(
      () =>
        project
          ? {
              project,
              unsavedChanges,
              preferences,
              gdevelopTheme,
              forceUpdate,
              forceUpdateList,
              showDeleteConfirmation,
              editName,
              scrollToItem,
              openItems,
              expandFolders,
              onMovedFolderOrItemToAnotherFolder: animateClosestVisibleParent,
              onNewFolderCreated,
              onExternalLayoutAdded,
              onDeleteExternalLayouts,
              onRenameExternalLayout,
              onOpenExternalLayout,
              onFindUsage,
            }
          : null,
      [
        project,
        unsavedChanges,
        preferences,
        gdevelopTheme,
        forceUpdate,
        forceUpdateList,
        showDeleteConfirmation,
        editName,
        scrollToItem,
        openItems,
        expandFolders,
        animateClosestVisibleParent,
        onNewFolderCreated,
        onExternalLayoutAdded,
        onDeleteExternalLayouts,
        onRenameExternalLayout,
        onOpenExternalLayout,
        onFindUsage,
      ]
    );

    const gameplayTestTreeViewItemProps = React.useMemo<?GameplayTestTreeViewItemProps>(
      () =>
        project
          ? {
              project,
              unsavedChanges,
              preferences,
              gdevelopTheme,
              forceUpdate,
              forceUpdateList,
              showDeleteConfirmation,
              editName,
              scrollToItem,
              expandFolders,
              onMovedFolderOrItemToAnotherFolder: animateClosestVisibleParent,
              onNewFolderCreated,
              onDeleteGameplayTests,
              onRenameGameplayTest,
              onOpenGameplayTest,
              onRunGameplayTest,
            }
          : null,
      [
        project,
        unsavedChanges,
        preferences,
        gdevelopTheme,
        forceUpdate,
        forceUpdateList,
        showDeleteConfirmation,
        editName,
        scrollToItem,
        expandFolders,
        animateClosestVisibleParent,
        onNewFolderCreated,
        onDeleteGameplayTests,
        onRenameGameplayTest,
        onOpenGameplayTest,
        onRunGameplayTest,
      ]
    );

    const getFolderTreeViewItemProps = React.useCallback(
      (kind: ProjectItemFoldersKind): ?ProjectItemFolderTreeViewItemProps => {
        if (!project || !folderTreeViewItemCommonProps) return null;
        if (kind === sceneFoldersKind) {
          return {
            ...folderTreeViewItemCommonProps,
            kind: sceneFoldersKind,
            addItemInFolder: (folder, i18n) =>
              openCreateSceneDialog(project.getLayoutsCount() - 1, folder),
            onItemsAdded: onSceneAdded,
            deleteItems: onDeleteLayouts,
          };
        }
        if (kind === externalEventsFoldersKind) {
          return {
            ...folderTreeViewItemCommonProps,
            kind: externalEventsFoldersKind,
            addItemInFolder: (folder, i18n) =>
              openCreateExternalDialog(
                project.getFirstLayout(),
                folder,
                'external-events'
              ),
            onItemsAdded: () => {},
            deleteItems: onDeleteExternalEventsList,
          };
        }
        if (kind === externalLayoutFoldersKind) {
          return {
            ...folderTreeViewItemCommonProps,
            kind: externalLayoutFoldersKind,
            addItemInFolder: (folder, i18n) =>
              openCreateExternalDialog(
                project.getFirstLayout(),
                folder,
                'external-layout'
              ),
            onItemsAdded: onExternalLayoutAdded,
            deleteItems: onDeleteExternalLayouts,
          };
        }
        if (kind === gameplayTestFoldersKind) {
          return {
            ...folderTreeViewItemCommonProps,
            kind: gameplayTestFoldersKind,
            addItemInFolder: (folder, i18n) =>
              addGameplayTest(
                project.getTests().getTestsCount() - 1,
                i18n,
                folder
              ),
            onItemsAdded: () => {},
            deleteItems: onDeleteGameplayTests,
          };
        }
        return null;
      },
      [
        project,
        folderTreeViewItemCommonProps,
        openCreateExternalDialog,
        openCreateSceneDialog,
        onSceneAdded,
        onDeleteLayouts,
        onDeleteExternalEventsList,
        onExternalLayoutAdded,
        onDeleteExternalLayouts,
        addGameplayTest,
        onDeleteGameplayTests,
      ]
    );
    getFolderTreeViewItemPropsRef.current = getFolderTreeViewItemProps;

    const getTreeViewData = React.useCallback(
      (i18n: I18nType): Array<TreeViewItem> => {
        const gameRootTreeViewItemDescription = getGameRootTreeViewItemDescription(
          i18n,
          mainMenuCallbacks.onCreateProject
        );
        const externalsByScene = project
          ? enumerateExternalsByScene(project)
          : null;
        const unlinkedExternalItems =
          externalsByScene &&
          externalLayoutTreeViewItemProps &&
          externalEventsTreeViewItemProps
            ? makeExternalTreeViewItems(
                externalsByScene.unlinkedExternals,
                externalLayoutTreeViewItemProps,
                externalEventsTreeViewItemProps
              )
            : [];

        const withSceneShortcuts = (
          items: Array<TreeViewItem>
        ): Array<TreeViewItem> =>
          items.map(item => {
            if (item instanceof FolderTreeViewItem) {
              return new FolderTreeViewItem(item.content, i18n =>
                withSceneShortcuts(item.getChildren(i18n) || [])
              );
            }
            if (
              !(item.content instanceof SceneTreeViewItemContent) ||
              !externalsByScene ||
              !sceneTreeViewItemProps ||
              !externalLayoutTreeViewItemProps ||
              !externalEventsTreeViewItemProps
            )
              return item;
            const scene = item.content.scene;
            const sceneExternals = externalsByScene.bySceneName.get(
              scene.getName()
            );
            const externalItems = sceneExternals
              ? makeExternalTreeViewItems(
                  sceneExternals,
                  externalLayoutTreeViewItemProps,
                  externalEventsTreeViewItemProps
                )
              : [];
            const externalId = getSceneExternalsTreeViewItemId(scene);
            return new TreeViewItemWithChildren(item.content, [
              new LeafTreeViewItem(
                new SceneObjectsTreeViewItemContent(
                  scene,
                  sceneTreeViewItemProps,
                  i18n._(t`Objects`)
                )
              ),
              new LeafTreeViewItem(
                new SceneEventsTreeViewItemContent(
                  scene,
                  sceneTreeViewItemProps,
                  i18n._(t`Events`)
                )
              ),
              new TreeViewItemWithChildren(
                new LabelTreeViewItemContent(externalId, i18n._(t`Externals`), {
                  icon: <Add />,
                  label: i18n._(t`Create external`),
                  click: () => openCreateExternalDialog(scene.getName()),
                  id: `create-external-button-${scene.ptr}`,
                }),
                externalItems.length
                  ? externalItems
                  : [
                      new PlaceHolderTreeViewItem(
                        `${externalId}-${externalsEmptyPlaceholderId}`,
                        i18n._(t`Start by creating an external.`)
                      ),
                    ]
              ),
            ]);
          });

        return !project ||
          !sceneTreeViewItemProps ||
          !customObjectTreeViewItemProps ||
          !behaviorShortcutTreeViewItemProps ||
          !functionShortcutTreeViewItemProps ||
          !folderTreeViewItemCommonProps ||
          !externalEventsTreeViewItemProps ||
          !externalLayoutTreeViewItemProps ||
          !externalsByScene ||
          !gameplayTestTreeViewItemProps
          ? []
          : [
              {
                isRoot: true,
                content: new LabelTreeViewItemContent(
                  projectRootFolderId,
                  gameRootTreeViewItemDescription.label,
                  gameRootTreeViewItemDescription.rightButton
                ),
                getChildren(i18n: I18nType): ?Array<TreeViewItem> {
                  return [
                    new LeafTreeViewItem(
                      new ActionTreeViewItemContent(
                        gamePropertiesItemId,
                        i18n._(t`Properties`),
                        openProjectProperties,
                        'res/icons_default/properties_black.svg'
                      )
                    ),
                    new LeafTreeViewItem(
                      new ActionTreeViewItemContent(
                        gameResourcesItemId,
                        i18n._(t`Resources`),
                        onOpenResources,
                        'res/icons_default/project_resources_black.svg'
                      )
                    ),
                    new LeafTreeViewItem(
                      new ActionTreeViewItemContent(
                        gameExtensionsItemId,
                        i18n._(t`Extensions`),
                        openProjectExtensionsDialog,
                        'res/functions/extension_black.svg'
                      )
                    ),
                    new LeafTreeViewItem(
                      new ActionTreeViewItemContent(
                        constantsItemId,
                        i18n._(t`Constants`),
                        onOpenConstants,
                        'res/icons_default/constants24_black.svg'
                      )
                    ),
                    new LeafTreeViewItem(
                      new ActionTreeViewItemContent(
                        globalObjectsItemId,
                        i18n._(t`Objects`),
                        openProjectGlobalsDialog,
                        'res/icons_default/global_object24_black.svg'
                      )
                    ),
                  ];
                },
              },
              {
                isRoot: true,
                content: new LabelTreeViewItemContent(
                  scenesRootFolderId,
                  i18n._(t`Scenes`),
                  {
                    icon: <Add />,
                    label: i18n._(t`Add a scene`),
                    click: () => {
                      // TODO Add after selected scene?
                      const index = project.getLayoutsCount() - 1;
                      openCreateSceneDialog(index);
                    },
                    id: 'add-new-scene-button',
                  },
                  buildAddItemOrFolderMenuTemplate(
                    sceneFoldersKind,
                    i18n =>
                      openCreateSceneDialog(project.getLayoutsCount() - 1),
                    addNewFolder
                  )
                ),
                getChildren(i18n: I18nType): ?Array<TreeViewItem> {
                  return withSceneShortcuts(
                    buildFoldersSectionChildren(
                      new PlaceHolderTreeViewItem(
                        scenesEmptyPlaceholderId,
                        i18n._(t`Start by adding a new scene.`)
                      ),
                      itemNode =>
                        new SceneTreeViewItemContent(
                          itemNode.getItem(),
                          itemNode,
                          sceneTreeViewItemProps
                        ),
                      getFolderTreeViewItemProps(sceneFoldersKind)
                    )
                  );
                },
              },
              ...(unlinkedExternalItems.length > 0
                ? [
                    {
                      isRoot: true,
                      content: new LabelTreeViewItemContent(
                        externalsRootFolderId,
                        i18n._(t`Unlinked externals`)
                      ),
                      getChildren(i18n: I18nType): ?Array<TreeViewItem> {
                        return unlinkedExternalItems;
                      },
                    },
                  ]
                : []),
              {
                isRoot: true,
                content: new LabelTreeViewItemContent(
                  customObjectsRootFolderId,
                  i18n._(t`Prefabs`),
                  {
                    icon: <Add />,
                    label: i18n._(t`Create`),
                    click: () => openCreateExtensionItemDialog('prefab'),
                    id: 'create-prefab-button',
                  }
                ),
                getChildren(i18n: I18nType): ?Array<TreeViewItem> {
                  const customObjectTreeItems: Array<TreeViewItem> = [];
                  const eventsFunctionsExtensionsCount = project.getEventsFunctionsExtensionsCount();
                  for (
                    let extensionIndex = 0;
                    extensionIndex < eventsFunctionsExtensionsCount;
                    extensionIndex++
                  ) {
                    const eventsFunctionsExtension = project.getEventsFunctionsExtensionAt(
                      extensionIndex
                    );
                    const customObjectItems: Array<TreeViewItem> = [];
                    const customObjectNames: Array<string> = [];
                    const eventsBasedObjects = eventsFunctionsExtension.getEventsBasedObjects();
                    const eventsBasedObjectsCount = eventsBasedObjects.size();
                    for (
                      let objectIndex = 0;
                      objectIndex < eventsBasedObjectsCount;
                      objectIndex++
                    ) {
                      const eventsBasedObject = eventsBasedObjects.at(
                        objectIndex
                      );
                      customObjectNames.push(eventsBasedObject.getName());
                      const variants = eventsBasedObject.getVariants();
                      const variantItems: Array<TreeViewItem> = [];
                      for (
                        let variantIndex = 0;
                        variantIndex < variants.getVariantsCount();
                        variantIndex++
                      ) {
                        const variant = variants.getVariantAt(variantIndex);
                        if (!variant.getName()) continue;
                        customObjectNames.push(variant.getName());

                        variantItems.push(
                          new LeafTreeViewItem(
                            new CustomObjectVariantTreeViewItemContent(
                              eventsFunctionsExtension,
                              eventsBasedObject,
                              variant,
                              customObjectTreeViewItemProps
                            )
                          )
                        );
                      }

                      const objectItemContent = new CustomObjectTreeViewItemContent(
                        eventsFunctionsExtension,
                        eventsBasedObject,
                        customObjectTreeViewItemProps
                      );
                      customObjectItems.push(
                        variantItems.length > 0
                          ? new TreeViewItemWithChildren(
                              objectItemContent,
                              variantItems
                            )
                          : new LeafTreeViewItem(objectItemContent)
                      );
                    }

                    if (customObjectItems.length > 0) {
                      customObjectTreeItems.push(
                        new ShortcutExtensionLabelTreeViewItem(
                          customObjectsRootFolderId,
                          eventsFunctionsExtension,
                          customObjectNames
                        ),
                        ...customObjectItems
                      );
                    }
                  }

                  if (customObjectTreeItems.length === 0) {
                    return [
                      new PlaceHolderTreeViewItem(
                        customObjectsEmptyPlaceholderId,
                        i18n._(t`Start by adding a new prefab in extension.`)
                      ),
                    ];
                  }

                  return customObjectTreeItems;
                },
              },
              {
                isRoot: true,
                content: new LabelTreeViewItemContent(
                  behaviorsRootFolderId,
                  i18n._(t`Behaviors`),
                  {
                    icon: <Add />,
                    label: i18n._(t`Create`),
                    click: () => openCreateExtensionItemDialog('behavior'),
                    id: 'create-behavior-button',
                  }
                ),
                getChildren(i18n: I18nType): ?Array<TreeViewItem> {
                  const behaviorTreeItems: Array<TreeViewItem> = [];
                  const eventsFunctionsExtensionsCount = project.getEventsFunctionsExtensionsCount();
                  for (
                    let extensionIndex = 0;
                    extensionIndex < eventsFunctionsExtensionsCount;
                    extensionIndex++
                  ) {
                    const eventsFunctionsExtension = project.getEventsFunctionsExtensionAt(
                      extensionIndex
                    );
                    const behaviorItems: Array<TreeViewItem> = [];
                    const behaviorNames: Array<string> = [];
                    const eventsBasedBehaviors = eventsFunctionsExtension.getEventsBasedBehaviors();
                    const eventsBasedBehaviorsCount = eventsBasedBehaviors.size();
                    for (
                      let behaviorIndex = 0;
                      behaviorIndex < eventsBasedBehaviorsCount;
                      behaviorIndex++
                    ) {
                      const eventsBasedBehavior = eventsBasedBehaviors.at(
                        behaviorIndex
                      );
                      behaviorNames.push(eventsBasedBehavior.getName());
                      behaviorItems.push(
                        new LeafTreeViewItem(
                          new BehaviorShortcutTreeViewItemContent(
                            eventsFunctionsExtension,
                            eventsBasedBehavior,
                            behaviorShortcutTreeViewItemProps
                          )
                        )
                      );
                    }

                    if (behaviorItems.length > 0) {
                      behaviorTreeItems.push(
                        new ShortcutExtensionLabelTreeViewItem(
                          behaviorsRootFolderId,
                          eventsFunctionsExtension,
                          behaviorNames
                        ),
                        ...behaviorItems
                      );
                    }
                  }

                  if (behaviorTreeItems.length === 0) {
                    return [
                      new PlaceHolderTreeViewItem(
                        behaviorsEmptyPlaceholderId,
                        i18n._(t`Start by adding a new behavior in extension.`)
                      ),
                    ];
                  }

                  return behaviorTreeItems;
                },
              },
              {
                isRoot: true,
                content: new LabelTreeViewItemContent(
                  functionsRootFolderId,
                  i18n._(t`Functions`),
                  {
                    icon: <Add />,
                    label: i18n._(t`Create`),
                    click: () => openCreateExtensionItemDialog('function'),
                    id: 'create-function-button',
                  }
                ),
                getChildren(i18n: I18nType): ?Array<TreeViewItem> {
                  const functionTreeItems: Array<TreeViewItem> = [];
                  const eventsFunctionsExtensionsCount = project.getEventsFunctionsExtensionsCount();
                  for (
                    let extensionIndex = 0;
                    extensionIndex < eventsFunctionsExtensionsCount;
                    extensionIndex++
                  ) {
                    const eventsFunctionsExtension = project.getEventsFunctionsExtensionAt(
                      extensionIndex
                    );
                    const functionItems: Array<TreeViewItem> = [];
                    const eventsFunctions = enumerateFunctionsInFolder(
                      eventsFunctionsExtension
                        .getEventsFunctions()
                        .getRootFolder()
                    );
                    for (
                      let functionIndex = 0;
                      functionIndex < eventsFunctions.length;
                      functionIndex++
                    ) {
                      functionItems.push(
                        new LeafTreeViewItem(
                          new FunctionShortcutTreeViewItemContent(
                            eventsFunctionsExtension,
                            eventsFunctions[functionIndex],
                            functionShortcutTreeViewItemProps
                          )
                        )
                      );
                    }

                    if (functionItems.length > 0) {
                      functionTreeItems.push(
                        new ShortcutExtensionLabelTreeViewItem(
                          functionsRootFolderId,
                          eventsFunctionsExtension,
                          eventsFunctions.map(eventsFunction =>
                            eventsFunction.getName()
                          )
                        ),
                        ...functionItems
                      );
                    }
                  }

                  if (functionTreeItems.length === 0) {
                    return [
                      new PlaceHolderTreeViewItem(
                        functionsEmptyPlaceholderId,
                        i18n._(t`Start by adding a new function in extension.`)
                      ),
                    ];
                  }

                  return functionTreeItems;
                },
              },
              {
                isRoot: true,
                content: new LabelTreeViewItemContent(
                  gameplayTestsRootFolderId,
                  i18n._(t`Tests`),
                  {
                    icon: <Add />,
                    label: i18n._(t`Add a gameplay test`),
                    click: () => {
                      const index = project.getTests().getTestsCount() - 1;
                      addGameplayTest(index, i18n);
                    },
                    id: 'add-new-gameplay-test-button',
                  },
                  buildAddItemOrFolderMenuTemplate(
                    gameplayTestFoldersKind,
                    i18n =>
                      addGameplayTest(
                        project.getTests().getTestsCount() - 1,
                        i18n
                      ),
                    addNewFolder
                  )
                ),
                getChildren(i18n: I18nType): ?Array<TreeViewItem> {
                  return buildFoldersSectionChildren(
                    new PlaceHolderTreeViewItem(
                      gameplayTestsEmptyPlaceholderId,
                      i18n._(t`Start by adding a new gameplay test.`)
                    ),
                    itemNode =>
                      new GameplayTestTreeViewItemContent(
                        itemNode.getItem(),
                        itemNode,
                        gameplayTestTreeViewItemProps
                      ),
                    getFolderTreeViewItemProps(gameplayTestFoldersKind)
                  );
                },
              },
            ];
      },
      [
        openCreateSceneDialog,
        addGameplayTest,
        behaviorShortcutTreeViewItemProps,
        customObjectTreeViewItemProps,
        externalEventsTreeViewItemProps,
        externalLayoutTreeViewItemProps,
        functionShortcutTreeViewItemProps,
        gameplayTestTreeViewItemProps,
        mainMenuCallbacks,
        onOpenConstants,
        onOpenResources,
        openCreateExternalDialog,
        openProjectExtensionsDialog,
        openProjectProperties,
        openCreateExtensionItemDialog,
        openProjectGlobalsDialog,
        project,
        sceneTreeViewItemProps,
        folderTreeViewItemCommonProps,
        getFolderTreeViewItemProps,
        addNewFolder,
      ]
    );
    // Expose the latest tree data builder to imperative methods.
    getTreeViewDataRef.current = getTreeViewData;

    const canMoveSelectionTo = React.useCallback(
      (destinationItem: TreeViewItem, where: 'before' | 'inside' | 'after') =>
        selectedItems.every(item => {
          const rootId = item.content.getRootId();
          return (
            !(item.content instanceof ExternalEventsTreeViewItemContent) &&
            // Project and game settings children `getRootId` return an empty string.
            rootId.length > 0 &&
            // Shortcut rows are not owning project items.
            !isProjectManagerShortcutRootId(rootId) &&
            rootId === destinationItem.content.getRootId() &&
            destinationItem.content !== item.content &&
            !destinationItem.content.isDescendantOf(item.content)
          );
        }),
      [selectedItems]
    );

    const moveMultipleSelectionTo = React.useCallback(
      (
        i18n: I18nType,
        destinationItem: TreeViewItem,
        where: 'before' | 'inside' | 'after'
      ) => {
        const topLevelSelectedItems = getSelectionTopLevelItems(
          selectedItems,
          setSelectedItems,
          item => item.content.getFolderOrItem()
        );
        if (topLevelSelectedItems.length === 0) return;

        const destinationFolderOrItem = destinationItem.content.getFolderOrItem();
        if (!destinationFolderOrItem) return;
        const kind = getProjectItemFoldersKind(
          destinationItem.content.getRootId()
        );
        if (!kind) return;

        const allSameSection = topLevelSelectedItems.every(
          item =>
            item.content.getRootId() === destinationItem.content.getRootId()
        );
        if (!allSameSection) return;

        // Do not move anything inside one of the selected folders (or into
        // itself).
        if (
          topLevelSelectedItems.some(
            item =>
              // Destination is a descendant of a selected folder.
              destinationItem.content.isDescendantOf(item.content) ||
              // Destination is the selected folder itself (isDescendantOf is
              // false for the node itself in C++, so we must check separately).
              destinationItem.content.getId() === item.content.getId()
          )
        ) {
          return;
        }

        let parent;
        if (where === 'inside' && destinationFolderOrItem.isFolder()) {
          parent = destinationFolderOrItem;
        } else {
          parent = destinationFolderOrItem.getParent();
        }

        let position =
          where === 'inside'
            ? 0
            : destinationItem.content.getIndex() + (where === 'after' ? 1 : 0);

        topLevelSelectedItems.forEach(item => {
          const folderOrItem = item.content.getFolderOrItem();
          if (!folderOrItem) return;
          const currentParent = folderOrItem.getParent();
          if (currentParent === parent) {
            const fromIndex = currentParent.getChildPosition(folderOrItem);
            let toIndex = position;
            if (toIndex > fromIndex) toIndex -= 1;
            currentParent.moveChild(fromIndex, toIndex);
            position = toIndex + 1;
          } else {
            currentParent.moveFolderOrItemToAnotherFolder(
              folderOrItem,
              parent,
              position
            );
            position += 1;
          }
        });

        animateClosestVisibleParent(kind, parent);
        onProjectItemModified();
        onTreeModified(true);
      },
      [
        selectedItems,
        setSelectedItems,
        onProjectItemModified,
        onTreeModified,
        animateClosestVisibleParent,
      ]
    );

    const moveSelectionTo = React.useCallback(
      (
        i18n: I18nType,
        destinationItem: TreeViewItem,
        where: 'before' | 'inside' | 'after'
      ) => {
        if (destinationItem.isRoot) {
          return;
        }
        if (selectedItems.length > 1) {
          moveMultipleSelectionTo(i18n, destinationItem, where);
          return;
        }
        if (selectedItems.length !== 1) {
          return;
        }
        const selectedItem = selectedItems[0];
        const selectedFolderOrItem = selectedItem.content.getFolderOrItem();
        if (!selectedFolderOrItem) {
          // Items not organized in folders (extensions) are only reordered.
          selectedItem.content.moveAt(
            destinationItem.content.getIndex() + (where === 'after' ? 1 : 0)
          );
          onTreeModified(true);
          return;
        }
        if (destinationItem.content.getId() === selectedItem.content.getId()) {
          return;
        }

        const destinationFolderOrItem = destinationItem.content.getFolderOrItem();
        if (!destinationFolderOrItem) {
          return;
        }
        const kind = getProjectItemFoldersKind(
          selectedItem.content.getRootId()
        );
        if (!kind) {
          return;
        }

        let parent;
        if (where === 'inside' && destinationFolderOrItem.isFolder()) {
          parent = destinationFolderOrItem;
        } else {
          parent = destinationFolderOrItem.getParent();
        }
        const selectedFolderOrItemParent = selectedFolderOrItem.getParent();
        if (parent === selectedFolderOrItemParent) {
          const fromIndex = selectedItem.content.getIndex();
          let toIndex = destinationItem.content.getIndex();
          if (toIndex > fromIndex) toIndex -= 1;
          if (where === 'after') toIndex += 1;
          selectedFolderOrItemParent.moveChild(fromIndex, toIndex);
        } else {
          if (destinationItem.content.isDescendantOf(selectedItem.content)) {
            return;
          }
          const position =
            where === 'inside'
              ? 0
              : destinationItem.content.getIndex() +
                (where === 'after' ? 1 : 0);
          selectedFolderOrItemParent.moveFolderOrItemToAnotherFolder(
            selectedFolderOrItem,
            parent,
            position
          );
          animateClosestVisibleParent(kind, parent);
        }
        onProjectItemModified();
        onTreeModified(true);
      },
      [
        onTreeModified,
        selectedItems,
        onProjectItemModified,
        moveMultipleSelectionTo,
        animateClosestVisibleParent,
      ]
    );

    // Force List component to be mounted again if project
    // has been changed. Avoid accessing to invalid objects that could
    // crash the app.
    const listKey = project ? project.ptr : 'no-project';
    const initiallyOpenedNodeIds = React.useMemo(
      () => {
        const nodeIds = [
          projectRootFolderId,
          scenesRootFolderId,
          externalsRootFolderId,
          customObjectsRootFolderId,
          behaviorsRootFolderId,
          functionsRootFolderId,
          gameplayTestsRootFolderId,
        ];

        if (!project) return nodeIds;

        const eventsFunctionsExtensionsCount = project.getEventsFunctionsExtensionsCount();
        for (
          let extensionIndex = 0;
          extensionIndex < eventsFunctionsExtensionsCount;
          extensionIndex++
        ) {
          const eventsFunctionsExtension = project.getEventsFunctionsExtensionAt(
            extensionIndex
          );
          const eventsBasedObjects = eventsFunctionsExtension.getEventsBasedObjects();
          const eventsBasedObjectsCount = eventsBasedObjects.size();
          for (
            let objectIndex = 0;
            objectIndex < eventsBasedObjectsCount;
            objectIndex++
          ) {
            const eventsBasedObject = eventsBasedObjects.at(objectIndex);
            if (eventsBasedObject.getVariants().getVariantsCount() > 0) {
              nodeIds.push(
                getCustomObjectTreeViewItemId(
                  eventsFunctionsExtension,
                  eventsBasedObject
                )
              );
            }
          }
        }

        return nodeIds;
      },
      [project]
    );

    const [
      selectedMainMenuItemIndices,
      setSelectedMainMenuItemIndices,
    ] = React.useState<Array<number>>([]);
    const isNavigatingInMainMenuItem = selectedMainMenuItemIndices.length > 0;
    const shouldHideMainMenu = isMacLike() && !!electron;

    // Unselect items when the project manager is closed.
    React.useEffect(
      () => {
        if (!isOpen) {
          setSearchText('');
          setSelectedItems([]);
          setSelectedMainMenuItemIndices([]);
        }
      },
      [isOpen, setSelectedItems]
    );

    return (
      <Background maxWidth>
        <ProjectManagerCommands
          project={project}
          onOpenProjectProperties={openProjectProperties}
          onOpenProjectLoadingScreen={openProjectLoadingScreen}
          onOpenProjectVariables={openProjectVariables}
          onOpenResourcesDialog={onOpenResources}
          onOpenPlatformSpecificAssetsDialog={openProjectIcons}
          onOpenSearchExtensionDialog={openSearchExtensionDialog}
        />
        <Line expand>
          <ColumnStackLayout noMargin expand>
            {!shouldHideMainMenu && (
              <ProjectManagerMainMenu
                project={project}
                mainMenuCallbacks={mainMenuCallbacks}
                buildMainMenuProps={buildMainMenuProps}
                selectedMainMenuItemIndices={selectedMainMenuItemIndices}
                setSelectedMainMenuItemIndices={setSelectedMainMenuItemIndices}
                closeDrawer={closeProjectManager}
              />
            )}
            {!isNavigatingInMainMenuItem && project && (
              <Line noMargin>
                <Column expand>
                  <CompactSearchBar
                    ref={searchBarRef}
                    value={searchText}
                    onChange={setSearchText}
                    placeholder={t`Search in project`}
                  />
                </Column>
              </Line>
            )}
            <I18n>
              {({ i18n }) => {
                // Capture the latest i18n so imperative methods can traverse
                // the tree outside of this render prop.
                i18nRef.current = i18n;
                return (
                  <>
                    {isNavigatingInMainMenuItem ? null : project ? (
                      <div
                        id="project-manager"
                        style={{
                          ...styles.listContainer,
                          ...styles.autoSizerContainer,
                        }}
                        onKeyDown={keyboardShortcutsRef.current.onKeyDown}
                        onKeyUp={keyboardShortcutsRef.current.onKeyUp}
                      >
                        <AutoSizer style={styles.autoSizer} disableWidth>
                          {({ height }) => (
                            // $FlowFixMe[incompatible-type]
                            // $FlowFixMe[incompatible-exact]
                            <TreeView
                              enableStickyAncestors
                              key={listKey}
                              ref={treeViewRef}
                              items={getTreeViewData(i18n)}
                              height={height}
                              forceAllOpened={!!currentlyRunningInAppTutorial}
                              searchText={searchText}
                              getItemName={getTreeViewItemName}
                              getItemSearchText={getTreeViewItemSearchText}
                              getItemThumbnail={getTreeViewItemThumbnail}
                              getItemChildren={getTreeViewItemChildren(i18n)}
                              multiSelect
                              getItemId={getTreeViewItemId}
                              getItemHtmlId={getTreeViewItemHtmlId}
                              getItemDataset={getTreeViewItemDataSet}
                              onEditItem={editItem}
                              onCollapseItem={onCollapseItem}
                              selectedItems={selectedItems}
                              onSelectItems={(items, removedItems) => {
                                const itemToSelect = items[0];
                                if (!itemToSelect) {
                                  setSelectedItems([]);
                                  return;
                                }
                                if (itemToSelect.isRoot) return;
                                // A selection stays in one section: a Ctrl+click
                                // or Shift+click range reaching another section
                                // does not extend it, like the objects list does
                                // with the global and scene objects.
                                const sectionRootId = itemToSelect.content.getRootId();
                                const sameSectionItems = items.filter(
                                  item =>
                                    item.content.getRootId() === sectionRootId
                                );
                                // When a folder is explicitly deselected
                                // (Ctrl+click), also drop its descendants that
                                // a previous range had added to the selection.
                                const removedFolderOrItems = (
                                  removedItems || []
                                )
                                  .map(item => item.content.getFolderOrItem())
                                  .filter(Boolean);
                                setSelectedItems(
                                  dropDescendantsOfRemovedFolders(
                                    removedFolderOrItems,
                                    sameSectionItems,
                                    item => item.content.getFolderOrItem()
                                  )
                                );
                              }}
                              onClickItem={onClickItem}
                              onRenameItem={renameItem}
                              buildMenuTemplate={buildContextMenuTemplate(i18n)}
                              getItemRightButton={getTreeViewItemRightButton(
                                i18n
                              )}
                              renderRightComponent={renderTreeViewItemRightComponent(
                                i18n
                              )}
                              onMoveSelectionToItem={(destinationItem, where) =>
                                moveSelectionTo(i18n, destinationItem, where)
                              }
                              canMoveSelectionToItem={canMoveSelectionTo}
                              reactDndType={extensionItemReactDndType}
                              initiallyOpenedNodeIds={initiallyOpenedNodeIds}
                              forceDefaultDraggingPreview
                              shouldHideMenuIcon={item =>
                                !item.content.getRootId()
                              }
                            />
                          )}
                        </AutoSizer>
                      </div>
                    ) : (
                      <EmptyMessage>
                        <Trans>To begin, open or create a new project.</Trans>
                      </EmptyMessage>
                    )}
                    {project && usageTarget && (
                      <ProjectItemUsageDialog
                        project={project}
                        target={usageTarget}
                        onClose={() => setUsageTarget(null)}
                      />
                    )}
                    {projectPropertiesDialogOpen &&
                      project &&
                      projectScopedContainersAccessor && (
                        <ProjectPropertiesDialog
                          open
                          // $FlowFixMe[incompatible-type]
                          initialTab={projectPropertiesDialogInitialTab}
                          project={project}
                          onClose={() => setProjectPropertiesDialogOpen(false)}
                          onApply={onSaveProjectProperties}
                          onPropertiesApplied={onProjectPropertiesApplied}
                          resourceManagementProps={resourceManagementProps}
                          projectScopedContainersAccessor={
                            projectScopedContainersAccessor
                          }
                          hotReloadPreviewButtonProps={
                            hotReloadPreviewButtonProps
                          }
                          i18n={i18n}
                        />
                      )}
                    {project && projectVariablesEditorOpen && (
                      <GlobalVariablesDialog
                        project={project}
                        open
                        onCancel={() => setProjectVariablesEditorOpen(false)}
                        onApply={() => {
                          triggerUnsavedChanges();
                          setProjectVariablesEditorOpen(false);
                        }}
                        hotReloadPreviewButtonProps={
                          hotReloadPreviewButtonProps
                        }
                        isListLocked={false}
                        initiallySelectedVariable={null}
                      />
                    )}
                    {project && projectGlobalsDialogOpen && (
                      <ProjectGlobalsDialog
                        project={project}
                        onChange={triggerUnsavedChanges}
                        onClose={() => setProjectGlobalsDialogOpen(false)}
                        resourceManagementProps={resourceManagementProps}
                        hotReloadPreviewButtonProps={
                          hotReloadPreviewButtonProps
                        }
                        openBehaviorEvents={openBehaviorEvents}
                        onWillInstallExtension={onWillInstallExtension}
                        onExtensionInstalled={onExtensionInstalled}
                        onOpenEventBasedObjectEditor={
                          onOpenEventBasedObjectEditor
                        }
                        onOpenEventBasedObjectVariantEditor={
                          onOpenEventBasedObjectVariantEditor
                        }
                        onDeleteEventsBasedObjectVariant={
                          onDeletedEventsBasedObjectVariant
                        }
                        onGlobalObjectEdited={onGlobalObjectEdited}
                        onEffectAdded={onEffectAdded}
                        onObjectGroupsModifiedOutsideEditor={
                          onObjectGroupsModifiedOutsideEditor
                        }
                        onObjectListsModified={onObjectListsModified}
                        triggerHotReloadInGameEditorIfNeeded={
                          triggerHotReloadInGameEditorIfNeeded
                        }
                      />
                    )}
                    {!!editedSceneObjectsLayout && project && (
                      <ProjectSceneObjectsDialog
                        project={project}
                        layout={editedSceneObjectsLayout}
                        onChange={triggerUnsavedChanges}
                        onClose={() => setEditedSceneObjectsLayout(null)}
                        resourceManagementProps={resourceManagementProps}
                        hotReloadPreviewButtonProps={
                          hotReloadPreviewButtonProps
                        }
                        openBehaviorEvents={openBehaviorEvents}
                        onWillInstallExtension={onWillInstallExtension}
                        onExtensionInstalled={onExtensionInstalled}
                        onOpenEventBasedObjectEditor={
                          onOpenEventBasedObjectEditor
                        }
                        onOpenEventBasedObjectVariantEditor={
                          onOpenEventBasedObjectVariantEditor
                        }
                        onDeleteEventsBasedObjectVariant={
                          onDeletedEventsBasedObjectVariant
                        }
                        onSceneObjectEdited={onSceneObjectEdited}
                        onEffectAdded={onEffectAdded}
                        onObjectGroupsModifiedOutsideEditor={
                          onObjectGroupsModifiedOutsideEditor
                        }
                        onObjectListsModified={onObjectListsModified}
                        triggerHotReloadInGameEditorIfNeeded={
                          triggerHotReloadInGameEditorIfNeeded
                        }
                      />
                    )}
                    {!!editedPropertiesLayout &&
                      project &&
                      projectScopedContainersAccessor && (
                        <ScenePropertiesDialog
                          open
                          layout={editedPropertiesLayout}
                          project={project}
                          onApply={() => {
                            triggerUnsavedChanges();
                            onOpenLayoutProperties(null);
                          }}
                          onClose={() => onOpenLayoutProperties(null)}
                          onEditVariables={() => {
                            onOpenLayoutVariables(editedPropertiesLayout);
                            onOpenLayoutProperties(null);
                          }}
                          resourceManagementProps={resourceManagementProps}
                          projectScopedContainersAccessor={
                            projectScopedContainersAccessor
                          }
                          onBackgroundColorChanged={() => {
                            // TODO This can probably wait the rework of scene properties.
                          }}
                        />
                      )}
                    {project && !!editedVariablesLayout && (
                      <SceneVariablesDialog
                        open
                        project={project}
                        layout={editedVariablesLayout}
                        onCancel={() => onOpenLayoutVariables(null)}
                        onApply={() => {
                          triggerUnsavedChanges();
                          onOpenLayoutVariables(null);
                        }}
                        hotReloadPreviewButtonProps={
                          hotReloadPreviewButtonProps
                        }
                        isListLocked={false}
                        initiallySelectedVariable={null}
                      />
                    )}
                    {project && projectExtensionsDialogOpen && (
                      <ProjectExtensionsDialog
                        project={project}
                        resourceManagementProps={resourceManagementProps}
                        onClose={() => setProjectExtensionsDialogOpen(false)}
                        onInstallExtension={() => {
                          setProjectExtensionsDialogOpen(false);
                          openSearchExtensionDialog();
                        }}
                        onExtensionPropertiesChanged={() => {
                          onProjectItemModified();
                          forceUpdateList();
                        }}
                        onShowExtensionStoreDetails={eventsFunctionsExtension => {
                          setProjectExtensionsDialogOpen(false);
                          onEditEventsFunctionExtensionOrSeeDetails(
                            eventsFunctionsExtension
                          );
                        }}
                        onDeleteEventsFunctionsExtension={async eventsFunctionsExtension => {
                          await onDeleteEventsFunctionsExtension(
                            eventsFunctionsExtension
                          );
                          forceUpdateList();
                        }}
                      />
                    )}
                    {project && extensionFunctionSelectorDialogOpen && (
                      <ExtensionFunctionSelectorDialog
                        onCancel={() => {
                          setExtensionFunctionSelectorDialogOpen(false);
                          setCreateExtensionFunctionParameters(null);
                        }}
                        onChoose={parameters => {
                          setExtensionFunctionSelectorDialogOpen(false);
                          setCreateExtensionFunctionParameters(parameters);
                          setCreateExtensionItemKind('function');
                        }}
                      />
                    )}
                    {project && createExtensionItemKind && (
                      <CreateEventsFunctionExtensionItemDialog
                        project={project}
                        itemKind={createExtensionItemKind}
                        initialFunctionName={
                          createExtensionItemKind === 'function' &&
                          createExtensionFunctionParameters
                            ? createExtensionFunctionParameters.name
                            : null
                        }
                        initialFunctionType={
                          createExtensionItemKind === 'function' &&
                          createExtensionFunctionParameters
                            ? createExtensionFunctionParameters.functionType
                            : undefined
                        }
                        isFunctionTypeDisabled={
                          createExtensionItemKind === 'function' &&
                          !!createExtensionFunctionParameters
                        }
                        onCancel={closeCreateExtensionItemDialog}
                        onCreate={onCreateExtensionItem}
                      />
                    )}
                    {project && createSceneDialogIndex !== null && (
                      <CreateSceneDialog
                        project={project}
                        onCancel={closeCreateSceneDialog}
                        onCreate={onCreateScene}
                      />
                    )}
                    {project && createExternalDialogOpen && (
                      <CreateExternalDialog
                        project={project}
                        initialKind={createExternalDialogInitialKind}
                        initialLayoutName={
                          createExternalDialogInitialLayoutName
                        }
                        onCancel={() => setCreateExternalDialogOpen(false)}
                        onCreate={onCreateExternal}
                      />
                    )}
                    {project && extensionsSearchDialogOpen && (
                      <ExtensionsSearchDialog
                        project={project}
                        onClose={() => setExtensionsSearchDialogOpen(false)}
                        onWillInstallExtension={onWillInstallExtension}
                        onCreateNewExtension={() => {
                          onCreateNewExtension(project, i18n);
                        }}
                        onExtensionInstalled={onExtensionInstalled}
                      />
                    )}
                    {project &&
                      openedExtensionShortHeader &&
                      openedExtensionName && (
                        <InstalledExtensionDetails
                          project={project}
                          onClose={() => {
                            setOpenedExtensionShortHeader(null);
                            setOpenedExtensionName(null);
                          }}
                          onOpenEventsFunctionsExtension={
                            onOpenEventsFunctionsExtension
                          }
                          extensionShortHeader={openedExtensionShortHeader}
                          extensionName={openedExtensionName}
                          onWillInstallExtension={onWillInstallExtension}
                          onExtensionInstalled={onExtensionInstalled}
                        />
                      )}
                  </>
                );
              }}
            </I18n>
          </ColumnStackLayout>
        </Line>
      </Background>
    );
  }
);

const arePropsEqual = (prevProps: Props, nextProps: Props): boolean =>
  // The component is costly to render, so avoid any re-rendering as much
  // as possible.
  // We make the assumption that no changes to the tree is made outside
  // from the component.
  // If a change is made, the component won't notice it: you have to manually
  // call forceUpdate.
  prevProps.isOpen === nextProps.isOpen && !nextProps.isOpen;

// $FlowFixMe[incompatible-type]
const MemoizedProjectManager = React.memo<Props, ProjectManagerInterface>(
  // $FlowFixMe[incompatible-type]
  // $FlowFixMe[incompatible-exact]
  ProjectManager,
  arePropsEqual
);

const ProjectManagerWithErrorBoundary: React.ComponentType<{
  ...Props,
  +ref?: React.RefSetter<ProjectManagerInterface>,
}> = React.forwardRef<Props, ProjectManagerInterface>((props, outerRef) => {
  const projectManagerRef = React.useRef<?ProjectManagerInterface>(null);
  const shouldAutofocusInput = useShouldAutofocusInput();

  React.useEffect(
    () => {
      const timeoutId = setTimeout(() => {
        if (props.isOpen && shouldAutofocusInput && projectManagerRef.current) {
          projectManagerRef.current.focusSearchBar();
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    },
    [props.isOpen, shouldAutofocusInput]
  );

  return (
    <ErrorBoundary
      componentTitle={<Trans>Project manager</Trans>}
      scope="project-manager"
    >
      {/* $FlowFixMe[incompatible-type] */}
      <MemoizedProjectManager
        // $FlowFixMe[missing-local-annot]
        ref={ref => {
          projectManagerRef.current = ref;
          if (typeof outerRef === 'function') outerRef(ref);
          // $FlowFixMe[incompatible-use]
          else if (outerRef !== null) outerRef.current = ref;
        }}
        {...props}
      />
    </ErrorBoundary>
  );
});

export default ProjectManagerWithErrorBoundary;
