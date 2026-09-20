// @flow
import { EventsEditorContainer } from './EventsEditorContainer';
import { ExternalEventsEditorContainer } from './ExternalEventsEditorContainer';

jest.mock('../../SceneContextLifecycleFunctionsEditor', () => function() {});
jest.mock(
  '../../SceneContextLifecycleFunctionsEditor/SceneLifecycleFunctionParametersEditor',
  () => function() {}
);
jest.mock('../../EventsSheet', () => function EventsSheet() {});
jest.mock('../../EmbeddedGame/EmbeddedGameFrame', () => ({
  setEditorHotReloadNeeded: jest.fn(),
}));
jest.mock('../../InstructionOrExpression/EventsScope', () => {
  class ProjectScopedContainersAccessor {
    scope: any;

    constructor(scope: any) {
      this.scope = scope;
    }
  }

  return { ProjectScopedContainersAccessor };
});

const makeEditor = (snapshotName: string): any => {
  // $FlowFixMe[underconstrained-implicit-instantiation]
  const getEditorSelectionSnapshot = jest.fn(() => snapshotName);
  // $FlowFixMe[underconstrained-implicit-instantiation]
  const onEventsModifiedOutsideEditor = jest.fn();
  return {
    getEditorSelectionSnapshot,
    onEventsModifiedOutsideEditor,
  };
};

const makeLifecycleFunctionsEditor = (
  selectedEditor: any,
  editorsByName: { [string]: any }
): any => ({
  getSelectedEditor: jest.fn(() => selectedEditor),
  getEditor: jest.fn(name => editorsByName[name] || null),
  forEachEditor: jest.fn(callback =>
    Object.keys(editorsByName).forEach(name => callback(editorsByName[name]))
  ),
  selectFunctionByName: jest.fn(name =>
    ['sceneLoad', 'sceneSignal', 'sceneUpdate', 'sceneUnload'].includes(name)
  ),
});

describe('scene lifecycle editor containers', () => {
  it('adds the parameters toolbar button only to the scene signal editor', () => {
    const eventsFunction = ({}: any);
    const layout = ({
      getName: () => 'Test scene',
      getObjects: () => ({}: any),
      getLifecycleEventsFunctions: () => ({
        getByName: () => eventsFunction,
      }),
    }: any);
    const project = ({
      hasLayoutNamed: () => true,
      getLayout: () => layout,
      getObjects: () => ({}: any),
    }: any);
    const container: any = new EventsEditorContainer(
      ({ project, projectItemName: 'Test scene' }: any)
    );
    const sceneContextEditor = container.render();
    const openParameters = (jest.fn(): any);

    const signalEditor = sceneContextEditor.props.renderFunctionEditor({
      lifecycleFunctionName: 'sceneSignal',
      isSelected: true,
      editorRef: jest.fn(),
      onOpenParameters: openParameters,
    });
    expect(signalEditor.props.onOpenSettings).toBe(openParameters);
    expect(signalEditor.props.settingsIcon).toBeTruthy();
    expect(signalEditor.props.settingsTooltip).toBeTruthy();
    expect(signalEditor.props.settingsButtonPosition).toBe('start');

    const updateEditor = sceneContextEditor.props.renderFunctionEditor({
      lifecycleFunctionName: 'sceneUpdate',
      isSelected: true,
      editorRef: jest.fn(),
      onOpenParameters: null,
    });
    expect(updateEditor.props.onOpenSettings).toBeNull();
    expect(updateEditor.props.settingsIcon).toBeUndefined();
    expect(updateEditor.props.settingsTooltip).toBeUndefined();
    expect(updateEditor.props.settingsButtonPosition).toBeUndefined();
  });

  it('keeps one editor per visited scene lifecycle function and routes outside changes by role', () => {
    const scene = ({}: any);
    const container: any = new EventsEditorContainer(({}: any));
    const updateEditor = makeEditor('update-selection');
    const signalEditor = makeEditor('signal-selection');
    container.lifecycleFunctionsEditor = makeLifecycleFunctionsEditor(
      signalEditor,
      {
        sceneUpdate: updateEditor,
        sceneSignal: signalEditor,
      }
    );
    container.getLayout = () => scene;

    expect(container.getEditorSelectionSnapshot()).toBe('signal-selection');

    const changedIds = new Set<string>(['changed-event']);
    container.onSceneEventsModifiedOutsideEditor({
      scene,
      lifecycleFunctionName: 'sceneUpdate',
      newOrChangedAiGeneratedEventIds: changedIds,
    });

    expect(updateEditor.onEventsModifiedOutsideEditor).toHaveBeenCalledWith({
      newOrChangedAiGeneratedEventIds: changedIds,
    });
    expect(signalEditor.onEventsModifiedOutsideEditor).not.toHaveBeenCalled();
  });

  it('routes external-events changes to its single fragment editor', () => {
    const externalEvents = ({}: any);
    const container: any = new ExternalEventsEditorContainer(({}: any));
    const editor = makeEditor('fragment-selection');
    container.eventsEditor = editor;
    container.getExternalEvents = () => externalEvents;
    expect(container.getEditorSelectionSnapshot()).toBe('fragment-selection');
    const changedIds = new Set<string>(['external-event']);
    container.onSceneEventsModifiedOutsideEditor({
      scene: ({}: any),
      externalEvents,
      newOrChangedAiGeneratedEventIds: changedIds,
    });
    expect(editor.onEventsModifiedOutsideEditor).toHaveBeenCalledWith({
      newOrChangedAiGeneratedEventIds: changedIds,
    });
    expect(container.lifecycleFunctionsEditor).toBeUndefined();
    expect(container.selectLifecycleFunctionByName).toBeUndefined();
  });
});
