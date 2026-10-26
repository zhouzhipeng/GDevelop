// @flow

// Downloaded examples are native JSON snapshots, not Settings DSL sources.
// Custom behaviors retain removed properties in their serialized content even
// though the extension can no longer read them. Discard only those obsolete
// properties at this import boundary, using the bundled extension definitions.
// The Settings DSL reader and writer still reject undeclared authored fields.
export const normalizeDownloadedProject = (project: Object): Object => {
  const behaviorProperties: Map<string, Set<string>> = new Map();
  const sharedProperties: Map<string, Set<string>> = new Map();
  const objectDefinitions: Map<string, Object> = new Map();
  (project.eventsFunctionsExtensions || []).forEach(extension => {
    (extension.eventsBasedObjects || []).forEach(object => {
      objectDefinitions.set(`${extension.name}::${object.name}`, object);
    });
    (extension.eventsBasedBehaviors || []).forEach(behavior => {
      const type = `${extension.name}::${behavior.name}`;
      behaviorProperties.set(
        type,
        new Set(
          (behavior.propertyDescriptors || []).map(property => property.name)
        )
      );
      sharedProperties.set(
        type,
        new Set(
          (behavior.sharedPropertyDescriptors || []).map(
            property => property.name
          )
        )
      );
    });
  });
  const normalizeBehavior = (
    behavior: Object,
    propertiesByType: Map<string, Set<string>>
  ): Object => {
    // Some published examples contain the old unknown-behavior envelope.
    // Only unwrap an envelope identifying the same behavior, never a new type.
    if (
      behavior.serializedBehavior &&
      behavior.serializedBehavior.type === behavior.type &&
      behavior.serializedBehavior.name === behavior.name
    ) {
      const { serializedBehavior, ...outer } = behavior;
      behavior = { ...serializedBehavior, ...outer };
    }
    const properties = propertiesByType.get(behavior.type);
    if (!properties) return behavior;
    return Object.fromEntries(
      Object.entries(behavior).filter(
        ([key]) => key === 'name' || key === 'type' || properties.has(key)
      )
    );
  };
  const normalizeConfiguration = (
    configuration: Object,
    type: ?string
  ): Object => {
    const definition = type ? objectDefinitions.get(type) : null;
    if (!definition) return configuration;
    const propertyNames = new Set(
      (definition.propertyDescriptors || []).map(property => property.name)
    );
    const childTypes: Map<string, string> = new Map(
      (definition.objects || []).map(object => [object.name, object.type])
    );
    const normalized: Object = { ...configuration };
    if (configuration.content) {
      normalized.content = Object.fromEntries(
        Object.entries(configuration.content).filter(([key]) =>
          propertyNames.has(key)
        )
      );
    }
    if (configuration.childrenContent) {
      normalized.childrenContent = Object.fromEntries(
        Object.entries(configuration.childrenContent).map(([name, child]) => [
          name,
          normalizeConfiguration(child, childTypes.get(name)),
        ])
      );
    }
    return normalized;
  };
  const normalizeContainer = (container: Object): Object => {
    const normalized: Object = { ...container };
    if (container.layers) {
      normalized.layers = container.layers.map(layer => {
        const ambientKeys = [
          'ambientLightColorR',
          'ambientLightColorG',
          'ambientLightColorB',
        ];
        // These channels were uninitialized in some old non-lighting layers.
        if (
          !layer.isLightingLayer &&
          ambientKeys.some(
            key =>
              layer[key] !== undefined &&
              (!Number.isInteger(layer[key]) ||
                layer[key] < 0 ||
                layer[key] > 255)
          )
        ) {
          return {
            ...layer,
            ambientLightColorR: 200,
            ambientLightColorG: 200,
            ambientLightColorB: 200,
          };
        }
        return layer;
      });
    }
    if (container.objects) {
      normalized.objects = container.objects.map(object => {
        const normalizedObject: Object = {
          ...normalizeConfiguration(object, object.type),
        };
        if (object.behaviors)
          normalizedObject.behaviors = object.behaviors.map(behavior =>
            normalizeBehavior(behavior, behaviorProperties)
          );
        return normalizedObject;
      });
    }
    if (container.behaviorsSharedData) {
      normalized.behaviorsSharedData = container.behaviorsSharedData.map(
        behavior => normalizeBehavior(behavior, sharedProperties)
      );
    }
    return normalized;
  };
  const normalized: Object = normalizeContainer(project);
  if (project.layouts)
    normalized.layouts = project.layouts.map(normalizeContainer);
  if (project.eventsFunctionsExtensions) {
    normalized.eventsFunctionsExtensions = project.eventsFunctionsExtensions.map(
      extension => {
        const normalizedExtension: Object = { ...extension };
        if (extension.eventsBasedObjects) {
          normalizedExtension.eventsBasedObjects = extension.eventsBasedObjects.map(
            prefab => {
              const normalizedPrefab: Object = normalizeContainer(prefab);
              if (prefab.variants)
                normalizedPrefab.variants = prefab.variants.map(
                  normalizeContainer
                );
              return normalizedPrefab;
            }
          );
        }
        return normalizedExtension;
      }
    );
  }
  return normalized;
};
