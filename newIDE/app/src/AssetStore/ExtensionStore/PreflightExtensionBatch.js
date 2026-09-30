// @flow

// Complete the entire batch before the installer mutates the project or calls
// either installation callback. A failed dependency must leave it unchanged.
export const preflightExtensionBatch = async (
  extensions: Array<Object>,
  registryHeaders: Array<Object>,
  preflightExtension?: Object => Promise<Object>
): Promise<void> => {
  if (!preflightExtension) return;
  for (const serializedExtension of extensions) {
    const registryHeader = registryHeaders.find(
      header => header.name === serializedExtension.name
    );
    const receipt = await preflightExtension({
      serializedExtension,
      registryHeader,
    });
    if (!receipt || receipt.valid !== true) {
      throw new Error(
        'Extension compatibility preflight failed for ' +
          serializedExtension.name +
          ': ' +
          JSON.stringify((receipt && receipt.errors) || [])
      );
    }
  }
};
