// @ts-check

describe('SVG UI native overlay', function () {
  /** @param {gdjs.RuntimeScene} runtimeScene */
  const loadScene = (runtimeScene) => {
    runtimeScene.loadFromScene({
      sceneData: {
        layers: [
          {
            name: '',
            visibility: true,
            effects: [],
            cameras: [],
            ambientLightColorR: 0,
            ambientLightColorG: 0,
            ambientLightColorB: 0,
            isLightingLayer: false,
            followBaseLayerCamera: true,
          },
        ],
        r: 0,
        v: 0,
        b: 0,
        mangledName: 'Scene1',
        name: 'Scene1',
        stopSoundsOnStartup: false,
        title: '',
        renderer3DWorldScale: 100,
        behaviorsSharedData: [],
        objects: [],
        objectsGroups: [],
        instances: [],
        variables: [],
        usedResources: [],
        uiSettings: {
          grid: false,
          gridType: 'rectangular',
          gridWidth: 10,
          gridHeight: 10,
          gridDepth: 10,
          gridOffsetX: 0,
          gridOffsetY: 0,
          gridOffsetZ: 0,
          gridColor: 0,
          gridAlpha: 1,
          snap: false,
        },
      },
      usedExtensionsWithVariablesData: [],
    });
  };

  /** @param {ParentNode} parent @param {string} selector @returns {SVGElement} */
  function element(parent, selector) {
    const result = parent.querySelector(selector);
    if (!(result instanceof SVGElement))
      throw new Error('Missing SVG element: ' + selector);
    return result;
  }
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><defs><linearGradient id="paint"><stop stop-color="red"/></linearGradient></defs><g id="button"><rect id="bar" width="100" height="40" fill="url(#paint)"/><text id="label">Start</text></g></svg>`;
  const cleanups = [];
  afterEach(() => {
    while (cleanups.length) cleanups.pop()();
  });
  async function setup(svg = source) {
    const game = await gdjs.getPixiRuntimeGameWithAssets({});
    const scene = new gdjs.RuntimeScene(game);
    loadScene(scene);
    game.getRenderer().createStandardCanvas(document.createElement('div'));
    const loader = game.getResourceLoader();
    const original = loader.getResource.bind(loader);
    const stub = sinon.stub(loader, 'getResource').callsFake((name) =>
      name === 'ui.svg'
        ? {
            name,
            kind: 'image',
            file: 'data:image/svg+xml,' + encodeURIComponent(svg),
          }
        : original(name)
    );
    cleanups.push(() => stub.restore());
    const object = new gdjs.SvgUIRuntimeObject(scene, {
      name: 'UI',
      type: 'SvgUI::SvgUIObject',
      variables: [],
      behaviors: [],
      effects: [],
      content: { svgResourceName: 'ui.svg', width: 320, height: 180 },
    });
    scene.addObject(object);
    cleanups.push(() => object.onDestroyed());
    const host = game.getRenderer().getDomElementContainer();
    if (!host) throw new Error('No DOM container');
    return { object, scene, host, game };
  }
  async function loaded(object) {
    for (
      let i = 0;
      i < 100 && !object.isLoaded() && !object.hasLoadError();
      ++i
    )
      await new Promise((resolve) => setTimeout(resolve, 10));
    expect(object.isLoaded()).to.be(true);
  }
  it('queues mutations while loading and preserves native vector nodes', async () => {
    const { object, host } = await setup();
    object.setNodeText('label', '<b>Score 42</b>');
    object.setNodeWidth('bar', 75);
    object.setNodeColor('bar', '0;255;0');
    await loaded(object);
    expect(element(host, 'text').textContent).to.be('<b>Score 42</b>');
    expect(element(host, 'rect').getAttribute('width')).to.be('75');
    expect(element(host, 'rect').style.fill).to.be('rgb(0, 255, 0)');
    expect(host.querySelector('b')).to.be(null);
    object.setNodeVisible('button', false);
    expect(element(host, 'g').style.display).to.be('none');
    object.setNodeVisible('button', true);
    expect(element(host, 'g').style.display).to.be('inline');
  });
  it('reports clicks on nodes and ancestor groups for exactly one event frame', async () => {
    const { object, host } = await setup();
    await loaded(object);
    object.updatePreRender();
    element(host, 'rect').dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );
    expect(object.isNodeClicked('bar')).to.be(true);
    expect(object.isNodeClicked('button')).to.be(true);
    expect(object.isNodeClicked('button')).to.be(true);
    object.updatePreRender();
    expect(object.isNodeClicked('button')).to.be(false);
  });
  it('preserves mutations across pause and hides when the layer or object is hidden', async () => {
    const { object, host, scene } = await setup();
    await loaded(object);
    const svg = element(host, 'svg');
    const overlay = svg.parentElement;
    if (!overlay) throw new Error('Missing overlay');
    object.setNodeText('label', 'Paused');
    object.onScenePaused();
    object.updatePreRender();
    expect(overlay.style.display).to.be('none');
    object.onSceneResumed();
    object.updatePreRender();
    expect(overlay.style.display).to.be('block');
    expect(element(host, 'text').textContent).to.be('Paused');
    object.hide(true);
    object.updatePreRender();
    expect(overlay.style.display).to.be('none');
    object.hide(false);
    scene.getLayer('').show(false);
    object.updatePreRender();
    expect(overlay.style.display).to.be('none');
    object.onDestroyed();
    expect(host.querySelector('svg')).to.be(null);
  });
  it('isolates paint references for different instances', async () => {
    const first = await setup();
    await loaded(first.object);
    const second = await setup();
    await loaded(second.object);
    const a = element(first.host, 'linearGradient').id;
    const b = element(second.host, 'linearGradient').id;
    expect(a === b).to.be(false);
    expect(element(first.host, 'rect').getAttribute('fill')).to.be(
      'url(#' + a + ')'
    );
    expect(element(second.host, 'rect').getAttribute('fill')).to.be(
      'url(#' + b + ')'
    );
  });
  it('follows object size, rotation, opacity and DOM scaling', async () => {
    const { object, host, game } = await setup();
    await loaded(object);
    object.setPosition(10, 20);
    object.setSize(100, 50);
    object.setOpacity(128);
    const renderer = game.getRenderer();
    const scale = sinon
      .stub(renderer, 'convertCanvasToDomElementContainerCoords')
      .callsFake((point, result) => {
        result[0] = point[0] * 2;
        result[1] = point[1] * 3;
        return result;
      });
    cleanups.push(() => scale.restore());
    const overlay = element(host, 'svg').parentElement;
    if (!overlay) throw new Error('No overlay');
    object.updatePreRender();
    expect(overlay.style.width).to.be('100px');
    expect(overlay.style.height).to.be('50px');
    expect(Math.abs(Number(overlay.style.opacity) - 128 / 255) < 0.001).to.be(
      true
    );
    const initialTransform = overlay.style.transform;
    object.setAngle(45);
    object.updatePreRender();
    expect(overlay.style.transform === initialTransform).to.be(false);
  });
  it('does not attach late responses after destruction', async () => {
    const { object, host } = await setup();
    object.onDestroyed();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(host.querySelector('svg')).to.be(null);
    expect(object.isLoaded()).to.be(false);
  });
  it('rejects malformed documents and exposes a loading failure', async () => {
    const { object } = await setup('<svg><broken>');
    for (let i = 0; i < 100 && !object.hasLoadError(); ++i)
      await new Promise((resolve) => setTimeout(resolve, 10));
    expect(object.hasLoadError()).to.be(true);
    expect(object.isLoaded()).to.be(false);
  });
  it('strips scripts, external content and active styles but keeps local vector references', () => {
    const svg = gdjs.sanitizeSvgUI(
      `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><foreignObject/><image href="https://example.com/a.png"/><use href="https://example.com/a.svg#id"/><rect onclick="alert(1)" fill="url(https://example.com/a.svg)" style="fill:red;stroke:url(https://example.com);font-size:16px"/><path fill="url(#paint)"/></svg>`
    );
    expect(svg.querySelector('script, foreignObject, image')).to.be(null);
    expect(svg.hasAttribute('onload')).to.be(false);
    expect(element(svg, 'use').hasAttribute('href')).to.be(false);
    expect(element(svg, 'rect').hasAttribute('onclick')).to.be(false);
    expect(element(svg, 'rect').hasAttribute('fill')).to.be(false);
    expect(element(svg, 'rect').style.fill).to.be('red');
    expect(element(svg, 'rect').style.stroke).to.be('');
    expect(element(svg, 'path').getAttribute('fill')).to.be('url(#paint)');
  });
});
