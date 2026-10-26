/* global gdjs, expect, describe, it */
describe("unified Settings DSL runtime", function() {
  it("retains OR picking, parent-to-JS picking, deletion scope, Else and all loop counts", function() {
    // The producer is the real native code generator in NativeEvents.spec.js.
    // eslint-disable-next-line no-eval
    (0, eval)(window.__unifiedSettingsGeneratedCode);
    const runtimeGame = gdjs.getPixiRuntimeGame();
    const runtimeScene = new gdjs.TestRuntimeScene(runtimeGame);
    try {
      ["Player", "Enemy", "Coin"].forEach(name =>
        runtimeScene.registerObject({
          name,
          type: "TestObject::TestObject",
          variables: [],
          behaviors: [],
          effects: []
        })
      );
      const create = (name, x) => {
        const object = runtimeScene.createObject(name);
        object.setWidth(32);
        object.setHeight(32);
        object.setPosition(x, 0);
        return object;
      };
      const pickedPlayer = create("Player", 0);
      const unpickedPlayer = create("Player", 5000);
      create("Enemy", 1000);
      create("Coin", 0);
      const unpickedCoin = create("Coin", 10000);
      runtimeScene.getVariables().initFrom(window.__unifiedSettingsVariables);
      const update = gdjs.MainCode.sceneUpdate || gdjs.MainCode.func;
      expect(typeof update).to.be("function");
      runtimeScene.renderAndStepWithEventsFunction(16, () =>
        update(runtimeScene)
      );
      expect(runtimeScene.getObjects("Coin")).to.eql([unpickedCoin]);
      expect(pickedPlayer.getX()).to.be(42);
      expect(unpickedPlayer.getX()).to.be(5000);
      expect(
        runtimeScene
          .getVariables()
          .get("Score")
          .getAsNumber()
      ).to.be(11);
      expect(
        runtimeScene
          .getVariables()
          .get("QueueSize")
          .getAsNumber()
      ).to.be(0);
    } finally {
      runtimeScene.unloadScene();
    }
  });
});
