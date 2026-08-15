// @flow
import { Trans } from '@lingui/macro';

import * as React from 'react';
import Toolbar from './Toolbar';
import DebuggerContent from './DebuggerContent';
import DebuggerSelector from './DebuggerSelector';
import { Column } from '../UI/Grid';
import Text from '../UI/Text';
import PlaceholderLoader from '../UI/PlaceholderLoader';
import PlaceholderMessage from '../UI/PlaceholderMessage';
import Background from '../UI/Background';
import EmptyMessage from '../UI/EmptyMessage';
import {
  type PreviewDebuggerServer,
  type DebuggerId,
  type DebuggerStatus,
} from '../ExportAndShare/PreviewLauncher.flow';
import { type Log, LogsManager } from './DebuggerConsole';
import IssueReportDialog, {
  type IssueAnnotationTool,
} from './IssueReportDialog';
import {
  getLocalProjectRoot,
  getIssueReportClipboardPath,
  writeIssueReport,
  type IssueReportData,
} from './IssueReportWriter';
import { showErrorBox } from '../UI/Messages/MessageBox';
import InfoBar from '../UI/Messages/InfoBar';
import { copyTextToClipboard } from '../Utils/Clipboard';

// Mirrors `gdjs.FrameMeasureOutput`: a plain tree (no back-references),
// as sent by the game's profiler.
export type ProfilerMeasuresSection = {|
  time: number,
  subsections: { [string]: ProfilerMeasuresSection },
|};

export type ProfilerOutput = {|
  framesAverageMeasures: ProfilerMeasuresSection,
  stats: {
    framesCount: number,
  },
|};

type ActiveIssueReport = {|
  debuggerId: DebuggerId,
  wasPaused: boolean,
  runtimeDump: Object,
  sceneName: ?string,
|};

/**
 * Returns true if a log is a warning or debug log from a library out of our control that we do not want to bother users with.
 * This is used in Debugger#_handleMessage below to filter out those kinds of messages.
 */
const isUnavoidableLibraryWarning = ({ group, message }: Log): boolean =>
  group === 'JavaScript' &&
  (message.includes('Electron Security Warning') ||
    message.includes('Warning: This is a browser-targeted Firebase bundle'));

type Props = {|
  project: gdProject,
  setToolbar: React.Node => void,
  previewDebuggerServer: PreviewDebuggerServer,
|};

type State = {|
  debuggerServerState: 'started' | 'stopped',
  debuggerServerError: ?any,
  debuggerIds: Array<DebuggerId>,
  unregisterDebuggerServerCallbacks: ?() => void,

  debuggerGameData: { [DebuggerId]: any },
  profilerOutputs: { [DebuggerId]: ProfilerOutput },
  profilingInProgress: { [DebuggerId]: boolean },
  signalDiagnostics: { [DebuggerId]: any },
  debuggerStatus: { [DebuggerId]: DebuggerStatus },
  selectedId: DebuggerId,
  logs: { [DebuggerId]: Array<Log> },
  activeIssueReport: ?ActiveIssueReport,
  isIssueReportStarting: boolean,
  isIssueReportSaving: boolean,
  issueReportDescription: string,
  issueReportError: ?string,
  issueReportWarning: ?string,
  issueReportTool: IssueAnnotationTool,
  issueReportToastMessage: string,
  issueReportToastVisible: boolean,
  issueReportToastId: number,
|};

/**
 * Start the debugger server, listen to commands received and issue commands to it.
 */
export default class Debugger extends React.Component<Props, State> {
  // $FlowFixMe[missing-local-annot]
  state = {
    debuggerServerState: (this.props.previewDebuggerServer.getServerState():
      | 'started'
      | 'stopped'),
    debuggerServerError: null,
    debuggerIds: (this.props.previewDebuggerServer.getExistingDebuggerIds(): Array<DebuggerId>),
    unregisterDebuggerServerCallbacks: null,
    debuggerGameData: {},
    profilerOutputs: {},
    profilingInProgress: {},
    signalDiagnostics: {},
    debuggerStatus: {},
    selectedId: '0',
    logs: {},
    activeIssueReport: null,
    isIssueReportStarting: false,
    isIssueReportSaving: false,
    issueReportDescription: '',
    issueReportError: null,
    issueReportWarning: null,
    issueReportTool: 'freehand',
    issueReportToastMessage: '',
    issueReportToastVisible: false,
    issueReportToastId: 0,
  };

  _debuggerContents: { [DebuggerId]: ?DebuggerContent } = {};
  _debuggerLogs: Map<DebuggerId, LogsManager> = new Map();
  _isUnmounted = false;

  updateToolbar = () => {
    const {
      selectedId,
      debuggerStatus,
      activeIssueReport,
      isIssueReportStarting,
      isIssueReportSaving,
    } = this.state;

    const selectedDebuggerContents = this._debuggerContents[
      this.state.selectedId
    ];

    const isSelectedDebuggerPaused = debuggerStatus[selectedId]
      ? debuggerStatus[selectedId].isPaused
      : false;

    this.props.setToolbar(
      <Toolbar
        onPlay={() => this._play(this.state.selectedId)}
        onPause={() => this._pause(this.state.selectedId)}
        canPlay={this._hasSelectedDebugger() && isSelectedDebuggerPaused}
        canPause={this._hasSelectedDebugger() && !isSelectedDebuggerPaused}
        canOpenProfiler={this._hasSelectedDebugger()}
        isProfilerShown={
          !!selectedDebuggerContents &&
          selectedDebuggerContents.isProfilerShown()
        }
        onToggleProfiler={() => {
          if (this._debuggerContents[this.state.selectedId])
            this._debuggerContents[this.state.selectedId].toggleProfiler();
        }}
        canOpenConsole={this._hasSelectedDebugger()}
        isConsoleShown={
          !!selectedDebuggerContents &&
          selectedDebuggerContents.isConsoleShown()
        }
        onToggleConsole={() => {
          if (this._debuggerContents[this.state.selectedId])
            this._debuggerContents[this.state.selectedId].toggleConsole();
        }}
        canOpenSignalMonitor={this._hasSelectedDebugger()}
        isSignalMonitorShown={
          !!selectedDebuggerContents &&
          selectedDebuggerContents.isSignalMonitorShown()
        }
        onToggleSignalMonitor={() => {
          if (this._debuggerContents[this.state.selectedId])
            this._debuggerContents[this.state.selectedId].toggleSignalMonitor();
        }}
        onReportIssue={this._startIssueReport}
        canReportIssue={
          this._canReportIssue() &&
          !activeIssueReport &&
          !isIssueReportStarting &&
          !isIssueReportSaving
        }
        isReportingIssue={
          !!activeIssueReport || isIssueReportStarting || isIssueReportSaving
        }
      />
    );
  };

  componentDidMount() {
    this._registerServerCallbacks();
  }

  componentWillUnmount() {
    this._isUnmounted = true;
    const { activeIssueReport } = this.state;
    if (activeIssueReport) {
      const { previewDebuggerServer } = this.props;
      previewDebuggerServer.sendMessage(activeIssueReport.debuggerId, {
        command: 'issueReport.stopAnnotation',
      });
      if (!activeIssueReport.wasPaused) {
        previewDebuggerServer.sendMessage(activeIssueReport.debuggerId, {
          command: 'play',
        });
      }
    }
    if (this.state.unregisterDebuggerServerCallbacks) {
      this.state.unregisterDebuggerServerCallbacks();
    }
  }

  _getLogsManager(id: DebuggerId): LogsManager {
    let result = this._debuggerLogs.get(id);
    if (!result) {
      result = new LogsManager();
      this._debuggerLogs.set(id, result);
    }
    return result;
  }

  _registerServerCallbacks = () => {
    const { previewDebuggerServer } = this.props;
    const { unregisterDebuggerServerCallbacks } = this.state;
    if (
      unregisterDebuggerServerCallbacks &&
      previewDebuggerServer.getServerState() === 'started'
    )
      return; // Server already started and callbacks registered

    if (unregisterDebuggerServerCallbacks) unregisterDebuggerServerCallbacks(); // Unregister old callbacks, if any

    // Register new callbacks
    const unregisterCallbacks = previewDebuggerServer.registerCallbacks({
      onErrorReceived: err => {
        this.setState(
          {
            debuggerServerError: err,
          },
          () => this.updateToolbar()
        );
      },
      onConnectionClosed: ({ id, debuggerIds }) => {
        const didCloseActiveIssueReport =
          !!this.state.activeIssueReport &&
          this.state.activeIssueReport.debuggerId === id;
        this._debuggerLogs.delete(id);
        this.setState(
          ({
            selectedId,
            debuggerGameData,
            profilerOutputs,
            profilingInProgress,
            signalDiagnostics,
            debuggerStatus,
            activeIssueReport,
            isIssueReportSaving,
            issueReportDescription,
            issueReportError,
            issueReportWarning,
          }) => {
            // Remove any data bound to the instance that might have been stored.
            // Otherwise this would be a memory leak.
            if (debuggerGameData[id]) delete debuggerGameData[id];
            if (profilerOutputs[id]) delete profilerOutputs[id];
            if (profilingInProgress[id]) delete profilingInProgress[id];
            if (signalDiagnostics.hasOwnProperty(id)) {
              delete signalDiagnostics[id];
            }
            if (debuggerStatus[id]) delete debuggerStatus[id];
            const isClosingActiveIssueReport = !!(
              activeIssueReport && activeIssueReport.debuggerId === id
            );

            return {
              debuggerIds,
              selectedId:
                selectedId !== id
                  ? selectedId
                  : debuggerIds.length
                  ? debuggerIds[debuggerIds.length - 1]
                  : selectedId,
              debuggerGameData,
              profilerOutputs,
              profilingInProgress,
              signalDiagnostics,
              debuggerStatus,
              activeIssueReport: isClosingActiveIssueReport
                ? null
                : activeIssueReport,
              isIssueReportSaving: isClosingActiveIssueReport
                ? false
                : isIssueReportSaving,
              issueReportDescription: isClosingActiveIssueReport
                ? ''
                : issueReportDescription,
              issueReportError: isClosingActiveIssueReport
                ? null
                : issueReportError,
              issueReportWarning: isClosingActiveIssueReport
                ? null
                : issueReportWarning,
            };
          },
          () => {
            this.updateToolbar();
            if (didCloseActiveIssueReport) {
              showErrorBox({
                message:
                  'The game preview closed before the issue report was saved.',
                rawError: null,
                errorId: 'issue-report-preview-closed',
                doNotReport: true,
              });
            }
          }
        );
      },
      onConnectionOpened: ({ id, debuggerIds }) => {
        this.setState(state => {
          const isPreparingOrEditingIssueReport =
            state.isIssueReportStarting || !!state.activeIssueReport;
          return {
            debuggerIds,
            selectedId: isPreparingOrEditingIssueReport ? state.selectedId : id,
          };
        }, this.updateToolbar);
      },
      onConnectionErrored: ({ id, errorMessage }) => {
        this._getLogsManager(id).addLog({
          type: 'error',
          timestamp: performance.now(),
          group: 'Debugger connection',
          message: 'The debugger connection errored: ' + errorMessage,
        });
      },
      onServerStateChanged: () => {
        this.setState(
          {
            debuggerServerState: previewDebuggerServer.getServerState(),
          },
          () => this.updateToolbar()
        );
      },
      onHandleParsedMessage: ({ id, parsedMessage }) => {
        this._handleMessage(id, parsedMessage);
      },
    });
    this.setState({
      unregisterDebuggerServerCallbacks: unregisterCallbacks,
    });

    // Fetch the status of each debugger client.
    previewDebuggerServer.getExistingDebuggerIds().forEach(debuggerId => {
      previewDebuggerServer.sendMessage(debuggerId, { command: 'getStatus' });
    });
  };

  _handleMessage = (id: DebuggerId, data: any) => {
    if (data.command === 'dump') {
      this.setState({
        debuggerGameData: {
          ...this.state.debuggerGameData,
          [id]: data.payload,
        },
      });
    } else if (data.command === 'status') {
      this.setState(
        state => ({
          debuggerStatus: {
            ...state.debuggerStatus,
            [id]: data.payload,
          },
        }),
        () => this.updateToolbar()
      );
    } else if (data.command === 'signalDiagnostics') {
      this.setState(state => ({
        signalDiagnostics: {
          ...state.signalDiagnostics,
          [id]: data.payload,
        },
      }));
    } else if (data.command === 'profiler.output') {
      this.setState({
        profilerOutputs: {
          ...this.state.profilerOutputs,
          [id]: data.payload,
        },
      });
    } else if (data.command === 'profiler.started') {
      this.setState(state => ({
        profilingInProgress: { ...state.profilingInProgress, [id]: true },
      }));
    } else if (data.command === 'profiler.stopped') {
      this.setState(state => ({
        profilingInProgress: { ...state.profilingInProgress, [id]: false },
      }));
    } else if (data.command === 'hotReloader.logs') {
      // Nothing to do.
    } else if (data.command === 'updateInstances') {
      // Nothing to do.
    } else if (data.command === 'console.log') {
      // Filter out unavoidable warnings that do not concern non-engine devs.
      if (isUnavoidableLibraryWarning(data.payload)) return;
      this._getLogsManager(id).addLog(data.payload);
    } else if (data.command === 'issueReport.annotationLimitReached') {
      if (
        this.state.activeIssueReport &&
        this.state.activeIssueReport.debuggerId === id
      ) {
        this.setState({
          issueReportWarning:
            'The annotation is very large. Clear some strokes or save the report.',
        });
      }
    } else if (data.command.indexOf('issueReport.') === 0) {
      // Responses are handled by the targeted request promise.
    } else {
      console.warn(
        'Unknown command received from debugger client:',
        data.command
      );
    }
  };

  _play = (id: DebuggerId) => {
    const { previewDebuggerServer } = this.props;
    previewDebuggerServer.sendMessage(id, { command: 'play' });

    // Pause status is transmitted by the game (using `status`).
  };

  _pause = (id: DebuggerId) => {
    const { previewDebuggerServer } = this.props;
    previewDebuggerServer.sendMessage(id, { command: 'pause' });

    // Pause status is transmitted by the game (using `status`).
  };

  _refresh = (id: DebuggerId) => {
    const { previewDebuggerServer } = this.props;
    previewDebuggerServer.sendMessage(id, { command: 'refresh' });
  };

  _canReportIssue = (): boolean => {
    const { previewDebuggerServer, project } = this.props;
    const { selectedId, debuggerStatus } = this.state;
    return (
      this._hasSelectedDebugger() &&
      !!debuggerStatus[selectedId] &&
      previewDebuggerServer
        .getExistingPreviewDebuggerIds()
        .indexOf(selectedId) !== -1 &&
      !!getLocalProjectRoot(project.getProjectFile())
    );
  };

  _validateIssueReportResponse = (
    response: any,
    expectedCommand: string
  ): any => {
    if (!response || response.command !== expectedCommand) {
      throw new Error(
        `The preview returned an unexpected response while preparing the report.`
      );
    }
    if (response.payload && response.payload.error) {
      throw new Error(response.payload.error);
    }
    return response.payload;
  };

  _startIssueReport = async (): Promise<void> => {
    if (
      !this._canReportIssue() ||
      this.state.isIssueReportStarting ||
      this.state.isIssueReportSaving ||
      this.state.activeIssueReport
    ) {
      return;
    }
    const { previewDebuggerServer } = this.props;
    const { selectedId, debuggerStatus } = this.state;
    const wasPaused = !!(
      debuggerStatus[selectedId] && debuggerStatus[selectedId].isPaused
    );

    this.setState(
      {
        isIssueReportStarting: true,
        issueReportError: null,
        issueReportWarning: null,
        issueReportTool: 'freehand',
      },
      this.updateToolbar
    );

    try {
      const pauseResponse = await previewDebuggerServer.sendMessageToDebuggerWithResponse(
        selectedId,
        { command: 'pause' },
        5000
      );
      const pauseStatus = this._validateIssueReportResponse(
        pauseResponse,
        'status'
      );
      if (!pauseStatus || !pauseStatus.isPaused) {
        throw new Error('The game did not confirm that it was paused.');
      }

      const dumpResponse = await previewDebuggerServer.sendMessageToDebuggerWithResponse(
        selectedId,
        { command: 'refresh' },
        15000
      );
      this._validateIssueReportResponse(dumpResponse, 'dump');

      const annotationResponse = await previewDebuggerServer.sendMessageToDebuggerWithResponse(
        selectedId,
        { command: 'issueReport.startAnnotation' },
        5000
      );
      this._validateIssueReportResponse(
        annotationResponse,
        'issueReport.annotationStarted'
      );

      if (
        this._isUnmounted ||
        this.state.selectedId !== selectedId ||
        previewDebuggerServer.getExistingDebuggerIds().indexOf(selectedId) ===
          -1
      ) {
        throw new Error(
          'The selected preview changed while opening the report.'
        );
      }

      this.setState(
        {
          activeIssueReport: {
            debuggerId: selectedId,
            wasPaused,
            runtimeDump: dumpResponse.payload,
            sceneName: pauseStatus.sceneName,
          },
          isIssueReportStarting: false,
          issueReportDescription: '',
          issueReportError: null,
          issueReportWarning: null,
          issueReportTool: 'freehand',
        },
        this.updateToolbar
      );
    } catch (error) {
      previewDebuggerServer.sendMessage(selectedId, {
        command: 'issueReport.stopAnnotation',
      });
      if (!wasPaused) {
        previewDebuggerServer.sendMessage(selectedId, { command: 'play' });
      }
      if (!this._isUnmounted) {
        this.setState({ isIssueReportStarting: false }, this.updateToolbar);
        showErrorBox({
          message: `Unable to start the issue report: ${error.message ||
            String(error)}`,
          rawError: error,
          errorId: 'issue-report-start-failed',
          doNotReport: true,
        });
      }
    }
  };

  _runIssueAnnotationCommand = async (command: string): Promise<void> => {
    const { activeIssueReport } = this.state;
    if (!activeIssueReport) return;
    this.setState({ issueReportError: null });
    try {
      const response = await this.props.previewDebuggerServer.sendMessageToDebuggerWithResponse(
        activeIssueReport.debuggerId,
        { command },
        5000
      );
      this._validateIssueReportResponse(
        response,
        'issueReport.annotationChanged'
      );
    } catch (error) {
      if (!this._isUnmounted) {
        this.setState({
          issueReportError: error.message || String(error),
        });
      }
    }
  };

  _setIssueAnnotationTool = async (
    tool: IssueAnnotationTool
  ): Promise<void> => {
    const {
      activeIssueReport,
      isIssueReportSaving,
      issueReportTool,
    } = this.state;
    if (!activeIssueReport || isIssueReportSaving || tool === issueReportTool) {
      return;
    }
    this.setState({ issueReportError: null });
    try {
      const response = await this.props.previewDebuggerServer.sendMessageToDebuggerWithResponse(
        activeIssueReport.debuggerId,
        {
          command: 'issueReport.setAnnotationTool',
          payload: { tool },
        },
        5000
      );
      const payload = this._validateIssueReportResponse(
        response,
        'issueReport.annotationToolChanged'
      );
      if (!payload || payload.tool !== tool) {
        throw new Error('The preview did not activate the drawing tool.');
      }
      if (!this._isUnmounted) {
        this.setState({ issueReportTool: tool });
      }
    } catch (error) {
      if (!this._isUnmounted) {
        this.setState({
          issueReportError: error.message || String(error),
        });
      }
    }
  };

  _cleanupIssueReport = async (
    issueReport: ActiveIssueReport
  ): Promise<?string> => {
    const warnings: Array<string> = [];
    const { previewDebuggerServer } = this.props;
    try {
      const stopResponse = await previewDebuggerServer.sendMessageToDebuggerWithResponse(
        issueReport.debuggerId,
        { command: 'issueReport.stopAnnotation' },
        5000
      );
      this._validateIssueReportResponse(
        stopResponse,
        'issueReport.annotationStopped'
      );
    } catch (error) {
      warnings.push(`Could not remove the annotation layer: ${error.message}`);
    }

    if (!issueReport.wasPaused) {
      try {
        const playResponse = await previewDebuggerServer.sendMessageToDebuggerWithResponse(
          issueReport.debuggerId,
          { command: 'play' },
          5000
        );
        this._validateIssueReportResponse(playResponse, 'status');
      } catch (error) {
        warnings.push(`Could not resume the game: ${error.message}`);
      }
    }
    return warnings.length ? warnings.join('\n') : null;
  };

  _cancelIssueReport = async (): Promise<void> => {
    const { activeIssueReport, isIssueReportSaving } = this.state;
    if (!activeIssueReport || isIssueReportSaving) return;
    this.setState({ isIssueReportSaving: true });
    const cleanupWarning = await this._cleanupIssueReport(activeIssueReport);
    if (this._isUnmounted) return;
    this.setState(
      {
        activeIssueReport: null,
        isIssueReportSaving: false,
        issueReportDescription: '',
        issueReportError: null,
        issueReportWarning: null,
      },
      this.updateToolbar
    );
    if (cleanupWarning) {
      showErrorBox({
        message: cleanupWarning,
        rawError: null,
        errorId: 'issue-report-cleanup-failed',
        doNotReport: true,
      });
    }
  };

  _saveIssueReport = async (): Promise<void> => {
    const {
      activeIssueReport,
      issueReportDescription,
      isIssueReportSaving,
    } = this.state;
    if (
      !activeIssueReport ||
      isIssueReportSaving ||
      !issueReportDescription.trim()
    ) {
      return;
    }

    this.setState({
      isIssueReportSaving: true,
      issueReportError: null,
    });
    try {
      const screenshotResponse = await this.props.previewDebuggerServer.sendMessageToDebuggerWithResponse(
        activeIssueReport.debuggerId,
        { command: 'issueReport.captureAnnotatedScreenshot' },
        15000
      );
      const screenshot = this._validateIssueReportResponse(
        screenshotResponse,
        'issueReport.screenshot'
      );
      if (!screenshot || !screenshot.dataUrl) {
        throw new Error('The preview did not return an annotated screenshot.');
      }

      const reportData: IssueReportData = {
        createdAt: new Date(),
        projectName: this.props.project.getName(),
        sceneName: activeIssueReport.sceneName,
        debuggerId: activeIssueReport.debuggerId,
        description: issueReportDescription,
        screenshotDataUrl: screenshot.dataUrl,
        runtimeDump: activeIssueReport.runtimeDump,
        consoleLogs: this._getLogsManager(
          activeIssueReport.debuggerId
        ).getAllLogs(),
      };
      const projectFile = this.props.project.getProjectFile();
      this.setState(
        {
          activeIssueReport: null,
          // Keep the toolbar action disabled while the file write and preview
          // cleanup finish, but close the modal so this work is non-blocking.
          isIssueReportSaving: true,
          issueReportDescription: '',
          issueReportError: null,
          issueReportWarning: null,
        },
        this.updateToolbar
      );
      this._persistIssueReportInBackground({
        activeIssueReport,
        projectFile,
        reportData,
      });
    } catch (error) {
      if (!this._isUnmounted) {
        const message = `Unable to save the issue report: ${error.message ||
          String(error)}`;
        this.setState(state => ({
          isIssueReportSaving: false,
          issueReportError: message,
          issueReportToastMessage: message,
          issueReportToastVisible: true,
          issueReportToastId: state.issueReportToastId + 1,
        }));
      }
    }
  };

  _persistIssueReportInBackground = ({
    activeIssueReport,
    projectFile,
    reportData,
  }: {|
    activeIssueReport: ActiveIssueReport,
    projectFile: string,
    reportData: IssueReportData,
  |}): void => {
    const cleanupPromise = this._cleanupIssueReport(activeIssueReport);
    writeIssueReport({ projectFile, data: reportData })
      .then(async reportPath => {
        const clipboardPath = getIssueReportClipboardPath(reportPath);
        const clipboardWarningPromise: Promise<?string> = copyTextToClipboard(
          clipboardPath
        ).then(
          (): ?string => null,
          (error): ?string =>
            `Could not copy ${clipboardPath} to the clipboard: ${error.message ||
              String(error)}`
        );
        const [cleanupWarning, clipboardWarning] = await Promise.all([
          cleanupPromise,
          clipboardWarningPromise,
        ]);
        if (this._isUnmounted) return;
        const warnings = [cleanupWarning, clipboardWarning].filter(Boolean);
        const message = `Issue report saved to ${reportPath}. ${
          clipboardWarning ? '' : `Copied ${clipboardPath} to the clipboard. `
        }${warnings.join(' ')}`.trim();
        this.setState(
          state => ({
            isIssueReportSaving: false,
            issueReportToastMessage: message,
            issueReportToastVisible: true,
            issueReportToastId: state.issueReportToastId + 1,
          }),
          this.updateToolbar
        );
      })
      .catch(async error => {
        const cleanupWarning = await cleanupPromise;
        const errorMessage = `Unable to save the issue report: ${error.message ||
          String(error)}`;
        console.error(errorMessage, error);
        if (this._isUnmounted) return;
        this.setState(
          state => ({
            isIssueReportSaving: false,
            issueReportToastMessage: cleanupWarning
              ? `${errorMessage} ${cleanupWarning}`
              : errorMessage,
            issueReportToastVisible: true,
            issueReportToastId: state.issueReportToastId + 1,
          }),
          this.updateToolbar
        );
      });
  };

  _edit = (id: DebuggerId, path: Array<string>, newValue: any): any => {
    const { previewDebuggerServer } = this.props;
    previewDebuggerServer.sendMessage(id, {
      command: 'set',
      path,
      newValue,
    });

    setTimeout(() => this._refresh(id), 100);
    return true;
  };

  _call = (id: DebuggerId, path: Array<string>, args: Array<any>): any => {
    const { previewDebuggerServer } = this.props;
    previewDebuggerServer.sendMessage(id, {
      command: 'call',
      path,
      args,
    });

    setTimeout(() => this._refresh(id), 100);
    return true;
  };

  _startProfiler = (id: DebuggerId) => {
    const { previewDebuggerServer } = this.props;
    previewDebuggerServer.sendMessage(id, { command: 'profiler.start' });
  };

  _stopProfiler = (id: DebuggerId) => {
    const { previewDebuggerServer } = this.props;
    previewDebuggerServer.sendMessage(id, { command: 'profiler.stop' });
  };

  _chooseDebugger = (id: DebuggerId): void => {
    if (this.state.isIssueReportStarting) return;
    if (!this.state.activeIssueReport) {
      this.setState({ selectedId: id }, this.updateToolbar);
      return;
    }

    this._cancelIssueReport().then(() => {
      if (!this._isUnmounted) {
        this.setState({ selectedId: id }, this.updateToolbar);
      }
    });
  };

  _hasSelectedDebugger = (): any => {
    const { selectedId, debuggerIds } = this.state;
    if (debuggerIds.indexOf(selectedId) === -1) return false;

    const debuggerStatus = this.state.debuggerStatus[selectedId];
    if (debuggerStatus && debuggerStatus.isInGameEdition) return false;

    return true;
  };

  render(): any {
    const {
      debuggerServerError,
      debuggerServerState,
      selectedId,
      debuggerStatus,
      debuggerGameData,
      profilerOutputs,
      profilingInProgress,
      signalDiagnostics,
      activeIssueReport,
      isIssueReportSaving,
      issueReportDescription,
      issueReportError,
      issueReportWarning,
      issueReportTool,
      issueReportToastMessage,
      issueReportToastVisible,
      issueReportToastId,
    } = this.state;

    return (
      <React.Fragment>
        <Background>
          {debuggerServerState === 'stopped' && !debuggerServerError && (
            <PlaceholderMessage>
              <PlaceholderLoader />
              <Text>
                <Trans>Debugger is starting...</Trans>
              </Text>
            </PlaceholderMessage>
          )}
          {debuggerServerState === 'stopped' && debuggerServerError && (
            <PlaceholderMessage>
              <Text>
                <Trans>
                  Unable to start the debugger server! Make sure that you are
                  authorized to run servers on this computer.
                </Trans>
              </Text>
            </PlaceholderMessage>
          )}
          {debuggerServerState === 'started' && (
            <Column expand noMargin>
              <DebuggerSelector
                selectedId={selectedId}
                debuggerStatus={debuggerStatus}
                onChooseDebugger={this._chooseDebugger}
              />
              {this._hasSelectedDebugger() && (
                <DebuggerContent
                  ref={debuggerContent =>
                    (this._debuggerContents[selectedId] = debuggerContent)
                  }
                  gameData={debuggerGameData[selectedId]}
                  onPlay={() => this._play(selectedId)}
                  onPause={() => this._pause(selectedId)}
                  onRefresh={() => this._refresh(selectedId)}
                  onEdit={(path, args) => this._edit(selectedId, path, args)}
                  onCall={(path, args) => this._call(selectedId, path, args)}
                  onStartProfiler={() => this._startProfiler(selectedId)}
                  onStopProfiler={() => this._stopProfiler(selectedId)}
                  profilerOutput={profilerOutputs[selectedId]}
                  profilingInProgress={profilingInProgress[selectedId]}
                  logsManager={this._getLogsManager(selectedId)}
                  signalDiagnostics={signalDiagnostics[selectedId]}
                  onOpenedEditorsChanged={this.updateToolbar}
                />
              )}
              {!this._hasSelectedDebugger() && (
                <EmptyMessage>
                  <Trans>
                    Run a preview and you will be able to inspect it with the
                    debugger.
                  </Trans>
                </EmptyMessage>
              )}
            </Column>
          )}
        </Background>
        <IssueReportDialog
          open={!!activeIssueReport}
          description={issueReportDescription}
          onDescriptionChange={description =>
            this.setState({ issueReportDescription: description })
          }
          onUndo={() =>
            this._runIssueAnnotationCommand('issueReport.undoAnnotation')
          }
          onClear={() =>
            this._runIssueAnnotationCommand('issueReport.clearAnnotation')
          }
          selectedTool={issueReportTool}
          onToolChange={this._setIssueAnnotationTool}
          onCancel={this._cancelIssueReport}
          onSave={this._saveIssueReport}
          isSaving={isIssueReportSaving}
          error={issueReportError}
          warning={issueReportWarning}
        />
        <InfoBar
          key={issueReportToastId}
          visible={issueReportToastVisible}
          message={issueReportToastMessage}
          hide={() => this.setState({ issueReportToastVisible: false })}
          duration={5000}
          closable
        />
      </React.Fragment>
    );
  }
}
