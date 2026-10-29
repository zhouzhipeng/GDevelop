// @flow
import { Trans } from '@lingui/macro';

import * as React from 'react';
import PropertiesEditorByVisibility from '../../PropertiesEditor/PropertiesEditorByVisibility';
import { type BehaviorEditorProps } from './BehaviorEditorProps.flow';
import { Column } from '../../UI/Grid';
import { markOverriddenBehaviorFields } from './BehaviorPropertyOverrides';
import propertiesMapToSchema from '../../PropertiesEditor/PropertiesMapToSchema';
import {
  advancedTweenBehaviorType,
  customizeAdvancedTweenBehaviorPropertiesSchema,
} from './AdvancedTweenBehaviorEditorOptions';

const gd: libGDevelop = global.gd;

type Props = BehaviorEditorProps;

const BehaviorPropertiesEditor = ({
  project,
  behaviors,
  object,
  layersContainer,
  onBehaviorUpdated,
  resourceManagementProps,
  projectScopedContainersAccessor,
  isAdvancedSectionInitiallyUncollapsed,
  hideConstantPlaceholderHints,
}: Props): React.Node => {
  const behavior = behaviors[0];
  const behaviorMetadata = gd.MetadataProvider.getBehaviorMetadata(
    gd.JsPlatform.get(),
    behavior.getTypeName()
  );

  const schema = React.useMemo(
    () => {
      const behaviorProperties = behavior.getProperties();
      const getPrefabDefaultValue = name => {
        if (!object || !project.hasEventsBasedObject(object.getType()))
          return null;
        const prefab = project.getEventsBasedObject(object.getType());
        if (!prefab.hasBehaviorNamed(behavior.getName())) return null;
        const defaults = prefab.getBehavior(behavior.getName()).getProperties();
        return defaults.has(name) ? defaults.get(name).getValue() : null;
      };

      const schema = propertiesMapToSchema({
        properties: behaviorProperties,
        defaultValueProperties: behaviorMetadata.getProperties(),
        getPropertyValue: (instance, name) =>
          instance
            .getProperties()
            .get(name)
            .getValue(),
        onUpdateProperty: (instance, name, value) => {
          instance.updateProperty(name, value);
        },
        object,
        layersContainer,
        visibility: 'All',
        shouldDisabledFieldsWithMixedValues: true,
        propertyGroups: behaviorMetadata.getPropertyGroups(),
        allowConstantPlaceholders: project.hasEventsBasedBehavior(
          behavior.getTypeName()
        ),
      });
      if (behavior.getTypeName() === advancedTweenBehaviorType) {
        return markOverriddenBehaviorFields(
          customizeAdvancedTweenBehaviorPropertiesSchema(schema),
          getPrefabDefaultValue
        );
      }
      return markOverriddenBehaviorFields(schema, getPrefabDefaultValue);
    },
    [behavior, behaviorMetadata, layersContainer, object, project]
  );

  return (
    <Column expand>
      <PropertiesEditorByVisibility
        project={project}
        object={object}
        schema={schema}
        instances={behaviors}
        onInstancesModified={onBehaviorUpdated}
        resourceManagementProps={resourceManagementProps}
        projectScopedContainersAccessor={projectScopedContainersAccessor}
        placeholder={
          <Trans>
            There is nothing to configure for this behavior. You can still use
            events to interact with the object and this behavior.
          </Trans>
        }
        isAdvancedSectionInitiallyUncollapsed={
          isAdvancedSectionInitiallyUncollapsed
        }
        hideConstantPlaceholderHints={hideConstantPlaceholderHints}
      />
    </Column>
  );
};

export default BehaviorPropertiesEditor;
