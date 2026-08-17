// @flow
import { Trans } from '@lingui/macro';

import * as React from 'react';
import Dialog, { DialogPrimaryButton } from '../UI/Dialog';
import FlatButton from '../UI/FlatButton';
import Text from '../UI/Text';
import TextField from '../UI/TextField';
import SelectField from '../UI/SelectField';
import SelectOption from '../UI/SelectOption';
import { TSL_MATERIAL_EXAMPLES } from '../ProjectsStorage/TSLMaterialAuthoring';

type Props = {|
  open: boolean,
  error: ?string,
  onCancel: () => void,
  onCreate: (string, string) => void | Promise<void>,
|};

export const normalizeTSLMaterialBaseName = (rawFileName: string): string => {
  const withoutExtension = rawFileName.trim().replace(/\.tsl\.ts$/i, '');
  const withoutInvalidPathCharacters = withoutExtension.replace(
    /[<>:"/\\|?*]/g,
    '-'
  );
  return withoutInvalidPathCharacters.replace(/[. ]+$/g, '');
};

const TSLMaterialFileNameDialog = ({
  open,
  error,
  onCancel,
  onCreate,
}: Props): React.Node => {
  const [fileName, setFileName] = React.useState('Material');
  const [template, setTemplate] = React.useState('minimal');
  const normalizedBaseName = normalizeTSLMaterialBaseName(fileName);
  const fileNameToCreate = normalizedBaseName
    ? `${normalizedBaseName}.tsl.ts`
    : '';

  React.useEffect(
    () => {
      if (!open) return;
      setFileName('Material');
      setTemplate('minimal');
    },
    [open]
  );

  if (!open) return null;
  return (
    <Dialog
      title={<Trans>Create TSL material</Trans>}
      open
      actions={[
        <FlatButton
          key="cancel"
          label={<Trans>Cancel</Trans>}
          onClick={onCancel}
        />,
        <DialogPrimaryButton
          key="create"
          label={<Trans>Create</Trans>}
          primary
          disabled={!fileNameToCreate}
          onClick={() => onCreate(fileNameToCreate, template)}
        />,
      ]}
      onRequestClose={onCancel}
      onApply={() => {
        if (fileNameToCreate) onCreate(fileNameToCreate, template);
      }}
      maxWidth="sm"
    >
      <TextField
        value={fileName}
        onChange={(event, value) => setFileName(value)}
        floatingLabelText={<Trans>Material name</Trans>}
        fullWidth
        autoFocus="desktop"
      />
      <SelectField
        value={template}
        onChange={(event, index, value) => setTemplate(value)}
        floatingLabelText={<Trans>Template</Trans>}
        fullWidth
      >
        {TSL_MATERIAL_EXAMPLES.map(example => (
          <SelectOption
            key={example.template}
            value={example.template}
            label={example.label}
          />
        ))}
      </SelectField>
      {!!fileNameToCreate && (
        <Text noMargin color="secondary">
          <Trans>File to create:</Trans> {fileNameToCreate}
        </Text>
      )}
      {!!error && (
        <Text noMargin color="error">
          {error}
        </Text>
      )}
    </Dialog>
  );
};

export default TSLMaterialFileNameDialog;
