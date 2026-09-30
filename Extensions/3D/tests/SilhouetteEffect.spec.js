describe('3D silhouette outline', function () {
  it('draws only the combined outer edge over opaque and transparent occluders', function () {
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(128, 128);
    renderer.setPixelRatio(1);
    const output = new THREE.WebGLRenderTarget(128, 128);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 20);
    camera.position.z = 5;
    const root = new THREE.Group();
    scene.add(root);
    const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    for (const x of [-0.3, 0.3]) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 0.3),
        bodyMaterial
      );
      mesh.position.x = x;
      root.add(mesh);
    }
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 4),
      new THREE.MeshBasicMaterial({ color: 0x123456 })
    );
    wall.position.z = 1;
    scene.add(wall);
    const foliage = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 4),
      new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.5,
      })
    );
    foliage.position.z = 2;
    scene.add(foliage);
    const hidden = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 1), bodyMaterial);
    hidden.visible = false;
    root.add(hidden);
    const filter = new gdjs.Scene3DSilhouetteFilter({});
    const pixels = () => {
      const data = new Uint8Array(128 * 128 * 4);
      renderer.readRenderTargetPixels(output, 0, 0, 128, 128, data);
      return data;
    };
    try {
      renderer.setRenderTarget(output);
      renderer.setClearColor(0x010203, 0.4);
      renderer.render(scene, camera);
      const before = pixels();
      filter.render(renderer, scene, camera, root);
      const after = pixels();
      let changed = 0;
      for (let y = 0; y < 128; ++y)
        for (let x = 0; x < 128; ++x) {
          const index = (y * 128 + x) * 4;
          const different = [0, 1, 2].some(
            (c) => before[index + c] !== after[index + c]
          );
          if (different) changed++;
          // Body interior, including both mesh seams, must remain untouched.
          if (x >= 40 && x <= 87 && y >= 49 && y <= 78)
            expect(different).to.be(false);
        }
      expect(changed).to.be.greaterThan(100);
      const topEdge = (81 * 128 + 64) * 4;
      expect(after[topEdge + 1]).to.be.greaterThan(230);
      expect(after[topEdge + 2]).to.be.greaterThan(200);
      expect(wall.visible).to.be(true);
      expect(foliage.visible).to.be(true);
      expect(hidden.visible).to.be(false);
      expect(scene.overrideMaterial).to.be(null);
      expect(renderer.getRenderTarget()).to.be(output);
      expect(renderer.getClearColor(new THREE.Color()).getHex()).to.be(
        0x010203
      );
      expect(renderer.getClearAlpha()).to.be(0.4);
      expect(renderer.autoClear).to.be(true);
      filter.setEnabled({}, false);
      expect(filter.resources).to.be(null);
      renderer.render(scene, camera);
      filter.render(renderer, scene, camera, root);
      expect(Array.from(pixels())).to.eql(Array.from(before));
      filter.setEnabled({}, true);
      root.visible = false;
      filter.render(renderer, scene, camera, root);
      expect(filter.resources).to.be(null);
    } finally {
      filter.removeEffect();
      output.dispose();
      scene.traverse((node) => {
        if (node.geometry) node.geometry.dispose();
      });
      bodyMaterial.dispose();
      wall.material.dispose();
      foliage.material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    }
  });

  it('applies and removes object effects without a Pixi renderer', function () {
    const filter = { applyEffect: sinon.spy(), removeEffect: sinon.spy() };
    const manager = {
      removeEffect: (effects, target, name) => {
        effects[name].removeEffect(target);
        delete effects[name];
      },
    };
    const object = {
      _rendererEffects: { Outline: filter },
      _behaviors: [],
      getRendererObject: () => null,
      get3DRendererObject: () => new THREE.Group(),
      _runtimeScene: { getGame: () => ({ getEffectsManager: () => manager }) },
    };
    gdjs.RuntimeObject.prototype.onCreated.call(object);
    expect(filter.applyEffect.callCount).to.be(1);
    expect(gdjs.RuntimeObject.prototype.clearEffects.call(object)).to.be(true);
    expect(filter.removeEffect.callCount).to.be(1);
    expect(Object.keys(object._rendererEffects).length).to.be(0);
  });

  it('honors disabled state and clamps non-finite or excessive parameters', function () {
    const filter = new gdjs.Scene3DSilhouetteFilter({ disabled: true });
    expect(filter.isEnabled()).to.be(false);
    filter.updateDoubleParameter('thickness', 100);
    filter.updateDoubleParameter('opacity', -1);
    filter.updateDoubleParameter('thickness', NaN);
    expect(filter.getDoubleParameter('thickness')).to.be(8);
    expect(filter.getDoubleParameter('opacity')).to.be(0);
  });
});
