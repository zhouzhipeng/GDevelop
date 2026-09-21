// @ts-check
describe('3D model animation pause', function () {
  it('freezes outgoing actions and fade weights, then resumes the transition', function () {
    const root = new THREE.Object3D();
    const mixer = new THREE.AnimationMixer(root);
    const makeClip = (name, from, to) =>
      new THREE.AnimationClip(name, 1, [
        new THREE.NumberKeyframeTrack('.position[x]', [0, 1], [from, to]),
      ]);
    const first = mixer.clipAction(makeClip('first', 0, 10)).play();
    mixer.update(0.2);
    const second = mixer.clipAction(makeClip('second', 20, 30)).play();
    second.crossFadeFrom(first, 0.5, false);
    let paused = false;
    const renderer = Object.create(gdjs.Model3DRuntimeObjectRenderer.prototype);
    renderer._model3DRuntimeObject = { isAnimationPaused: () => paused };
    renderer._animationMixer = mixer;
    renderer.updateAnimation(0.1);
    const position = root.position.x;
    const mixerTime = mixer.time;
    const outgoingTime = first.time;
    const weight = second.getEffectiveWeight();
    paused = true;
    second.paused = true;
    for (let i = 0; i < 30; i++) renderer.updateAnimation(1 / 60);
    expect(root.position.x).to.be(position);
    expect(mixer.time).to.be(mixerTime);
    expect(first.time).to.be(outgoingTime);
    expect(second.getEffectiveWeight()).to.be(weight);
    paused = false;
    second.paused = false;
    renderer.updateAnimation(0.1);
    expect(root.position.x).not.to.be(position);
    expect(mixer.time).to.be(mixerTime + 0.1);
  });
});
