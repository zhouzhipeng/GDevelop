// @ts-check

describe('Model3D TSL material-host seam', function () {
  const makeRendererWithoutConstructor = (withRoot) => {
    const renderer = /** @type {any} */ (
      Object.create(gdjs.Model3DRuntimeObjectRenderer.prototype)
    );
    const parent = new THREE.Group();
    const threeObject = new THREE.Group();
    const clonedRoot = withRoot ? new THREE.Group() : null;
    if (clonedRoot) threeObject.add(clonedRoot);
    parent.add(threeObject);

    renderer._threeMaterialRootChangedListeners = new Set();
    renderer._modelGeneration = 3;
    renderer._threeObject = threeObject;
    renderer._clonedModelRoot = clonedRoot;
    renderer._animationMixer = {
      stopAllAction() {},
      uncacheRoot() {},
    };
    renderer._action = null;
    renderer._bonesByCanonicalName = null;
    renderer._ambiguousBoneNames = null;
    renderer._bonePoseScratch = null;
    renderer._sharedAnimationModelCompatibility = new Map();
    renderer.get3DRendererObject = () => parent;

    return { renderer, parent, threeObject, clonedRoot };
  };

  it('reports the previous root before replacement invalidates it', function () {
    const { renderer, parent, threeObject, clonedRoot } =
      makeRendererWithoutConstructor(true);
    const observations = [];
    const removeListener = renderer.addThreeMaterialRootChangedListener(
      (change) => {
        observations.push({
          change,
          rootDuringNotification: renderer.getThreeMaterialRoot(),
          childCountDuringNotification: change.previousRoot.children.length,
        });
      }
    );

    expect(renderer._releaseCurrentModelInstance('replaced')).to.be(true);
    expect(observations.length).to.be(1);
    expect(observations[0].change).to.eql({
      previousRoot: threeObject,
      nextRoot: null,
      generation: 4,
      reason: 'replaced',
    });
    expect(observations[0].rootDuringNotification).to.be(threeObject);
    expect(observations[0].childCountDuringNotification).to.be(1);
    if (!clonedRoot) throw new Error('Expected a cloned model root.');
    expect(clonedRoot.parent).to.be(null);
    expect(parent.children.length).to.be(0);
    expect(renderer.getThreeMaterialRoot()).to.be(null);
    expect(renderer.getThreeMaterialGeneration()).to.be(4);

    removeListener();
    removeListener();
    renderer._notifyThreeMaterialRootChanged({
      previousRoot: null,
      nextRoot: null,
      generation: 5,
      reason: 'released',
    });
    expect(observations.length).to.be(1);
  });

  it('reports destruction even when the asynchronous model never loaded', function () {
    const { renderer } = makeRendererWithoutConstructor(false);
    const changes = [];
    renderer.addThreeMaterialRootChangedListener((change) => {
      changes.push(change);
    });

    renderer.onDestroyed();
    expect(changes).to.eql([
      {
        previousRoot: null,
        nextRoot: null,
        generation: 4,
        reason: 'destroyed',
      },
    ]);

    renderer._notifyThreeMaterialRootChanged({
      previousRoot: null,
      nextRoot: null,
      generation: 5,
      reason: 'released',
    });
    expect(changes.length).to.be(1);
  });
});
