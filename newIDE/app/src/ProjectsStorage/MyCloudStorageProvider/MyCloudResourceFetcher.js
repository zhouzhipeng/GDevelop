// @flow
import {
  type FetchAllProjectResourcesOptions,
  type FetchAllProjectResourcesResult,
} from '../ResourceFetcher';

/**
 * Resources of a My Cloud project are stored as plain public URLs on the
 * self-hosted server, so when opening a project there is nothing to fetch or
 * rewrite. (Copying external resources into the cloud happens on save, in
 * MyCloudResourceMover.)
 */
export const fetchMyCloudProjectResources = async (
  options: FetchAllProjectResourcesOptions
): Promise<FetchAllProjectResourcesResult> => {
  return {
    erroredResources: [],
  };
};
