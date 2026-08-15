// @noflow
import * as React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import Toolbar from './Toolbar';

jest.mock('../UI/IconButton', () => {
  const React = require('react');
  return function MockIconButton(props) {
    return React.createElement(
      'button',
      {
        id: props.id,
        onClick: props.onClick,
        disabled: props.disabled,
        title: props.tooltip,
      },
      props.children
    );
  };
});
jest.mock('../UI/Toolbar', () => {
  const React = require('react');
  return {
    ToolbarGroup: props => React.createElement('div', null, props.children),
  };
});
jest.mock('../UI/FlatButton', () => () => null);
jest.mock('../UI/RaisedButton', () => () => null);

const makeProps = overrides => ({
  onPlay: jest.fn(),
  canPlay: false,
  onPause: jest.fn(),
  canPause: true,
  isProfilerShown: false,
  onToggleProfiler: jest.fn(),
  canOpenProfiler: true,
  isConsoleShown: false,
  onToggleConsole: jest.fn(),
  canOpenConsole: true,
  isSignalMonitorShown: false,
  onToggleSignalMonitor: jest.fn(),
  canOpenSignalMonitor: true,
  onReportIssue: jest.fn(),
  canReportIssue: true,
  isReportingIssue: false,
  ...overrides,
});

describe('Debugger Toolbar', () => {
  it('places the report action before the profiler and invokes it', () => {
    const props = makeProps();
    const component = TestRenderer.create(<Toolbar {...props} />);
    const buttonIds = component.root
      .findAll(node => node.type === 'button')
      .map(node => node.props.id);

    expect(buttonIds.indexOf('report-game-issue-button')).toBeLessThan(
      buttonIds.indexOf('debugger-profiler-button')
    );
    const reportButton = component.root.find(
      node =>
        node.type === 'button' && node.props.id === 'report-game-issue-button'
    );
    act(() => reportButton.props.onClick());
    expect(props.onReportIssue).toHaveBeenCalledTimes(1);
    expect(reportButton.props.title.id).toBe('Report an issue (R R)');
  });

  it('disables the report action when reporting is unavailable or active', () => {
    const component = TestRenderer.create(
      <Toolbar {...makeProps({ canReportIssue: false })} />
    );
    const getReportButton = () =>
      component.root.find(
        node =>
          node.type === 'button' && node.props.id === 'report-game-issue-button'
      );

    expect(getReportButton().props.disabled).toBe(true);
    act(() =>
      component.update(
        <Toolbar
          {...makeProps({ canReportIssue: true, isReportingIssue: true })}
        />
      )
    );
    expect(getReportButton().props.disabled).toBe(true);
  });
});
