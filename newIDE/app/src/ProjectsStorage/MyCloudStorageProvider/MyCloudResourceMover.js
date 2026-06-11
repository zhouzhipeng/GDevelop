// @flow
import PromisePool from '@supercharge/promise-pool';
import {
  type MoveAllProjectResourcesOptions,
  type MoveAllProjectResourcesResult,
} from '../ResourceMover';
import {
  downloadUrlsToBlobs,
  convertBlobToFiles,
  type ItemResult,
} from '../../Utils/BlobDownloader';
import { isBlobURL, isURL } from '../../ResourcesList/ResourceUtils';
import { getFileSha512TruncatedTo256 } from '../../Utils/FileHasher';
import { uploadResource, getMyCloudBaseUrl } from './MyCloudClient';
import optionalRequire from '../../Utils/OptionalRequire';
import { readLocalFileToFile } from '../../Utils/LocalFileUploader';

const path = optionalRequire('path');

type ResourceToFetchAndUpload = {|
  resource: gdResource,
  url: string,
  filename: string,
|};

const extractFilenameFromUrl = (url: string): string => {
  try {
    const pathname = new URL(url).pathname;
    const decoded = decodeURIComponent(pathname.split('/').pop() || 'file');
    return decoded || 'file';
  } catch (error) {
    return 'file';
  }
};

/**
 * Move resources to a My Cloud project: download any external/private URL
 * resources and re-upload them to the My Cloud server, rewriting their URLs.
 * Resources already hosted on this same My Cloud server are left untouched.
 *
 * Usable both for Url=>MyCloud and MyCloud=>MyCloud transitions.
 */
export const moveResourcesToMyCloudProject = async ({
  project,
  oldFileMetadata,
  newFileMetadata,
  oldStorageProviderOperations,
  onProgress,
}: MoveAllProjectResourcesOptions): Promise<MoveAllProjectResourcesResult> => {
  const result: MoveAllProjectResourcesResult = {
    erroredResources: [],
  };

  const newProjectId = newFileMetadata.fileIdentifier;
  let myCloudBaseUrl = '';
  try {
    myCloudBaseUrl = getMyCloudBaseUrl();
  } catch (error) {
    // If we can't resolve the server, every upload will fail below; surface
    // a single clear error per resource rather than crashing here.
  }

  const resourcesManager = project.getResourcesManager();
  const allResourceNames = resourcesManager.getAllResourceNames().toJSArray();
  const resourcesToFetchAndUpload: Array<ResourceToFetchAndUpload> = [];

  await PromisePool.withConcurrency(50)
    .for(allResourceNames)
    .process(async (resourceName: string) => {
      const resource = resourcesManager.getResource(resourceName);
      const resourceFile = resource.getFile();

      if (isURL(resourceFile)) {
        // Already hosted on this My Cloud server for the same project: skip.
        if (
          myCloudBaseUrl &&
          resourceFile.startsWith(
            `${myCloudBaseUrl}/resources/${newProjectId}/`
          )
        ) {
          return;
        }
        if (isBlobURL(resourceFile)) {
          result.erroredResources.push({
            resourceName: resource.getName(),
            error: new Error('Unsupported blob URL.'),
          });
          return;
        }
        // Any other URL (public, private, or hosted on another project): copy.
        resourcesToFetchAndUpload.push({
          resource,
          url: resourceFile,
          filename: extractFilenameFromUrl(resourceFile),
        });
      } else {
        // Local relative file: unsupported for a cloud project.
        result.erroredResources.push({
          resourceName: resource.getName(),
          error: new Error('Unsupported relative file.'),
        });
      }
    });

  if (oldStorageProviderOperations.onEnsureCanAccessResources)
    await oldStorageProviderOperations.onEnsureCanAccessResources(
      project,
      oldFileMetadata
    );

  // Download all resources to blobs (first half of progress).
  const downloadedBlobs: Array<ItemResult<ResourceToFetchAndUpload>> =
    // $FlowFixMe[incompatible-type]
    await downloadUrlsToBlobs({
      urlContainers: resourcesToFetchAndUpload,
      onProgress: (count, total) => {
        onProgress(count, total * 2);
      },
    });

  // Convert blobs to Files.
  // $FlowFixMe[incompatible-type]
  const downloadedFiles = convertBlobToFiles(
    downloadedBlobs,
    (resourceName, error) => {
      result.erroredResources.push({ resourceName, error });
    }
  );

  // Upload each file to the My Cloud server (second half of progress).
  const total = downloadedFiles.length;
  let done = 0;
  await PromisePool.withConcurrency(6)
    .for(downloadedFiles)
    .process(async ({ file, resource }) => {
      try {
        const sha = await getFileSha512TruncatedTo256(file);
        const url = await uploadResource(newProjectId, { file, sha });
        resource.setFile(url);
      } catch (error) {
        result.erroredResources.push({
          resourceName: resource.getName(),
          error: error instanceof Error ? error : new Error('Upload failed.'),
        });
      } finally {
        done++;
        onProgress(total + done, total * 2);
      }
    });

  return result;
};

/**
 * Move resources from a LOCAL project (resources are file paths relative to the
 * project file) to a My Cloud project: read each local file and upload it.
 * Used for LocalFile=>MyCloud on the desktop app.
 */
export const moveLocalResourcesToMyCloudProject = async ({
  project,
  oldFileMetadata,
  newFileMetadata,
  onProgress,
}: MoveAllProjectResourcesOptions): Promise<MoveAllProjectResourcesResult> => {
  const result: MoveAllProjectResourcesResult = {
    erroredResources: [],
  };
  if (!path) {
    throw new Error('Local file system is not available.');
  }

  const newProjectId = newFileMetadata.fileIdentifier;
  const projectPath = path.dirname(oldFileMetadata.fileIdentifier);

  const resourcesManager = project.getResourcesManager();
  const allResourceNames = resourcesManager.getAllResourceNames().toJSArray();

  // Resolve local resources to read from disk; URLs are left as-is (public).
  const localResources: Array<gdResource> = allResourceNames
    .map(resourceName => resourcesManager.getResource(resourceName))
    .filter(resource => {
      const file = resource.getFile();
      if (isURL(file)) {
        if (isBlobURL(file)) {
          result.erroredResources.push({
            resourceName: resource.getName(),
            error: new Error('Unsupported blob URL.'),
          });
        }
        return false;
      }
      return true;
    });

  const total = localResources.length;
  let done = 0;
  await PromisePool.withConcurrency(6)
    .for(localResources)
    .process(async (resource: gdResource) => {
      const resourceAbsolutePath = path.resolve(
        projectPath,
        resource.getFile()
      );
      try {
        const file = await readLocalFileToFile(resourceAbsolutePath);
        const sha = await getFileSha512TruncatedTo256(file);
        const url = await uploadResource(newProjectId, { file, sha });
        resource.setFile(url);
      } catch (error) {
        result.erroredResources.push({
          resourceName: resource.getName(),
          error: error instanceof Error ? error : new Error('Upload failed.'),
        });
      } finally {
        done++;
        onProgress(done, total);
      }
    });

  return result;
};
