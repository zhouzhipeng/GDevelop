// @flow

export type SceneLifecycleFunctionName =
  | 'sceneLoad'
  | 'sceneSignal'
  | 'sceneUpdate'
  | 'sceneUnload';

export type SceneLifecycleFunctionDefinition = {|
  name: SceneLifecycleFunctionName,
  icon: string,
|};

export const DEFAULT_SCENE_LIFECYCLE_FUNCTION_NAME: SceneLifecycleFunctionName =
  'sceneUpdate';

export const sceneLifecycleFunctionDefinitions: Array<SceneLifecycleFunctionDefinition> = [
  { name: 'sceneLoad', icon: 'res/functions/create_black.svg' },
  { name: 'sceneSignal', icon: 'res/functions/signal_black.svg' },
  { name: 'sceneUpdate', icon: 'res/functions/step_black.svg' },
  { name: 'sceneUnload', icon: 'res/functions/destroy_black.svg' },
];

export const isSceneLifecycleFunctionName = (name: ?string): boolean =>
  name === 'sceneLoad' ||
  name === 'sceneSignal' ||
  name === 'sceneUpdate' ||
  name === 'sceneUnload';

export const getSceneLifecycleEventsFunction = (
  owner: gdLayout,
  name: SceneLifecycleFunctionName
): gdEventsFunction => {
  const lifecycleEventsFunctions = owner.getLifecycleEventsFunctions();
  return lifecycleEventsFunctions.getByName(name);
};

export const hasSceneLifecycleEventsFunction = (
  owner: gdLayout,
  name: SceneLifecycleFunctionName
): boolean => {
  const lifecycleEventsFunctions = owner.getLifecycleEventsFunctions();
  return lifecycleEventsFunctions.hasByName(name);
};

export const insertSceneLifecycleEventsFunction = (
  owner: gdLayout,
  name: SceneLifecycleFunctionName
): gdEventsFunction => {
  const lifecycleEventsFunctions = owner.getLifecycleEventsFunctions();
  return lifecycleEventsFunctions.insertByName(name);
};

export const removeSceneLifecycleEventsFunction = (
  owner: gdLayout,
  name: SceneLifecycleFunctionName
): boolean => {
  const lifecycleEventsFunctions = owner.getLifecycleEventsFunctions();
  return lifecycleEventsFunctions.removeByName(name);
};

export const getSceneLifecycleEvents = (
  owner: gdLayout,
  name: SceneLifecycleFunctionName
): gdEventsList => getSceneLifecycleEventsFunction(owner, name).getEvents();

export const getSceneLifecycleFunctionDisplayName = (
  name: SceneLifecycleFunctionName
): string => {
  switch (name) {
    case 'sceneLoad':
      return 'On scene load';
    case 'sceneSignal':
      return 'On scene signal';
    case 'sceneUpdate':
      return 'Scene update';
    case 'sceneUnload':
      return 'On scene unload';
    default:
      return name;
  }
};
