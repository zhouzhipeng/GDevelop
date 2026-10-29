// @noflow
import { markPrefabPropertyOverrides } from './PrefabPropertyOverrides';

test('marks prefab differences, exposes defaults and resets one property', () => {
  const instance = { Speed: '1112', Enabled: 'false' };
  const defaults = { Speed: '1000', Enabled: 'true' };
  const schema = markPrefabPropertyOverrides(
    [
      { name: 'Speed', getValue: i => i.Speed },
      { name: 'Enabled', getValue: i => i.Enabled },
      { name: 'ObjectName', getValue: () => 'Enemy' },
    ],
    name => defaults[name],
    (i, name) => i[name],
    (i, name, value) => {
      i[name] = value;
    }
  );
  expect(schema[0].getLabel(instance)).toBe('Speed *');
  expect(schema[0].getOverrideDefaultValue(instance)).toBe('1000');
  expect(schema[2].getOverrideDefaultValue(instance)).toBeNull();
  schema[0].resetOverride(instance);
  expect(instance).toEqual({ Speed: '1000', Enabled: 'false' });
  expect(schema[0].getLabel(instance)).toBe('Speed');
  expect(schema[0].getOverrideDefaultValue(instance)).toBeNull();
  defaults.Speed = '2000';
  expect(schema[0].getOverrideDefaultValue(instance)).toBe('2000');
});
