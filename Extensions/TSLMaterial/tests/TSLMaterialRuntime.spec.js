// @ts-check

describe('TSL material runtime', function () {
  const hash = (character) => character.repeat(64);
  const TSLThree = /** @type {any} */ (THREE);

  /**
   * @param {string} sourceHash
   * @param {(context: gdjs.TSLMaterialBuildContext) => void} [build]
   * @returns {gdjs.TSLMaterialDefinition}
   */
  const makeDefinition = (sourceHash, build = () => {}) => ({
    apiVersion: 1,
    authoringApiVersion: '1',
    compilerVersion: '1',
    threeRevision: '185',
    portableProfileVersion: '1',
    sourceHash,
    base: 'inherit',
    label: 'Test material',
    description: '',
    parameterSchema: {
      strength: { type: 'number', default: 0.5, min: 0, max: 1 },
    },
    importedSymbols: [],
    build,
  });

  const makeDefinitionReceipt = (resourceName, sourceSha256) => ({
    apiVersion: 1,
    resourceName,
    normalizedSourcePath: `materials/${resourceName}.tsl.ts`,
    sourceSha256,
    emittedSha256: hash('e'),
    authoringApiVersion: '1',
    compilerVersion: '1',
    threeRevision: '185',
    portableProfileVersion: '1',
    projectApiSha256: hash('1'),
    tslApiSha256: hash('2'),
    tslCatalogSha256: hash('3'),
    optionsSha256: hash('4'),
    parameterSchemaSha256: hash('5'),
    importedSymbols: [],
  });

  /** @returns {gdjs.TSLMaterialBundleReceipt} */
  const makeBundleReceipt = (receipts) => ({
    apiVersion: 1,
    authoringApiVersion: '1',
    compilerVersion: '1',
    threeRevision: '185',
    portableProfileVersion: '1',
    target: 'webgl2-node-compat',
    definitionCount: receipts.length,
    definitionsSha256: hash('f'),
    receipts,
  });

  describe('atomic registry', function () {
    it('commits a complete compatible bundle and notifies changed definitions', function () {
      const registry = new gdjs.TSLMaterialRegistry();
      const changes = [];
      registry.addDefinitionChangedListener((name, previous, next) => {
        changes.push({ name, previous, next });
      });
      const definition = makeDefinition(hash('a'));
      registry.beginBundle(
        makeBundleReceipt([
          makeDefinitionReceipt('Material', definition.sourceHash),
        ])
      );
      registry.register('Material', definition);
      expect(registry.get('Material')).to.be(null);
      registry.endBundle();

      expect(registry.get('Material')).to.be(definition);
      expect(changes.length).to.be(1);
      expect(changes[0].name).to.be('Material');
      expect(changes[0].previous).to.be(null);
      expect(changes[0].next).to.be(definition);
    });

    it('keeps the last complete bundle after a partial or incompatible update', function () {
      const registry = new gdjs.TSLMaterialRegistry();
      const previous = makeDefinition(hash('a'));
      registry.register('Material', previous);
      registry.beginBundle(
        makeBundleReceipt([
          makeDefinitionReceipt('Material', hash('b')),
          makeDefinitionReceipt('Other', hash('c')),
        ])
      );
      registry.register('Material', makeDefinition(hash('b')));
      expect(() => registry.endBundle()).to.throwException();
      expect(registry.get('Material')).to.be(previous);
      expect(registry.isBundleRegistrationPending()).to.be(false);

      expect(() =>
        registry.beginBundle({
          ...makeBundleReceipt([]),
          target: 'webgpu',
        })
      ).to.throwException();
      expect(registry.get('Material')).to.be(previous);
    });

    it('rejects duplicate receipts and duplicate registrations without replacing the active bundle', function () {
      const registry = new gdjs.TSLMaterialRegistry();
      const previous = makeDefinition(hash('a'));
      registry.register('Material', previous);

      const duplicateReceipt = makeDefinitionReceipt('Material', hash('b'));
      expect(() =>
        registry.beginBundle(
          makeBundleReceipt([duplicateReceipt, duplicateReceipt])
        )
      ).to.throwException();
      expect(registry.get('Material')).to.be(previous);

      const next = makeDefinition(hash('b'));
      registry.beginBundle(
        makeBundleReceipt([makeDefinitionReceipt('Material', next.sourceHash)])
      );
      registry.register('Material', next);
      expect(() => registry.register('Material', next)).to.throwException();
      expect(registry.isBundleRegistrationPending()).to.be(false);
      expect(registry.get('Material')).to.be(previous);
    });

    it('checks the expected hot-reload descriptor before committing', function () {
      const registry = new gdjs.TSLMaterialRegistry();
      const previous = makeDefinition(hash('a'));
      registry.register('Material', previous);
      const candidate = makeDefinition(hash('c'));
      registry.expectNextBundle([
        { resourceName: 'Material', sourceSha256: hash('b') },
      ]);
      registry.beginBundle(
        makeBundleReceipt([
          makeDefinitionReceipt('Material', candidate.sourceHash),
        ])
      );
      registry.register('Material', candidate);
      expect(() => registry.endBundle()).to.throwException();
      expect(registry.get('Material')).to.be(previous);
      expect(registry.isBundleRegistrationPending()).to.be(false);
    });

    it('rejects malformed definitions and parameter schemas', function () {
      const registry = new gdjs.TSLMaterialRegistry();
      const previous = makeDefinition(hash('a'));
      registry.register('Material', previous);
      registry.register(
        'Material',
        /** @type {gdjs.TSLMaterialDefinition} */ ({
          ...makeDefinition(hash('b')),
          parameterSchema: {
            invalid: { type: 'number', default: Infinity },
          },
        })
      );
      expect(registry.get('Material')).to.be(previous);
    });
  });

  describe('binding ownership and lifecycle', function () {
    let previousRuntimeIdentity;
    let previousTSL;
    let previousNodesHandler;
    let previousStandardNodeMaterial;
    let previousPhysicalNodeMaterial;
    let previousBasicNodeMaterial;
    let previousNodeMaterial;
    let systems;

    class FakeNode {
      constructor(value) {
        this.value = value;
        this.isNode = true;
        this.needsUpdate = false;
      }
      add() {
        return new FakeNode(this.value);
      }
      sub() {
        return new FakeNode(this.value);
      }
      mul() {
        return new FakeNode(this.value);
      }
      div() {
        return new FakeNode(this.value);
      }
      get g() {
        return new FakeNode(this.value);
      }
      get b() {
        return new FakeNode(this.value);
      }
    }

    class FakeWebGLNodesHandler {}
    class FakeStandardNodeMaterial extends THREE.MeshStandardMaterial {}
    class FakePhysicalNodeMaterial extends THREE.MeshPhysicalMaterial {}
    class FakeBasicNodeMaterial extends THREE.MeshBasicMaterial {}
    class FakeNodeMaterial extends THREE.MeshBasicMaterial {}

    beforeEach(function () {
      previousRuntimeIdentity = TSLThree.GDEVELOP_TSL_RUNTIME;
      previousTSL = TSLThree.GDevelopTSL;
      previousNodesHandler = TSLThree.WebGLNodesHandler;
      previousStandardNodeMaterial = TSLThree.MeshStandardNodeMaterial;
      previousPhysicalNodeMaterial = TSLThree.MeshPhysicalNodeMaterial;
      previousBasicNodeMaterial = TSLThree.MeshBasicNodeMaterial;
      previousNodeMaterial = TSLThree.NodeMaterial;
      TSLThree.GDEVELOP_TSL_RUNTIME = {
        threeRevision: '185',
        authoringApiVersion: '1',
        portableProfileVersion: '1',
        backend: 'webgl2-node-compat',
      };
      TSLThree.GDevelopTSL = {
        color: (value) => new FakeNode(value),
        float: (value) => new FakeNode(value),
        uniform: (value) => new FakeNode(value),
        texture: (value) => new FakeNode(value),
        normalView: new FakeNode('normalView'),
        materialColor: new FakeNode('materialColor'),
        materialOpacity: new FakeNode('materialOpacity'),
        materialEmissive: new FakeNode('materialEmissive'),
        materialRoughness: new FakeNode('materialRoughness'),
        materialMetalness: new FakeNode('materialMetalness'),
        materialNormal: new FakeNode('materialNormal'),
      };
      TSLThree.WebGLNodesHandler = FakeWebGLNodesHandler;
      TSLThree.MeshStandardNodeMaterial = FakeStandardNodeMaterial;
      TSLThree.MeshPhysicalNodeMaterial = FakePhysicalNodeMaterial;
      TSLThree.MeshBasicNodeMaterial = FakeBasicNodeMaterial;
      TSLThree.NodeMaterial = FakeNodeMaterial;
      gdjs.__tslMaterialRegistry.clear();
      systems = [];
    });

    afterEach(function () {
      systems.forEach((system) => system.dispose());
      gdjs.__tslMaterialRegistry.clear();
      TSLThree.GDEVELOP_TSL_RUNTIME = previousRuntimeIdentity;
      TSLThree.GDevelopTSL = previousTSL;
      TSLThree.WebGLNodesHandler = previousNodesHandler;
      TSLThree.MeshStandardNodeMaterial = previousStandardNodeMaterial;
      TSLThree.MeshPhysicalNodeMaterial = previousPhysicalNodeMaterial;
      TSLThree.MeshBasicNodeMaterial = previousBasicNodeMaterial;
      TSLThree.NodeMaterial = previousNodeMaterial;
    });

    const makeRuntimeScene = (
      missingTextureName = '',
      delayedTextureName = ''
    ) => {
      const canvas = document.createElement('canvas');
      const renderer = {
        domElement: canvas,
        debug: {},
        setNodesHandler(handler) {
          this.nodesHandler = handler;
        },
      };
      const threeScene = new THREE.Scene();
      let delayedTextureIsReady = !delayedTextureName;
      let resolveDelayedTextureLoad = () => {};
      let rejectDelayedTextureLoad = () => {};
      const imageManager = {
        isResourceLoaded: (name) =>
          name !== delayedTextureName || delayedTextureIsReady,
        loadResource: (name) => {
          if (name !== delayedTextureName || delayedTextureIsReady) {
            return Promise.resolve();
          }
          return new Promise((resolve, reject) => {
            resolveDelayedTextureLoad = () => resolve(undefined);
            rejectDelayedTextureLoad = () =>
              reject(new Error(`Unable to load texture "${name}".`));
          });
        },
        getThreeTexture: (name) => {
          if (name === missingTextureName) {
            const error = new Error(`Texture "${name}" is missing.`);
            /** @type {any} */ (error).code = 'TSL-RUN-005';
            throw error;
          }
          return { name, isTexture: true };
        },
      };
      const runtimeScene = {
        getGame: () => ({
          getRenderer: () => ({ getThreeRenderer: () => renderer }),
          getResourceLoader: () => ({
            getResource: (name) =>
              name === missingTextureName
                ? null
                : { name, kind: 'image', file: `${name}.png` },
          }),
          getImageManager: () => imageManager,
        }),
        getLayer: () => ({ get3DRendererObject: () => threeScene }),
      };
      return {
        runtimeScene: /** @type {any} */ (runtimeScene),
        renderer,
        canvas,
        threeScene,
        completeDelayedTextureLoad: () => {
          delayedTextureIsReady = true;
          resolveDelayedTextureLoad();
        },
        failDelayedTextureLoad: () => rejectDelayedTextureLoad(),
      };
    };

    const makeHost = (root, name = 'Model') => {
      let listener = null;
      let generation = 1;
      return /** @type {any} */ ({
        getName: () => name,
        getLayer: () => '',
        getThreeMaterialRoot: () => root,
        getThreeMaterialGeneration: () => generation,
        addThreeMaterialRootChangedListener: (nextListener) => {
          listener = nextListener;
          return () => {
            listener = null;
          };
        },
        replaceRoot(nextRoot, reason = 'loaded') {
          generation++;
          root = nextRoot;
          if (listener) listener({ nextRoot, generation, reason });
        },
      });
    };

    const apply = (system, host, bindingName, resourceName, priority = 0) =>
      system.applyBinding(host, {
        bindingName,
        materialResourceName: resourceName,
        selector: { mode: 'All', meshName: '', materialName: '' },
        priority,
        enabled: true,
      });

    const makeSystem = (runtimeScene) => {
      const system = gdjs.TSLMaterialSystem.getOrCreateForScene(runtimeScene);
      systems.push(system);
      return system;
    };

    it('refuses to overwrite an unknown renderer nodes handler', function () {
      const { runtimeScene, renderer } = makeRuntimeScene();
      renderer.__gdevelopNodesHandler = {};
      const unavailable = gdjs.ensureTSLMaterialBackend(runtimeScene);
      expect(unavailable.available).to.be(false);
      expect(unavailable.code).to.be('TSL-PKG-002');

      delete renderer.__gdevelopNodesHandler;
      const available = gdjs.ensureTSLMaterialBackend(runtimeScene);
      expect(available.available).to.be(true);
      renderer.__gdevelopNodesHandler = {};
      const replaced = gdjs.ensureTSLMaterialBackend(runtimeScene);
      expect(replaced.available).to.be(false);
      expect(replaced.code).to.be('TSL-PKG-002');
    });

    it('isolates shared GLB materials per object and restores originals on removal', function () {
      const shared = new THREE.MeshStandardMaterial({ color: 0x336699 });
      shared.name = 'Shared';
      const meshA = new THREE.Mesh(new THREE.BoxGeometry(), shared);
      const meshB = new THREE.Mesh(new THREE.BoxGeometry(), shared);
      const rootA = new THREE.Group();
      const rootB = new THREE.Group();
      rootA.add(meshA);
      rootB.add(meshB);
      const { runtimeScene } = makeRuntimeScene();
      const system = makeSystem(runtimeScene);
      const definition = makeDefinition(hash('a'), ({ material }) => {
        material.colorNode = new FakeNode('tint');
      });
      gdjs.__tslMaterialRegistry.register('Tint', definition);
      const hostA = makeHost(rootA, 'A');
      const hostB = makeHost(rootB, 'B');
      apply(system, hostA, 'Default', 'Tint');
      apply(system, hostB, 'Default', 'Tint');
      system.flush();

      expect(meshA.material).not.to.be(shared);
      expect(meshB.material).not.to.be(shared);
      expect(meshA.material).not.to.be(meshB.material);
      expect(system.isBindingReady(hostA, 'Default')).to.be(true);
      expect(system.getActiveSlotCount(hostA, 'Default')).to.be(1);

      system.removeAllBindings(hostA);
      expect(meshA.material).to.be(shared);
      expect(meshB.material).not.to.be(shared);
      expect(/** @type {any} */ (shared).disposed).not.to.be(true);
    });

    it('captures complete inherited channels through Three material accessors', function () {
      const colorMap = new THREE.Texture();
      const alphaMap = new THREE.Texture();
      const normalMap = new THREE.Texture();
      const original = new THREE.MeshStandardMaterial({
        map: colorMap,
        alphaMap,
        normalMap,
      });
      original.emissiveIntensity = 2.5;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), original);
      const root = new THREE.Group();
      root.add(mesh);
      const { runtimeScene } = makeRuntimeScene();
      const system = makeSystem(runtimeScene);
      let inheritedInputs = /** @type {any} */ (null);
      gdjs.__tslMaterialRegistry.register(
        'Inherited',
        makeDefinition(hash('d'), ({ material, inputs }) => {
          inheritedInputs = inputs;
          material.colorNode = inputs.baseColor;
          material.opacityNode = inputs.opacity;
          material.normalNode = inputs.normal;
        })
      );
      const host = makeHost(root);
      apply(system, host, 'Default', 'Inherited');
      system.flush();

      expect(inheritedInputs.baseColor.value).to.be('materialColor');
      expect(inheritedInputs.opacity.value).to.be('materialOpacity');
      expect(inheritedInputs.emissive.value).to.be('materialEmissive');
      expect(inheritedInputs.roughness.value).to.be('materialRoughness');
      expect(inheritedInputs.metalness.value).to.be('materialMetalness');
      expect(inheritedInputs.normal.value).to.be('materialNormal');
      expect(mesh.material.map).to.be(colorMap);
      expect(mesh.material.alphaMap).to.be(alphaMap);
      expect(mesh.material.normalMap).to.be(normalMap);
      expect(mesh.material.emissiveIntensity).to.be(2.5);
    });

    it('resolves overlapping bindings by priority and latest sequence', function () {
      const original = new THREE.MeshStandardMaterial();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), original);
      const root = new THREE.Group();
      root.add(mesh);
      const { runtimeScene } = makeRuntimeScene();
      const system = makeSystem(runtimeScene);
      gdjs.__tslMaterialRegistry.register(
        'Low',
        makeDefinition(hash('a'), ({ material }) => {
          material.colorNode = new FakeNode('low');
        })
      );
      gdjs.__tslMaterialRegistry.register(
        'High',
        makeDefinition(hash('b'), ({ material }) => {
          material.colorNode = new FakeNode('high');
        })
      );
      const host = makeHost(root);
      apply(system, host, 'LowBinding', 'Low', 0);
      apply(system, host, 'HighBinding', 'High', 10);
      system.flush();

      expect(/** @type {any} */ (mesh.material).colorNode.value).to.be('high');
      expect(system.getActiveSlotCount(host, 'LowBinding')).to.be(0);
      expect(system.getActiveSlotCount(host, 'HighBinding')).to.be(1);
      system.removeBinding(host, 'HighBinding');
      system.flush();
      expect(/** @type {any} */ (mesh.material).colorNode.value).to.be('low');
    });

    it('keeps a working lower-priority binding when its replacement fails', function () {
      const original = new THREE.MeshStandardMaterial();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), original);
      const root = new THREE.Group();
      root.add(mesh);
      const { runtimeScene } = makeRuntimeScene();
      const system = makeSystem(runtimeScene);
      gdjs.__tslMaterialRegistry.register(
        'Working',
        makeDefinition(hash('a'), ({ material }) => {
          material.colorNode = new FakeNode('working');
        })
      );
      gdjs.__tslMaterialRegistry.register(
        'Broken',
        makeDefinition(hash('b'), () => {
          throw new Error('replacement graph failed');
        })
      );
      const host = makeHost(root);
      apply(system, host, 'WorkingBinding', 'Working', 0);
      system.flush();
      const workingMaterial = mesh.material;

      apply(system, host, 'BrokenBinding', 'Broken', 10);
      system.flush();

      expect(mesh.material).to.be(workingMaterial);
      expect(system.getActiveSlotCount(host, 'WorkingBinding')).to.be(1);
      expect(system.isBindingReady(host, 'WorkingBinding')).to.be(true);
      expect(system.getActiveSlotCount(host, 'BrokenBinding')).to.be(0);
      expect(system.bindingHasError(host, 'BrokenBinding')).to.be(true);
      expect(system.getLastError(host, 'BrokenBinding')).to.contain(
        'replacement graph failed'
      );
    });

    it('yields an externally changed slot without overwriting it', function () {
      const original = new THREE.MeshStandardMaterial();
      const external = new THREE.MeshBasicMaterial();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), original);
      const root = new THREE.Group();
      root.add(mesh);
      const { runtimeScene } = makeRuntimeScene();
      const system = makeSystem(runtimeScene);
      gdjs.__tslMaterialRegistry.register(
        'Tint',
        makeDefinition(hash('a'), ({ material }) => {
          material.colorNode = new FakeNode('tint');
        })
      );
      const host = makeHost(root);
      apply(system, host, 'Default', 'Tint');
      system.flush();
      /** @type {any} */ (mesh).material = external;
      apply(system, host, 'Default', 'Tint');
      system.flush();

      expect(mesh.material).to.be(external);
      expect(system.getLastErrorCode(host, 'Default')).to.be('TSL-RUN-008');
    });

    it('keeps the last-known-good material when a hot definition fails', function () {
      const original = new THREE.MeshStandardMaterial();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), original);
      const root = new THREE.Group();
      root.add(mesh);
      const { runtimeScene } = makeRuntimeScene();
      const system = makeSystem(runtimeScene);
      const host = makeHost(root);
      gdjs.__tslMaterialRegistry.register(
        'Hot',
        makeDefinition(hash('a'), ({ material }) => {
          material.colorNode = new FakeNode('good');
        })
      );
      apply(system, host, 'Default', 'Hot');
      system.flush();
      const lastKnownGood = mesh.material;

      gdjs.__tslMaterialRegistry.register(
        'Hot',
        makeDefinition(hash('b'), () => {
          throw new Error('broken graph');
        })
      );
      system.flush();
      expect(mesh.material).to.be(lastKnownGood);
      expect(system.bindingHasError(host, 'Default')).to.be(true);
      expect(system.getLastError(host, 'Default')).to.contain('broken graph');
    });

    it('updates every parameter type, clamps numbers, and retains the last valid value after rejection', function () {
      const original = new THREE.MeshStandardMaterial();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), original);
      const root = new THREE.Group();
      root.add(mesh);
      const { runtimeScene } = makeRuntimeScene();
      const system = makeSystem(runtimeScene);
      let parameters = /** @type {any} */ ({});
      gdjs.__tslMaterialRegistry.register(
        'Parameters',
        /** @type {gdjs.TSLMaterialDefinition} */ ({
          ...makeDefinition(hash('d'), (context) => {
            parameters = context.parameters;
            context.material.colorNode = new FakeNode('parameters');
          }),
          parameterSchema: {
            amount: { type: 'number', default: 0.5, min: 0, max: 1 },
            enabled: { type: 'boolean', default: true },
            tint: { type: 'color', default: '#112233' },
            offset: { type: 'vec2', default: [0, 0] },
            direction: { type: 'vec3', default: [0, 0, 1] },
            weights: { type: 'vec4', default: [1, 0, 0, 1] },
            mask: { type: 'texture', default: 'DefaultTexture' },
          },
        })
      );
      const host = makeHost(root);
      apply(system, host, 'Default', 'Parameters');
      system.flush();

      expect(system.setParameter(host, 'Default', 'amount', 'number', 2)).to.be(
        true
      );
      expect(parameters.amount.value).to.be(1);
      expect(
        system.setParameter(host, 'Default', 'enabled', 'boolean', false)
      ).to.be(true);
      expect(parameters.enabled.value).to.be(false);
      expect(
        system.setParameter(host, 'Default', 'tint', 'color', '#abcdef')
      ).to.be(true);
      expect(parameters.tint.value.getHexString()).to.be('abcdef');
      expect(
        system.setParameter(host, 'Default', 'tint', 'color', 'not-a-color')
      ).to.be(false);
      expect(parameters.tint.value.getHexString()).to.be('abcdef');
      expect(
        system.setParameter(host, 'Default', 'tint', 'color', '999;0;0')
      ).to.be(false);
      expect(parameters.tint.value.getHexString()).to.be('abcdef');
      expect(
        system.setParameter(host, 'Default', 'offset', 'vec2', [2, 3])
      ).to.be(true);
      expect(parameters.offset.value.toArray()).to.eql([2, 3]);
      expect(
        system.setParameter(host, 'Default', 'direction', 'vec3', [4, 5, 6])
      ).to.be(true);
      expect(parameters.direction.value.toArray()).to.eql([4, 5, 6]);
      expect(
        system.setParameter(host, 'Default', 'weights', 'vec4', [7, 8, 9, 10])
      ).to.be(true);
      expect(parameters.weights.value.toArray()).to.eql([7, 8, 9, 10]);
      expect(
        system.setParameter(host, 'Default', 'mask', 'texture', 'OtherTexture')
      ).to.be(true);
      expect(parameters.mask.value.name).to.be('OtherTexture');

      expect(
        system.setParameter(host, 'Default', 'amount', 'number', 'invalid')
      ).to.be(false);
      expect(parameters.amount.value).to.be(1);
      expect(system.getLastErrorCode(host, 'Default')).to.be('TSL-RUN-007');
      expect(system.isBindingReady(host, 'Default')).to.be(true);
      expect(system.bindingHasError(host, 'Default')).to.be(false);
      expect(
        system.setParameter(host, 'Default', 'amount', 'number', 0.25)
      ).to.be(true);
      expect(parameters.amount.value).to.be(0.25);
      expect(system.isBindingReady(host, 'Default')).to.be(true);
    });

    it('matches mesh and material selectors across material arrays and restores exact slots', function () {
      const first = new THREE.MeshStandardMaterial();
      first.name = 'Body';
      const second = new THREE.MeshStandardMaterial();
      second.name = 'Trim';
      const materials = [first, second];
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), materials);
      mesh.name = 'HeroMesh';
      const root = new THREE.Group();
      root.add(mesh);
      const { runtimeScene } = makeRuntimeScene();
      const system = makeSystem(runtimeScene);
      gdjs.__tslMaterialRegistry.register(
        'Selected',
        makeDefinition(hash('e'), ({ material }) => {
          material.colorNode = new FakeNode('selected');
        })
      );
      const host = makeHost(root);
      system.applyBinding(host, {
        bindingName: 'TrimOnly',
        materialResourceName: 'Selected',
        selector: {
          mode: 'MeshAndMaterialName',
          meshName: 'HeroMesh',
          materialName: 'Trim',
        },
        priority: 0,
        enabled: true,
      });
      system.flush();
      expect(mesh.material).not.to.be(materials);
      expect(mesh.material[0]).to.be(first);
      expect(mesh.material[1]).not.to.be(second);
      expect(system.getMatchedSlotCount(host, 'TrimOnly')).to.be(1);
      expect(system.getActiveSlotCount(host, 'TrimOnly')).to.be(1);

      expect(
        system.applyBinding(host, {
          bindingName: 'InvalidSelector',
          materialResourceName: 'Selected',
          selector: {
            mode: 'MaterialName',
            meshName: '',
            materialName: '',
          },
          priority: 0,
          enabled: true,
        })
      ).to.be(false);
      expect(system.hasBinding(host, 'InvalidSelector')).to.be(false);

      host.getRuntimeScene = () => runtimeScene;
      gdjs.TSLMaterialRuntimeTools.applyMaterial(
        host,
        'InvalidEventSelector',
        'Selected',
        'Typo',
        '',
        '',
        0
      );
      expect(system.hasBinding(host, 'InvalidEventSelector')).to.be(false);

      system.applyBinding(host, {
        bindingName: 'NoMatch',
        materialResourceName: 'Selected',
        selector: {
          mode: 'MaterialName',
          meshName: '',
          materialName: 'Missing',
        },
        priority: 0,
        enabled: true,
      });
      system.flush();
      expect(system.bindingMatchedSlot(host, 'NoMatch')).to.be(false);
      expect(system.getLastErrorCode(host, 'NoMatch')).to.be('TSL-RUN-003');

      system.removeBinding(host, 'TrimOnly');
      system.flush();
      expect(mesh.material).to.be(materials);
      expect(mesh.material[0]).to.be(first);
      expect(mesh.material[1]).to.be(second);
    });

    it('copy-on-writes material arrays shared by cached GLB instances', function () {
      const first = new THREE.MeshStandardMaterial();
      const second = new THREE.MeshStandardMaterial();
      const cachedMaterialArray = [first, second];
      const meshA = new THREE.Mesh(
        new THREE.BoxGeometry(),
        cachedMaterialArray
      );
      const meshB = new THREE.Mesh(
        new THREE.BoxGeometry(),
        cachedMaterialArray
      );
      const rootA = new THREE.Group();
      const rootB = new THREE.Group();
      rootA.add(meshA);
      rootB.add(meshB);
      const { runtimeScene } = makeRuntimeScene();
      const system = makeSystem(runtimeScene);
      gdjs.__tslMaterialRegistry.register(
        'ArrayIsolation',
        makeDefinition(hash('5'), ({ material }) => {
          material.colorNode = new FakeNode('isolated');
        })
      );
      const hostA = makeHost(rootA, 'A');
      const hostB = makeHost(rootB, 'B');
      apply(system, hostA, 'Default', 'ArrayIsolation');
      apply(system, hostB, 'Default', 'ArrayIsolation');
      system.flush();

      expect(cachedMaterialArray).to.eql([first, second]);
      expect(meshA.material).not.to.be(cachedMaterialArray);
      expect(meshB.material).not.to.be(cachedMaterialArray);
      expect(meshA.material).not.to.be(meshB.material);
      expect(meshA.material[0]).not.to.be(meshB.material[0]);

      system.removeAllBindings(hostA);
      expect(meshA.material).to.be(cachedMaterialArray);
      expect(meshB.material).not.to.be(cachedMaterialArray);
      system.removeAllBindings(hostB);
      expect(meshB.material).to.be(cachedMaterialArray);
      expect(cachedMaterialArray).to.eql([first, second]);
    });

    it('keeps borrowed source resources alive and disposes only owned materials once', function () {
      const texture = new THREE.Texture();
      const original = new THREE.MeshStandardMaterial({ map: texture });
      const geometry = new THREE.BoxGeometry();
      const mesh = new THREE.Mesh(geometry, original);
      const root = new THREE.Group();
      root.add(mesh);
      let originalDisposeCount = 0;
      let geometryDisposeCount = 0;
      let textureDisposeCount = 0;
      original.addEventListener('dispose', () => originalDisposeCount++);
      geometry.addEventListener('dispose', () => geometryDisposeCount++);
      texture.addEventListener('dispose', () => textureDisposeCount++);
      const { runtimeScene } = makeRuntimeScene();
      const system = makeSystem(runtimeScene);
      gdjs.__tslMaterialRegistry.register(
        'Owned',
        makeDefinition(hash('6'), ({ material }) => {
          material.colorNode = new FakeNode('owned');
        })
      );
      const host = makeHost(root);
      apply(system, host, 'Default', 'Owned');
      system.flush();
      const owned = mesh.material;
      let ownedDisposeCount = 0;
      owned.addEventListener('dispose', () => ownedDisposeCount++);
      system.removeAllBindings(host);
      system.removeAllBindings(host);

      expect(mesh.material).to.be(original);
      expect(ownedDisposeCount).to.be(1);
      expect(originalDisposeCount).to.be(0);
      expect(geometryDisposeCount).to.be(0);
      expect(textureDisposeCount).to.be(0);
    });

    it('rejects physical transmission with TSL-RUN-004 and keeps the source material', function () {
      const original = new THREE.MeshPhysicalMaterial();
      original.transmission = 0.5;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), original);
      const root = new THREE.Group();
      root.add(mesh);
      const { runtimeScene } = makeRuntimeScene();
      const system = makeSystem(runtimeScene);
      gdjs.__tslMaterialRegistry.register(
        'Physical',
        makeDefinition(hash('7'), ({ material }) => {
          material.colorNode = new FakeNode('physical');
        })
      );
      const host = makeHost(root);
      apply(system, host, 'Default', 'Physical');
      system.flush();
      expect(mesh.material).to.be(original);
      expect(system.getLastErrorCode(host, 'Default')).to.be('TSL-RUN-004');
      expect(system.bindingHasError(host, 'Default')).to.be(true);
    });

    it('scales to hundreds of instance slots and updates uniforms without rebuilding', function () {
      const root = new THREE.Group();
      const original = new THREE.MeshStandardMaterial();
      const geometry = new THREE.BoxGeometry();
      const parameterNodes = [];
      for (let index = 0; index < 200; index++) {
        root.add(new THREE.Mesh(geometry, original));
      }
      const { runtimeScene } = makeRuntimeScene();
      const system = makeSystem(runtimeScene);
      gdjs.__tslMaterialRegistry.register(
        'Stress',
        makeDefinition(hash('8'), ({ material, parameters }) => {
          parameterNodes.push(parameters.strength);
          material.colorNode = new FakeNode('stress');
        })
      );
      const host = makeHost(root);
      apply(system, host, 'Default', 'Stress');
      system.flush();
      expect(system.getActiveSlotCount(host, 'Default')).to.be(200);
      expect(parameterNodes.length).to.be(200);
      expect(
        system.setParameter(host, 'Default', 'strength', 'number', 0.75)
      ).to.be(true);
      expect(parameterNodes.every((node) => node.value === 0.75)).to.be(true);
      system.removeAllBindings(host);
      expect(
        root.children.every(
          (child) => /** @type {any} */ (child).material === original
        )
      ).to.be(true);
    });

    it('fails closed without partially replacing a model above the slot budget', function () {
      const root = new THREE.Group();
      const original = new THREE.MeshStandardMaterial();
      const geometry = new THREE.BoxGeometry();
      for (let index = 0; index < 1025; index++) {
        root.add(new THREE.Mesh(geometry, original));
      }
      const { runtimeScene } = makeRuntimeScene();
      const system = makeSystem(runtimeScene);
      let buildCount = 0;
      gdjs.__tslMaterialRegistry.register(
        'TooManySlots',
        makeDefinition(hash('b'), ({ material }) => {
          buildCount++;
          material.colorNode = new FakeNode('slot-limit');
        })
      );
      const host = makeHost(root);
      apply(system, host, 'Default', 'TooManySlots');
      system.flush();

      expect(buildCount).to.be(0);
      expect(system.getActiveSlotCount(host, 'Default')).to.be(0);
      expect(system.getLastErrorCode(host, 'Default')).to.be('TSL-LIMIT-001');
      expect(
        root.children.every(
          (child) => /** @type {any} */ (child).material === original
        )
      ).to.be(true);
    });

    it('enforces the slot budget per binding instead of rejecting a selectively matched large model', function () {
      const root = new THREE.Group();
      const otherMaterial = new THREE.MeshStandardMaterial();
      otherMaterial.name = 'Other';
      const selectedMaterial = new THREE.MeshStandardMaterial();
      selectedMaterial.name = 'Selected';
      const geometry = new THREE.BoxGeometry();
      for (let index = 0; index < 1024; index++) {
        root.add(new THREE.Mesh(geometry, otherMaterial));
      }
      const selectedMesh = new THREE.Mesh(geometry, selectedMaterial);
      root.add(selectedMesh);
      const { runtimeScene } = makeRuntimeScene();
      const system = makeSystem(runtimeScene);
      let buildCount = 0;
      gdjs.__tslMaterialRegistry.register(
        'Selective',
        makeDefinition(hash('d'), ({ material }) => {
          buildCount++;
          material.colorNode = new FakeNode('selective');
        })
      );
      const host = makeHost(root);
      system.applyBinding(host, {
        bindingName: 'Default',
        materialResourceName: 'Selective',
        selector: {
          mode: 'MaterialName',
          meshName: '',
          materialName: 'Selected',
        },
        priority: 0,
        enabled: true,
      });
      system.flush();

      expect(buildCount).to.be(1);
      expect(system.getMatchedSlotCount(host, 'Default')).to.be(1);
      expect(system.getActiveSlotCount(host, 'Default')).to.be(1);
      expect(selectedMesh.material).not.to.be(selectedMaterial);
      system.removeAllBindings(host);
      expect(selectedMesh.material).to.be(selectedMaterial);
    });

    it('keeps the previous texture uniform when a borrowed resource is missing', function () {
      const original = new THREE.MeshStandardMaterial();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), original);
      const root = new THREE.Group();
      root.add(mesh);
      const { runtimeScene } = makeRuntimeScene('MissingTexture');
      const system = makeSystem(runtimeScene);
      let textureNode = /** @type {any} */ (null);
      gdjs.__tslMaterialRegistry.register('TextureMaterial', {
        ...makeDefinition(hash('c'), ({ material, parameters }) => {
          textureNode = parameters.surface;
          material.colorNode = parameters.surface;
        }),
        parameterSchema: {
          surface: {
            type: 'texture',
            default: 'InitialTexture',
            colorSpace: 'srgb',
          },
        },
      });
      const host = makeHost(root);
      apply(system, host, 'Default', 'TextureMaterial');
      system.flush();

      expect(textureNode.value.name).to.be('InitialTexture');
      expect(
        system.setParameter(
          host,
          'Default',
          'surface',
          'texture',
          'MissingTexture'
        )
      ).to.be(false);
      expect(textureNode.value.name).to.be('InitialTexture');
      expect(system.getLastErrorCode(host, 'Default')).to.be('TSL-RUN-005');

      expect(
        system.setParameter(
          host,
          'Default',
          'surface',
          'texture',
          'ReplacementTexture'
        )
      ).to.be(true);
      expect(textureNode.value.name).to.be('ReplacementTexture');
      expect(system.getLastErrorCode(host, 'Default')).to.be('');
    });

    it('keeps the original material while a default texture resource loads', async function () {
      const original = new THREE.MeshStandardMaterial();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), original);
      const root = new THREE.Group();
      root.add(mesh);
      const { runtimeScene, completeDelayedTextureLoad } = makeRuntimeScene(
        '',
        'DelayedTexture'
      );
      const system = makeSystem(runtimeScene);
      gdjs.__tslMaterialRegistry.register('DelayedDefault', {
        ...makeDefinition(hash('2'), ({ material, parameters }) => {
          material.colorNode = parameters.surface;
        }),
        parameterSchema: {
          surface: {
            type: 'texture',
            default: 'DelayedTexture',
            colorSpace: 'srgb',
          },
        },
      });
      const host = makeHost(root);
      apply(system, host, 'Default', 'DelayedDefault');
      system.flush();

      expect(mesh.material).to.be(original);
      expect(
        /** @type {any} */ (system)._getBindingState(host, 'Default')
      ).to.be('PendingResources');
      expect(system.bindingHasError(host, 'Default')).to.be(false);

      completeDelayedTextureLoad();
      await Promise.resolve();
      system.flush();
      expect(mesh.material).not.to.be(original);
      expect(system.isBindingReady(host, 'Default')).to.be(true);
    });

    it('updates a delayed texture uniform without rebuilding graph topology', async function () {
      const original = new THREE.MeshStandardMaterial();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), original);
      const root = new THREE.Group();
      root.add(mesh);
      const { runtimeScene, completeDelayedTextureLoad } = makeRuntimeScene(
        '',
        'DelayedTexture'
      );
      const system = makeSystem(runtimeScene);
      let textureNode = /** @type {any} */ (null);
      let buildCount = 0;
      gdjs.__tslMaterialRegistry.register('DelayedUpdate', {
        ...makeDefinition(hash('3'), ({ material, parameters }) => {
          buildCount++;
          textureNode = parameters.surface;
          material.colorNode = parameters.surface;
        }),
        parameterSchema: {
          surface: {
            type: 'texture',
            default: 'InitialTexture',
            colorSpace: 'srgb',
          },
        },
      });
      const host = makeHost(root);
      apply(system, host, 'Default', 'DelayedUpdate');
      system.flush();
      const installedMaterial = mesh.material;

      expect(
        system.setParameter(
          host,
          'Default',
          'surface',
          'texture',
          'DelayedTexture'
        )
      ).to.be(true);
      expect(textureNode.value.name).to.be('InitialTexture');
      expect(
        /** @type {any} */ (system)._getBindingState(host, 'Default')
      ).to.be('PendingResources');

      completeDelayedTextureLoad();
      await Promise.resolve();
      system.flush();
      expect(textureNode.value.name).to.be('DelayedTexture');
      expect(mesh.material).to.be(installedMaterial);
      expect(buildCount).to.be(1);
      expect(system.isBindingReady(host, 'Default')).to.be(true);
    });

    it('retains the last texture uniform after an asynchronous load fails', async function () {
      const original = new THREE.MeshStandardMaterial();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), original);
      const root = new THREE.Group();
      root.add(mesh);
      const { runtimeScene, failDelayedTextureLoad } = makeRuntimeScene(
        '',
        'BrokenTexture'
      );
      const system = makeSystem(runtimeScene);
      let textureNode = /** @type {any} */ (null);
      gdjs.__tslMaterialRegistry.register('BrokenUpdate', {
        ...makeDefinition(hash('4'), ({ material, parameters }) => {
          textureNode = parameters.surface;
          material.colorNode = parameters.surface;
        }),
        parameterSchema: {
          surface: {
            type: 'texture',
            default: 'InitialTexture',
            colorSpace: 'srgb',
          },
        },
      });
      const host = makeHost(root);
      apply(system, host, 'Default', 'BrokenUpdate');
      system.flush();
      const installedMaterial = mesh.material;

      expect(
        system.setParameter(
          host,
          'Default',
          'surface',
          'texture',
          'BrokenTexture'
        )
      ).to.be(true);
      failDelayedTextureLoad();
      await Promise.resolve();
      system.flush();

      expect(textureNode.value.name).to.be('InitialTexture');
      expect(mesh.material).to.be(installedMaterial);
      expect(system.getLastErrorCode(host, 'Default')).to.be('TSL-RUN-005');
      expect(system.bindingHasError(host, 'Default')).to.be(true);
    });

    it('rebuilds only after explicit fog or environment invalidation', function () {
      const original = new THREE.MeshStandardMaterial();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), original);
      const root = new THREE.Group();
      root.add(mesh);
      const { runtimeScene, threeScene } = makeRuntimeScene();
      const system = makeSystem(runtimeScene);
      let buildCount = 0;
      gdjs.__tslMaterialRegistry.register(
        'SceneInputs',
        makeDefinition(hash('9'), ({ material }) => {
          buildCount++;
          material.colorNode = new FakeNode('scene-input');
        })
      );
      const host = makeHost(root);
      apply(system, host, 'Default', 'SceneInputs');
      system.flush();
      const firstOwnedMaterial = mesh.material;
      system.flush();
      system.flush();
      expect(buildCount).to.be(1);
      expect(mesh.material).to.be(firstOwnedMaterial);

      threeScene.fog = new THREE.Fog(0xffffff, 1, 100);
      gdjs.TSLMaterialSystem.invalidateSceneInputs(runtimeScene);
      system.flush();
      expect(buildCount).to.be(2);
      expect(mesh.material).not.to.be(firstOwnedMaterial);
    });

    it('removes a pending host record when the object is destroyed before its model loads', function () {
      const { runtimeScene } = makeRuntimeScene();
      const system = makeSystem(runtimeScene);
      const host = makeHost(null);
      apply(system, host, 'Default', 'Missing');
      expect(system.hasBinding(host, 'Default')).to.be(true);
      host.replaceRoot(null, 'destroyed');
      expect(system.hasBinding(host, 'Default')).to.be(false);
    });

    it('restores originals on context loss and rebuilds only after restoration', function () {
      const original = new THREE.MeshStandardMaterial();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), original);
      const root = new THREE.Group();
      root.add(mesh);
      const { runtimeScene, canvas } = makeRuntimeScene();
      const system = makeSystem(runtimeScene);
      gdjs.__tslMaterialRegistry.register(
        'Tint',
        makeDefinition(hash('a'), ({ material }) => {
          material.colorNode = new FakeNode('tint');
        })
      );
      const host = makeHost(root);
      apply(system, host, 'Default', 'Tint');
      system.flush();
      const firstReplacement = mesh.material;
      canvas.dispatchEvent(new Event('webglcontextlost'));
      expect(mesh.material).to.be(original);
      system.flush();
      expect(mesh.material).to.be(original);
      canvas.dispatchEvent(new Event('webglcontextrestored'));
      system.flush();
      expect(mesh.material).not.to.be(original);
      expect(mesh.material).not.to.be(firstReplacement);
    });
  });
});
