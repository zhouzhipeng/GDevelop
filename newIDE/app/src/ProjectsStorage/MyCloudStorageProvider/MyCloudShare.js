// @flow
import { type FileMetadata } from '..';
import Window from '../../Utils/Window';
import { getMyCloudBaseUrl } from './MyCloudClient';

/** Build the public share landing URL for a My Cloud project. */
export const getShareUrl = (projectId: string): string => {
  const baseUrl = getMyCloudBaseUrl();
  return `${baseUrl}/share/${encodeURIComponent(projectId)}`;
};

/** Open the public share page (Play + Download) for a saved My Cloud project. */
export const openShareLink = (fileMetadata: FileMetadata): void => {
  const url = getShareUrl(fileMetadata.fileIdentifier);
  Window.openExternalURL(url);
};
