/* global gdjs, expect, describe, it */
describe("unified GDevelop Language (GDL) runtime", function() {
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

describe("GDL reviewed cardinality rules", function() {
  (window.__gdlSemanticsFixtures || []).forEach(function(fixture) {
    it(fixture.name, function() {
      // eslint-disable-next-line no-eval
      (0, eval)(fixture.code);
      const runtimeScene = new gdjs.TestRuntimeScene(gdjs.getPixiRuntimeGame());
      try {
        ["Player", "Coin", "Enemy"].forEach(name => runtimeScene.registerObject({ name, type: "TestObject::TestObject", variables: [], behaviors: [], effects: [] }));
        const create = (name, x) => {
          const object = runtimeScene.createObject(name);
          object.setWidth(32); object.setHeight(32); object.setPosition(x, 0);
          return object;
        };
        create("Player", 0); create("Player", 5000);
        create("Coin", 0); create("Coin", 16);
        const distantCoin = create("Coin", 10000);
        runtimeScene.getVariables().initFrom([{ name: "Score", type: "number", value: 0 }]);
        const update = gdjs.MainCode.sceneUpdate || gdjs.MainCode.func;
        runtimeScene.renderAndStepWithEventsFunction(16, () => update(runtimeScene));
        expect(runtimeScene.getObjects("Coin").length).to.be(fixture.coins);
        expect(runtimeScene.getVariables().get("Score").getAsNumber()).to.be(fixture.score);
        if (fixture.allCoins !== undefined) expect(runtimeScene.getVariables().get("AllCoins").getAsNumber()).to.be(fixture.allCoins);
        if (fixture.name === "random-current-selection") expect(runtimeScene.getObjects("Coin").indexOf(distantCoin)).not.to.be(-1);
      } finally { runtimeScene.unloadScene(); }
    });
  });
});
