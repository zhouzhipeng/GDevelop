namespace gdjs {
  /** @internal */
  export interface Model3DBoneAttachmentBehaviorData extends BehaviorData {
    object3D: string;
  }

  /** @internal */
  export type Model3DBoneAttachmentFailure =
    | 'deleted-object'
    | 'container-mismatch'
    | 'layer-mismatch'
    | 'layer-group-mismatch'
    | 'renderer-parent-mismatch'
    | 'missing-bone'
    | 'ambiguous-bone'
    | 'invalid-bone-transform';

  /** @internal */
  export type Model3DBoneAttachment = {
    target: gdjs.Model3DRuntimeObject;
    boneName: string;
    positionOffset: [number, number, number];
    rotationOffset: [number, number, number];
    isResolved: boolean;
    lastFailure: gdjs.Model3DBoneAttachmentFailure | null;
  };
}
