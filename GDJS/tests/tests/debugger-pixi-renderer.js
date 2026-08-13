// @ts-check

describe('gdjs.DebuggerPixiRenderer', function () {
  it('keeps explicit 3D rendering when an invalid lighting-layer flag is set', function () {
    const warning = sinon.spy(console, 'warn');
    const makeRuntimeScene = () => {
      const runtimeScene = new gdjs.RuntimeScene(gdjs.getPixiRuntimeGame());
      runtimeScene.addLayer({
        name: 'InvalidLightingLayerForTest',
        renderingType: '3d',
        cameraType: 'perspective',
        visibility: true,
        cameras: [],
        effects: [],
        ambientLightColorR: 0,
        ambientLightColorG: 0,
        ambientLightColorB: 0,
        isLightingLayer: true,
        followBaseLayerCamera: false,
      });
      return runtimeScene;
    };

    const firstScene = makeRuntimeScene();
    const secondScene = makeRuntimeScene();
    try {
      const layer = firstScene.getLayer('InvalidLightingLayerForTest');
      expect(layer.getRenderingType()).to.be(
        gdjs.RuntimeLayerRenderingType.THREE_D
      );
      expect(layer.isLightingLayer()).to.be(false);
      expect(layer.getRenderer().getThreeGroup()).not.to.be(null);
      expect(
        warning.calledWithMatch('RUNTIME_3D_LIGHTING_LAYER_NORMALIZED')
      ).to.be(true);
      expect(warning.callCount).to.be(1);
    } finally {
      warning.restore();
      firstScene._destroy();
      secondScene._destroy();
    }
  });

  /**
   * @returns {{runtimeScene: gdjs.RuntimeScene, object: gdjs.TestRuntimeObject, layer: gdjs.RuntimeLayer}}
   */
  const make3DSceneAndObject = () => {
    const runtimeGame = gdjs.getPixiRuntimeGame();
    const runtimeScene = new gdjs.RuntimeScene(runtimeGame);
    runtimeScene.addLayer({
      name: '',
      renderingType: '3d',
      cameraType: 'perspective',
      visibility: true,
      cameras: [],
      effects: [],
      ambientLightColorR: 0,
      ambientLightColorG: 0,
      ambientLightColorB: 0,
      isLightingLayer: false,
      followBaseLayerCamera: false,
    });
    const object = new gdjs.TestRuntimeObject(runtimeScene, {
      name: 'Object',
      type: '',
      variables: [],
      behaviors: [],
      effects: [],
    });
    return { runtimeScene, object, layer: runtimeScene.getLayer('') };
  };

  /**
   * @param {gdjs.SignalDebugPoint} source
   * @param {gdjs.SignalDebugPoint} receiver
   * @returns {gdjs.SignalAnimationDebugRecord}
   */
  const makeSignalDebugRecord = (source, receiver) => ({
    id: 1,
    name: 'TestSignal',
    payload: '',
    target: 'objectInstance:#2',
    status: 'delivered',
    source,
    receivers: [{ ...receiver, receiverName: receiver.objectName }],
  });

  it('exposes signal animations through the debugger overlay rendered over 3D scenes', function () {
    const { runtimeScene, object } = make3DSceneAndObject();
    const debuggerRenderer = runtimeScene.getDebuggerRenderer();
    const signalDebugRecord = makeSignalDebugRecord(
      {
        objectName: 'scene',
        objectId: -1,
        x: 400,
        y: 300,
        z: 0,
        layer: '',
      },
      {
        objectName: 'Object',
        objectId: object.getUniqueId(),
        x: 100,
        y: 200,
        z: 0,
        layer: '',
      }
    );

    try {
      debuggerRenderer.renderSignalDebugDraw([signalDebugRecord], 0);
      const debugOverlayContainer = debuggerRenderer.getRendererObject();
      if (!debugOverlayContainer) {
        throw new Error('The debugger overlay should have been created.');
      }
      expect(debugOverlayContainer.children).to.contain(
        debuggerRenderer._signalDebugDrawContainer
      );
      expect(
        runtimeScene.getRenderer().getRendererObject().children
      ).to.contain(debugOverlayContainer);

      debuggerRenderer.renderDebugDraw([object], true, false, false, false, []);
      expect(debuggerRenderer.getRendererObject()).to.be(debugOverlayContainer);
      expect(debugOverlayContainer.children).to.contain(
        debuggerRenderer._debugDrawContainer
      );

      debuggerRenderer.clearSignalDebugDraw();
      expect(debuggerRenderer.getRendererObject()).to.be(debugOverlayContainer);
      debuggerRenderer.clearDebugDraw();
      expect(debuggerRenderer.getRendererObject()).to.be(null);
    } finally {
      runtimeScene._destroy();
    }
  });

  it('projects signal endpoints through the active 3D camera using their Z position', function () {
    const { runtimeScene, layer } = make3DSceneAndObject();
    const layerRenderer = layer.getRenderer();
    const threeObject = new THREE.Object3D();
    layerRenderer.add3DRendererObject(threeObject);
    layer.setCameraX(400);
    layer.setCameraY(300);
    layer.setCameraRotationX(25);
    const camera = layerRenderer.getThreeCamera();
    if (!camera) {
      throw new Error('The 3D layer should have a Three.js camera.');
    }

    try {
      const point = {
        objectName: 'Object',
        objectId: 1,
        x: 430,
        y: 340,
        z: 120,
        layer: '',
      };
      const projectedPosition = runtimeScene
        .getDebuggerRenderer()
        ._getSignalDebugPointPosition(point, [0, 0]);
      if (!projectedPosition) {
        throw new Error(
          'The signal point should be inside the camera frustum.'
        );
      }

      const inverseWorldScale = runtimeScene.getRenderer3DInverseWorldScale();
      camera.updateMatrixWorld();
      const expectedPoint = new THREE.Vector3(
        point.x * inverseWorldScale,
        -point.y * inverseWorldScale,
        point.z * inverseWorldScale
      ).project(camera);
      expect(projectedPosition[0]).to.be.within(
        ((expectedPoint.x + 1) / 2) * layer.getWidth() - 0.001,
        ((expectedPoint.x + 1) / 2) * layer.getWidth() + 0.001
      );
      expect(projectedPosition[1]).to.be.within(
        ((1 - expectedPoint.y) / 2) * layer.getHeight() - 0.001,
        ((1 - expectedPoint.y) / 2) * layer.getHeight() + 0.001
      );

      const groundPosition = runtimeScene
        .getDebuggerRenderer()
        ._getSignalDebugPointPosition({ ...point, z: 0 }, [0, 0]);
      if (!groundPosition) {
        throw new Error(
          'The ground signal point should be inside the frustum.'
        );
      }
      expect(
        Math.abs(projectedPosition[1] - groundPosition[1])
      ).to.be.greaterThan(1);
      expect(
        runtimeScene.getDebuggerRenderer()._getSignalDebugPointPosition(
          {
            objectName: 'scene',
            objectId: -1,
            x: layer.getCameraX(),
            y: layer.getCameraY(),
            z: 0,
            layer: '',
          },
          [0, 0]
        )
      ).to.eql([400, 300]);
    } finally {
      layerRenderer.remove3DRendererObject(threeObject);
      runtimeScene._destroy();
    }
  });

  it('refreshes collision masks at 30 frames per second', function () {
    const { runtimeScene } = make3DSceneAndObject();
    const debuggerRenderer = runtimeScene.getDebuggerRenderer();
    const now = sinon.stub(Date, 'now');
    now.returns(1000);
    debuggerRenderer._debugDrawLastRenderSignature = '0:0:0';
    debuggerRenderer._debugDrawLastRenderTime = 1000;

    try {
      expect(
        debuggerRenderer.isDebugDrawRefreshNeeded(false, false, false)
      ).to.be(false);
      now.returns(1033);
      expect(
        debuggerRenderer.isDebugDrawRefreshNeeded(false, false, false)
      ).to.be(false);
      now.returns(1034);
      expect(
        debuggerRenderer.isDebugDrawRefreshNeeded(false, false, false)
      ).to.be(true);
    } finally {
      now.restore();
      runtimeScene._destroy();
    }
  });

  it('renders and updates a 3D collision mask in its layer', function () {
    const { runtimeScene, object, layer } = make3DSceneAndObject();
    let collisionMask = {
      vertices: new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0]),
      positionX: 100,
      positionY: 200,
      positionZ: 300,
      rotationX: 0,
      rotationY: 0,
      rotationZ: Math.sqrt(0.5),
      rotationW: Math.sqrt(0.5),
    };
    object.get3DDebugCollisionMasks = () => [collisionMask];
    expect(object.getRendererObject()).to.be(null);

    const debuggerRenderer = runtimeScene.getDebuggerRenderer();
    const clearMaskCache = sinon.spy(object, 'clear3DDebugCollisionMaskCache');
    debuggerRenderer.renderDebugDraw([object], true, false, false, false, []);

    const threeGroup = layer.getRenderer().getThreeGroup();
    if (!threeGroup) {
      throw new Error('The 3D layer should have a Three.js group.');
    }
    expect(threeGroup.children.length).to.be(1);
    const lineSegments = /** @type {THREE.LineSegments} */ (
      threeGroup.children[0]
    );
    expect(lineSegments instanceof THREE.LineSegments).to.be(true);
    expect(lineSegments.geometry.getAttribute('position').count).to.be(6);
    expect(lineSegments.position.toArray()).to.eql([100, 200, 300]);
    expect(lineSegments.quaternion.toArray()).to.eql([
      0,
      0,
      Math.sqrt(0.5),
      Math.sqrt(0.5),
    ]);
    const material = /** @type {THREE.LineBasicMaterial} */ (
      lineSegments.material
    );
    expect(material.color.getHex()).to.be(0xff0000);
    expect(material.opacity).to.be(0.5);
    expect(material.depthTest).to.be(false);

    const previousGeometry = lineSegments.geometry;
    const disposePreviousGeometry = sinon.spy(previousGeometry, 'dispose');
    collisionMask = {
      ...collisionMask,
      vertices: new Float32Array([0, 0, 0, 20, 0, 0, 0, 20, 0]),
      positionX: 400,
    };
    debuggerRenderer._debugDrawLastRenderTime = 0;
    debuggerRenderer.renderDebugDraw([object], true, false, false, false, []);

    expect(threeGroup.children[0]).to.be(lineSegments);
    expect(disposePreviousGeometry.calledOnce).to.be(true);
    expect(lineSegments.geometry).not.to.be(previousGeometry);
    expect(lineSegments.position.x).to.be(400);
    expect(lineSegments.renderOrder).to.be.greaterThan(Number.MAX_SAFE_INTEGER);

    const raycastIntersections = [];
    lineSegments.raycast(new THREE.Raycaster(), raycastIntersections);
    expect(raycastIntersections).to.eql([]);

    debuggerRenderer.clearDebugDraw();
    expect(clearMaskCache.calledOnce).to.be(true);
  });

  it('removes and disposes 3D collision masks when its container is destroyed', function () {
    const { runtimeScene, object, layer } = make3DSceneAndObject();
    object.get3DDebugCollisionMasks = () => [
      {
        vertices: new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0]),
        positionX: 0,
        positionY: 0,
        positionZ: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        rotationW: 1,
      },
    ];

    const debuggerRenderer = runtimeScene.getDebuggerRenderer();
    const clearMaskCache = sinon.spy(object, 'clear3DDebugCollisionMaskCache');
    debuggerRenderer.renderDebugDraw([object], true, false, false, false, []);
    const threeGroup = layer.getRenderer().getThreeGroup();
    if (!threeGroup) {
      throw new Error('The 3D layer should have a Three.js group.');
    }
    const lineSegments = /** @type {THREE.LineSegments} */ (
      threeGroup.children[0]
    );
    const material = /** @type {THREE.LineBasicMaterial} */ (
      lineSegments.material
    );
    const disposeGeometry = sinon.spy(lineSegments.geometry, 'dispose');
    const disposeMaterial = sinon.spy(material, 'dispose');

    runtimeScene._destroy();

    expect(threeGroup.children.length).to.be(0);
    expect(disposeGeometry.calledOnce).to.be(true);
    expect(disposeMaterial.calledOnce).to.be(true);
    expect(clearMaskCache.calledOnce).to.be(true);
    expect(Object.keys(debuggerRenderer._debugDraw3DCollisionMasks)).to.eql([]);
  });

  it('removes a cached mask when its hidden object stops providing it', function () {
    const { runtimeScene, object, layer } = make3DSceneAndObject();
    let collisionMasks = [
      {
        vertices: new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0]),
        positionX: 0,
        positionY: 0,
        positionZ: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        rotationW: 1,
      },
    ];
    object.get3DDebugCollisionMasks = () => collisionMasks;

    const debuggerRenderer = runtimeScene.getDebuggerRenderer();
    debuggerRenderer.renderDebugDraw([object], true, false, false, false, []);
    const threeGroup = layer.getRenderer().getThreeGroup();
    if (!threeGroup) {
      throw new Error('The 3D layer should have a Three.js group.');
    }
    const lineSegments = /** @type {THREE.LineSegments} */ (
      threeGroup.children[0]
    );
    const disposeGeometry = sinon.spy(lineSegments.geometry, 'dispose');

    object.hide(true);
    collisionMasks = [];
    debuggerRenderer._debugDrawLastRenderTime = 0;
    debuggerRenderer.renderDebugDraw([object], true, false, false, false, []);

    expect(threeGroup.children.length).to.be(0);
    expect(disposeGeometry.calledOnce).to.be(true);

    debuggerRenderer.clearDebugDraw();
  });
});
