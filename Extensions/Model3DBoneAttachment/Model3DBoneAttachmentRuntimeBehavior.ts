namespace gdjs {
  const model3DBoneAttachmentBehaviorLogger = new gdjs.Logger(
    '3D bone attachments'
  );
  type Model3DBoneAttachmentOwner = gdjs.RuntimeObject & gdjs.Base3DHandler;

  /**
   * Constrains a rendered 3D object to the posed bone of a 3D model.
   *
   * @category Behaviors > 3D model bone attachment
   */
  export class Model3DBoneAttachmentRuntimeBehavior extends gdjs.RuntimeBehavior {
    declare owner: Model3DBoneAttachmentOwner;
    private _model3DBoneAttachment: gdjs.Model3DBoneAttachment | null = null;

    constructor(
      instanceContainer: gdjs.RuntimeInstanceContainer,
      behaviorData: gdjs.Model3DBoneAttachmentBehaviorData,
      owner: gdjs.RuntimeObject
    ) {
      super(instanceContainer, behaviorData, owner);
      this.owner = owner as Model3DBoneAttachmentOwner;
      this.enableSynchronization(false);
    }

    override onCreated(): void {
      if (
        !gdjs.Base3DHandler.is3D(this.owner) ||
        !this.owner.get3DRendererObject()
      ) {
        model3DBoneAttachmentBehaviorLogger.warn(
          'Model3DBoneAttachmentBehavior can only be attached to a rendered 3D object.'
        );
      }
    }

    override applyBehaviorOverriding(
      behaviorData: gdjs.Model3DBoneAttachmentBehaviorData
    ): boolean {
      return true;
    }

    override onActivate(): void {
      const manager = gdjs.Model3DBoneAttachmentManager.getForScene(
        this.owner.getRuntimeScene()
      );
      if (manager) manager.synchronizeBehavior(this);
    }

    override onDeActivate(): void {
      if (!this._model3DBoneAttachment) return;
      this._model3DBoneAttachment.isResolved = false;
      this._model3DBoneAttachment.lastFailure = null;
    }

    override onDestroy(): void {
      const manager = gdjs.Model3DBoneAttachmentManager.getForScene(
        this.owner.getRuntimeScene()
      );
      if (manager) manager.detach(this);
      this._model3DBoneAttachment = null;
    }

    override doStepPreEvents(
      instanceContainer: gdjs.RuntimeInstanceContainer
    ): void {}

    override doStepPostEvents(
      instanceContainer: gdjs.RuntimeInstanceContainer
    ): void {}

    /** @internal */
    _getModel3DBoneAttachment(): gdjs.Model3DBoneAttachment | null {
      return this._model3DBoneAttachment;
    }

    /** @internal */
    _setModel3DBoneAttachment(
      attachment: gdjs.Model3DBoneAttachment | null
    ): void {
      this._model3DBoneAttachment = attachment;
    }

    attachToModelBone(
      target: gdjs.Model3DRuntimeObject,
      boneName: string
    ): void {
      gdjs.Model3DBoneAttachmentManager.getOrCreateForScene(
        this.owner.getRuntimeScene()
      ).attach(this, target, boneName);
    }

    detachFromModelBone(): void {
      const manager = gdjs.Model3DBoneAttachmentManager.getForScene(
        this.owner.getRuntimeScene()
      );
      if (manager) manager.detach(this);
      else this._model3DBoneAttachment = null;
    }

    setBoneAttachmentPositionOffset(x: float, y: float, z: float): void {
      const attachment = this._model3DBoneAttachment;
      if (!attachment) return;
      attachment.positionOffset[0] = x;
      attachment.positionOffset[1] = y;
      attachment.positionOffset[2] = z;
      const manager = gdjs.Model3DBoneAttachmentManager.getForScene(
        this.owner.getRuntimeScene()
      );
      if (manager) manager.synchronizeBehavior(this);
    }

    setBoneAttachmentRotationOffset(x: float, y: float, z: float): void {
      const attachment = this._model3DBoneAttachment;
      if (!attachment) return;
      attachment.rotationOffset[0] = x;
      attachment.rotationOffset[1] = y;
      attachment.rotationOffset[2] = z;
      const manager = gdjs.Model3DBoneAttachmentManager.getForScene(
        this.owner.getRuntimeScene()
      );
      if (manager) manager.synchronizeBehavior(this);
    }

    isAttachedToModelBone(): boolean {
      return !!this._model3DBoneAttachment;
    }

    isBoneAttachmentResolved(): boolean {
      return !!this._model3DBoneAttachment?.isResolved;
    }

    getAttachedBoneName(): string {
      return this._model3DBoneAttachment?.boneName || '';
    }

    getBoneAttachmentOffsetX(): float {
      return this._model3DBoneAttachment?.positionOffset[0] || 0;
    }

    getBoneAttachmentOffsetY(): float {
      return this._model3DBoneAttachment?.positionOffset[1] || 0;
    }

    getBoneAttachmentOffsetZ(): float {
      return this._model3DBoneAttachment?.positionOffset[2] || 0;
    }

    getBoneAttachmentRotationOffsetX(): float {
      return this._model3DBoneAttachment?.rotationOffset[0] || 0;
    }

    getBoneAttachmentRotationOffsetY(): float {
      return this._model3DBoneAttachment?.rotationOffset[1] || 0;
    }

    getBoneAttachmentRotationOffsetZ(): float {
      return this._model3DBoneAttachment?.rotationOffset[2] || 0;
    }
  }

  gdjs.registerBehavior(
    'Model3DBoneAttachment::Model3DBoneAttachmentBehavior',
    gdjs.Model3DBoneAttachmentRuntimeBehavior
  );
}
