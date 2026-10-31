// @flow
import { type I18n as I18nType } from '@lingui/core';
import { t } from '@lingui/macro';

import * as React from 'react';
import newNameGenerator from '../Utils/NewNameGenerator';
import {
  serializeToJSObject,
  unserializeFromJSObject,
} from '../Utils/Serializer';
import {
  type TreeViewItemContent,
  type TreeItemProps,
  scenesRootFolderId,
} from '.';
import Tooltip from '@material-ui/core/Tooltip';
import Flag from '@material-ui/icons/Flag';
import { type HTMLDataset } from '../Utils/HTMLDataset';
import { type OpenLayoutHandler } from '../MainFrame/EditorContainers/BaseEditor';

import { ProjectItemInFolder } from './ProjectItemInFolder';
import {
  type ProjectItemFoldersKind,
  type ProjectItemFolderOrItem,
  moveNewItemToFolder,
} from './ProjectItemFolders';

const styles = {
  tooltip: { marginRight: 5, verticalAlign: 'bottom' },
};

export type SceneTreeViewItemCallbacks = {|
  onSceneAdded: () => void,
  // Resolves to true once removed (after the user confirmed).
  onDeleteLayouts: (
    Array<gdLayout>,
    options?: {| folderName?: string |}
  ) => Promise<boolean>,
  onRenameLayout: (string, string) => void,
  onOpenLayout: OpenLayoutHandler,
|};

export type SceneTreeViewItemCommonProps = {|
  ...TreeItemProps,
  ...SceneTreeViewItemCallbacks,
|};

export type SceneTreeViewItemProps = {|
  ...SceneTreeViewItemCommonProps,
  project: gdProject,
  onOpenLayoutProperties: (layout: ?gdLayout) => void,
  onOpenLayoutVariables: (layout: ?gdLayout) => void,
  onOpenSceneObjects: (layout: gdLayout) => void,
  openSceneVariables: (layout: ?gdLayout) => void,
  onProjectItemModified: () => void,
  expandFolders: (folderIds: Array<string>) => void,
  onMovedFolderOrItemToAnotherFolder: (
    kind: ProjectItemFoldersKind,
    destinationFolder: ProjectItemFolderOrItem
  ) => void,
  onNewFolderCreated: (
    kind: ProjectItemFoldersKind,
    newFolder: ProjectItemFolderOrItem
  ) => void,
|};

export const getSceneTreeViewItemId = (scene: gdLayout): string => {
  // Pointers are used because they stay the same even when the names are
  // changed.
  return `scene-${scene.ptr}`;
};

export const getSceneEventsTreeViewItemId = (scene: gdLayout): string => {
  return `scene-events-${scene.ptr}`;
};

export const getSceneObjectsTreeViewItemId = (scene: gdLayout): string => {
  return `scene-objects-${scene.ptr}`;
};

export const sceneFoldersKind: ProjectItemFoldersKind = {
  name: 'scene',
  getRootId: () => scenesRootFolderId,
  getRootFolder: project => project.getLayoutsRootFolder(),
  hasItemNamed: (project, name) => project.hasLayoutNamed(name),
  getItemTreeViewItemId: getSceneTreeViewItemId,
  insertItemFromSerializedContent: (project, name, serializedLayout) => {
    const newLayout = project.insertNewLayout(name, project.getLayoutsCount());
    unserializeFromJSObject(
      newLayout,
      serializedLayout,
      'unserializeFrom',
      project
    );
    // Unserialization has overwritten the name.
    newLayout.setName(name);
    newLayout.updateBehaviorsSharedData(project);
    return newLayout;
  },
  legacyClipboard: { kind: 'Layout', itemProperty: 'layout' },
  addItemLabel: t`Add a scene`,
};

export class SceneTreeViewItemContent implements TreeViewItemContent {
  scene: gdLayout;
  // The node of the scenes folder structure holding this scene. Keeping it
  // avoids searching the whole tree every time the position of the scene or
  // its parent folder is needed.
  folderOrItem: ProjectItemFolderOrItem;
  inFolder: ProjectItemInFolder;
  props: SceneTreeViewItemProps;

  constructor(
    scene: gdLayout,
    folderOrItem: ProjectItemFolderOrItem,
    props: SceneTreeViewItemProps
  ) {
    this.scene = scene;
    this.folderOrItem = folderOrItem;
    this.inFolder = new ProjectItemInFolder(
      sceneFoldersKind,
      folderOrItem,
      props,
      () => props.onSceneAdded()
    );
    this.props = props;
  }

  getFolderOrItem(): ProjectItemFolderOrItem {
    return this.folderOrItem;
  }

  isDescendantOf(itemContent: TreeViewItemContent): boolean {
    return this.inFolder.isDescendantOf(itemContent);
  }

  getRootId(): string {
    return scenesRootFolderId;
  }

  getName(): string | React.Node {
    return this.scene.getName();
  }

  getId(): string {
    return getSceneTreeViewItemId(this.scene);
  }

  getHtmlId(index: number): ?string {
    return `scene-item-${index}`;
  }

  getDataSet(): ?HTMLDataset {
    return {
      scene: this.scene.getName(),
    };
  }

  getThumbnail(): ?string {
    return 'res/icons_default/scene_black.svg';
  }

  onClick(): void {
    this.props.onOpenLayout(this.scene.getName(), {
      openEventsEditor: true,
      openSceneEditor: true,
      focusWhenOpened: 'scene',
    });
  }

  rename(newName: string): void {
    const oldName = this.scene.getName();
    if (oldName === newName) {
      return;
    }
    this.props.onRenameLayout(oldName, newName);
    this.props.forceUpdateList();
  }

  edit(): void {
    this.props.editName(this.getId());
  }

  buildMenuTemplate(i18n: I18nType, index: number): any {
    return [
      {
        label: i18n._(t`Open scene editor`),
        enabled: true,
        click: () =>
          this.props.onOpenLayout(this.scene.getName(), {
            openSceneEditor: true,
            openEventsEditor: false,
            focusWhenOpened: 'scene',
          }),
      },
      {
        label: i18n._(t`Open events sheet`),
        enabled: true,
        click: () =>
          this.props.onOpenLayout(this.scene.getName(), {
            openSceneEditor: false,
            openEventsEditor: true,
            focusWhenOpened: 'events',
          }),
      },
      {
        type: 'separator',
      },
      {
        label: i18n._(t`Edit scene properties`),
        enabled: true,
        click: () => this.props.onOpenLayoutProperties(this.scene),
      },
      {
        label: i18n._(t`Edit scene variables`),
        enabled: true,
        click: () => this.props.onOpenLayoutVariables(this.scene),
      },
      {
        label: i18n._(t`Set as start scene`),
        enabled: !this._isFirstScene(),
        click: () => this._setProjectFirstScene(this.scene.getName()),
      },
      {
        type: 'separator',
      },
      this.inFolder.buildMoveToFolderMenuItem(i18n),
      {
        type: 'separator',
      },
      {
        label: i18n._(t`Rename`),
        click: () => this.edit(),
        accelerator: 'F2',
      },
      {
        label: i18n._(t`Delete`),
        click: () => this.delete(),
        accelerator: 'Backspace',
      },
      {
        type: 'separator',
      },
      {
        label: i18n._(t`Copy`),
        click: () => this.copy(),
        accelerator: 'CmdOrCtrl+C',
      },
      {
        label: i18n._(t`Cut`),
        click: () => this.cut(),
        accelerator: 'CmdOrCtrl+X',
      },
      this.inFolder.buildPasteMenuItem(i18n, () => this.paste()),
      {
        label: i18n._(t`Duplicate`),
        click: () => this._duplicate(),
      },
    ];
  }

  _isFirstScene(): boolean {
    return this.scene.getName() === this.props.project.getFirstLayout();
  }

  renderRightComponent(i18n: I18nType): ?React.Node {
    const icons = [];

    if (this._isFirstScene()) {
      icons.push(
        <Tooltip
          key="first-scene"
          title={i18n._(t`This scene will be used as the start scene.`)}
        >
          <Flag
            fontSize="small"
            style={{
              ...styles.tooltip,
              color: this.props.gdevelopTheme.text.color.disabled,
            }}
          />
        </Tooltip>
      );
    }
    return icons.length > 0 ? icons : null;
  }

  delete(): void {
    // Removing the layout from the project also removes it from the scenes
    // folder structure, so nothing else has to be done here.
    this.props.onDeleteLayouts([this.scene]);
  }

  getIndex(): number {
    return this.inFolder.getIndex();
  }

  // Moves are done by the project manager, on the folder structure.
  moveAt(destinationIndex: number): void {}

  copy(): void {
    this.inFolder.copy();
  }

  cut(): void {
    this.copy();
    this.delete();
  }

  paste(): void {
    this.inFolder.paste();
  }

  _duplicate(): void {
    const { project } = this.props;
    const newName = newNameGenerator(this.scene.getName(), name =>
      project.hasLayoutNamed(name)
    );

    const newScene = project.insertNewLayout(
      newName,
      project.getLayoutsCount()
    );
    moveNewItemToFolder(
      sceneFoldersKind,
      project,
      newName,
      this.folderOrItem.getParent(),
      this.getIndex() + 1
    );

    unserializeFromJSObject(
      newScene,
      serializeToJSObject(this.scene),
      'unserializeFrom',
      project
    );
    // Unserialization has overwritten the name.
    newScene.setName(newName);
    newScene.updateBehaviorsSharedData(project);

    this.inFolder.onFolderStructureModified();
    this.props.editName(getSceneTreeViewItemId(newScene));
    this.props.onSceneAdded();
  }

  getRightButton(i18n: I18nType): any {
    return null;
  }

  _setProjectFirstScene(sceneName: string): void {
    this.props.project.setFirstLayout(sceneName);
    this.props.forceUpdate();
  }
}

export class SceneObjectsTreeViewItemContent implements TreeViewItemContent {
  scene: gdLayout;
  props: SceneTreeViewItemProps;
  label: string;

  constructor(scene: gdLayout, props: SceneTreeViewItemProps, label: string) {
    this.scene = scene;
    this.props = props;
    this.label = label;
  }

  isDescendantOf(itemContent: TreeViewItemContent): boolean {
    const itemId = itemContent.getId();
    return (
      itemId === scenesRootFolderId ||
      itemId === getSceneTreeViewItemId(this.scene)
    );
  }

  getRootId(): string {
    return '';
  }

  getName(): string | React.Node {
    return this.label;
  }

  getId(): string {
    return getSceneObjectsTreeViewItemId(this.scene);
  }

  getHtmlId(index: number): ?string {
    return `scene-objects-item-${index}`;
  }

  getDataSet(): ?HTMLDataset {
    return {
      scene: this.scene.getName(),
      sceneObjects: this.scene.getName(),
    };
  }

  getThumbnail(): ?string {
    return 'res/functions/object_black.svg';
  }

  onClick(): void {
    this.props.onOpenSceneObjects(this.scene);
  }

  buildMenuTemplate(i18n: I18nType, index: number): any {
    return [
      {
        label: i18n._(t`Open objects and groups`),
        click: () => this.onClick(),
      },
    ];
  }

  renderRightComponent(i18n: I18nType): ?React.Node {
    return null;
  }

  getRightButton(i18n: I18nType): any {
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
}

export class SceneEventsTreeViewItemContent implements TreeViewItemContent {
  scene: gdLayout;
  props: SceneTreeViewItemProps;
  label: string;

  constructor(scene: gdLayout, props: SceneTreeViewItemProps, label: string) {
    this.scene = scene;
    this.props = props;
    this.label = label;
  }

  isDescendantOf(itemContent: TreeViewItemContent): boolean {
    const itemId = itemContent.getId();
    return (
      itemId === scenesRootFolderId ||
      itemId === getSceneTreeViewItemId(this.scene)
    );
  }

  getRootId(): string {
    return '';
  }

  getName(): string | React.Node {
    return this.label;
  }

  getId(): string {
    return getSceneEventsTreeViewItemId(this.scene);
  }

  getHtmlId(index: number): ?string {
    return `scene-events-item-${index}`;
  }

  getDataSet(): ?HTMLDataset {
    return {
      scene: this.scene.getName(),
      sceneEvents: this.scene.getName(),
    };
  }

  getThumbnail(): ?string {
    return 'res/icons_default/events_black.svg';
  }

  onClick(): void {
    this.props.onOpenLayout(this.scene.getName(), {
      openSceneEditor: false,
      openEventsEditor: true,
      focusWhenOpened: 'events',
    });
  }

  buildMenuTemplate(i18n: I18nType, index: number): any {
    return [
      {
        label: i18n._(t`Open events sheet`),
        click: () => this.onClick(),
      },
    ];
  }

  renderRightComponent(i18n: I18nType): ?React.Node {
    return null;
  }

  getRightButton(i18n: I18nType): any {
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
}
