// @noflow
const {
  createProjectFileOpenHandler,
  createProjectFileWindowArgs,
} = require('../../electron-app/app/ProjectFileOpenHandler');

describe('ProjectFileOpenHandler', () => {
  it('builds ordinary project-window arguments from a document path', () => {
    expect(
      createProjectFileWindowArgs(
        {
          _: ['old-project.json'],
          'dev-tools': true,
          'run-command': 'validate_project_files',
          'cmd-args': '{}',
        },
        'C:\\games\\MyGame\\project.gdl'
      )
    ).toEqual({
      _: ['C:\\games\\MyGame\\project.gdl'],
      'dev-tools': true,
    });
  });

  it('queues document-open events until the app is ready', () => {
    const openProjectFile = jest.fn();
    const handler = createProjectFileOpenHandler({ openProjectFile });
    const firstEvent = { preventDefault: jest.fn() };
    const secondEvent = { preventDefault: jest.fn() };

    handler.handleOpenFile(firstEvent, '/games/First/project.gdl');
    handler.handleOpenFile(secondEvent, '/games/Second/project.gdl');

    expect(firstEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(secondEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(openProjectFile).not.toHaveBeenCalled();
    expect(handler.markReady()).toBe(2);
    expect(openProjectFile.mock.calls).toEqual([
      ['/games/First/project.gdl'],
      ['/games/Second/project.gdl'],
    ]);
    expect(handler.markReady()).toBe(0);
  });

  it('opens document paths immediately after the app is ready', () => {
    const openProjectFile = jest.fn();
    const handler = createProjectFileOpenHandler({ openProjectFile });
    handler.markReady();

    const event = { preventDefault: jest.fn() };
    handler.handleOpenFile(event, '/games/Current/project.gdl');

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(openProjectFile).toHaveBeenCalledWith('/games/Current/project.gdl');
  });

  it('ignores an empty document path after handling the event', () => {
    const openProjectFile = jest.fn();
    const handler = createProjectFileOpenHandler({ openProjectFile });
    handler.markReady();

    const event = { preventDefault: jest.fn() };
    handler.handleOpenFile(event, '');

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(openProjectFile).not.toHaveBeenCalled();
  });
});
