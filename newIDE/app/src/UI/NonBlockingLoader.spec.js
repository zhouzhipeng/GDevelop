/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"http://localhost/"}
 */
// @flow
import * as React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import NonBlockingLoader from './NonBlockingLoader';

jest.mock('@lingui/react', () => ({
  I18n: ({ children }: {| children: Function |}) =>
    children({
      i18n: {
        _: descriptor =>
          typeof descriptor === 'string'
            ? descriptor
            : descriptor.id || descriptor.message || '',
      },
    }),
}));

describe('NonBlockingLoader', () => {
  let container: HTMLDivElement;
  let root: any;
  let previousActEnvironment: any;

  beforeEach(() => {
    previousActEnvironment = (global: any).IS_REACT_ACT_ENVIRONMENT;
    (global: any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    const body = document.body;
    if (!body) throw new Error('Document body not found.');
    body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    (global: any).IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    jest.useRealTimers();
  });

  it('shows preview progress without mounting an input-blocking modal', () => {
    const onEditorOperation: any = jest.fn();
    act(() => {
      root.render(
        <>
          <button id="editor-operation" onClick={onEditorOperation} />
          <NonBlockingLoader showImmediately message="Loading preview..." />
        </>
      );
    });

    const loader: any = document.querySelector(
      '[data-gdevelop-non-blocking-loader]'
    );
    expect(loader).not.toBe(null);
    expect(loader.style.pointerEvents).toBe('none');
    expect(document.querySelector('.MuiModal-root')).toBe(null);
    expect(document.querySelector('.MuiBackdrop-root')).toBe(null);

    const editorOperation = document.getElementById('editor-operation');
    if (!editorOperation) throw new Error('Editor operation not found.');
    act(() => {
      editorOperation.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onEditorOperation).toHaveBeenCalledTimes(1);
  });

  it('can delay short-lived preview progress without leaving stale UI', () => {
    jest.useFakeTimers();
    act(() => {
      root.render(
        <NonBlockingLoader
          showImmediately={false}
          showAfterDelay
          message="Loading preview..."
        />
      );
    });
    expect(document.querySelector('[data-gdevelop-non-blocking-loader]')).toBe(
      null
    );

    act(() => jest.advanceTimersByTime(150));
    expect(
      document.querySelector('[data-gdevelop-non-blocking-loader]')
    ).not.toBe(null);

    act(() => {
      root.render(
        <NonBlockingLoader
          showImmediately={false}
          showAfterDelay={false}
          message="Loading preview..."
        />
      );
    });
    expect(document.querySelector('[data-gdevelop-non-blocking-loader]')).toBe(
      null
    );
  });
});
