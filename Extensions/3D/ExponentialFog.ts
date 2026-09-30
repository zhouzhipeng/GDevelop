namespace gdjs {
  interface ExponentialFogFilterNetworkSyncData {
    d: number;
    c: number;
  }
  gdjs.PixiFiltersTools.registerFilterCreator(
    'Scene3D::ExponentialFog',
    new (class implements gdjs.PixiFiltersTools.FilterCreator {
      makeFilter(
        target: EffectsTarget,
        effectData: EffectData
      ): gdjs.PixiFiltersTools.Filter {
        if (typeof THREE === 'undefined') {
          return new gdjs.PixiFiltersTools.EmptyFilter();
        }
        return new (class implements gdjs.PixiFiltersTools.Filter {
          fog: THREE.FogExp2;
          private _density: float = 0.00025;

          private _invalidateTSLMaterials(): void {
            const tslMaterialSystem = (gdjs as any).TSLMaterialSystem;
            if (tslMaterialSystem) {
              tslMaterialSystem.invalidateSceneInputs(target.getRuntimeScene());
            }
          }

          constructor() {
            this.fog = new THREE.FogExp2(0xffffff);
            this._applyWorldScale();
          }

          private _applyWorldScale(): void {
            const worldScale = target
              .getRuntimeScene()
              .getScene()
              .getRenderer3DWorldScale();
            this.fog.density = this._density * worldScale;
          }

          isEnabled(target: EffectsTarget): boolean {
            const scene = target.get3DRendererObject() as
              | THREE.Scene
              | null
              | undefined;
            return scene ? scene.fog === this.fog : false;
          }
          setEnabled(target: EffectsTarget, enabled: boolean): boolean {
            if (enabled) {
              return this.applyEffect(target);
            } else {
              return this.removeEffect(target);
            }
          }
          applyEffect(target: EffectsTarget): boolean {
            const scene = target.get3DRendererObject() as
              | THREE.Scene
              | null
              | undefined;
            if (!scene || scene.fog === undefined) {
              return false;
            }
            if (scene.fog === this.fog) return true;
            scene.fog = this.fog;
            this._invalidateTSLMaterials();
            return true;
          }
          removeEffect(target: EffectsTarget): boolean {
            const scene = target.get3DRendererObject() as
              | THREE.Scene
              | null
              | undefined;
            if (!scene || scene.fog === undefined) {
              return false;
            }
            if (scene.fog === null) return true;
            scene.fog = null;
            this._invalidateTSLMaterials();
            return true;
          }
          updatePreRender(target: gdjs.EffectsTarget): any {
            this._applyWorldScale();
          }
          updateDoubleParameter(parameterName: string, value: number): void {
            // Fog values are live TSL uniforms. Rebuild only when the fog
            // object/graph changes, never for each frame of a weather fade.
            if (parameterName === 'density') {
              if (this._density === value) return;
              this._density = value;
              this._applyWorldScale();
            }
          }
          getDoubleParameter(parameterName: string): number {
            if (parameterName === 'density') {
              return this._density;
            }
            return 0;
          }
          updateStringParameter(parameterName: string, value: string): void {
            if (parameterName === 'color') {
              const color = gdjs.rgbOrHexStringToNumber(value);
              if (this.fog.color.getHex() === color) return;
              this.fog.color.setHex(color);
            }
          }
          updateColorParameter(parameterName: string, value: number): void {
            if (parameterName === 'color') {
              if (this.fog.color.getHex() === value) return;
              this.fog.color.setHex(value);
            }
          }
          getColorParameter(parameterName: string): number {
            if (parameterName === 'color') {
              return this.fog.color.getHex();
            }
            return 0;
          }
          updateBooleanParameter(parameterName: string, value: boolean): void {}
          getNetworkSyncData(): ExponentialFogFilterNetworkSyncData {
            return {
              d: this._density,
              c: this.fog.color.getHex(),
            };
          }
          updateFromNetworkSyncData(
            syncData: ExponentialFogFilterNetworkSyncData
          ): void {
            if (
              this._density === syncData.d &&
              this.fog.color.getHex() === syncData.c
            )
              return;
            this._density = syncData.d;
            this._applyWorldScale();
            this.fog.color.setHex(syncData.c);
          }
        })();
      }
    })()
  );
}
