// @flow

import { type FileMetadata } from '../ProjectsStorage';

export const autoSaveProjectForPreviewIfNeeded = async ({
  project,
  fileMetadata,
  hasUnsavedChanges,
  saveProject,
  autoSaveProject,
  onAutoSaveError,
}: {|
  project: ?gdProject,
  fileMetadata: ?FileMetadata,
  hasUnsavedChanges: boolean,
  saveProject: ?() => Promise<?FileMetadata>,
  autoSaveProject: ?(
    project: gdProject,
    fileMetadata: FileMetadata
  ) => Promise<void>,
  onAutoSaveError: (error: any) => void,
|}): Promise<?FileMetadata> => {
  if (!project || !fileMetadata || !hasUnsavedChanges) return null;

  if (saveProject) {
    return (await saveProject()) || null;
  }

  if (autoSaveProject) {
    try {
      await autoSaveProject(project, fileMetadata);
      return fileMetadata;
    } catch (error) {
      onAutoSaveError(error);
    }
  }

  return null;
};
