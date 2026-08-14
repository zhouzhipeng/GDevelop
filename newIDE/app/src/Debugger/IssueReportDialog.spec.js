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
jest.mock('../UI/CompactToggleButtons', () => {
  const React = require('react');
  return props =>
    React.createElement(
      'div',
      null,
      props.buttons.map(button =>
        React.createElement(
          'button',
          {
            key: button.id,
            id: button.id,
            disabled: button.disabled,
            'data-active': button.isActive,
            onClick: button.onClick,
          },
          React.createElement('span', null, button.label),
          React.createElement('span', null, button.tooltip)
        )
      )
    );
});

const makeProps = overrides => ({
  open: true,
  description: '',
  onDescriptionChange: jest.fn(),
  onUndo: jest.fn(),
  onClear: jest.fn(),
  selectedTool: 'freehand',
  onToolChange: jest.fn(),
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

  it('selects freehand, rectangle and arrow drawing tools', () => {
    const props = makeProps({ selectedTool: 'rectangle' });
    const component = TestRenderer.create(<IssueReportDialog {...props} />);
    const findButton = id =>
      component.root.find(
        node => node.type === 'button' && node.props.id === id
      );

    expect(findButton('issue-report-freehand-tool').props['data-active']).toBe(
      false
    );
    expect(findButton('issue-report-rectangle-tool').props['data-active']).toBe(
      true
    );
    expect(findButton('issue-report-arrow-tool').props['data-active']).toBe(
      false
    );
    findButton('issue-report-arrow-tool').props.onClick();
    expect(props.onToolChange).toHaveBeenCalledWith('arrow');
  });

  it('renders translated tool labels and tooltips as React nodes', () => {
    expect(() =>
      TestRenderer.create(<IssueReportDialog {...makeProps()} />)
    ).not.toThrow();
  });

  it('disables drawing tools while saving', () => {
    const component = TestRenderer.create(
      <IssueReportDialog {...makeProps({ isSaving: true })} />
    );
    const toolButtons = component.root.findAll(
      node => node.type === 'button' && node.props.id
    );

    expect(toolButtons).toHaveLength(3);
    toolButtons.forEach(button => expect(button.props.disabled).toBe(true));
  });
});
