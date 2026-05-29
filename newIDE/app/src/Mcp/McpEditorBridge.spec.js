// @flow
import { createMcpEditorBridge } from './McpEditorBridge';

const gd: libGDevelop = global.gd;

describe('McpEditorBridge', () => {
  const makeBridge = (overrides: Object = {}) =>
    createMcpEditorBridge({
      getProject: () => null,
      getPermissions: () => ({
        allowWriteTools: false,
        allowCommandTools: false,
      }),
      i18n: {
        _: message => message.id,
      },
      editorCallbacks: {
        onOpenLayout: jest.fn(),
        onCreateProject: jest.fn(),
      },
      processEditorFunctionCalls: jest.fn(),
      triggerUnsavedChanges: jest.fn(),
      runCommand: jest.fn(),
      ...overrides,
    });

  it('lists MCP tools using current permissions', async () => {
    const bridge = makeBridge();

    const response = await bridge.handleRendererMcpRequest({
      method: 'tools/list',
      params: {},
    });

    expect(response.tools.map(tool => tool.name)).toContain(
      'gdevelop_get_editor_state'
    );
    expect(response.tools.map(tool => tool.name)).not.toContain('create_scene');
  });

  it('returns editor state without an open project', async () => {
    const bridge = makeBridge();

    const response = await bridge.handleRendererMcpRequest({
      method: 'tools/call',
      params: {
        name: 'gdevelop_get_editor_state',
        arguments: {},
      },
    });

    expect(response.content[0].text).toContain('"hasProject": false');
  });

  it('returns a project summary when a project is open', async () => {
    // $FlowFixMe[invalid-constructor]
    const project = new gd.ProjectHelper.createNewGDJSProject();
    project.setName('MCP Test Game');
    project.insertNewLayout('Level1', 0);

    try {
      const bridge = makeBridge({
        getProject: () => project,
      });

      const response = await bridge.handleRendererMcpRequest({
        method: 'tools/call',
        params: {
          name: 'gdevelop_get_project_summary',
          arguments: {},
        },
      });

      expect(response.content[0].text).toContain('MCP Test Game');
      expect(response.content[0].text).toContain('Level1');
    } finally {
      project.delete();
    }
  });

  it('blocks write tools when write permission is disabled', async () => {
    const bridge = makeBridge();

    const response = await bridge.handleRendererMcpRequest({
      method: 'tools/call',
      params: {
        name: 'create_scene',
        arguments: { scene_name: 'Blocked' },
      },
    });

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('Write MCP tools are disabled');
  });

  it('forwards allowed editor function calls and marks unsaved changes', async () => {
    const triggerUnsavedChanges: any = jest.fn();
    const processEditorFunctionCalls: any = (jest.fn(): any);
    processEditorFunctionCalls.mockResolvedValue({
      results: [
        {
          status: 'finished',
          call_id: 'mcp-call',
          success: true,
          didModifyProject: true,
          output: { message: 'Created scene.' },
        },
      ],
      createdSceneNames: [],
      createdProject: null,
    });
    const bridge = makeBridge({
      getPermissions: () => ({
        allowWriteTools: true,
        allowCommandTools: false,
      }),
      processEditorFunctionCalls,
      triggerUnsavedChanges,
    });

    const response = await bridge.handleRendererMcpRequest({
      method: 'tools/call',
      params: {
        name: 'create_scene',
        arguments: { scene_name: 'Level2' },
      },
    });

    expect(response.content[0].text).toContain('Created scene.');
    expect(processEditorFunctionCalls).toHaveBeenCalledWith(
      expect.objectContaining({
        functionCalls: [
          {
            name: 'create_scene',
            arguments: JSON.stringify({ scene_name: 'Level2' }),
            call_id: 'mcp-call',
          },
        ],
      })
    );
    expect(triggerUnsavedChanges).toHaveBeenCalled();
  });

  it('blocks MCP event generation-service fallback without direct events', async () => {
    const processEditorFunctionCalls: any = (jest.fn(): any);
    const bridge = makeBridge({
      getPermissions: () => ({
        allowWriteTools: true,
        allowCommandTools: false,
      }),
      processEditorFunctionCalls,
    });

    const response = await bridge.handleRendererMcpRequest({
      method: 'tools/call',
      params: {
        name: 'add_scene_events',
        arguments: {
          scene_name: 'Level1',
          events_description: 'Add click events.',
        },
      },
    });

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain(
      'Pass events_json or event_changes'
    );
    expect(processEditorFunctionCalls).not.toHaveBeenCalled();

    const escapeHatchResponse = await bridge.handleRendererMcpRequest({
      method: 'tools/call',
      params: {
        name: 'gdevelop_editor_call',
        arguments: {
          name: 'add_scene_events',
          arguments: {
            scene_name: 'Level1',
            events_description: 'Add click events.',
          },
        },
      },
    });

    expect(escapeHatchResponse.isError).toBe(true);
    expect(escapeHatchResponse.content[0].text).toContain(
      'Pass events_json or event_changes'
    );
    expect(processEditorFunctionCalls).not.toHaveBeenCalled();
  });

  it('reads resource URIs', async () => {
    const bridge = makeBridge();

    const response = await bridge.handleRendererMcpRequest({
      method: 'resources/read',
      params: {
        uri: 'gdevelop://editor/state',
      },
    });

    expect(response.contents[0].uri).toBe('gdevelop://editor/state');
    expect(response.contents[0].mimeType).toBe('application/json');
    expect(response.contents[0].text).toContain('"hasProject": false');
  });
});
