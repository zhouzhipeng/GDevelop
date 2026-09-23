describe('Scene render profiling boundaries', function () {
  let scene;
  let profiler;
  let clock;
  beforeEach(function () {
    scene = new gdjs.RuntimeScene(gdjs.getPixiRuntimeGame());
    scene.addLayer({ name: '', visibility: true, cameras: [], effects: [] });
    scene.setEventsFunction(() => { clock += 2; });
    sinon.stub(scene.getRenderer(), 'render').callsFake(() => { clock += 3; });
    scene.startProfiler(() => {});
    profiler = scene.getProfiler();
    clock = 0;
    profiler._getTimeNow = () => clock;
  });
  afterEach(function () {
    scene.getRenderer().render.restore();
    scene._destroy();
  });
  it('can redraw a paused scene before its first profiled step', function () {
    scene.render();
    expect(profiler.getFrameTimes().length).to.be(0);
    scene.renderAndStep(1000 / 60);
    expect(profiler.getFrameTimes()).to.eql([5]);
  });
  it('does not mutate a completed frame when the paused preview redraws', function () {
    scene.renderAndStep(1000 / 60);
    const measured = profiler.getFramesAverageMeasures();
    for (let i = 0; i < 3; i++) scene.render();
    expect(profiler.getFramesAverageMeasures()).to.eql(measured);
    scene.renderAndStep(1000 / 60);
    expect(profiler.getFrameTimes()).to.eql([5, 5]);
    expect(profiler.getFramesAverageMeasures().subsections.render.time).to.be(3);
  });
});
