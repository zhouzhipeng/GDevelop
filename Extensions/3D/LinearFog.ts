namespace gdjs {
  interface LinearFogFilterNetworkSyncData {
    n: number;
    f: number;
    c: number;
  }
  gdjs.PixiFiltersTools.registerFilterCreator(
    'Scene3D::LinearFog',
    new (class implements gdjs.PixiFiltersTools.FilterCreator {
      makeFilter(
        target: EffectsTarget,
        effectData: EffectData
      ): gdjs.PixiFiltersTools.Filter {
        if (typeof THREE === 'undefined') {
          return new gdjs.PixiFiltersTools.EmptyFilter();
        }
        return new (class implements gdjs.PixiFiltersTools.Filter {
          fog: THREE.Fog;
          private _near: float = 1;
          private _far: float = 1000;

          private _invalidateTSLMaterials(): void {
            const tslMaterialSystem = (gdjs as any).TSLMaterialSystem;
            if (tslMaterialSystem) {
              tslMaterialSystem.invalidateSceneInputs(target.getRuntimeScene());
            }
          }

          constructor() {
            this.fog = new THREE.Fog(0xffffff);
            this._applyWorldScale();
          }

          private _applyWorldScale(): void {
            const inverseWorldScale = target
              .getRuntimeScene()
              .getScene()
              .getRenderer3DInverseWorldScale();
            this.fog.near = this._near * inverseWorldScale;
            this.fog.far = this._far * inverseWorldScale;
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
            scene.fog = null;
            this._invalidateTSLMaterials();
            return true;
          }
          updatePreRender(target: gdjs.EffectsTarget): any {
            this._applyWorldScale();
          }
          updateDoubleParameter(parameterName: string, value: number): void {
            if (parameterName === 'near') {
              this._near = value;
              this._applyWorldScale();
            } else if (parameterName === 'far') {
              this._far = value;
              this._applyWorldScale();
            }
            if (
              (parameterName === 'near' || parameterName === 'far') &&
              this.isEnabled(target)
            ) {
              this._invalidateTSLMaterials();
            }
          }
          getDoubleParameter(parameterName: string): number {
            if (parameterName === 'near') {
              return this._near;
            } else if (parameterName === 'far') {
              return this._far;
            }
            return 0;
          }
          updateStringParameter(parameterName: string, value: string): void {
            if (parameterName === 'color') {
              this.fog.color = new THREE.Color(
                gdjs.rgbOrHexStringToNumber(value)
              );
              if (this.isEnabled(target)) this._invalidateTSLMaterials();
            }
          }
          updateColorParameter(parameterName: string, value: number): void {
            if (parameterName === 'color') {
              this.fog.color.setHex(value);
              if (this.isEnabled(target)) this._invalidateTSLMaterials();
            }
          }
          getColorParameter(parameterName: string): number {
            if (parameterName === 'color') {
              return this.fog.color.getHex();
            }
            return 0;
          }
          updateBooleanParameter(parameterName: string, value: boolean): void {}
          getNetworkSyncData(): LinearFogFilterNetworkSyncData {
            return {
              n: this._near,
              f: this._far,
              c: this.fog.color.getHex(),
            };
          }
          updateFromNetworkSyncData(
            data: LinearFogFilterNetworkSyncData
          ): void {
            this._near = data.n;
            this._far = data.f;
            this._applyWorldScale();
            this.fog.color.setHex(data.c);
            if (this.isEnabled(target)) this._invalidateTSLMaterials();
          }
        })();
      }
    })()
  );
}
