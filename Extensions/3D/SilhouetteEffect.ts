namespace gdjs {
  /** Geometric silhouette of a whole 3D object, composited after its layer. */
  export class Scene3DSilhouetteFilter implements gdjs.PixiFiltersTools.Filter {
    private enabled: boolean;
    private thickness = 2;
    private opacity = 1;
    private color = 0x8fffe8;
    private resources: {
      mask: THREE.WebGLRenderTarget;
      maskMaterial: THREE.MeshBasicMaterial;
      material: THREE.ShaderMaterial;
      quad: THREE.Mesh;
      scene: THREE.Scene;
      camera: THREE.OrthographicCamera;
    } | null = null;

    constructor(effectData: EffectData) {
      this.enabled = !effectData.disabled;
    }

    isEnabled(): boolean {
      return this.enabled;
    }
    setEnabled(target: gdjs.EffectsTarget, enabled: boolean): boolean {
      this.enabled = enabled;
      if (!enabled) this.dispose();
      return true;
    }
    applyEffect(target: gdjs.EffectsTarget): boolean {
      return !!target.get3DRendererObject();
    }
    removeEffect(): boolean {
      this.enabled = false;
      this.dispose();
      return true;
    }
    updatePreRender(): void {}
    updateDoubleParameter(name: string, value: number): void {
      if (!Number.isFinite(value)) return;
      if (name === 'thickness')
        this.thickness = Math.max(0, Math.min(8, value));
      if (name === 'opacity') this.opacity = Math.max(0, Math.min(1, value));
    }
    getDoubleParameter(name: string): number {
      return name === 'thickness'
        ? this.thickness
        : name === 'opacity'
          ? this.opacity
          : 0;
    }
    updateColorParameter(name: string, value: number): void {
      if (name === 'color' && Number.isFinite(value)) this.color = value;
    }
    getColorParameter(name: string): number {
      return name === 'color' ? this.color : 0;
    }
    updateStringParameter(name: string, value: string): void {
      if (name === 'color') this.color = gdjs.rgbOrHexStringToNumber(value);
    }
    updateBooleanParameter(): void {}
    getNetworkSyncData() {
      return { t: this.thickness, o: this.opacity, c: this.color };
    }
    updateFromNetworkSyncData(data: { t: number; o: number; c: number }): void {
      this.updateDoubleParameter('thickness', data.t);
      this.updateDoubleParameter('opacity', data.o);
      this.updateColorParameter('color', data.c);
    }

    private dispose(): void {
      if (!this.resources) return;
      this.resources.mask.dispose();
      this.resources.maskMaterial.dispose();
      this.resources.material.dispose();
      this.resources.quad.geometry.dispose();
      this.resources = null;
    }

    private getResources() {
      if (this.resources) return this.resources;
      const mask = new THREE.WebGLRenderTarget(1, 1, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: true,
      });
      const maskMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        fog: false,
        toneMapped: false,
      });
      const material = new THREE.ShaderMaterial({
        uniforms: {
          mask: { value: mask.texture },
          texel: { value: new THREE.Vector2() },
          thickness: { value: 2 },
          opacity: { value: 1 },
          tint: { value: new THREE.Color() },
        },
        vertexShader: `varying vec2 vUv;
          void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
        fragmentShader: `uniform sampler2D mask;
          uniform vec2 texel;
          uniform float thickness;
          uniform float opacity;
          uniform vec3 tint;
          varying vec2 vUv;
          void main() {
            float center = texture2D(mask, vUv).r;
            float expanded = center;
            for (int i = 0; i < 16; ++i) {
              float angle = float(i) * 6.28318530718 / 16.0;
              vec2 offset = vec2(cos(angle), sin(angle)) * texel * thickness;
              expanded = max(expanded, texture2D(mask, vUv + offset).r);
            }
            gl_FragColor = vec4(tint, max(0.0, expanded - center) * opacity);
            #include <colorspace_fragment>
          }`,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
      quad.frustumCulled = false;
      const scene = new THREE.Scene();
      scene.add(quad);
      this.resources = {
        mask,
        maskMaterial,
        material,
        quad,
        scene,
        camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
      };
      return this.resources;
    }

    /** Keep the animated hierarchy intact; hide only siblings on its ancestor path. */
    render(
      renderer: THREE.WebGLRenderer,
      scene: THREE.Scene,
      camera: THREE.Camera,
      root: THREE.Object3D
    ): void {
      if (!this.enabled || this.opacity <= 0 || this.thickness <= 0) return;
      const ancestors: THREE.Object3D[] = [];
      for (let node: THREE.Object3D | null = root; node; node = node.parent) {
        if (!node.visible) return;
        ancestors.push(node);
        if (node === scene) break;
      }
      if (ancestors[ancestors.length - 1] !== scene) return;
      const resources = this.getResources();
      const size = renderer.getDrawingBufferSize(new THREE.Vector2());
      resources.mask.setSize(size.x, size.y);
      resources.material.uniforms.texel.value.set(1 / size.x, 1 / size.y);
      resources.material.uniforms.thickness.value =
        this.thickness * renderer.getPixelRatio();
      resources.material.uniforms.opacity.value = this.opacity;
      resources.material.uniforms.tint.value.setHex(this.color);
      const hidden: THREE.Object3D[] = [];
      const background = scene.background;
      const overrideMaterial = scene.overrideMaterial;
      const renderTarget = renderer.getRenderTarget();
      const clearColor = renderer.getClearColor(new THREE.Color()).clone();
      const clearAlpha = renderer.getClearAlpha();
      const autoClear = renderer.autoClear;
      const shadowAutoUpdate = renderer.shadowMap.autoUpdate;
      const viewport = renderer.getViewport(new THREE.Vector4()).clone();
      const scissor = renderer.getScissor(new THREE.Vector4()).clone();
      const scissorTest = renderer.getScissorTest();
      try {
        for (let i = 1; i < ancestors.length; ++i) {
          for (const sibling of ancestors[i].children) {
            if (sibling !== ancestors[i - 1] && sibling.visible) {
              hidden.push(sibling);
              sibling.visible = false;
            }
          }
        }
        scene.background = null;
        scene.overrideMaterial = resources.maskMaterial;
        renderer.shadowMap.autoUpdate = false;
        renderer.autoClear = false;
        renderer.setRenderTarget(resources.mask);
        renderer.setScissorTest(false);
        renderer.setClearColor(0x000000, 0);
        renderer.clear();
        renderer.render(scene, camera);
      } finally {
        for (const object of hidden) object.visible = true;
        scene.background = background;
        scene.overrideMaterial = overrideMaterial;
        renderer.shadowMap.autoUpdate = shadowAutoUpdate;
        renderer.setRenderTarget(renderTarget);
        renderer.setViewport(viewport);
        renderer.setScissor(scissor);
        renderer.setScissorTest(scissorTest);
        renderer.setClearColor(clearColor, clearAlpha);
        renderer.autoClear = autoClear;
      }
      // This draw occurs after opaque, transparent and layer post-processing draws.
      try {
        renderer.autoClear = false;
        renderer.render(resources.scene, resources.camera);
      } finally {
        renderer.autoClear = autoClear;
      }
    }

    static renderLayer(
      renderer: THREE.WebGLRenderer,
      scene: THREE.Scene,
      camera: THREE.Camera
    ): void {
      const effects: {
        root: THREE.Object3D;
        filter: Scene3DSilhouetteFilter;
      }[] = [];
      scene.traverseVisible((node) => {
        const object = (
          node as THREE.Object3D & { gdjsRuntimeObject?: gdjs.RuntimeObject }
        ).gdjsRuntimeObject;
        if (!object || object.get3DRendererObject() !== node) return;
        const filters = object.getRendererEffects();
        for (const name in filters) {
          const filter = filters[name];
          if (filter instanceof Scene3DSilhouetteFilter && filter.enabled) {
            effects.push({ root: node, filter });
          }
        }
      });
      for (const effect of effects)
        effect.filter.render(renderer, scene, camera, effect.root);
    }
  }

  gdjs.PixiFiltersTools.registerFilterCreator('Scene3D::Silhouette', {
    makeFilter: (_target, effectData) =>
      new Scene3DSilhouetteFilter(effectData),
  });
}
