// @noflow
import { normalizeDownloadedProject } from './NormalizeDownloadedProject';

const definition = {
  name: 'Controls',
  eventsBasedBehaviors: [
    {
      name: 'Input',
      propertyDescriptors: [{ name: 'Enabled', hidden: true }],
      sharedPropertyDescriptors: [{ name: 'Mode' }],
    },
  ],
  eventsBasedObjects: [
    {
      name: 'Button',
      propertyDescriptors: [{ name: 'Label' }],
      objects: [{ name: 'Inner', type: 'Controls::Button' }],
    },
  ],
};
const behavior = {
  name: 'Input',
  type: 'Controls::Input',
  Enabled: false,
  Removed: 123,
};
const object = {
  name: 'Button',
  type: 'Controls::Button',
  content: { Label: 'Play', Removed: 'old' },
  childrenContent: {
    Inner: { content: { Label: 'Nested', Removed: 'old' }, variant: '' },
  },
  behaviors: [
    behavior,
    { name: 'Native', type: 'Native::Behavior', Custom: 42 },
  ],
};

describe('Downloaded native project normalization', () => {
  test('preserves declared, hidden and native fields across every object owner without mutating the download', () => {
    const source = {
      objects: [object],
      layouts: [
        {
          objects: [object],
          behaviorsSharedData: [
            {
              name: 'Input',
              type: 'Controls::Input',
              Mode: 'touch',
              Removed: true,
            },
          ],
        },
      ],
      eventsFunctionsExtensions: [
        {
          ...definition,
          eventsBasedObjects: [
            {
              ...definition.eventsBasedObjects[0],
              objects: [object, ...definition.eventsBasedObjects[0].objects],
              variants: [{ objects: [object] }],
            },
          ],
        },
      ],
    };
    const before = JSON.parse(JSON.stringify(source));
    const result = normalizeDownloadedProject(source);
    const owners = [
      result,
      result.layouts[0],
      result.eventsFunctionsExtensions[0].eventsBasedObjects[0],
      result.eventsFunctionsExtensions[0].eventsBasedObjects[0].variants[0],
    ];
    owners.forEach(owner => {
      expect(owner.objects[0].content).toEqual({ Label: 'Play' });
      expect(owner.objects[0].childrenContent.Inner).toEqual({
        content: { Label: 'Nested' },
        variant: '',
      });
      expect(owner.objects[0].behaviors[0]).toEqual({
        name: 'Input',
        type: 'Controls::Input',
        Enabled: false,
      });
      expect(owner.objects[0].behaviors[1]).toEqual(object.behaviors[1]);
    });
    expect(result.layouts[0].behaviorsSharedData[0]).toEqual({
      name: 'Input',
      type: 'Controls::Input',
      Mode: 'touch',
    });
    expect(source).toEqual(before);
    expect(normalizeDownloadedProject(result)).toEqual(result);
  });

  test('unwraps only matching native behavior envelopes and preserves outer values', () => {
    const wrapped = {
      name: 'Tween',
      type: 'Tween::TweenBehavior',
      active: true,
      serializedBehavior: {
        name: 'Tween',
        type: 'Tween::TweenBehavior',
        active: false,
      },
    };
    const mismatch = {
      ...wrapped,
      serializedBehavior: {
        ...wrapped.serializedBehavior,
        type: 'Other::Type',
      },
    };
    const result = normalizeDownloadedProject({
      objects: [{ behaviors: [wrapped, mismatch] }],
    });
    expect(result.objects[0].behaviors[0]).toEqual({
      name: 'Tween',
      type: 'Tween::TweenBehavior',
      active: true,
    });
    expect(result.objects[0].behaviors[1]).toEqual(mismatch);
  });

  test('repairs unused invalid ambient values without changing real lighting or valid colors', () => {
    const invalid = {
      ambientLightColorR: -2147483616,
      ambientLightColorG: 6031360,
      ambientLightColorB: 32,
    };
    const valid = {
      ambientLightColorR: 10,
      ambientLightColorG: 20,
      ambientLightColorB: 30,
    };
    const result = normalizeDownloadedProject({
      layouts: [
        { layers: [invalid, { ...invalid, isLightingLayer: true }, valid] },
      ],
    });
    expect(result.layouts[0].layers[0]).toEqual({
      ambientLightColorR: 200,
      ambientLightColorG: 200,
      ambientLightColorB: 200,
    });
    expect(result.layouts[0].layers[1]).toEqual({
      ...invalid,
      isLightingLayer: true,
    });
    expect(result.layouts[0].layers[2]).toEqual(valid);
  });
});
