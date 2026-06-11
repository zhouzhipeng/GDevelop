// @flow
import { type I18n as I18nType } from '@lingui/core';
import { type FileMetadata } from '..';
import optionalRequire from '../../Utils/OptionalRequire';
import { uploadExport } from './MyCloudClient';

// IMPORTANT: do NOT statically import the local HTML5 export pipeline here.
// It (via LocalFileSystem) evaluates `path.posix` at module load time, which
// throws in the browser bundle where `path` is null. We dynamically import the
// Node-only modules inside exportAndUploadPlayBuild, which only runs on desktop.

const path = optionalRequire('path');
const os = optionalRequire('os');

/**
 * Build a playable HTML5 export of the project and upload it to the My Cloud
 * server, so the public /play/:id share link runs the game in a browser.
 *
 * Desktop only (uses the local HTML5 exporter + Node archiver). Returns the
 * public play URL.
 */
export const exportAndUploadPlayBuild = async ({
  project,
  fileMetadata,
  i18n,
}: {|
  project: gdProject,
  fileMetadata: FileMetadata,
  i18n: I18nType,
|}): Promise<string> => {
  if (!path || !os) {
    throw new Error(
      'Sharing a playable build requires the desktop app (Node.js is not available here).'
    );
  }

  // Dynamically import the Electron/Node-only modules so they are never
  // evaluated in the browser bundle (see note above).
  const [
    { exportLocalHtml5Headless },
    { archiveLocalFolder },
    { readLocalFileToFile },
  ] = await Promise.all([
    import('../../ExportAndShare/Headless/ExportLocalHtml5Headless'),
    import('../../Utils/LocalArchiver'),
    import('../../Utils/LocalFileUploader'),
  ]);

  const projectId = fileMetadata.fileIdentifier;

  // Export the HTML5 build to a temporary folder.
  const exportDir = path.join(
    os.tmpdir(),
    `gd-mycloud-export-${projectId}-${project.getProjectUuid()}`
  );
  await exportLocalHtml5Headless({ project, i18n, outputDir: exportDir });

  // Zip the exported folder.
  const zipPath = path.join(os.tmpdir(), `gd-mycloud-export-${projectId}.zip`);
  await archiveLocalFolder({ path: exportDir, outputFilename: zipPath });

  // Read the zip and upload it as the play build.
  const zipFile = await readLocalFileToFile(zipPath);
  const playUrl = await uploadExport(projectId, zipFile);
  return playUrl;
};

/** Whether the playable-build export is available (desktop only). */
export const isPlayBuildExportSupported = (): boolean => !!(path && os);
