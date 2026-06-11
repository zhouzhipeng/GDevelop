// @flow
import axios from 'axios';
import { GDevelopMyCloud } from '../../Utils/GDevelopServices/ApiConfigs';

/**
 * The "My Cloud" provider talks to a self-hosted server (see
 * newIDE/my-cloud-server) deployed on the user's own machine/VPS.
 *
 * The server URL + access token come, in priority order, from:
 *   1. The user's Preferences (myCloudServerUrl / myCloudAccessToken).
 *   2. A build-time same-origin proxy path REACT_APP_MY_CLOUD_PROXY_PATH
 *      (e.g. "/my-cloud"), set when the web editor is deployed behind nginx
 *      next to a my-cloud-server instance (see scripts/deploy-web-editor.py).
 *
 * Unlike the GDevelop "Cloud" provider, there is no embedded server: the
 * desktop app stores projects on the local file system, so My Cloud is only
 * useful to point at a remote server.
 */

export type MyCloudProject = {|
  id: string,
  name: string,
  gameId: ?string,
  createdAt: string,
  updatedAt: string,
  currentVersion: ?string,
|};

export type MyCloudServerConfig = {|
  serverUrl: string,
  accessToken: string,
|};

const stripTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

// Same-origin proxy path baked at build time (optional, set by the deploy
// script). Null when the web editor is not deployed next to a my-cloud-server.
const proxyPath = GDevelopMyCloud.proxyPath
  ? stripTrailingSlash(GDevelopMyCloud.proxyPath)
  : null;

// In-memory config, kept in sync by the Preferences layer through
// setMyCloudServerConfig. Initialized lazily from persisted preferences so it
// works even before the Preferences provider mounts.
let cachedConfig: ?MyCloudServerConfig = null;

const PREFERENCES_LOCAL_STORAGE_KEY = 'gd-preferences';

const readConfigFromPreferences = (): MyCloudServerConfig => {
  try {
    const persisted = localStorage.getItem(PREFERENCES_LOCAL_STORAGE_KEY);
    if (persisted) {
      const values = JSON.parse(persisted);
      return {
        serverUrl: (values && values.myCloudServerUrl) || '',
        accessToken: (values && values.myCloudAccessToken) || '',
      };
    }
  } catch (error) {
    console.warn('Could not read My Cloud config from preferences.', error);
  }
  return { serverUrl: '', accessToken: '' };
};

export const setMyCloudServerConfig = (config: MyCloudServerConfig) => {
  cachedConfig = config;
};

const getConfig = (): MyCloudServerConfig => {
  if (cachedConfig) return cachedConfig;
  cachedConfig = readConfigFromPreferences();
  return cachedConfig;
};

/**
 * Resolve the base URL + token to use: a user-configured server takes
 * precedence; otherwise fall back to the build-time same-origin proxy path.
 * The token always comes from Preferences (the My Cloud access token).
 */
const resolveServer = (): {| baseUrl: string, token: string |} => {
  const { serverUrl, accessToken } = getConfig();
  if (serverUrl) {
    return { baseUrl: stripTrailingSlash(serverUrl), token: accessToken || '' };
  }
  if (proxyPath) {
    return { baseUrl: proxyPath, token: accessToken || '' };
  }
  throw new Error(
    'No My Cloud server is configured. Set the server URL and access token in Preferences → My Cloud server.'
  );
};

const createClient = () => {
  const { baseUrl, token } = resolveServer();
  return axios.create({
    baseURL: baseUrl,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
};

/** Public: whether a usable server is configured/available. */
export const isMyCloudConfigured = (): boolean => {
  try {
    resolveServer();
    return true;
  } catch (error) {
    return false;
  }
};

/** Public: the absolute base URL of the active server (for share links). */
export const getMyCloudBaseUrl = (): string => {
  return resolveServer().baseUrl;
};

export const checkHealth = async (
  config?: MyCloudServerConfig
): Promise<{| ok: boolean, authRequired: boolean, version: string |}> => {
  const baseUrl = config
    ? stripTrailingSlash(config.serverUrl)
    : resolveServer().baseUrl;
  // $FlowFixMe[underconstrained-implicit-instantiation]
  const response = await axios.get(`${baseUrl}/api/health`);
  return response.data;
};

export const listProjects = async (): Promise<Array<MyCloudProject>> => {
  // $FlowFixMe[underconstrained-implicit-instantiation]
  const response = await createClient().get('/api/projects');
  return response.data;
};

export const getProject = async (id: string): Promise<MyCloudProject> => {
  // $FlowFixMe[underconstrained-implicit-instantiation]
  const response = await createClient().get(
    `/api/projects/${encodeURIComponent(id)}`
  );
  return response.data;
};

export const createProject = async ({
  name,
  gameId,
}: {|
  name: string,
  gameId?: ?string,
|}): Promise<MyCloudProject> => {
  // $FlowFixMe[underconstrained-implicit-instantiation]
  const response = await createClient().post('/api/projects', { name, gameId });
  return response.data;
};

export const updateProject = async (
  id: string,
  changes: {| name?: string, gameId?: string |}
): Promise<MyCloudProject> => {
  // $FlowFixMe[underconstrained-implicit-instantiation]
  const response = await createClient().patch(
    `/api/projects/${encodeURIComponent(id)}`,
    changes
  );
  return response.data;
};

export const deleteProject = async (id: string): Promise<void> => {
  // $FlowFixMe[underconstrained-implicit-instantiation]
  await createClient().delete(`/api/projects/${encodeURIComponent(id)}`);
};

/** Download the project body (a zip containing game.json) as a Blob. */
export const getArchiveBlob = async (id: string): Promise<Blob> => {
  // $FlowFixMe[underconstrained-implicit-instantiation]
  const response = await createClient().get(
    `/api/projects/${encodeURIComponent(id)}/archive`,
    { responseType: 'blob' }
  );
  return response.data;
};

/** Upload a new project body (zip Blob). Returns the new version id. */
export const uploadArchive = async (
  id: string,
  zippedProject: Blob
): Promise<string> => {
  // $FlowFixMe[underconstrained-implicit-instantiation]
  const response = await createClient().post(
    `/api/projects/${encodeURIComponent(id)}/archive`,
    zippedProject,
    { headers: { 'Content-Type': 'application/zip' } }
  );
  return response.data.version;
};

/** Upload one resource file. Returns the public URL to store in the project. */
export const uploadResource = async (
  id: string,
  {
    file,
    sha,
  }: {|
    file: File,
    sha: string,
  |}
): Promise<string> => {
  // $FlowFixMe[underconstrained-implicit-instantiation]
  const response = await createClient().post(
    `/api/projects/${encodeURIComponent(
      id
    )}/resources?filename=${encodeURIComponent(
      file.name
    )}&sha=${encodeURIComponent(sha)}`,
    file,
    { headers: { 'Content-Type': file.type || 'application/octet-stream' } }
  );
  return response.data.url;
};

/**
 * Upload several device files to a My Cloud project, reporting progress.
 * Returns one result per input file: { url } on success, or { error }.
 * Mirrors the shape of GDevelopServices/Project uploadProjectResourceFiles so
 * callers can treat Cloud and My Cloud uniformly.
 */
export const uploadResourceFiles = async (
  id: string,
  files: Array<File>,
  onProgress: (current: number, total: number) => void
): Promise<Array<{| resourceFile: File, url: ?string, error: ?Error |}>> => {
  const { getFileSha512TruncatedTo256 } = require('../../Utils/FileHasher');
  const total = files.length;
  let done = 0;
  const results: Array<{|
    resourceFile: File,
    url: ?string,
    error: ?Error,
  |}> = [];
  // Sequential to keep memory bounded and progress simple.
  for (const file of files) {
    try {
      const sha = await getFileSha512TruncatedTo256(file);
      const url = await uploadResource(id, { file, sha });
      results.push({ resourceFile: file, url, error: null });
    } catch (error) {
      results.push({
        resourceFile: file,
        url: null,
        error: error instanceof Error ? error : new Error('Upload failed.'),
      });
    } finally {
      done++;
      onProgress(done, total);
    }
  }
  return results;
};

/** Upload an HTML5 export zip for the public /play link. Returns play URL. */
export const uploadExport = async (
  id: string,
  exportZip: Blob
): Promise<string> => {
  // $FlowFixMe[underconstrained-implicit-instantiation]
  const response = await createClient().post(
    `/api/projects/${encodeURIComponent(id)}/export`,
    exportZip,
    { headers: { 'Content-Type': 'application/zip' } }
  );
  return response.data.playUrl;
};
