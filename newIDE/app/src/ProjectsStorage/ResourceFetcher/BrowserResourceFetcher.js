// @flow
import {
  type ResourceFetcher,
  type FetchAllProjectResourcesOptions,
  type FetchAllProjectResourcesResult,
  type FetchAllProjectResourcesFunction,
} from './index';
import CloudStorageProvider from '../CloudStorageProvider';
import { moveUrlResourcesToCloudFilesIfPrivate } from '../CloudStorageProvider/CloudResourceFetcher';
import MyCloudStorageProvider from '../MyCloudStorageProvider';
import { fetchMyCloudProjectResources } from '../MyCloudStorageProvider/MyCloudResourceFetcher';
import UrlStorageProvider from '../UrlStorageProvider';
import { fetchRelativeResourcesToFullUrls } from '../UrlStorageProvider/UrlResourceFetcher';

const fetchers: {
  [string]: FetchAllProjectResourcesFunction,
} = {
  // The Cloud file storage provider fetches the resources that are
  // private URLs by downloading them and reuploading them to the cloud.
  // $FlowFixMe[incompatible-type]
  [CloudStorageProvider.internalName]: moveUrlResourcesToCloudFilesIfPrivate,
  // My Cloud resources are plain public URLs on the self-hosted server: nothing
  // to fetch when opening.
  // $FlowFixMe[incompatible-type]
  [MyCloudStorageProvider.internalName]: fetchMyCloudProjectResources,
  // The URL storage consider relative resources to be relative to the project
  // URL. This allows to open local projects uploaded to GitHub for example.
  // $FlowFixMe[incompatible-type]
  [UrlStorageProvider.internalName]: fetchRelativeResourcesToFullUrls,
};

const BrowserResourceFetcher: ResourceFetcher = {
  fetchAllProjectResources: async (
    options: FetchAllProjectResourcesOptions
  ): Promise<FetchAllProjectResourcesResult> => {
    const { storageProvider } = options;
    const fetcher = fetchers[storageProvider.internalName];
    // $FlowFixMe[constant-condition]
    if (!fetcher)
      throw new Error(
        `Can't find a ResourceFetcher for ${
          storageProvider.internalName
        } - have you registered the storage provider here?`
      );

    return fetcher(options);
  },
};

export default BrowserResourceFetcher;
