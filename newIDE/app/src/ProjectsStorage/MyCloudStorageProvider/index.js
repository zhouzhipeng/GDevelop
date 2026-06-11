// @flow
import * as React from 'react';
import { t, Trans } from '@lingui/macro';
import { type StorageProvider } from '../index';
import { type MenuItemTemplate } from '../../UI/Menu/Menu.flow';
import { type MessageDescriptor } from '../../Utils/i18n/MessageDescriptor.flow';
import {
  type AppArguments,
  POSITIONAL_ARGUMENTS_KEY,
} from '../../Utils/Window';
import { onOpen, onEnsureCanAccessResources } from './MyCloudProjectOpener';
import {
  onSaveProject,
  generateOnSaveProjectAs,
  generateOnChooseSaveProjectAsLocation,
  onChangeProjectProperty,
  canFileMetadataBeSafelySaved,
  getWriteErrorMessage,
  getProjectLocation,
  renderNewProjectSaveAsLocationChooser,
} from './MyCloudProjectWriter';
import { openShareLink } from './MyCloudShare';
import {
  exportAndUploadPlayBuild,
  isPlayBuildExportSupported,
} from './MyCloudExport';
import { myCloudStorageProviderInternalName } from './MyCloudStorageProviderInternalName';
import Cloud from '../../UI/CustomSvgIcons/Cloud';

/**
 * Storage provider that stores and shares projects on a user's own self-hosted
 * "My Cloud" server (see newIDE/my-cloud-server). On the desktop app, a server
 * is embedded and runs on localhost out of the box; a remote server can be
 * configured in Preferences (URL + access token).
 *
 * Unlike the GDevelop "Cloud" provider, this does NOT require a GDevelop
 * account — it authenticates with its own shared access token.
 */
export default ({
  internalName: myCloudStorageProviderInternalName,
  name: t`My Cloud`,
  renderIcon: props => <Cloud fontSize={props.size} />,
  // No GDevelop account needed: this uses its own server + token.
  needUserAuthentication: false,
  hiddenInOpenDialog: true,
  getFileMetadataFromAppArguments: (appArguments: AppArguments) => {
    if (!appArguments[POSITIONAL_ARGUMENTS_KEY]) return null;
    if (!appArguments[POSITIONAL_ARGUMENTS_KEY].length) return null;
    return null;
  },
  getProjectLocation,
  renderNewProjectSaveAsLocationChooser,
  createOperations: ({ setDialog, closeDialog }) => ({
    onOpen,
    onEnsureCanAccessResources,
    onSaveProject,
    onChooseSaveProjectAsLocation: generateOnChooseSaveProjectAsLocation({
      setDialog,
      closeDialog,
    }),
    // $FlowFixMe[incompatible-type]
    onSaveProjectAs: generateOnSaveProjectAs(setDialog, closeDialog),
    onChangeProjectProperty,
    // $FlowFixMe[incompatible-type]
    canFileMetadataBeSafelySavedAs: canFileMetadataBeSafelySaved,
    getOpenErrorMessage: (error: Error): MessageDescriptor => {
      return t`An error occurred when opening the project from your cloud. Check that the server is reachable and that your access token is correct.`;
    },
    getWriteErrorMessage,
  }),
  // Right-click actions on resources: offer the public share link, and (on
  // desktop) publishing a playable build for the share page's Play button.
  // $FlowFixMe[incompatible-type]
  createResourceOperations: () => ({
    project,
    fileMetadata,
    i18n,
    informUser,
  }) => {
    const actions: Array<MenuItemTemplate> = [
      {
        label: i18n._(t`Get public share link (Play & Download)`),
        click: () => {
          try {
            openShareLink(fileMetadata);
          } catch (error) {
            informUser({
              message: (
                <Trans>
                  Could not open the share link. Make sure the project has been
                  saved to My Cloud.
                </Trans>
              ),
            });
          }
        },
      },
    ];

    if (isPlayBuildExportSupported()) {
      actions.push({
        label: i18n._(t`Publish playable build to share page`),
        click: async () => {
          try {
            informUser({
              message: <Trans>Building and uploading the playable game…</Trans>,
            });
            await exportAndUploadPlayBuild({ project, fileMetadata, i18n });
            informUser({
              message: <Trans>Playable build published.</Trans>,
              actionLabel: i18n._(t`Open share page`),
              onActionClick: () => openShareLink(fileMetadata),
            });
          } catch (error) {
            console.error('Failed to publish playable build:', error);
            informUser({
              message: (
                <Trans>
                  Could not publish the playable build. Make sure the project is
                  saved to My Cloud.
                </Trans>
              ),
            });
          }
        },
      });
    }

    return actions;
  },
}: StorageProvider);
