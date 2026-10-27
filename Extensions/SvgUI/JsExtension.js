//@ts-check
/// <reference path="../JsExtensionTypes.d.ts" />
/** @type {ExtensionModule} */
module.exports = {
  createExtension: function (_, gd) {
    const extension = new gd.PlatformExtension();
    extension
      .setExtensionInformation(
        'SvgUI',
        _('SVG UI'),
        _('Native SVG interfaces with addressable nodes.'),
        'GDevelop contributors',
        'MIT'
      )
      .setCategory('User interface');
    const configuration = new gd.ObjectJsImplementation();
    configuration.content = { svgResourceName: '', width: 320, height: 180 };
    configuration.updateProperty = function (name, value) {
      if (name === 'svgResourceName') {
        this.content[name] = value;
        return true;
      }
      if (
        (name === 'width' || name === 'height') &&
        Number.isFinite(Number(value)) &&
        Number(value) > 0
      ) {
        this.content[name] = Number(value);
        return true;
      }
      return false;
    };
    configuration.getProperties = function () {
      const properties = new gd.MapStringPropertyDescriptor();
      properties
        .getOrCreate('svgResourceName')
        .setType('resource')
        .addExtraInfo('image')
        .setValue(this.content.svgResourceName)
        .setLabel(_('SVG image'))
        .setDescription(
          _(
            'Choose an SVG file. Use element IDs to address text, shapes and buttons. Rendered above the game canvas.'
          )
        );
      for (const name of ['width', 'height'])
        properties
          .getOrCreate(name)
          .setType('number')
          .setValue(String(this.content[name]))
          .setLabel(name === 'width' ? _('Width') : _('Height'));
      return properties;
    };
    const object = extension
      .addObject(
        'SvgUIObject',
        _('SVG UI'),
        _(
          'An SVG interface rendered above the game canvas. Supports inline styles and local vector references; scripts, external files and embedded stylesheets are removed.'
        ),
        'res/conditions/rectangle24.png',
        configuration
      )
      .setCategory('User interface')
      .setIncludeFile('Extensions/SvgUI/svguiruntimeobject.js')
      .addIncludeFile('Extensions/SvgUI/svguiruntimeobject-renderer.js')
      .addDefaultBehavior('ResizableCapability::ResizableBehavior')
      .addDefaultBehavior('OpacityCapability::OpacityBehavior');
    const icon = 'res/conditions/rectangle24.png';
    const nodeAction = (
      name,
      label,
      sentence,
      parameterType,
      parameterLabel,
      method
    ) => {
      object
        .addScopedAction(
          name,
          label,
          label,
          sentence,
          _('SVG nodes'),
          icon,
          icon
        )
        .addParameter('object', _('SVG UI'), 'SvgUIObject', false)
        .addParameter('string', _('Element ID'))
        .addParameter(parameterType, parameterLabel)
        .getCodeExtraInformation()
        .setFunctionName(method);
    };
    nodeAction(
      'SetNodeText',
      _('Set node text'),
      _('Set text of element _PARAM1_ in _PARAM0_ to _PARAM2_'),
      'string',
      _('Text'),
      'setNodeText'
    );
    nodeAction(
      'SetNodeColor',
      _('Set node fill color'),
      _('Set fill color of element _PARAM1_ in _PARAM0_ to _PARAM2_'),
      'color',
      _('Color'),
      'setNodeColor'
    );
    nodeAction(
      'SetNodeVisible',
      _('Set node visibility'),
      _('Set visibility of element _PARAM1_ in _PARAM0_ to _PARAM2_'),
      'yesorno',
      _('Visible'),
      'setNodeVisible'
    );
    nodeAction(
      'SetNodeWidth',
      _('Set node width'),
      _('Set width of element _PARAM1_ in _PARAM0_ to _PARAM2_'),
      'expression',
      _('Width in SVG units'),
      'setNodeWidth'
    );
    object
      .addScopedCondition(
        'NodeClicked',
        _('SVG node clicked'),
        _(
          'True for one event frame when a node or one of its children is clicked or tapped.'
        ),
        _('Element _PARAM1_ in _PARAM0_ was clicked'),
        _('SVG nodes'),
        icon,
        icon
      )
      .addParameter('object', _('SVG UI'), 'SvgUIObject', false)
      .addParameter('string', _('Element ID'))
      .getCodeExtraInformation()
      .setFunctionName('isNodeClicked');
    for (const [name, label, method] of [
      ['Loaded', _('SVG loaded'), 'isLoaded'],
      ['LoadError', _('SVG loading failed'), 'hasLoadError'],
    ]) {
      object
        .addScopedCondition(
          name,
          label,
          label,
          label + ' (_PARAM0_)',
          _('SVG loading'),
          icon,
          icon
        )
        .addParameter('object', _('SVG UI'), 'SvgUIObject', false)
        .getCodeExtraInformation()
        .setFunctionName(method);
    }
    return extension;
  },
  runExtensionSanityTests: function () {
    return [];
  },
  registerEditorConfigurations: function (service) {
    service.registerEditorConfiguration(
      'SvgUI::SvgUIObject',
      service.getDefaultObjectJsImplementationPropertiesEditor({
        helpPagePath: '',
      })
    );
  },
  registerInstanceRenderers: function (service) {
    const { RenderedInstance, PIXI } = service;
    class RenderedSvgUIInstance extends RenderedInstance {
      static getThumbnail() {
        return 'res/conditions/rectangle24.png';
      }
      constructor(project, instance, configuration, container, loader) {
        super(project, instance, configuration, container, loader);
        this._pixiObject = new PIXI.Sprite(PIXI.Texture.EMPTY);
        this._pixiContainer.addChild(this._pixiObject);
        this.update();
      }
      update() {
        const content = gd.castObject(
          this._associatedObjectConfiguration,
          gd.ObjectJsImplementation
        ).content;
        this._pixiObject.texture = this._pixiResourcesLoader.getPIXITexture(
          this._project,
          content.svgResourceName
        );
        const width = this._instance.hasCustomSize()
          ? this.getCustomWidth()
          : this.getDefaultWidth();
        const height = this._instance.hasCustomSize()
          ? this.getCustomHeight()
          : this.getDefaultHeight();
        this._pixiObject.width = width;
        this._pixiObject.height = height;
        this._pixiObject.pivot.set(
          this._pixiObject.texture.width / 2,
          this._pixiObject.texture.height / 2
        );
        this._pixiObject.position.set(
          this._instance.getX() + width / 2,
          this._instance.getY() + height / 2
        );
        this._pixiObject.rotation = RenderedInstance.toRad(
          this._instance.getAngle()
        );
        this._pixiObject.alpha = Math.max(
          0.5,
          this._instance.getOpacity() / 255
        );
      }
      getDefaultWidth() {
        return (
          gd.castObject(
            this._associatedObjectConfiguration,
            gd.ObjectJsImplementation
          ).content.width || 320
        );
      }
      getDefaultHeight() {
        return (
          gd.castObject(
            this._associatedObjectConfiguration,
            gd.ObjectJsImplementation
          ).content.height || 180
        );
      }
      onRemovedFromScene() {
        super.onRemovedFromScene();
        this._pixiObject.destroy();
      }
    }
    service.registerInstanceRenderer(
      'SvgUI::SvgUIObject',
      RenderedSvgUIInstance
    );
  },
};
