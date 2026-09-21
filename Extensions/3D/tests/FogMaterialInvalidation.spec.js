// @ts-check
describe('Fog material invalidation', function () {
  ['LinearFog', 'ExponentialFog'].forEach(function (name) {
    it(
      name + ' ignores repeated weather values but invalidates real changes',
      function () {
        const scene = new THREE.Scene();
        const runtimeScene = {
          getScene: () => ({
            getRenderer3DInverseWorldScale: () => 0.01,
            getRenderer3DWorldScale: () => 100,
          }),
        };
        const target = {
          getRuntimeScene: () => runtimeScene,
          get3DRendererObject: () => scene,
        };
        const invalidate = sinon.stub(
          gdjs.TSLMaterialSystem,
          'invalidateSceneInputs'
        );
        try {
          const filter = gdjs.PixiFiltersTools.getFilterCreator(
            'Scene3D::' + name
          ).makeFilter(target, {});
          filter.applyEffect(target);
          expect(invalidate.callCount).to.be(1);
          filter.applyEffect(target);
          const parameter = name === 'LinearFog' ? 'near' : 'density';
          const value = filter.getDoubleParameter(parameter);
          for (let i = 0; i < 60; i++) {
            filter.updateDoubleParameter(parameter, value);
            filter.updateStringParameter('color', '255;255;255');
            filter.updateColorParameter('color', 0xffffff);
            filter.updateFromNetworkSyncData(filter.getNetworkSyncData());
          }
          expect(invalidate.callCount).to.be(1);
          filter.updateDoubleParameter(parameter, value + 1);
          expect(invalidate.callCount).to.be(2);
          filter.updateStringParameter('color', '12;34;56');
          expect(invalidate.callCount).to.be(3);
          filter.updateColorParameter('color', 0x123456);
          expect(invalidate.callCount).to.be(4);
          filter.removeEffect(target);
          filter.removeEffect(target);
          expect(invalidate.callCount).to.be(5);
          filter.updateDoubleParameter(parameter, value + 2);
          expect(invalidate.callCount).to.be(5);
          filter.applyEffect(target);
          expect(invalidate.callCount).to.be(6);
        } finally {
          invalidate.restore();
        }
      }
    );
  });
});
