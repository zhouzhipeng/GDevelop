// @flow
import { type Schema, type Instance } from './PropertiesEditorSchema';

export const markPrefabPropertyOverrides = (
  schema: Schema,
  getDefaultValue: string => ?string,
  getCurrentValue: (Instance, string) => string,
  resetValue: (Instance, string, string) => void
): Schema =>
  schema.map(field => {
    if (field.children)
      return {
        ...field,
        children: markPrefabPropertyOverrides(
          field.children,
          getDefaultValue,
          getCurrentValue,
          resetValue
        ),
      };
    if (!field.name || !field.getValue) return field;
    const getLabel = field.getLabel;
    const isOverridden = instance => {
      const defaultValue = getDefaultValue(field.name);
      return (
        defaultValue != null &&
        getCurrentValue(instance, field.name) !== defaultValue
      );
    };
    return {
      ...field,
      getLabel: instance => {
        const label = getLabel ? getLabel(instance) : field.name;
        return isOverridden(instance) ? `${label} *` : label;
      },
      isHighlighted: isOverridden,
      getOverrideDefaultValue: instance =>
        isOverridden(instance) ? getDefaultValue(field.name) : null,
      resetOverride: instance => {
        const value = getDefaultValue(field.name);
        if (value != null) resetValue(instance, field.name, value);
      },
    };
  });
