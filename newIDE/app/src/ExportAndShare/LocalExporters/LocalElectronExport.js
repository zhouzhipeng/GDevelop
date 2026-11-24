// @flow
import { Trans, t } from '@lingui/macro';

import React from 'react';
import { type I18n } from '@lingui/core';
import RaisedButton from '../../UI/RaisedButton';
import { Column, Line } from '../../UI/Grid';
import { findGDJS } from '../../GameEngineFinder/LocalGDJSFinder';
import LocalFileSystem, { type UrlFileDescriptor } from './LocalFileSystem';
import LocalFolderPicker from '../../UI/LocalFolderPicker';
import assignIn from 'lodash/assignIn';
import optionalRequire from '../../Utils/OptionalRequire';
import {
  type ExportFlowProps,
  type ExportPipeline,
  type ExportPipelineContext,
} from '../ExportPipeline.flow';
import {
  ExplanationHeader,
  DoneFooter,
  ExportFlow,
} from '../GenericExporters/ElectronExport';
import { downloadUrlsToLocalFiles } from '../../Utils/LocalFileDownloader';
import { runNpmScript } from '../../Utils/NpmScriptExecutor';
import { exportLocalElectronService } from './LocalElectronService';
import { exportWholePixiProjectWithTSL } from '../../TSLMaterial/TSLMaterialProjectCompiler';
// It's important to use remote and not electron for folder actions,
// otherwise they will be opened in the background.
// See https://github.com/electron/electron/issues/4349#issuecomment-777475765
const remote = optionalRequire('@electron/remote');
const shell = remote ? remote.shell : null;

const gd: libGDevelop = global.gd;

type ExportState = {
  outputDir: string,
};

type PreparedExporter = {|
  exporter: gdjsExporter,
  localFileSystem: LocalFileSystem,
|};

type ExportOutput = {|
  urlFiles: Array<UrlFileDescriptor>,
|};

type ResourcesDownloadOutput = null;

type CompressionOutput = null;

const exportPipelineName = 'local-electron';

const prepareLocalElectronExporter = (): Promise<PreparedExporter> => {
  return findGDJS().then(({ gdjsRoot }) => {
    console.info('GDJS found in ', gdjsRoot);

    // TODO: Memory leak? Check for other exporters too.
    const localFileSystem = new LocalFileSystem({
      downloadUrlsToLocalFiles: true,
    });
    const fileSystem = assignIn(new gd.AbstractFileSystemJS(), localFileSystem);
    const exporter = new gd.Exporter(fileSystem, gdjsRoot);

    return {
      exporter,
      localFileSystem,
    };
  });
};

const exportLocalElectron = async (
  project: gdProject,
  outputDir: string,
  i18n: I18n,
  { exporter, localFileSystem }: PreparedExporter,
  fallbackAuthor?: ?{ id: string, username: string }
): Promise<ExportOutput> => {
  const exportOptions = new gd.ExportOptions(project, outputDir);
  exportOptions.setTarget('electron');
  if (fallbackAuthor) {
    exportOptions.setFallbackAuthor(fallbackAuthor.id, fallbackAuthor.username);
  }
  let exportSucceeded = false;
  try {
    exportSucceeded = await exportWholePixiProjectWithTSL({
      project,
      exporter,
      exportOptions,
      fileSystem: localFileSystem,
      outputDirectory: outputDir,
      target: 'electron',
    });
  } finally {
    exportOptions.delete();
    exporter.delete();
  }

  if (!exportSucceeded) {
    throw new Error(
      i18n._(
        t`Export failed. Check that the output folder is accessible and that you have the necessary permissions.`
      )
    );
  }

  exportLocalElectronService(project.getProjectFile(), outputDir);

  return {
    urlFiles: localFileSystem.getAllUrlFilesIn(outputDir),
  };
};

export const exportLocalElectronHeadless = async (
  project: gdProject,
  i18n: I18n,
  outputDir: string
): Promise<void> => {
  const prepared = await prepareLocalElectronExporter();
  const { urlFiles } = await exportLocalElectron(
    project,
    outputDir,
    i18n,
    prepared
  );
  await downloadUrlsToLocalFiles({
    urlContainers: urlFiles,
    onProgress: () => {},
    throwIfAnyError: true,
  });
};

export const localElectronExportPipeline: ExportPipeline<
  ExportState,
  PreparedExporter,
  ExportOutput,
  ResourcesDownloadOutput,
  CompressionOutput
> = {
  name: exportPipelineName,
  packageNameWarningType: 'desktop',

  getInitialExportState: (project: gdProject) => ({
    outputDir: project.getLastCompilationDirectory(),
  }),

  canLaunchBuild: exportState => !!exportState.outputDir,

  isNavigationDisabled: () => false,

  renderHeader: ({ project, exportState, updateExportState, exportStep }) =>
    exportStep !== 'done' ? (
      <Column noMargin expand>
        <Line>
          <Column noMargin>
            <ExplanationHeader />
          </Column>
        </Line>
        <Line>
          <LocalFolderPicker
            type="export"
            value={exportState.outputDir}
            defaultPath={project.getLastCompilationDirectory()}
            onChange={outputDir => {
              updateExportState(() => ({ outputDir }));
              project.setLastCompilationDirectory(outputDir);
            }}
            fullWidth
          />
        </Line>
      </Column>
    ) : null,

  renderExportFlow: (props: ExportFlowProps) => (
    <ExportFlow {...props} exportPipelineName={exportPipelineName} />
  ),

  prepareExporter: prepareLocalElectronExporter,

  launchExport: (context, prepared, fallbackAuthor) =>
    exportLocalElectron(
      context.project,
      context.exportState.outputDir,
      context.i18n,
      prepared,
      fallbackAuthor
    ),

  launchResourcesDownload: async (
    context: ExportPipelineContext<ExportState>,
    { urlFiles }: ExportOutput
  ): Promise<ResourcesDownloadOutput> => {
    await downloadUrlsToLocalFiles({
      urlContainers: urlFiles,
      onProgress: context.updateStepProgress,
      throwIfAnyError: true,
    });

    return null;
  },

  launchCompression: (
    context: ExportPipelineContext<ExportState>,
    exportOutput: ResourcesDownloadOutput
  ): Promise<CompressionOutput> => {
    return Promise.resolve(null);
  },

  renderDoneFooter: ({ exportState }) => {
    const openExportFolder = () => {
      if (shell) shell.openPath(exportState.outputDir);
    };

    return (
      <DoneFooter
        renderGameButton={() => (
          <RaisedButton
            key="open"
            label={<Trans>Open folder</Trans>}
            primary={true}
            onClick={openExportFolder}
          />
        )}
        renderBuildButton={() => (
          <RaisedButton
            key="build-binary"
            label={<Trans>Build binary</Trans>}
            primary
            onClick={() => {
              runNpmScript(exportState.outputDir, {
                script: 'build',
                installDependencies: true,
                openFolderAfterSuccess: 'dist',
              });
            }}
          />
        )}
      />
    );
  },
};
