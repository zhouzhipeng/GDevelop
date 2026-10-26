/**
 * Common tests for gdjs game engine.
 * See README.md for more information.
 */


describe('gdjs.Layer', () => {
	const runtimeGame = gdjs.getPixiRuntimeGame();
	const runtimeScene = new gdjs.RuntimeScene(runtimeGame);
	const add3DLayer = (scene, cameraType = 'perspective', renderingType = '3d') => {
		scene.addLayer({
			name: '3D layer',
			renderingType,
			cameraType,
			visibility: true,
			cameras: [],
			effects: [],
			ambientLightColorR: 0,
			ambientLightColorG: 0,
			ambientLightColorB: 0,
			isLightingLayer: false,
			followBaseLayerCamera: false,
		});
		return scene.getLayer('3D layer');
	};

	it('can convert coordinates', () => {
		const layer = new gdjs.Layer({name: 'My layer', visibility: true, effects:[]}, runtimeScene)
		layer.setCameraX(100, 0);
		layer.setCameraY(200, 0);
		layer.setCameraRotation(90, 0);

		expect(layer.convertCoords(350, 450, 0)[0]).to.be.within(-50.001, -49.99999);
		expect(layer.convertCoords(350, 450, 0)[1]).to.be.within(149.9999, 150.001);
	});
	it('can convert inverse coordinates', () => {
		const layer = new gdjs.Layer({name: 'My layer', visibility: true, effects:[]}, runtimeScene)
		layer.setCameraX(100, 0);
		layer.setCameraY(200, 0);
		layer.setCameraRotation(90, 0);

		expect(layer.convertInverseCoords(350, 450, 0)[0]).to.be.within(649.999, 650.001);
		expect(layer.convertInverseCoords(350, 450, 0)[1]).to.be.within(49.9999, 50.001);
	});
	it('can get the camera Z position', () => {
		const layer = new gdjs.Layer({name: 'My layer', visibility: true, effects:[]}, runtimeScene)
		expect(layer.getCameraZoom()).to.be(1);
		expect(layer.getWidth()).to.be(800);
		expect(layer.getHeight()).to.be(600);

		expect(layer.getCameraZ(45)).to.be.within(724.264, 724.265);
	});
	it('can update the camera Z position', () => {
		const layer = new gdjs.Layer({name: 'My layer', visibility: true, effects:[]}, runtimeScene)
		layer.setCameraZ(400, 45);

		expect(layer.getCameraZ(45)).to.be(400);
		expect(layer.getCameraZoom()).to.be.within(1.81066, 1.81067);
	});
	it('can get the camera Z position after a zoom update', () => {
		const layer = new gdjs.Layer({name: 'My layer', visibility: true, effects:[]}, runtimeScene)
		layer.setCameraZoom(2);

		expect(layer.getCameraZoom()).to.be(2);
		expect(layer.getCameraZ(45)).to.be.within(362.132, 362.133);
	});
	it('can set the camera Z position to 0', () => {
		const layer = new gdjs.Layer({name: 'My layer', visibility: true, effects:[]}, runtimeScene)
		expect(layer.getCameraZoom()).to.be(1);
		expect(layer.getCameraZ(45)).to.be.within(724.264, 724.265);
		
		layer.setCameraZ(0, 45);

		// The zoom factor is capped to avoid infinity.
		expect(layer.getCameraZoom()).to.be(Number.MAX_SAFE_INTEGER);
		// The camera Z is still 0, it's not evaluated from the zoom factor.
		expect(layer.getCameraZ(45)).to.be(0);
	});
	it('applies the renderer world scale to orthographic cameras', () => {
		const scene = new gdjs.RuntimeScene(runtimeGame);
		const layer = add3DLayer(scene, 'orthographic');
		const camera = layer.getRenderer().getThreeCamera();
		try {
			expect(camera).not.to.be(null);
			expect(camera.left).to.be.within(-4.00001, -3.99999);
			expect(camera.right).to.be.within(3.99999, 4.00001);
			expect(camera.top).to.be.within(2.99999, 3.00001);
			expect(camera.bottom).to.be.within(-3.00001, -2.99999);

			scene.setRenderer3DWorldScale(50);
			expect(camera.left).to.be.within(-8.00001, -7.99999);
			expect(camera.right).to.be.within(7.99999, 8.00001);
		} finally {
			scene._destroy();
		}
	});
	it('preserves authored camera clipping distances when world scale changes', () => {
		const scene = new gdjs.RuntimeScene(runtimeGame);
		const layer = add3DLayer(scene);
		try {
			layer.setCamera3DNearPlaneDistance(7);
			layer.setCamera3DFarPlaneDistance(9000);
			scene.setRenderer3DWorldScale(50);

			expect(layer.getCamera3DNearPlaneDistance()).to.be.within(6.99999, 7.00001);
			expect(layer.getCamera3DFarPlaneDistance()).to.be.within(8999.99, 9000.01);
		} finally {
			scene._destroy();
		}
	});
	it('converts scaled Three.js world coordinates back to authored coordinates', () => {
		const scene = new gdjs.RuntimeScene(runtimeGame);
		const layer = add3DLayer(scene);
		try {
			layer.setCameraRotationX(20);
			const camera = layer.getRenderer().getThreeCamera();
			expect(camera).not.to.be(null);
			camera.updateMatrixWorld();
			const inverseWorldScale = scene.getRenderer3DInverseWorldScale();
			const projectedPoint = new THREE.Vector3(
				123 * inverseWorldScale,
				-234 * inverseWorldScale,
				0
			).project(camera);
			const screenX = ((projectedPoint.x + 1) / 2) * layer.getWidth();
			const screenY = ((1 - projectedPoint.y) / 2) * layer.getHeight();

			const position = layer.convertCoords(screenX, screenY, 0);
			expect(position[0]).to.be.within(122.999, 123.001);
			expect(position[1]).to.be.within(233.999, 234.001);
		} finally {
			scene._destroy();
		}
	});
	it('keeps the hybrid 2D plane in authored units', () => {
		const scene = new gdjs.RuntimeScene(runtimeGame);
		const layer = add3DLayer(scene, 'perspective', '2d+3d');
		try {
			const plane = layer.getRenderer()._threePlaneMesh;
			expect(plane).not.to.be(null);
			expect(plane.scale.x).to.be.within(799.99, 800.01);
			expect(plane.scale.y).to.be.within(599.99, 600.01);
		} finally {
			scene._destroy();
		}
	});

	describe('with a camera rotated in 3D', () => {
		/**
		 * @param {number} worldScale
		 * @param {'perspective' | 'orthographic'} cameraType
		 */
		const make3DLayerWithRotatedCamera = (worldScale, cameraType) => {
			const runtimeScene = new gdjs.RuntimeScene(gdjs.getPixiRuntimeGame());
			runtimeScene.setRenderer3DWorldScale(worldScale);
			runtimeScene.addLayer({
				name: '',
				renderingType: '3d',
				cameraType,
				visibility: true,
				cameras: [],
				effects: [],
				ambientLightColorR: 0,
				ambientLightColorG: 0,
				ambientLightColorB: 0,
				isLightingLayer: false,
				followBaseLayerCamera: false,
			});
			const layer = runtimeScene.getLayer('');
			layer.setCameraX(100);
			layer.setCameraY(200);
			layer.setCameraRotationX(30);
			return layer;
		};

		/**
		 * Project a point of the scene, on the plane Z = 0, on the screen
		 * like the Three.js renderer does for 3D objects.
		 * @param {gdjs.RuntimeLayer} layer
		 * @param {number} x
		 * @param {number} y
		 */
		const projectOnScreen = (layer, x, y) => {
			const threeScene = layer.getRenderer().getThreeScene();
			const camera = layer.getRenderer().getThreeCamera();
			threeScene.updateMatrixWorld(true);
			camera.updateMatrixWorld(true);
			const projected = new THREE.Vector3(x, y, 0)
				.applyMatrix4(threeScene.matrixWorld)
				.project(camera);
			return [
				((projected.x + 1) / 2) * layer.getWidth(),
				((1 - projected.y) / 2) * layer.getHeight(),
			];
		};

		[1, 100, 250].forEach((worldScale) => {
			['perspective', 'orthographic'].forEach((cameraType) => {
				it(`converts screen coordinates to the plane Z = 0 (${cameraType} camera, world scale: ${worldScale})`, () => {
					const layer = make3DLayerWithRotatedCamera(worldScale, cameraType);

					const [sceneX, sceneY] = layer.convertCoords(300, 400, 0, [0, 0]);
					const [screenX, screenY] = projectOnScreen(layer, sceneX, sceneY);

					expect(screenX).to.be.within(299.99, 300.01);
					expect(screenY).to.be.within(399.99, 400.01);
				});
			});

			it(`shows the scene at its size with an orthographic camera (world scale: ${worldScale})`, () => {
				const layer = make3DLayerWithRotatedCamera(worldScale, 'orthographic');
				layer.setCameraRotationX(0);
				layer.setCameraZoom(2);

				const [centerX, centerY] = projectOnScreen(layer, 100, 200);
				const [cornerX, cornerY] = projectOnScreen(
					layer,
					100 + layer.getWidth() / 4,
					200 + layer.getHeight() / 4
				);

				expect(centerX).to.be.within(
					layer.getWidth() / 2 - 0.01,
					layer.getWidth() / 2 + 0.01
				);
				expect(centerY).to.be.within(
					layer.getHeight() / 2 - 0.01,
					layer.getHeight() / 2 + 0.01
				);
				expect(cornerX).to.be.within(
					layer.getWidth() - 0.01,
					layer.getWidth() + 0.01
				);
				expect(cornerY).to.be.within(
					layer.getHeight() - 0.01,
					layer.getHeight() + 0.01
				);
			});

			it(`converts the screen center to the point looked at by the camera (world scale: ${worldScale})`, () => {
				const layer = make3DLayerWithRotatedCamera(worldScale, 'perspective');
				const cameraZ = layer.getCameraZ(45);

				const [sceneX, sceneY] = layer.convertCoords(400, 300, 0, [0, 0]);

				expect(sceneX).to.be.within(99.99, 100.01);
				// The camera rotated on X looks toward Y-.
				const expectedSceneY = 200 - cameraZ * Math.tan(gdjs.toRad(30));
				expect(sceneY).to.be.within(expectedSceneY - 0.01, expectedSceneY + 0.01);
			});
		});
	});

	it('shows the 2D rendering of a 2D+3D layer on a plane covering the screen', () => {
		const runtimeGameWithCanvas = gdjs.getPixiRuntimeGame();
		runtimeGameWithCanvas
			.getRenderer()
			.createStandardCanvas(document.createElement('div'));
		const runtimeSceneWithCanvas = new gdjs.RuntimeScene(runtimeGameWithCanvas);
		const layer = new gdjs.Layer(
			{ name: 'My layer', renderingType: '2d+3d', visibility: true, effects: [] },
			runtimeSceneWithCanvas
		);
		layer.getRenderer().updatePosition();

		const threeScene = layer.getRenderer().getThreeScene();
		const camera = layer.getRenderer().getThreeCamera();
		const plane = threeScene.children.find(
			(child) => child.renderOrder === Number.MAX_SAFE_INTEGER
		);
		threeScene.updateMatrixWorld(true);
		camera.updateMatrixWorld(true);
		const projectedCorners = [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].map(
			([x, y]) =>
				new THREE.Vector3(x, y, 0).applyMatrix4(plane.matrixWorld).project(camera)
		);
		const xs = projectedCorners.map((corner) => corner.x);
		const ys = projectedCorners.map((corner) => corner.y);

		// The plane covers exactly the screen (from -1 to 1 in normalized coordinates).
		expect(Math.min(...xs)).to.be.within(-1.001, -0.999);
		expect(Math.max(...xs)).to.be.within(0.999, 1.001);
		expect(Math.min(...ys)).to.be.within(-1.001, -0.999);
		expect(Math.max(...ys)).to.be.within(0.999, 1.001);
	});
});
