// @flow
import * as React from 'react';
import { t, Trans } from '@lingui/macro';
import {
  type FileMetadata,
  type SaveAsLocation,
  type SaveAsOptions,
  type SaveProjectOptions,
} from '..';
import { type MessageDescriptor } from '../../Utils/i18n/MessageDescriptor.flow';
import { serializeToJSON, addFinalNewline } from '../../Utils/Serializer';
import { createZipWithSingleTextFile } from '../../Utils/Zip.js/Utils';
import {
  createProject,
  getProject,
  updateProject,
  uploadArchive,
} from './MyCloudClient';
import Dialog, { DialogPrimaryButton } from '../../UI/Dialog';
import FlatButton from '../../UI/FlatButton';
import TextField from '../../UI/TextField';
import { ColumnStackLayout } from '../../UI/Layout';

export const PROJECT_NAME_MAX_LENGTH = 60;

const zipProject = async (project: gdProject): Promise<Blob> => {
  let projectJson = serializeToJSON(project, 'serializeTo', {
    canonicalEventSerialization: false,
  });
  projectJson = addFinalNewline(projectJson);
  return createZipWithSingleTextFile(projectJson, 'game.json');
};

export const getWriteErrorMessage = (error: Error): MessageDescriptor => {
  return t`An error occurred when saving the project to your cloud. Check that the server is reachable and that your access token is correct.`;
};

export const getProjectLocation = ({
  projectName,
}: {|
  projectName: string,
  saveAsLocation: ?SaveAsLocation,
  newProjectsDefaultFolder?: string,
|}): SaveAsLocation => {
  // Always return the current projectName. renderNewProjectSaveAsLocationChooser
  // re-syncs saveAsLocation to projectName during render and only stops when
  // saveAsLocation.name === projectName — returning a stale name here would loop
  // forever and freeze the tab.
  return {
    name: projectName,
  };
};

export const renderNewProjectSaveAsLocationChooser = ({
  projectName,
  saveAsLocation,
  setSaveAsLocation,
}: {|
  projectName: string,
  saveAsLocation: ?SaveAsLocation,
  setSaveAsLocation: (?SaveAsLocation) => void,
  newProjectsDefaultFolder?: string,
|}): null => {
  if (!saveAsLocation || saveAsLocation.name !== projectName) {
    setSaveAsLocation(getProjectLocation({ projectName, saveAsLocation }));
  }
  return null;
};

/**
 * "Save as" location chooser: a small dialog to enter the project name under
 * which it will be created on the cloud server (mirrors the Cloud provider's
 * name-only SaveAsLocation).
 */
export const generateOnChooseSaveProjectAsLocation = ({
  setDialog,
  closeDialog,
}: {|
  setDialog: (() => React.Node) => void,
  closeDialog: () => void,
|}): (({
  project: gdProject,
  fileMetadata: ?FileMetadata,
  displayOptionToGenerateNewProjectUuid: boolean,
}) => Promise<{
  saveAsLocation: ?SaveAsLocation,
  saveAsOptions: ?SaveAsOptions,
}>) => async ({
  project,
  fileMetadata,
}: {|
  project: gdProject,
  fileMetadata: ?FileMetadata,
  displayOptionToGenerateNewProjectUuid: boolean,
|}): Promise<{|
  saveAsLocation: ?SaveAsLocation,
  saveAsOptions: ?SaveAsOptions,
|}> => {
  const projectName = project.getName();

  const name: ?string = await new Promise(resolve => {
    const MyCloudNameDialog = () => {
      const [value, setValue] = React.useState(projectName);
      return (
        <Dialog
          title={<Trans>Save to My Cloud</Trans>}
          maxWidth="sm"
          open
          onRequestClose={() => {
            closeDialog();
            resolve(null);
          }}
          onApply={() => {
            closeDialog();
            resolve(value.trim() || projectName);
          }}
          actions={[
            <FlatButton
              key="cancel"
              label={<Trans>Cancel</Trans>}
              onClick={() => {
                closeDialog();
                resolve(null);
              }}
            />,
            <DialogPrimaryButton
              key="save"
              label={<Trans>Save</Trans>}
              primary
              onClick={() => {
                closeDialog();
                resolve(value.trim() || projectName);
              }}
            />,
          ]}
        >
          <ColumnStackLayout noMargin>
            <TextField
              autoFocus="desktop"
              floatingLabelText={<Trans>Project name</Trans>}
              value={value}
              onChange={(e, text) => setValue(text)}
              maxLength={PROJECT_NAME_MAX_LENGTH}
            />
          </ColumnStackLayout>
        </Dialog>
      );
    };
    setDialog(() => <MyCloudNameDialog />);
  });

  if (!name) {
    return { saveAsLocation: null, saveAsOptions: null };
  }

  return {
    saveAsLocation: { name },
    saveAsOptions: { generateNewProjectUuid: true },
  };
};

export const generateOnSaveProjectAs = (
  setDialog: (() => React.Node) => void,
  closeDialog: () => void
): ((
  project: gdProject,
  saveAsLocation: ?SaveAsLocation,
  options: {|
    onStartSaving: () => void,
    onMoveResources: ({| newFileMetadata: FileMetadata |}) => Promise<void>,
  |}
) => Promise<{|
  wasSaved: boolean,
  fileMetadata: ?FileMetadata,
|}>) => async (
  project: gdProject,
  saveAsLocation: ?SaveAsLocation,
  options: {|
    onStartSaving: () => void,
    onMoveResources: ({|
      newFileMetadata: FileMetadata,
    |}) => Promise<void>,
  |}
): Promise<{|
  wasSaved: boolean,
  fileMetadata: ?FileMetadata,
|}> => {
  if (!saveAsLocation)
    throw new Error('A location was not chosen before saving as.');
  const { name } = saveAsLocation;
  if (!name) throw new Error('A name was not chosen before saving as.');

  options.onStartSaving();

  const gameId = project.getProjectUuid();

  try {
    // Create the project on the cloud server (gets an id).
    const cloudProject = await createProject({ name, gameId });
    const fileMetadata: FileMetadata = {
      fileIdentifier: cloudProject.id,
      name,
      gameId,
    };

    // Move/upload the resources so their URLs point at the new project.
    await options.onMoveResources({ newFileMetadata: fileMetadata });

    // Upload the project body.
    const zippedProject = await zipProject(project);
    const newVersion = await uploadArchive(cloudProject.id, zippedProject);
    fileMetadata.version = newVersion;
    fileMetadata.lastModifiedDate = Date.now();

    return {
      wasSaved: true,
      fileMetadata,
    };
  } catch (error) {
    console.error('Error while creating a My Cloud project:', error);
    throw error;
  }
};

export const onSaveProject = async (
  project: gdProject,
  fileMetadata: FileMetadata,
  options?: SaveProjectOptions
): Promise<{|
  wasSaved: boolean,
  fileMetadata: FileMetadata,
|}> => {
  const projectId = fileMetadata.fileIdentifier;

  const zippedProject = await zipProject(project);
  const newVersion = await uploadArchive(projectId, zippedProject);

  const newFileMetadata: FileMetadata = {
    ...fileMetadata,
    version: newVersion,
    lastModifiedDate: Date.now(),
  };

  return {
    wasSaved: true,
    fileMetadata: newFileMetadata,
  };
};

/**
 * Detects whether the project was modified elsewhere since it was opened, by
 * comparing the opened version with the server's current version.
 */
export const canFileMetadataBeSafelySaved = async (
  fileMetadata: FileMetadata,
  actions: {|
    showAlert: (options: {|
      title: MessageDescriptor,
      message: MessageDescriptor,
    |}) => void,
    showConfirmation: (options: {|
      title: MessageDescriptor,
      message: MessageDescriptor,
    |}) => Promise<boolean>,
  |}
): Promise<boolean> => {
  const projectId = fileMetadata.fileIdentifier;
  const openedVersion = fileMetadata.version;
  if (!openedVersion) return true;

  let serverProject;
  try {
    serverProject = await getProject(projectId);
  } catch (error) {
    // If we can't check, let the save proceed and surface real errors later.
    return true;
  }
  if (!serverProject || !serverProject.currentVersion) return true;
  if (serverProject.currentVersion === openedVersion) return true;

  return actions.showConfirmation({
    title: t`This project was modified elsewhere`,
    message: t`It looks like this project was saved somewhere else since you opened it. If you continue, you will overwrite those changes. Save anyway?`,
  });
};

export const onChangeProjectProperty = async (
  project: gdProject,
  fileMetadata: FileMetadata,
  properties: {| name?: string, gameId?: string |}
): Promise<null | {| version: string, lastModifiedDate: number |}> => {
  try {
    await updateProject(fileMetadata.fileIdentifier, properties);
    return null;
  } catch (error) {
    console.error('Error while updating My Cloud project properties:', error);
    return null;
  }
};
