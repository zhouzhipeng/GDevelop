// @ts-check

describe('Spring bone runtime behavior', function () {
  it('converts Three.js frame coordinates to GDevelop scene units', function () {
    const targets = new Float32Array([1.25, -2.5, 0.75, 1.5, -2.75, 0.5]);
    const rendererColliderWorldData = new Float32Array([
      1, -2, 3, 0.1, 4, -5, 6, 0.2,
    ]);
    const originalRendererColliderWorldData = Array.from(
      rendererColliderWorldData
    );
    const colliderWorldData = new Float32Array(8);

    gdjs.convertSpringBoneFrameToSceneCoordinates(
      targets,
      rendererColliderWorldData,
      colliderWorldData,
      100
    );

    expect(Array.from(targets)).to.eql([125, -250, 75, 150, -275, 50]);
    expect(Array.from(colliderWorldData)).to.eql([
      100, -200, 300, 10, 400, -500, 600, 20,
    ]);
    expect(Array.from(rendererColliderWorldData)).to.eql(
      originalRendererColliderWorldData
    );
  });
});
