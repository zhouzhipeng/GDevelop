// @flow

import {
  buildProjectModuleMap,
  serializeProjectModuleMap,
} from './ProjectModuleMap';

describe('project module map', () => {
  test('reads links from current Settings source when editor events are stale', () => {
    const project = {
      properties: { name: 'Example' },
      layouts: [{ name: 'Game', events: [] }],
      externalEvents: [{ name: 'HUD', associatedLayout: 'Game', events: [] }],
      eventsFunctionsExtensions: [],
    };
    const files = {
      'game://scenes/Game/functions/sceneUpdate.gdl':
        'function {\n name = "sceneUpdate"\n events {\n link {\n target = "HUD"\n }\n }\n }\n',
    };
    const result = buildProjectModuleMap(project, files, () => null);
    expect(result.scenes[0].events[0].linkPaths).toEqual([
      'scenes/Game/external-events/HUD.gdl',
    ]);
  });

  test('routes nested links to settings and event sources deterministically', () => {
    const project = {
      properties: { name: 'Example' },
      layouts: [
        {
          name: 'Game',
          events: [
            {
              type: 'BuiltinCommonInstructions::Standard',
              events: [
                { type: 'BuiltinCommonInstructions::Link', target: 'HUD' },
                { type: 'BuiltinCommonInstructions::Link', target: 'Missing' },
              ],
            },
          ],
        },
      ],
      externalEvents: [{ name: 'HUD', associatedLayout: 'Game', events: [] }],
      eventsFunctionsExtensions: [
        {
          name: 'Local',
          eventsFunctions: [{ name: 'Update', events: [] }],
          eventsBasedObjects: [],
          eventsBasedBehaviors: [],
        },
      ],
    };
    const files = {
      'game://scenes/Game/functions/sceneUpdate.gdl':
        'function {\n name = "sceneUpdate"\n description = "Every frame"\n}\n',
      'game://scenes/Game/external-events/HUD.gdl':
        'external_events {\n name = "HUD"\n description = "Show player status"\n eventsLogic = "Refresh labels"\n}\n',
      'game://extensions/Local/functions/Update.gdl':
        'function {\n name = "Update"\n description = "Update local state"\n}\n',
    };
    const result = buildProjectModuleMap(project, files);
    expect(result.scenes[0].events[0].links).toEqual(['HUD', 'Missing']);
    expect(result.scenes[0].events[0].linkPaths).toEqual([
      'scenes/Game/external-events/HUD.gdl',
    ]);
    expect(result.externalEvents[0]).toMatchObject({
      purpose: 'Show player status',
      eventsLogic: 'Refresh labels',
      linkedFrom: ['scenes/Game/functions/sceneUpdate.gdl'],
    });
    expect(result.extensions[0].events[0].settingsPath).toBe(
      'extensions/Local/functions/Update.gdl'
    );
    expect(result.diagnostics).toEqual([
      {
        code: 'UNRESOLVED_EXTERNAL_EVENTS_LINK',
        settingsPath: 'scenes/Game/functions/sceneUpdate.gdl',
        target: 'Missing',
      },
    ]);
    expect(serializeProjectModuleMap(result)).toBe(
      serializeProjectModuleMap(buildProjectModuleMap(project, files))
    );
  });
});
