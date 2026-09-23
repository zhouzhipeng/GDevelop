// @flow

import {
  buildProjectModuleMap,
  serializeProjectModuleMap,
} from './ProjectModuleMap';

describe('project module map', () => {
  test('reads links from current IfDo source when editor events are stale', () => {
    const project = {
      properties: { name: 'Example' },
      layouts: [{ name: 'Game', events: [] }],
      externalEvents: [{ name: 'HUD', associatedLayout: 'Game', events: [] }],
      eventsFunctionsExtensions: [],
    };
    const files = {
      'game://scenes/Game/functions/sceneUpdate.settings':
        'kind = "function"\n',
      'game://scenes/Game/functions/sceneUpdate.events': 'link "HUD"\n',
    };
    const result = buildProjectModuleMap(project, files, () => null);
    expect(result.scenes[0].events[0].linkPaths).toEqual([
      'scenes/Game/external-events/HUD.events',
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
      'game://scenes/Game/functions/sceneUpdate.settings':
        'kind = "function"\ndescription = "Every frame"\n',
      'game://scenes/Game/external-events/HUD.settings':
        'kind = "externalEvents"\nname = "HUD"\ndescription = "Show player status"\neventsLogic = "Refresh labels"\n',
      'game://extensions/Local/functions/Update.settings':
        'kind = "function"\ndescription = "Update local state"\n',
    };
    const result = buildProjectModuleMap(project, files);
    expect(result.scenes[0].events[0].links).toEqual(['HUD', 'Missing']);
    expect(result.scenes[0].events[0].linkPaths).toEqual([
      'scenes/Game/external-events/HUD.events',
    ]);
    expect(result.externalEvents[0]).toMatchObject({
      purpose: 'Show player status',
      eventsLogic: 'Refresh labels',
      linkedFrom: ['scenes/Game/functions/sceneUpdate.events'],
    });
    expect(result.extensions[0].events[0].eventsPath).toBe(
      'extensions/Local/functions/Update.events'
    );
    expect(result.diagnostics).toEqual([
      {
        code: 'UNRESOLVED_EXTERNAL_EVENTS_LINK',
        eventsPath: 'scenes/Game/functions/sceneUpdate.events',
        target: 'Missing',
      },
    ]);
    expect(serializeProjectModuleMap(result)).toBe(
      serializeProjectModuleMap(buildProjectModuleMap(project, files))
    );
  });
});
