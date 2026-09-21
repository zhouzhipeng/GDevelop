// @flow
import { t, Trans } from '@lingui/macro';
import { I18n } from '@lingui/react';
import * as React from 'react';
import Dialog, { DialogPrimaryButton } from '../UI/Dialog';
import FlatButton from '../UI/FlatButton';
import IconButton from '../UI/IconButton';
import TextField from '../UI/TextField';
import Text from '../UI/Text';
import AlertMessage from '../UI/AlertMessage';
import { ColumnStackLayout } from '../UI/Layout';
import UndoIcon from '../UI/CustomSvgIcons/Undo';
import TrashIcon from '../UI/CustomSvgIcons/Trash';
import BrushIcon from '../UI/CustomSvgIcons/Brush';
import RectangleIcon from '../UI/CustomSvgIcons/Rectangle';
import ArrowIcon from '@material-ui/icons/TrendingFlat';
import CompactToggleButtons from '../UI/CompactToggleButtons';
import VideocamIcon from '@material-ui/icons/Videocam';
import StopIcon from '@material-ui/icons/Stop';
import classes from './IssueReportDialog.module.css';

export type IssueAnnotationTool = 'freehand' | 'rectangle' | 'arrow';

type Props = {|
  open: boolean,
  description: string,
  onDescriptionChange: string => void,
  onUndo: () => void | Promise<void>,
  onClear: () => void | Promise<void>,
  selectedTool: IssueAnnotationTool,
  onToolChange: IssueAnnotationTool => void | Promise<void>,
  onCancel: () => void | Promise<void>,
  onSave: () => void | Promise<void>,
  isSaving: boolean,
  isRecording?: boolean,
  isRecordingBusy?: boolean,
  recordingDataUrl?: ?string,
  onStartRecording?: () => void | Promise<void>,
  onStopRecording?: () => void | Promise<void>,
  error: ?string,
  warning: ?string,
|};

const IssueReportDialog = ({
  open,
  description,
  onDescriptionChange,
  onUndo,
  onClear,
  selectedTool,
  onToolChange,
  onCancel,
  onSave,
  isSaving,
  isRecording = false,
  isRecordingBusy = false,
  recordingDataUrl,
  onStartRecording,
  onStopRecording,
  error,
  warning,
}: Props): React.Node => (
  <Dialog
    open={open}
    title={<Trans>Report an issue</Trans>}
    onRequestClose={onCancel}
    cannotBeDismissed={isSaving || isRecordingBusy}
    maxWidth="sm"
    id="issue-report-dialog"
    actions={[
      <FlatButton
        key="cancel"
        label={<Trans>Cancel</Trans>}
        onClick={onCancel}
        disabled={isSaving || isRecordingBusy}
      />,
      <DialogPrimaryButton
        key="save"
        primary
        label={isSaving ? <Trans>Saving...</Trans> : <Trans>Save report</Trans>}
        onClick={onSave}
        disabled={
          isSaving || isRecordingBusy || isRecording || !description.trim()
        }
      />,
    ]}
  >
    <ColumnStackLayout noMargin>
      <div className={classes.tools}>
        <div className={classes.toolRow}>
          {onStartRecording && onStopRecording && (
            <FlatButton
              leftIcon={isRecording ? <StopIcon /> : <VideocamIcon />}
              color={isRecording ? 'danger' : undefined}
              label={
                isRecording ? (
                  <Trans>Stop recording</Trans>
                ) : isRecordingBusy ? (
                  <Trans>Processing...</Trans>
                ) : recordingDataUrl ? (
                  <Trans>Record again</Trans>
                ) : (
                  <Trans>Record</Trans>
                )
              }
              onClick={isRecording ? onStopRecording : onStartRecording}
              disabled={isSaving || isRecordingBusy}
            />
          )}
          <div className={classes.annotationTools}>
            <CompactToggleButtons
              id="issue-report-annotation-tools"
              buttons={[
                {
                  id: 'issue-report-freehand-tool',
                  label: <Trans>Freehand</Trans>,
                  tooltip: <Trans>Draw freehand</Trans>,
                  renderIcon: className => <BrushIcon className={className} />,
                  onClick: () => {
                    onToolChange('freehand');
                  },
                  isActive: selectedTool === 'freehand',
                  disabled: isSaving || isRecordingBusy || isRecording,
                },
                {
                  id: 'issue-report-rectangle-tool',
                  label: <Trans>Rectangle</Trans>,
                  tooltip: <Trans>Draw a rectangle</Trans>,
                  renderIcon: className => (
                    <RectangleIcon className={className} />
                  ),
                  onClick: () => {
                    onToolChange('rectangle');
                  },
                  isActive: selectedTool === 'rectangle',
                  disabled: isSaving || isRecordingBusy || isRecording,
                },
                {
                  id: 'issue-report-arrow-tool',
                  label: <Trans>Arrow</Trans>,
                  tooltip: <Trans>Draw an arrow</Trans>,
                  renderIcon: className => <ArrowIcon className={className} />,
                  onClick: () => {
                    onToolChange('arrow');
                  },
                  isActive: selectedTool === 'arrow',
                  disabled: isSaving || isRecordingBusy || isRecording,
                },
              ]}
            />
            <I18n key="undo">
              {({ i18n }) => (
                <IconButton
                  size="small"
                  tooltip={t`Undo last annotation`}
                  aria-label={i18n._(t`Undo last annotation`)}
                  onClick={onUndo}
                  disabled={isSaving || isRecordingBusy || isRecording}
                >
                  <UndoIcon />
                </IconButton>
              )}
            </I18n>
            <I18n key="clear">
              {({ i18n }) => (
                <IconButton
                  size="small"
                  tooltip={t`Clear annotations`}
                  aria-label={i18n._(t`Clear annotations`)}
                  onClick={onClear}
                  disabled={isSaving || isRecordingBusy || isRecording}
                >
                  <TrashIcon />
                </IconButton>
              )}
            </I18n>
          </div>
        </div>
        <div role="status" aria-live="polite">
          <Text noMargin size="body-small" color="secondary">
            {isRecording ? (
              <Trans>
                Recording… Use the game preview. Stops after 60 seconds.
              </Trans>
            ) : isRecordingBusy ? (
              <Trans>Processing recording…</Trans>
            ) : (
              <Trans>Draw on the game preview to mark the problem.</Trans>
            )}
          </Text>
        </div>
      </div>
      {warning && <AlertMessage kind="warning">{warning}</AlertMessage>}
      {error && <AlertMessage kind="error">{error}</AlertMessage>}
      <TextField
        value={description}
        onChange={(event, value) => onDescriptionChange(value)}
        floatingLabelText={<Trans>What went wrong?</Trans>}
        translatableHintText={t`Explain what you expected and what happened.`}
        multiline
        rows={4}
        fullWidth
        required
        autoFocus="desktop"
        disabled={isSaving || isRecordingBusy}
      />
      {recordingDataUrl && !isRecording && !isRecordingBusy && (
        <div className={classes.recording}>
          <Text noMargin size="sub-title">
            <Trans>Recording preview</Trans>
          </Text>
          <I18n>
            {({ i18n }) => (
              <video
                controls
                preload="metadata"
                src={recordingDataUrl}
                className={classes.video}
                aria-label={i18n._(t`Game recording`)}
              />
            )}
          </I18n>
        </div>
      )}
      <details className={classes.help}>
        <summary>
          <Trans>How to use the tools</Trans>
        </summary>
        <Text size="body-small" color="secondary">
          <Trans>
            Draw with a mouse, pen, or touch in the game preview. Game input is
            blocked while marking. Use undo to remove the last mark or clear to
            remove all marks.
          </Trans>
        </Text>
        {onStartRecording && onStopRecording && (
          <Text size="body-small" color="secondary">
            <Trans>
              Record up to 60 seconds of gameplay. Keyboard, mouse, and touch
              input appear in the video and are saved as a timed input log.
              Starting a recording clears existing annotations. Game audio is
              not recorded.
            </Trans>
          </Text>
        )}
      </details>
    </ColumnStackLayout>
  </Dialog>
);

export default IssueReportDialog;
