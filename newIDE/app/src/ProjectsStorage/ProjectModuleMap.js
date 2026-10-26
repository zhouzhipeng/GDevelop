// @flow

import { decodeSettingsDocument } from './SettingsDsl';
import {
  encodeManagedName,
  MULTI_FILE_FORMAT_VERSION,
} from './MultiFileProjectFormat';
import { compileSettingsEvents } from './SettingsDsl/Events';

export const PROJECT_MODULE_MAP_RELATIVE_PATH =
  '.gdevelop/project-module-map.json';

const sourcePath = (...segments: Array<string>): string =>
  segments.map(segment => encodeManagedName(segment)).join('/');

const settingsAt = (files: { [string]: string }, path: string): Object => {
  const source = files[`game://${path}`];
  return source ? decodeSettingsDocument(source, `game://${path}`).payload : {};
};

const linksIn = (events: Array<Object>): Array<string> => {
  const links: Set<string> = new Set();
  const visit = (items: ?Array<Object>) => {
    (items || []).forEach(event => {
      if (event.type === 'BuiltinCommonInstructions::Link' && event.target)
        links.add(event.target);
      visit(event.events);
    });
  };
  visit(events);
  return Array.from(links).sort((left, right) => left.localeCompare(right));
};

const eventEntry = (
  name: string,
  settingsPath: string,
  events: Array<Object>,
  settings: Object,
  files: { [string]: string },
  resolver?: Function
): Object => ({
  name,
  settingsPath,
  purpose: settings.description || '',
  eventsLogic: settings.eventsLogic || '',
  links: linksIn(
    resolver && files[`game://${settingsPath}`] !== undefined
      ? compileSettingsEvents(files[`game://${settingsPath}`], {
          resolveInstruction: resolver,
        })
      : events
  ),
});

export const buildProjectModuleMap = (
  serializedProject: Object,
  files: Object,
  resolver?: Function
): Object => {
  const callersByFragment: Map<string, Set<string>> = new Map();
  const allEventEntries: Array<Object> = [];
  const register = (entry: Object): Object => {
    allEventEntries.push(entry);
    entry.links.forEach(target => {
      const callers = callersByFragment.get(target) || new Set<string>();
      callers.add(entry.settingsPath);
      callersByFragment.set(target, callers);
    });
    return entry;
  };
  const lifecycleFields = [
    ['sceneLoad', 'sceneLoadEvents'],
    ['sceneSignal', 'sceneSignalEvents'],
    ['sceneUpdate', 'events'],
    ['sceneUnload', 'sceneUnloadEvents'],
  ];
  const scenes = (serializedProject.layouts || []).map(scene => {
    const sceneBase = sourcePath('scenes', scene.name);
    return {
      name: scene.name,
      settingsPath: `${sceneBase}/scene.gdl`,
      events: lifecycleFields
        .map(([name, field]) => {
          const base = `${sceneBase}/functions`;
          const settingsPath = `${base}/${encodeManagedName(`${name}.gdl`)}`;
          if (!files[`game://${settingsPath}`]) return null;
          return register(
            eventEntry(
              name,
              settingsPath,
              scene[field],
              settingsAt(files, settingsPath),
              files,
              resolver
            )
          );
        })
        .filter(Boolean),
    };
  });
  const externalEvents = (serializedProject.externalEvents || [])
    .map(fragment => {
      const base = `${sourcePath(
        'scenes',
        fragment.associatedLayout
      )}/external-events`;
      const settingsPath = `${base}/${encodeManagedName(
        `${fragment.name}.gdl`
      )}`;
      const entry = register(
        eventEntry(
          fragment.name,
          settingsPath,
          fragment.events,
          settingsAt(files, settingsPath),
          files,
          resolver
        )
      );
      return { scene: fragment.associatedLayout, ...entry };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  const functionEntries = (
    functions: Array<Object>,
    base: string,
    ownerKind: string,
    ownerName: string
  ): Array<Object> =>
    (functions || []).map(fn => {
      const functionBase = `${base}/functions`;
      const settingsPath = `${functionBase}/${encodeManagedName(
        `${fn.name}.gdl`
      )}`;
      return {
        ownerKind,
        ownerName,
        ...register(
          eventEntry(
            fn.name,
            settingsPath,
            fn.events,
            settingsAt(files, settingsPath),
            files,
            resolver
          )
        ),
      };
    });
  const extensions = (serializedProject.eventsFunctionsExtensions || []).map(
    extension => {
      const base = sourcePath('extensions', extension.name);
      return {
        name: extension.name,
        settingsPath: `${base}/extension.gdl`,
        events: [
          ...functionEntries(
            extension.eventsFunctions,
            base,
            'extension',
            extension.name
          ),
          ...(extension.eventsBasedObjects || []).flatMap(prefab =>
            functionEntries(
              prefab.eventsFunctions,
              `${base}/prefabs/${encodeManagedName(prefab.name)}`,
              'prefab',
              prefab.name
            )
          ),
          ...(extension.eventsBasedBehaviors || []).flatMap(behavior =>
            functionEntries(
              behavior.eventsFunctions,
              `${base}/behaviors/${encodeManagedName(behavior.name)}`,
              'behavior',
              behavior.name
            )
          ),
        ],
      };
    }
  );
  externalEvents.forEach(fragment => {
    fragment.linkedFrom = Array.from(
      callersByFragment.get(fragment.name) || []
    ).sort();
  });
  const fragmentPathByName = new Map(
    externalEvents.map(fragment => [fragment.name, fragment.settingsPath])
  );
  allEventEntries.forEach(entry => {
    entry.linkPaths = entry.links
      .filter(target => fragmentPathByName.has(target))
      .map(target => fragmentPathByName.get(target));
  });
  const knownFragments = new Set(fragmentPathByName.keys());
  const diagnostics = allEventEntries.flatMap(entry =>
    entry.links
      .filter(target => !knownFragments.has(target))
      .map(target => ({
        code: 'UNRESOLVED_EXTERNAL_EVENTS_LINK',
        settingsPath: entry.settingsPath,
        target,
      }))
  );
  return {
    format: 'gdevelop-project-module-map',
    formatVersion: 2,
    sourceFormatVersion: MULTI_FILE_FORMAT_VERSION,
    project: {
      name:
        (serializedProject.properties && serializedProject.properties.name) ||
        '',
      settingsPath: 'project.gdevelop',
    },
    scenes,
    externalEvents,
    extensions,
    diagnostics,
  };
};

export const serializeProjectModuleMap = (moduleMap: Object): string =>
  `${JSON.stringify(moduleMap, null, 2)}\n`;
