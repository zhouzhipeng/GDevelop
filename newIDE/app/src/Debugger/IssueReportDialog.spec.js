// @noflow
import * as React from 'react';
import TestRenderer from 'react-test-renderer';
import IssueReportDialog from './IssueReportDialog';

jest.mock('../UI/Dialog', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: props => React.createElement('div', null, props.children),
    DialogPrimaryButton: () => null,
  };
});
jest.mock('../UI/FlatButton', () => () => null);
jest.mock('../UI/TextField', () => () => null);
jest.mock('../UI/Text', () => {
  const React = require('react');
  return props => React.createElement('span', null, props.children);
});
jest.mock('../UI/AlertMessage', () => {
  const React = require('react');
  return props =>
    React.createElement(
      'div',
      { 'data-alert-kind': props.kind },
      props.children
    );
});
jest.mock('../UI/Layout', () => {
  const React = require('react');
  return {
    ColumnStackLayout: props =>
      React.createElement('div', null, props.children),
  };
});

const makeProps = overrides => ({
  open: true,
  description: '',
  onDescriptionChange: jest.fn(),
  onUndo: jest.fn(),
  onClear: jest.fn(),
  onCancel: jest.fn(),
  onSave: jest.fn(),
  isSaving: false,
  error: null,
  warning: null,
  ...overrides,
});

describe('IssueReportDialog', () => {
  it('does not show a static privacy warning', () => {
    const component = TestRenderer.create(
      <IssueReportDialog {...makeProps()} />
    );

    expect(
      component.root.findAll(
        node => node.props['data-alert-kind'] === 'warning'
      )
    ).toHaveLength(0);
  });

  it('still shows actionable annotation warnings', () => {
    const component = TestRenderer.create(
      <IssueReportDialog
        {...makeProps({ warning: 'The annotation limit was reached.' })}
      />
    );
    const warnings = component.root.findAll(
      node => node.props['data-alert-kind'] === 'warning'
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0].children).toContain('The annotation limit was reached.');
  });
});
