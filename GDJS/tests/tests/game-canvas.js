describe('gdjs.RuntimeGameRenderer canvas tests', () => {
    let runtimeGame;
    let renderer;
    let gameContainer;
    let restoreDevicePixelRatio;

    const setDevicePixelRatio = value => {
        const descriptor = Object.getOwnPropertyDescriptor(
            window,
            'devicePixelRatio'
        );
        Object.defineProperty(window, 'devicePixelRatio', {
            configurable: true,
            value,
        });

        return () => {
            if (descriptor) {
                Object.defineProperty(window, 'devicePixelRatio', descriptor);
            } else {
                delete window.devicePixelRatio;
            }
        };
    };

    beforeEach(() => {
        restoreDevicePixelRatio = null;
        runtimeGame = gdjs.getPixiRuntimeGame();
        renderer = runtimeGame.getRenderer();
        gameContainer = document.createElement('div');
    });

    afterEach(() => {
        if (restoreDevicePixelRatio) {
            restoreDevicePixelRatio();
        }
    });

    it('should correctly create standard canvas and domElementsContainer', () => {
        renderer.createStandardCanvas(gameContainer);

        const actualGameCanvas = renderer.getCanvas();
        const actualDomElementsContainer = renderer.getDomElementContainer();

        expect(actualGameCanvas).to.not.be(null);
        expect(actualDomElementsContainer).to.not.be(null);
        expect(actualGameCanvas.parentElement).to.be(gameContainer);
        expect(actualDomElementsContainer.parentElement).to.be(gameContainer);
    });

    it('should correctly initialize external canvas and create domElementsContainer', () => {
        const gameCanvas = document.createElement('canvas');
        gameContainer.appendChild(gameCanvas);
        renderer.initializeRenderers(gameCanvas);
        renderer.initializeCanvas(gameCanvas);

        const actualGameCanvas = renderer.getCanvas();
        const actualDomElementsContainer = renderer.getDomElementContainer();

        expect(actualGameCanvas).to.not.be(null);
        expect(actualDomElementsContainer).to.not.be(null);
        expect(actualGameCanvas).to.be(gameCanvas);
        expect(actualDomElementsContainer.parentElement).to.be(gameContainer);
    });

    it('should configure the shared WebGL context for Pixi masks and shadows', () => {
        renderer.createStandardCanvas(gameContainer);

        const actualThreeRenderer = renderer.getThreeRenderer();
        expect(actualThreeRenderer).to.not.be(null);
        expect(
            actualThreeRenderer.getContext().getContextAttributes().stencil
        ).to.be(true);
        expect(actualThreeRenderer.shadowMap.type).to.be(THREE.PCFShadowMap);
    });

    it('should render the canvas with the device pixel ratio without scaling the scene', () => {
        restoreDevicePixelRatio = setDevicePixelRatio(2);

        renderer.createStandardCanvas(gameContainer);

        const actualGameCanvas = renderer.getCanvas();
        const actualPixiRenderer = renderer.getPIXIRenderer();
        const actualThreeRenderer = renderer.getThreeRenderer();
        const runtimeScene = new gdjs.RuntimeScene(runtimeGame);
        const actualSceneContainer = runtimeScene
            .getRenderer()
            .getRendererObject();

        expect(actualGameCanvas).to.not.be(null);
        expect(actualPixiRenderer).to.not.be(null);
        expect(actualThreeRenderer).to.not.be(null);
        expect(actualPixiRenderer.resolution).to.be(2);
        expect(actualThreeRenderer.getPixelRatio()).to.be(2);
        expect(actualPixiRenderer.width).to.be(
            runtimeGame.getGameResolutionWidth() * 2
        );
        expect(actualPixiRenderer.height).to.be(
            runtimeGame.getGameResolutionHeight() * 2
        );
        expect(actualPixiRenderer.screen.width).to.be(
            runtimeGame.getGameResolutionWidth()
        );
        expect(actualPixiRenderer.screen.height).to.be(
            runtimeGame.getGameResolutionHeight()
        );
        expect(actualGameCanvas.width).to.be(
            runtimeGame.getGameResolutionWidth() * 2
        );
        expect(actualGameCanvas.height).to.be(
            runtimeGame.getGameResolutionHeight() * 2
        );
        const initialCanvasCssWidth = actualGameCanvas.style.width;
        const initialCanvasCssHeight = actualGameCanvas.style.height;
        expect(parseFloat(initialCanvasCssWidth)).to.be.lessThan(
            actualGameCanvas.width
        );
        expect(parseFloat(initialCanvasCssHeight)).to.be.lessThan(
            actualGameCanvas.height
        );
        expect(actualSceneContainer.scale.x).to.be(1);
        expect(actualSceneContainer.scale.y).to.be(1);

        restoreDevicePixelRatio();
        restoreDevicePixelRatio = setDevicePixelRatio(1.5);

        renderer.updateRendererSize();
        runtimeScene.onGameResolutionResized();

        expect(actualPixiRenderer.resolution).to.be(1.5);
        expect(actualThreeRenderer.getPixelRatio()).to.be(1.5);
        expect(actualPixiRenderer.width).to.be(
            runtimeGame.getGameResolutionWidth() * 1.5
        );
        expect(actualPixiRenderer.height).to.be(
            runtimeGame.getGameResolutionHeight() * 1.5
        );
        expect(actualPixiRenderer.screen.width).to.be(
            runtimeGame.getGameResolutionWidth()
        );
        expect(actualPixiRenderer.screen.height).to.be(
            runtimeGame.getGameResolutionHeight()
        );
        expect(actualGameCanvas.width).to.be(
            runtimeGame.getGameResolutionWidth() * 1.5
        );
        expect(actualGameCanvas.height).to.be(
            runtimeGame.getGameResolutionHeight() * 1.5
        );
        expect(actualGameCanvas.style.width).to.be(initialCanvasCssWidth);
        expect(actualGameCanvas.style.height).to.be(initialCanvasCssHeight);
        expect(actualSceneContainer.scale.x).to.be(1);
        expect(actualSceneContainer.scale.y).to.be(1);
    });

    it('should remove canvas and domElementsContainer on dispose', () => {
        renderer.createStandardCanvas(gameContainer);

        const actualGameCanvas = renderer.getCanvas();
        const actualDomElementsContainer = renderer.getDomElementContainer();

        expect(actualGameCanvas).to.not.be(null);
        expect(actualDomElementsContainer).to.not.be(null);
        expect(actualGameCanvas.parentElement).to.be(gameContainer);
        expect(actualDomElementsContainer.parentElement).to.be(gameContainer);

        runtimeGame.dispose(true);

        const actualGameCanvasAfterDispose = renderer.getCanvas();
        const actualDomElementsContainerAfterDispose = renderer.getDomElementContainer();

        expect(actualGameCanvasAfterDispose).to.be(null);
        expect(actualDomElementsContainerAfterDispose).to.be(null);

        expect(gameContainer.childNodes.length).to.be(0);
    });
});

['none', 'MSAA'].forEach((antialiasingMode) => {
    describe('gdjs.RuntimeGameRenderer shared stencil buffer (' + antialiasingMode + ')', () => {
        let runtimeGame;
        let renderer;

        beforeEach(() => {
            runtimeGame = gdjs.getPixiRuntimeGame({
                propertiesOverrides: {
                    windowWidth: 32,
                    windowHeight: 16,
                    antialiasingMode,
                },
            });
            renderer = runtimeGame.getRenderer();
            renderer.createStandardCanvas(document.createElement('div'));
        });

        afterEach(() => runtimeGame.dispose(true));

        it('shares a stencil-enabled WebGL context between Three.js and PixiJS', () => {
            const threeRenderer = renderer.getThreeRenderer();
            expect(threeRenderer).to.not.be(null);
            const gl = threeRenderer.getContext();

            expect(renderer.getPIXIRenderer().gl).to.be(gl);
            expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).to.be(null);
            expect(gl.getContextAttributes().stencil).to.be(true);
            expect(gl.getParameter(gl.STENCIL_BITS)).to.be.greaterThan(0);
        });

        it('renders a Three.js material only where the stencil mask was written', () => {
            const threeRenderer = renderer.getThreeRenderer();
            expect(threeRenderer).to.not.be(null);
            const gl = threeRenderer.getContext();
            const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
            const geometry = new THREE.PlaneGeometry(2, 2);
            const maskMaterial = new THREE.MeshBasicMaterial({
                colorWrite: false,
                depthWrite: false,
                depthTest: false,
                stencilWrite: true,
                stencilRef: 1,
                stencilFunc: THREE.AlwaysStencilFunc,
                stencilFail: THREE.KeepStencilOp,
                stencilZFail: THREE.KeepStencilOp,
                stencilZPass: THREE.ReplaceStencilOp,
            });
            const material = new THREE.MeshBasicMaterial({
                color: 0xff0000,
                depthWrite: false,
                depthTest: false,
                stencilWrite: true,
                stencilRef: 1,
                stencilFunc: THREE.EqualStencilFunc,
                stencilFail: THREE.KeepStencilOp,
                stencilZFail: THREE.KeepStencilOp,
                stencilZPass: THREE.KeepStencilOp,
            });
            try {
                threeRenderer.setRenderTarget(null);
                expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).to.be(null);
                expect(gl.drawingBufferWidth).to.be(32);
                expect(gl.drawingBufferHeight).to.be(16);
                threeRenderer.setClearColor(0x000000, 1);
                threeRenderer.clear(true, true, true);
                const mask = new THREE.Mesh(geometry, maskMaterial);
                mask.scale.x = 0.5;
                mask.position.x = -0.5;
                const maskScene = new THREE.Scene();
                maskScene.add(mask);
                threeRenderer.render(maskScene, camera);

                const scene = new THREE.Scene();
                scene.add(new THREE.Mesh(geometry, material));
                threeRenderer.render(scene, camera);

                const pixel = new Uint8Array(4);
                gl.readPixels(8, 8, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
                expect(Array.from(pixel)).to.eql([255, 0, 0, 255]);
                gl.readPixels(24, 8, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
                expect(Array.from(pixel)).to.eql([0, 0, 0, 255]);

                material.stencilWrite = false;
                threeRenderer.render(scene, camera);
                gl.readPixels(24, 8, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
                expect(Array.from(pixel)).to.eql([255, 0, 0, 255]);
            } finally {
                geometry.dispose();
                maskMaterial.dispose();
                material.dispose();
            }
        });
    });
});
