// @flow
import { t } from '@lingui/macro';
import { type MessageDescriptor } from '../../Utils/i18n/MessageDescriptor.flow';
import { type FileMetadata } from '..';
import { unzipFirstEntryOfBlob } from '../../Utils/Zip.js/Utils';
import { getArchiveBlob, getProject } from './MyCloudClient';

class MyCloudProjectReadingError extends Error {
  constructor() {
    super();
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MyCloudProjectReadingError);
    }
    this.name = 'MyCloudProjectReadingError';
  }
}

export const onOpen = async (
  fileMetadata: FileMetadata,
  onProgress?: (progress: number, message: MessageDescriptor) => void
): Promise<{| content: Object |}> => {
  const projectId = fileMetadata.fileIdentifier;

  onProgress && onProgress((1 / 3) * 100, t`Connecting to your cloud`);
  const project = await getProject(projectId);
  if (!project) throw new Error("The project couldn't be fetched.");

  onProgress && onProgress((2 / 3) * 100, t`Downloading project`);
  const zippedSerializedProject = await getArchiveBlob(projectId);

  onProgress && onProgress((3 / 3) * 100, t`Opening project`);
  // The zip only contains the project json file (game.json), so read the first
  // entry, exactly like the GDevelop Cloud provider does.
  try {
    const serializedProject = await unzipFirstEntryOfBlob(
      zippedSerializedProject
    );
    return {
      content: JSON.parse(serializedProject),
    };
  } catch (error) {
    console.error('Error while reading My Cloud project:', error);
    throw new MyCloudProjectReadingError();
  }
};

export const onEnsureCanAccessResources = async (
  project: gdProject,
  fileMetadata: FileMetadata
): Promise<void> => {
  // Resources are served as public URLs by the My Cloud server, so there is
  // nothing to authorize before accessing them.
};
