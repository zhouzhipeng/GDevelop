// @noflow
import {
  decodeSettingsDocument,
  serializeSettingsDocument,
  resetSettingsTypes,
  setSettingsTypeProvider,
} from '.';

afterEach(() => {
  resetSettingsTypes();
  setSettingsTypeProvider(undefined);
});

test('loads effect metadata lazily after a source-tree save resets the registries', () => {
  resetSettingsTypes();
  const provider = jest.fn(() => ({
    effectTypes: [
      {
        type: 'TestEffect',
        serializedParameters: [
          { name: 'amount', type: 'number' },
          { name: 'texture', type: 'string' },
          { name: 'enabled', type: 'boolean' },
        ],
      },
    ],
  }));
  setSettingsTypeProvider(provider);
  const payload = {
    name: 'Player',
    type: 'Sprite',
    effects: [
      {
        name: 'Effect',
        effectType: 'TestEffect',
        doubleParameters: { amount: 0.5 },
        stringParameters: { texture: 'image.png' },
        booleanParameters: { enabled: true },
      },
    ],
  };
  const source = serializeSettingsDocument('object', payload);
  expect(provider).toHaveBeenCalledTimes(1);
  resetSettingsTypes();
  expect(decodeSettingsDocument(source).payload).toEqual(payload);
  expect(provider).toHaveBeenCalledTimes(2);
});
