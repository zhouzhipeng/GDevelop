import { preflightExtensionBatch } from './PreflightExtensionBatch';

describe('extension batch preflight', () => {
  it('checks every downloaded dependency against its registry identity', async () => {
    const extensions = [{ name: 'FPS' }, { name: 'Dependency' }];
    const headers = extensions.map(extension => ({
      ...extension,
      version: '1',
    }));
    const preflight = jest.fn(async () => ({ valid: true }));
    await preflightExtensionBatch(extensions, headers, preflight);
    expect(preflight.mock.calls).toEqual(
      extensions.map((serializedExtension, i) => [
        { serializedExtension, registryHeader: headers[i] },
      ])
    );
  });

  it('rejects a failed dependency before the caller can install anything', async () => {
    const mutate = jest.fn();
    const preflight = jest.fn(async ({ serializedExtension }) => ({
      valid: serializedExtension.name !== 'Bad',
      errors: ['invalid dependency'],
    }));
    await expect(
      (async () => {
        await preflightExtensionBatch(
          [{ name: 'Good' }, { name: 'Bad' }],
          [],
          preflight
        );
        mutate();
      })()
    ).rejects.toThrow('Bad');
    expect(mutate).not.toHaveBeenCalled();
  });
});
