// @flow
import { type Schema } from '../../PropertiesEditor/PropertiesEditorSchema';

// Read the authored override state, not differences from behavior-type defaults.
export const isBehaviorPropertyOverridden = (
  behavior: gdBehavior,
  name: string
): boolean =>
  behavior.isInheritedFromObjectType() && behavior.hasPropertyValue(name);

export const markOverriddenBehaviorFields = (
  schema: Schema,
  getDefaultValue?: (name: string) => ?string
): Schema =>
  schema.map(field => {
    if (field.children)
      return {
        ...field,
        children: markOverriddenBehaviorFields(field.children, getDefaultValue),
      };
    if (!field.name || !field.getValue) return field;
    const getLabel = field.getLabel;
    return {
      ...field,
      getLabel: instance => {
        const label = getLabel ? getLabel(instance) : field.name;
        return isBehaviorPropertyOverridden(instance, field.name)
          ? `${label} *`
          : label;
      },
      getOverrideDefaultValue: instance =>
        isBehaviorPropertyOverridden(instance, field.name) && getDefaultValue
          ? getDefaultValue(field.name)
          : null,
      resetOverride: instance => {
        const value = getDefaultValue && getDefaultValue(field.name);
        if (value != null)
          instance.updateProperty(
            field.name,
            field.valueType === 'boolean'
              ? value === 'true'
                ? '1'
                : '0'
              : value
          );
      },
      isHighlighted: instance =>
        isBehaviorPropertyOverridden(instance, field.name),
    };
  });
