namespace gdjs {
  type TSLThreeRuntimeIdentity = {
    threeRevision: string;
    authoringApiVersion: string;
    portableProfileVersion: string;
    backend: string;
  };

  const getThreeWithTSL = (): any => THREE as any;

  /** Private adapter captured by generated registry modules. */
  export const __tslMaterialRuntime = Object.freeze({
    defineMaterial: (definition: Object): Object => definition,
    get tsl(): any {
      return getThreeWithTSL().GDevelopTSL;
    },
  });

  const installedHandlerByRenderer = new WeakMap<Object, Object>();
  const requiredInheritedMaterialNodes = [
    'materialColor',
    'materialOpacity',
    'materialEmissive',
    'materialRoughness',
    'materialMetalness',
    'materialNormal',
  ];

  type TSLRendererLifecycleListener = {
    onContextLost: () => void;
    onContextRestored: () => void;
    onShaderError: () => void;
  };

  type TSLRendererLifecycleRecord = {
    listeners: Set<TSLRendererLifecycleListener>;
    canvas: HTMLCanvasElement | null;
    previousShaderErrorHandler: any;
    shaderErrorHandler: any;
    contextLostHandler: () => void;
    contextRestoredHandler: () => void;
  };

  const rendererLifecycleRecords = new WeakMap<
    Object,
    TSLRendererLifecycleRecord
  >();

  export const getTSLMaterialRenderer = (
    runtimeScene: gdjs.RuntimeScene
  ): any => {
    const gameRenderer = runtimeScene.getGame().getRenderer() as any;
    return gameRenderer.getThreeRenderer
      ? gameRenderer.getThreeRenderer()
      : null;
  };

  const invalidateRendererBackend = (renderer: any): void => {
    const installed = installedHandlerByRenderer.get(renderer);
    installedHandlerByRenderer.delete(renderer);
    if ((renderer as any).__gdevelopNodesHandler === installed) {
      delete (renderer as any).__gdevelopNodesHandler;
    }
  };

  /**
   * Subscribe to the renderer's existing context lifecycle and shader-error
   * hook. This observes restoration; it never creates a context or a retry
   * loop of its own.
   */
  export const addTSLMaterialRendererLifecycleListener = (
    runtimeScene: gdjs.RuntimeScene,
    listener: TSLRendererLifecycleListener
  ): { renderer: any; remove: () => void } | null => {
    const renderer = getTSLMaterialRenderer(runtimeScene);
    if (!renderer) return null;
    let record = rendererLifecycleRecords.get(renderer);
    if (!record) {
      const listeners = new Set<TSLRendererLifecycleListener>();
      const canvas = (renderer.domElement as HTMLCanvasElement) || null;
      const previousShaderErrorHandler = renderer.debug
        ? renderer.debug.onShaderError
        : null;
      const contextLostHandler = () => {
        for (const currentListener of Array.from(listeners)) {
          currentListener.onContextLost();
        }
      };
      const contextRestoredHandler = () => {
        // WebGLNodesHandler holds renderer-side caches. Reinstalling it after
        // Three restored its context prevents stale program/uniform state.
        invalidateRendererBackend(renderer);
        for (const currentListener of Array.from(listeners)) {
          currentListener.onContextRestored();
        }
      };
      const shaderErrorHandler = (...args: any[]) => {
        if (typeof previousShaderErrorHandler === 'function') {
          previousShaderErrorHandler.apply(renderer.debug, args);
        } else {
          const gl = args[0];
          if (gl && typeof console !== 'undefined') {
            const programLog = gl.getProgramInfoLog(args[1]) || '';
            const vertexLog = gl.getShaderInfoLog(args[2]) || '';
            const fragmentLog = gl.getShaderInfoLog(args[3]) || '';
            console.error(
              'THREE.WebGLProgram: shader program creation failed.',
              programLog || vertexLog || fragmentLog
            );
          }
        }
        const gl = args[0];
        const vertexShader = args[2];
        const fragmentShader = args[3];
        let isNodeShader = true;
        if (gl && typeof gl.getShaderSource === 'function') {
          const source = `${gl.getShaderSource(vertexShader) || ''}\n${
            gl.getShaderSource(fragmentShader) || ''
          }`;
          // Compatibility-handler output uses Three NodeBuilder declaration
          // names. Ignore unrelated shader failures in the shared renderer.
          isNodeShader = /\bnode(?:Uniform|Var|Varying)\d*\b/.test(source);
        }
        if (!isNodeShader) return;
        for (const currentListener of Array.from(listeners)) {
          currentListener.onShaderError();
        }
      };
      if (canvas && typeof canvas.addEventListener === 'function') {
        canvas.addEventListener('webglcontextlost', contextLostHandler, false);
        canvas.addEventListener(
          'webglcontextrestored',
          contextRestoredHandler,
          false
        );
      }
      if (renderer.debug) renderer.debug.onShaderError = shaderErrorHandler;
      record = {
        listeners,
        canvas,
        previousShaderErrorHandler,
        shaderErrorHandler,
        contextLostHandler,
        contextRestoredHandler,
      };
      rendererLifecycleRecords.set(renderer, record);
    }
    record.listeners.add(listener);
    let removed = false;
    return {
      renderer,
      remove: () => {
        if (removed || !record) return;
        removed = true;
        record.listeners.delete(listener);
        if (record.listeners.size) return;
        if (record.canvas) {
          record.canvas.removeEventListener(
            'webglcontextlost',
            record.contextLostHandler,
            false
          );
          record.canvas.removeEventListener(
            'webglcontextrestored',
            record.contextRestoredHandler,
            false
          );
        }
        if (
          renderer.debug &&
          renderer.debug.onShaderError === record.shaderErrorHandler
        ) {
          renderer.debug.onShaderError = record.previousShaderErrorHandler;
        }
        rendererLifecycleRecords.delete(renderer);
      },
    };
  };

  export const ensureTSLMaterialBackend = (
    runtimeScene: gdjs.RuntimeScene
  ): { available: boolean; code: string; message: string } => {
    const three = getThreeWithTSL();
    const identity = three.GDEVELOP_TSL_RUNTIME as
      | TSLThreeRuntimeIdentity
      | null
      | undefined;
    if (
      three.REVISION !== '185' ||
      !identity ||
      String(identity.threeRevision) !== '185' ||
      identity.authoringApiVersion !== '1' ||
      identity.portableProfileVersion !== '1' ||
      identity.backend !== 'webgl2-node-compat' ||
      !three.GDevelopTSL ||
      requiredInheritedMaterialNodes.some(
        (name) => !three.GDevelopTSL[name] || !three.GDevelopTSL[name].isNode
      ) ||
      !three.WebGLNodesHandler ||
      !three.MeshStandardNodeMaterial
    ) {
      return {
        available: false,
        code: 'TSL-PKG-001',
        message:
          'The loaded Three runtime is not the compatible r185 TSL bundle.',
      };
    }
    const renderer = getTSLMaterialRenderer(runtimeScene);
    if (!renderer || typeof renderer.setNodesHandler !== 'function') {
      return {
        available: false,
        code: 'TSL-RUN-004',
        message: 'The current renderer cannot install the TSL nodes handler.',
      };
    }
    const installed = installedHandlerByRenderer.get(renderer);
    if (installed) {
      if ((renderer as any).__gdevelopNodesHandler !== installed) {
        installedHandlerByRenderer.delete(renderer);
        return {
          available: false,
          code: 'TSL-PKG-002',
          message:
            'The renderer nodes handler changed after TSL material initialization.',
        };
      }
      return { available: true, code: '', message: '' };
    }
    const externallyInstalled = (renderer as any).__gdevelopNodesHandler;
    if (
      externallyInstalled &&
      !(externallyInstalled instanceof three.WebGLNodesHandler)
    ) {
      return {
        available: false,
        code: 'TSL-PKG-002',
        message:
          'An unknown Three nodes handler is already installed on the renderer.',
      };
    }
    const handler =
      externallyInstalled || new (three.WebGLNodesHandler as any)();
    if (!externallyInstalled) renderer.setNodesHandler(handler);
    (renderer as any).__gdevelopNodesHandler = handler;
    installedHandlerByRenderer.set(renderer, handler);
    return { available: true, code: '', message: '' };
  };

  export const isTSLMaterialBackendAvailable = (
    runtimeScene: gdjs.RuntimeScene
  ): boolean => ensureTSLMaterialBackend(runtimeScene).available;
}
