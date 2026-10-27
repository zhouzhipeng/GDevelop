// @noflow

describe('Electron builder configuration', () => {
  it('registers project.gdl as an editable GDevelop project', () => {
    const config = require('../../electron-app/electron-builder-config');

    expect(config.fileAssociations).toContainEqual({
      ext: 'gdl',
      name: 'GDevelop project',
      description: 'GDevelop project',
      mimeType: 'application/x-gdevelop-project',
      role: 'Editor',
    });
  });
});
