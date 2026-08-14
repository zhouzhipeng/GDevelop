// @flow
import { t, Trans } from '@lingui/macro';
import * as React from 'react';
import Dialog, { DialogPrimaryButton } from '../UI/Dialog';
import FlatButton from '../UI/FlatButton';
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
  error,
  warning,
}: Props): React.Node => (
  <Dialog
    open={open}
    title={<Trans>Report an issue</Trans>}
    subtitle={
      <Trans>Describe the problem and draw directly on the paused game.</Trans>
    }
    onRequestClose={onCancel}
    cannotBeDismissed={isSaving}
    maxWidth="sm"
    id="issue-report-dialog"
    actions={[
      <FlatButton
        key="cancel"
        label={<Trans>Cancel</Trans>}
        onClick={onCancel}
        disabled={isSaving}
      />,
      <DialogPrimaryButton
        key="save"
        primary
        label={isSaving ? <Trans>Saving...</Trans> : <Trans>Save report</Trans>}
        onClick={onSave}
        disabled={isSaving || !description.trim()}
      />,
    ]}
    secondaryActions={[
      <FlatButton
        key="undo"
        label={<Trans>Undo last annotation</Trans>}
        leftIcon={<UndoIcon />}
        onClick={onUndo}
        disabled={isSaving}
      />,
      <FlatButton
        key="clear"
        label={<Trans>Clear annotations</Trans>}
        leftIcon={<TrashIcon />}
        onClick={onClear}
        disabled={isSaving}
      />,
    ]}
  >
    <ColumnStackLayout noMargin>
      <Text noMargin>
        <Trans>
          Use the mouse, a pen, or touch in the game preview to mark the
          problem. Game input is blocked while the annotation layer is active.
        </Trans>
      </Text>
      <CompactToggleButtons
        id="issue-report-annotation-tools"
        expand
        buttons={[
          {
            id: 'issue-report-freehand-tool',
            label: t`Freehand`,
            tooltip: t`Draw freehand`,
            renderIcon: className => <BrushIcon className={className} />,
            onClick: () => {
              onToolChange('freehand');
            },
            isActive: selectedTool === 'freehand',
            disabled: isSaving,
          },
          {
            id: 'issue-report-rectangle-tool',
            label: t`Rectangle`,
            tooltip: t`Draw a rectangle`,
            renderIcon: className => <RectangleIcon className={className} />,
            onClick: () => {
              onToolChange('rectangle');
            },
            isActive: selectedTool === 'rectangle',
            disabled: isSaving,
          },
          {
            id: 'issue-report-arrow-tool',
            label: t`Arrow`,
            tooltip: t`Draw an arrow`,
            renderIcon: className => <ArrowIcon className={className} />,
            onClick: () => {
              onToolChange('arrow');
            },
            isActive: selectedTool === 'arrow',
            disabled: isSaving,
          },
        ]}
      />
      {warning && <AlertMessage kind="warning">{warning}</AlertMessage>}
      {error && <AlertMessage kind="error">{error}</AlertMessage>}
      <TextField
        value={description}
        onChange={(event, value) => onDescriptionChange(value)}
        floatingLabelText={<Trans>What went wrong?</Trans>}
        translatableHintText={t`Explain what you expected and what happened.`}
        multiline
        rows={5}
        rowsMax={12}
        fullWidth
        required
        autoFocus="desktop"
        disabled={isSaving}
      />
    </ColumnStackLayout>
  </Dialog>
);

export default IssueReportDialog;
