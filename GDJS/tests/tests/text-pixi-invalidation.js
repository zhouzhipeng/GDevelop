describe('Text Pixi style invalidation', function () {
  let scene;
  let object;
  let paint;
  beforeEach(function () {
    scene = new gdjs.RuntimeScene(gdjs.getPixiRuntimeGame());
    scene.addLayer({ name: '', visibility: true, cameras: [], effects: [] });
    object = new gdjs.TextRuntimeObject(scene, {
      name: 'Notice',
      type: 'TextObject::Text',
      variables: [],
      behaviors: [],
      effects: [],
      content: {
        text: 'Attack! Keep moving.',
        font: '',
        characterSize: 24,
        bold: false,
        italic: false,
        underlined: false,
        color: '255;255;255',
        textAlignment: 'left',
        verticalTextAlignment: 'top',
        lineHeight: 0,
        isOutlineEnabled: false,
        outlineThickness: 0,
        outlineColor: '0;0;0',
        isShadowEnabled: false,
        shadowColor: '0;0;0',
        shadowOpacity: 0,
        shadowDistance: 0,
        shadowAngle: 0,
        shadowBlurRadius: 0,
      },
    });
    object.setWrapping(true);
    object.setWrappingWidth(400);
    object.getRendererObject().updateText(true);
    paint = sinon.spy(object.getRendererObject().context, 'fillText');
  });
  afterEach(function () {
    paint.restore();
    object.getRendererObject().destroy();
    scene._destroy();
  });
  it('does not rasterize unchanged HUD styles or positions again', function () {
    for (let frame = 0; frame < 60; frame++) {
      object.setCharacterSize(24);
      object.setColor('255;255;255');
      object.setBold(false);
      object.setItalic(false);
      object.setTextAlignment('left');
      object.setWrappingWidth(400);
      object.setX(20);
      object.setY(30);
      object.getWidth();
      object.getHeight();
    }
    expect(paint.callCount).to.be(0);
  });
  it('rasterizes actual changes once and keeps text metrics current', function () {
    const oldHeight = object.getHeight();
    object.setCharacterSize(48);
    expect(object.getHeight()).to.be.greaterThan(oldHeight);
    const afterSize = paint.callCount;
    expect(afterSize).to.be.greaterThan(0);
    object.setX(40);
    object.setY(50);
    object.getWidth();
    expect(paint.callCount).to.be(afterSize);
    object.setColor('255;0;0');
    object.getHeight();
    expect(paint.callCount).to.be.greaterThan(afterSize);
    const afterColor = paint.callCount;
    object.setColor('255;0;0');
    object.getWidth();
    expect(paint.callCount).to.be(afterColor);
    object.setString('Short');
    expect(object.getString()).to.be('Short');
    expect(object.getWidth()).to.be.greaterThan(0);
    expect(paint.callCount).to.be.greaterThan(afterColor);
  });
});
