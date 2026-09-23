// @ts-check
describe('3D model root motion filtering', function () {
  const makeRenderer = () => {
    const renderer = Object.create(gdjs.Model3DRuntimeObjectRenderer.prototype);
    renderer._animationClipsWithoutRootMotion = new WeakMap();
    renderer._rootMotionTrackTargetNames = new WeakMap();
    return renderer;
  };

  it('keeps independent root mesh animations such as boat oars', function () {
    const scene = new THREE.Scene();
    for (const name of ['Hull', 'OarLeft', 'OarRight']) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(),
        new THREE.MeshBasicMaterial()
      );
      mesh.name = name;
      scene.add(mesh);
    }
    const clip = new THREE.AnimationClip('Row', 1, [
      new THREE.VectorKeyframeTrack(
        'Hull.position',
        [0, 1],
        [0, 0, 0, 1, 0, 0]
      ),
      new THREE.QuaternionKeyframeTrack(
        'OarLeft.quaternion',
        [0, 1],
        [0, 0, 0, 1, 0, 0, 0.5, 0.866]
      ),
      new THREE.QuaternionKeyframeTrack(
        'OarRight.quaternion',
        [0, 1],
        [0, 0, 0, 1, 0, 0, -0.5, 0.866]
      ),
    ]);

    const filtered = makeRenderer()._getAnimationClipWithoutRootMotion(
      clip,
      scene
    );
    expect(filtered.tracks.map((track) => track.name)).to.eql([
      'Hull.position',
      'OarLeft.quaternion',
      'OarRight.quaternion',
    ]);
  });

  it('still removes transforms from a root that moves the entire model', function () {
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    root.name = 'ModelRoot';
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshBasicMaterial()
    );
    mesh.name = 'Oar';
    root.add(mesh);
    scene.add(root);
    const clip = new THREE.AnimationClip('Row', 1, [
      new THREE.VectorKeyframeTrack(
        'ModelRoot.position',
        [0, 1],
        [0, 0, 0, 1, 0, 0]
      ),
      new THREE.QuaternionKeyframeTrack(
        'Oar.quaternion',
        [0, 1],
        [0, 0, 0, 1, 0, 0, 0.5, 0.866]
      ),
    ]);

    const filtered = makeRenderer()._getAnimationClipWithoutRootMotion(
      clip,
      scene
    );
    expect(filtered.tracks.map((track) => track.name)).to.eql([
      'Oar.quaternion',
    ]);
  });
});
