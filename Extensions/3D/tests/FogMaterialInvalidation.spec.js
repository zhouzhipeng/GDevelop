// @ts-check
describe('Fog material invalidation', function () {
  ['LinearFog', 'ExponentialFog'].forEach(function (name) {
    it(
      name + ' updates animated fog uniforms without rebuilding materials',
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
          expect(invalidate.callCount).to.be(1);
          filter.updateStringParameter('color', '12;34;56');
          expect(invalidate.callCount).to.be(1);
          filter.updateColorParameter('color', 0x123456);
          expect(invalidate.callCount).to.be(1);
          const fog = scene.fog;
          const color = fog.color;
          for (let i = 0; i < 120; i++) {
            const next = value + (i + 1) / 100;
            filter.updateDoubleParameter(parameter, next);
            if (name === 'LinearFog') filter.updateDoubleParameter('far', 1000 + i);
            filter.updateColorParameter('color', 0x123456 + i);
            const sync = filter.getNetworkSyncData();
            sync.c = 0x234567 + i;
            if (name === 'LinearFog') { sync.n += 0.1; sync.f += 1; }
            else sync.d += 0.01;
            filter.updateFromNetworkSyncData(sync);
            expect(scene.fog).to.be(fog);
            expect(fog.color).to.be(color);
            expect(fog.color.getHex()).to.be(sync.c);
            if (name === 'LinearFog') {
              expect(fog.near).to.be(sync.n * 0.01);
              expect(fog.far).to.be(sync.f * 0.01);
            } else expect(fog.density).to.be(sync.d * 100);
          }
          expect(invalidate.callCount).to.be(1);
          filter.removeEffect(target);
          filter.removeEffect(target);
          expect(invalidate.callCount).to.be(2);
          filter.updateDoubleParameter(parameter, value + 2);
          expect(invalidate.callCount).to.be(2);
          filter.applyEffect(target);
          expect(invalidate.callCount).to.be(3);
        } finally {
          invalidate.restore();
        }
      }
    );
  });
});
