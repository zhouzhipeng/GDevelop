namespace gdjs {
  /** Applies one declarative default TSL material binding to a Model3D object. */
  export class TSLMaterialRuntimeBehavior extends gdjs.RuntimeBehavior {
    declare owner: gdjs.Model3DRuntimeObject;
    private _materialResourceName = '';
    private _bindingName = 'Default';
    private _selectorMode: gdjs.TSLMaterialSelectorMode = 'All';
    private _meshName = '';
    private _materialName = '';
    private _priority = 0;
    private _configuredEnabled = true;

    constructor(
      instanceContainer: gdjs.RuntimeInstanceContainer,
      behaviorData: gdjs.TSLMaterialBehaviorData,
      owner: gdjs.RuntimeObject
    ) {
      super(instanceContainer, behaviorData, owner);
      this.owner = owner as gdjs.Model3DRuntimeObject;
      this._applyData(behaviorData);
      this.enableSynchronization(false);
    }

    override onCreated(): void {
      this._applyBinding();
    }

    override applyBehaviorOverriding(
      behaviorData: gdjs.TSLMaterialBehaviorData
    ): boolean {
      const previousBindingName = this._bindingName;
      this._applyData(behaviorData);
      const system = gdjs.TSLMaterialSystem.getOrCreateForScene(
        this.owner.getRuntimeScene()
      );
      if (previousBindingName !== this._bindingName) {
        system.removeBinding(this.owner, previousBindingName);
      }
      this._applyBinding();
      return true;
    }

    override onActivate(): void {
      this._applyBinding();
    }

    override onDeActivate(): void {
      gdjs.TSLMaterialSystem.getForScene(
        this.owner.getRuntimeScene()
      )?.enableBinding(this.owner, this._bindingName, false);
    }

    override onDestroy(): void {
      gdjs.TSLMaterialSystem.getForScene(
        this.owner.getRuntimeScene()
      )?.removeBinding(this.owner, this._bindingName);
    }

    override doStepPreEvents(
      instanceContainer: gdjs.RuntimeInstanceContainer
    ): void {}

    override doStepPostEvents(
      instanceContainer: gdjs.RuntimeInstanceContainer
    ): void {}

    applyMaterial(
      bindingName: string,
      materialResourceName: string,
      selectorMode: string,
      meshName: string,
      materialName: string,
      priority: integer
    ): void {
      gdjs.TSLMaterialRuntimeTools.applyMaterial(
        this.owner,
        bindingName,
        materialResourceName,
        selectorMode,
        meshName,
        materialName,
        priority
      );
    }

    removeBinding(bindingName: string): void {
      gdjs.TSLMaterialRuntimeTools.removeBinding(this.owner, bindingName);
    }

    removeAllBindings(): void {
      gdjs.TSLMaterialRuntimeTools.removeAllBindings(this.owner);
    }

    enableBinding(bindingName: string, enabled: boolean): void {
      gdjs.TSLMaterialRuntimeTools.enableBinding(
        this.owner,
        bindingName,
        enabled
      );
    }

    setNumberParameter(
      bindingName: string,
      parameterName: string,
      value: float
    ): void {
      gdjs.TSLMaterialRuntimeTools.setNumberParameter(
        this.owner,
        bindingName,
        parameterName,
        value
      );
    }

    setBooleanParameter(
      bindingName: string,
      parameterName: string,
      value: boolean
    ): void {
      gdjs.TSLMaterialRuntimeTools.setBooleanParameter(
        this.owner,
        bindingName,
        parameterName,
        value
      );
    }

    setColorParameter(
      bindingName: string,
      parameterName: string,
      value: string
    ): void {
      gdjs.TSLMaterialRuntimeTools.setColorParameter(
        this.owner,
        bindingName,
        parameterName,
        value
      );
    }

    setVector2Parameter(
      bindingName: string,
      parameterName: string,
      x: float,
      y: float
    ): void {
      gdjs.TSLMaterialRuntimeTools.setVector2Parameter(
        this.owner,
        bindingName,
        parameterName,
        x,
        y
      );
    }

    setVector3Parameter(
      bindingName: string,
      parameterName: string,
      x: float,
      y: float,
      z: float
    ): void {
      gdjs.TSLMaterialRuntimeTools.setVector3Parameter(
        this.owner,
        bindingName,
        parameterName,
        x,
        y,
        z
      );
    }

    setVector4Parameter(
      bindingName: string,
      parameterName: string,
      x: float,
      y: float,
      z: float,
      w: float
    ): void {
      gdjs.TSLMaterialRuntimeTools.setVector4Parameter(
        this.owner,
        bindingName,
        parameterName,
        x,
        y,
        z,
        w
      );
    }

    setTextureParameter(
      bindingName: string,
      parameterName: string,
      imageResourceName: string
    ): void {
      gdjs.TSLMaterialRuntimeTools.setTextureParameter(
        this.owner,
        bindingName,
        parameterName,
        imageResourceName
      );
    }

    resetParameter(bindingName: string, parameterName: string): void {
      gdjs.TSLMaterialRuntimeTools.resetParameter(
        this.owner,
        bindingName,
        parameterName
      );
    }

    hasBinding(bindingName: string): boolean {
      return gdjs.TSLMaterialRuntimeTools.hasBinding(this.owner, bindingName);
    }

    isBindingReady(bindingName: string): boolean {
      return gdjs.TSLMaterialRuntimeTools.isBindingReady(
        this.owner,
        bindingName
      );
    }

    bindingHasError(bindingName: string): boolean {
      return gdjs.TSLMaterialRuntimeTools.bindingHasError(
        this.owner,
        bindingName
      );
    }

    bindingMatchedSlot(bindingName: string): boolean {
      return gdjs.TSLMaterialRuntimeTools.bindingMatchedSlot(
        this.owner,
        bindingName
      );
    }

    getMatchedSlotCount(bindingName: string): integer {
      return gdjs.TSLMaterialRuntimeTools.getMatchedSlotCount(
        this.owner,
        bindingName
      );
    }

    getActiveSlotCount(bindingName: string): integer {
      return gdjs.TSLMaterialRuntimeTools.getActiveSlotCount(
        this.owner,
        bindingName
      );
    }

    getLastErrorCode(bindingName: string): string {
      return gdjs.TSLMaterialRuntimeTools.getLastErrorCode(
        this.owner,
        bindingName
      );
    }

    getLastError(bindingName: string): string {
      return gdjs.TSLMaterialRuntimeTools.getLastError(this.owner, bindingName);
    }

    private _applyData(data: Partial<gdjs.TSLMaterialBehaviorData>): void {
      if (typeof data.Material === 'string') {
        this._materialResourceName = data.Material;
      }
      if (typeof data.BindingName === 'string' && data.BindingName) {
        this._bindingName = data.BindingName;
      }
      if (
        data.SelectorMode === 'All' ||
        data.SelectorMode === 'MeshName' ||
        data.SelectorMode === 'MaterialName' ||
        data.SelectorMode === 'MeshAndMaterialName'
      ) {
        this._selectorMode = data.SelectorMode;
      }
      if (typeof data.MeshName === 'string') this._meshName = data.MeshName;
      if (typeof data.MaterialName === 'string') {
        this._materialName = data.MaterialName;
      }
      if (typeof data.Priority === 'number' && Number.isFinite(data.Priority)) {
        this._priority = Math.trunc(data.Priority);
      }
      if (typeof data.Enabled === 'boolean') {
        this._configuredEnabled = data.Enabled;
      }
    }

    private _applyBinding(): void {
      if (
        !(this.owner instanceof gdjs.Model3DRuntimeObject) ||
        !this._materialResourceName
      ) {
        gdjs.TSLMaterialSystem.getForScene(
          this.owner.getRuntimeScene()
        )?.removeBinding(this.owner, this._bindingName);
        return;
      }
      gdjs.TSLMaterialSystem.getOrCreateForScene(
        this.owner.getRuntimeScene()
      ).applyBinding(this.owner, {
        bindingName: this._bindingName,
        materialResourceName: this._materialResourceName,
        selector: {
          mode: this._selectorMode,
          meshName: this._meshName,
          materialName: this._materialName,
        },
        priority: this._priority,
        enabled: this._configuredEnabled && this.activated(),
      });
    }
  }

  gdjs.registerBehavior(
    'TSLMaterial::Material',
    gdjs.TSLMaterialRuntimeBehavior
  );
}
