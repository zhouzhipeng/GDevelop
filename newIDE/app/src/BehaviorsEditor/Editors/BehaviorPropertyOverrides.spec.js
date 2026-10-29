// @noflow
import { markOverriddenBehaviorFields } from './BehaviorPropertyOverrides';

test('marks authored overrides and updates when they are reset', () => {
  const overridden = new Set(['Speed']);
  const behavior = {
    isInheritedFromObjectType: () => true,
    hasPropertyValue: name => overridden.has(name),
  };
  const fields = markOverriddenBehaviorFields([
    {
      name: 'group',
      children: [
        { name: 'Speed', getLabel: () => 'Move speed', getValue: () => 150 },
        { name: 'Enabled', getValue: () => true },
      ],
    },
  ])[0].children;
  expect(fields[0].getLabel(behavior)).toBe('Move speed *');
  expect(fields[0].isHighlighted(behavior)).toBe(true);
  expect(fields[1].getLabel(behavior)).toBe('Enabled');
  overridden.clear();
  expect(fields[0].getLabel(behavior)).toBe('Move speed');
  expect(fields[0].isHighlighted(behavior)).toBe(false);
  overridden.add('Speed');
  behavior.isInheritedFromObjectType = () => false;
  expect(fields[0].getLabel(behavior)).toBe('Move speed');
});

test('shows the prefab value and resets only the selected property', () => {
  const values = { Speed: '2000', Enabled: 'false' };
  const behavior = {
    isInheritedFromObjectType: () => true,
    hasPropertyValue: () => true,
    updateProperty: (name, value) => {
      values[name] = value;
    },
  };
  const fields = markOverriddenBehaviorFields(
    [
      { name: 'Speed', valueType: 'number', getValue: () => 2000 },
      { name: 'Enabled', valueType: 'boolean', getValue: () => false },
    ],
    name => (name === 'Speed' ? '1000' : 'true')
  );
  expect(fields[0].getOverrideDefaultValue(behavior)).toBe('1000');
  fields[0].resetOverride(behavior);
  expect(values).toEqual({ Speed: '1000', Enabled: 'false' });
  fields[1].resetOverride(behavior);
  expect(values.Enabled).toBe('1');
});
