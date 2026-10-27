const initializeGDevelopJs = require('../../Binaries/embuild/GDevelop.js/libGD.js');
const svgUI = require('../../Extensions/SvgUI/JsExtension.js');

describe('SVG UI extension registration', () => {
  let gd;
  beforeAll(async () => {
    gd = await initializeGDevelopJs();
    const extension = svgUI.createExtension((value) => value, gd);
    gd.JsPlatform.get().addNewExtension(extension);
    extension.delete();
  });
  it('creates a configurable object with an image resource for export', () => {
    const project = gd.ProjectHelper.createNewGDJSProject();
    try {
      const object = project
        .getObjects()
        .insertNewObject(project, 'SvgUI::SvgUIObject', 'HUD', 0);
      const configuration = object.getConfiguration();
      expect(configuration.updateProperty('svgResourceName', 'hud.svg')).toBe(
        true
      );
      expect(configuration.updateProperty('width', '640')).toBe(true);
      configuration.updateProperty('width', '-1');
      const properties = configuration.getProperties();
      expect(properties.get('svgResourceName').getType()).toBe('resource');
      expect(properties.get('svgResourceName').getExtraInfo().at(0)).toBe(
        'image'
      );
      expect(properties.get('svgResourceName').getValue()).toBe('hud.svg');
      expect(properties.get('width').getValue()).toBe('640');
      properties.delete();
    } finally {
      project.delete();
    }
  });
  it('registers event methods and capabilities', () => {
    const metadata = gd.MetadataProvider.getObjectMetadata(
      gd.JsPlatform.get(),
      'SvgUI::SvgUIObject'
    );
    expect(metadata.getAllActions().keys().size()).toBe(4);
    expect(metadata.getAllConditions().keys().size()).toBe(3);
    const behaviors = metadata.getDefaultBehaviors().toNewVectorString();
    expect(
      Array.from({ length: behaviors.size() }, (_, index) =>
        behaviors.at(index)
      )
    ).toEqual(
      expect.arrayContaining([
        'ResizableCapability::ResizableBehavior',
        'OpacityCapability::OpacityBehavior',
      ])
    );
    behaviors.delete();
  });
  it('provides the thumbnail required for scene renderer registration', () => {
    let registered = false;
    svgUI.registerInstanceRenderers({
      RenderedInstance: class {},
      PIXI: {},
      registerInstanceRenderer(type, Renderer) {
        expect(type).toBe('SvgUI::SvgUIObject');
        expect(Renderer.getThumbnail()).toBe('res/conditions/rectangle24.png');
        registered = true;
      },
    });
    expect(registered).toBe(true);
  });
});
