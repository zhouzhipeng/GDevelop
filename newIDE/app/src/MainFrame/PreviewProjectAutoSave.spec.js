// @flow

import { autoSaveProjectForPreviewIfNeeded } from './PreviewProjectAutoSave';

describe('autoSaveProjectForPreviewIfNeeded', () => {
  const project = ({}: any);
  const fileMetadata = ({ fileIdentifier: 'project.gdevelop' }: any);

  it('does not reload a clean project from disk before previewing', async () => {
    const saveProject = jest.fn();
    const autoSaveProject = jest.fn();

    const savedFileMetadata = await autoSaveProjectForPreviewIfNeeded({
      project,
      fileMetadata,
      hasUnsavedChanges: false,
      saveProject,
      autoSaveProject,
      onAutoSaveError: jest.fn(),
    });

    expect(savedFileMetadata).toBeNull();
    expect(saveProject).not.toHaveBeenCalled();
    expect(autoSaveProject).not.toHaveBeenCalled();
  });

  it('returns the saved file for unsaved changes', async () => {
    const savedFileMetadata = ({ fileIdentifier: 'saved.gdevelop' }: any);
    const saveProject = jest.fn().mockResolvedValue(savedFileMetadata);

    expect(
      await autoSaveProjectForPreviewIfNeeded({
        project,
        fileMetadata,
        hasUnsavedChanges: true,
        saveProject,
        autoSaveProject: null,
        onAutoSaveError: jest.fn(),
      })
    ).toBe(savedFileMetadata);
    expect(saveProject).toHaveBeenCalledTimes(1);
  });

  it('uses the storage provider autosave as a fallback', async () => {
    const autoSaveProject = jest.fn().mockResolvedValue(undefined);

    expect(
      await autoSaveProjectForPreviewIfNeeded({
        project,
        fileMetadata,
        hasUnsavedChanges: true,
        saveProject: null,
        autoSaveProject,
        onAutoSaveError: jest.fn(),
      })
    ).toBe(fileMetadata);
    expect(autoSaveProject).toHaveBeenCalledWith(project, fileMetadata);
  });

  it('reports a storage provider autosave failure', async () => {
    const error = new Error('save failed');
    const onAutoSaveError = jest.fn();

    expect(
      await autoSaveProjectForPreviewIfNeeded({
        project,
        fileMetadata,
        hasUnsavedChanges: true,
        saveProject: null,
        autoSaveProject: jest.fn().mockRejectedValue(error),
        onAutoSaveError,
      })
    ).toBeNull();
    expect(onAutoSaveError).toHaveBeenCalledWith(error);
  });
});
