describe('3D renderer attachment diagnostics', function () {
  let scene;
  let baseRenderer;
  let worldRenderer;
  let warn;

  beforeEach(function () {
    scene = new gdjs.RuntimeScene(gdjs.getPixiRuntimeGame());
    for (const [name, renderingType] of [
      ['', '2d'],
      ['World3D', '3d'],
    ]) {
      scene.addLayer({
        name,
        renderingType,
        visibility: true,
        cameras: [],
        effects: [],
      });
    }
    baseRenderer = scene.getLayer('').getRenderer();
    worldRenderer = scene.getLayer('World3D').getRenderer();
    warn = sinon.stub(console, 'warn');
  });

  afterEach(function () {
    warn.restore();
  });

  it('does not report the temporary base-layer attachment during creation', async function () {
    const object = new THREE.Group();
    baseRenderer.add3DRendererObject(object);
    baseRenderer.remove3DRendererObject(object);
    worldRenderer.add3DRendererObject(object);
    await Promise.resolve();
    expect(
      baseRenderer.getRendererDebugInfo().rejected3DRendererObjectCount
    ).to.be(0);
    expect(worldRenderer.getRendererDebugInfo().threeGroupChildCount).to.be(1);
    expect(warn.called).to.be(false);
  });

  it('still reports objects left on a 2D layer, warning only once', async function () {
    baseRenderer.add3DRendererObject(new THREE.Group());
    baseRenderer.add3DRendererObject(new THREE.Group());
    await Promise.resolve();
    expect(
      baseRenderer.getRendererDebugInfo().rejected3DRendererObjectCount
    ).to.be(2);
    expect(warn.callCount).to.be(1);
    expect(warn.firstCall.args[0]).to.contain(
      '[RUNTIME_3D_RENDERER_OBJECT_REJECTED]'
    );
    baseRenderer.add3DRendererObject(new THREE.Group());
    await Promise.resolve();
    expect(
      baseRenderer.getRendererDebugInfo().rejected3DRendererObjectCount
    ).to.be(3);
    expect(warn.callCount).to.be(1);
  });

  it('reports a real move back to 2D after a successful initial attachment', async function () {
    const object = new THREE.Group();
    baseRenderer.add3DRendererObject(object);
    baseRenderer.remove3DRendererObject(object);
    worldRenderer.add3DRendererObject(object);
    await Promise.resolve();
    worldRenderer.remove3DRendererObject(object);
    baseRenderer.add3DRendererObject(object);
    await Promise.resolve();
    expect(
      baseRenderer.getRendererDebugInfo().rejected3DRendererObjectCount
    ).to.be(1);
    expect(warn.callCount).to.be(1);
  });
});
