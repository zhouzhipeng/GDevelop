namespace gdjs {
  const tslMaterialRegistryLogger = new gdjs.Logger('TSL materials');

  /** Stores editor-compiled definitions loaded before scene code. */
  export class TSLMaterialRegistry {
    private _definitions = new Map<string, gdjs.TSLMaterialDefinition>();
    private _pendingBundle: {
      receipt: gdjs.TSLMaterialBundleReceipt;
      definitions: Map<string, gdjs.TSLMaterialDefinition>;
    } | null = null;
    private _expectedNextBundle: Map<string, string> | null = null;
    private _listeners = new Set<
      (
        resourceName: string,
        previous: gdjs.TSLMaterialDefinition | null,
        next: gdjs.TSLMaterialDefinition | null
      ) => void
    >();

    register(
      resourceName: string,
      definition: gdjs.TSLMaterialDefinition
    ): void {
      if (!resourceName || !this._isCompatibleDefinition(definition)) {
        if (this._pendingBundle) {
          this._rejectPendingBundle(
            `Rejected incompatible TSL material registry entry "${resourceName}" (TSL-PKG-001).`
          );
        }
        tslMaterialRegistryLogger.error(
          `Rejected incompatible TSL material registry entry "${resourceName}" (TSL-PKG-001).`
        );
        return;
      }
      if (this._pendingBundle) {
        if (this._pendingBundle.definitions.has(resourceName)) {
          this._rejectPendingBundle(
            `Duplicate TSL material registry entry "${resourceName}" (TSL-PKG-001).`
          );
        }
        this._pendingBundle.definitions.set(resourceName, definition);
        return;
      }
      const previous = this._definitions.get(resourceName) || null;
      if (previous && previous.sourceHash === definition.sourceHash) return;
      this._definitions.set(resourceName, definition);
      for (const listener of Array.from(this._listeners)) {
        listener(resourceName, previous, definition);
      }
    }

    get(resourceName: string): gdjs.TSLMaterialDefinition | null {
      return this._definitions.get(resourceName) || null;
    }

    has(resourceName: string): boolean {
      return this._definitions.has(resourceName);
    }

    /** Starts an atomic generated-bundle registration transaction. */
    beginBundle(receipt: gdjs.TSLMaterialBundleReceipt): void {
      if (this._pendingBundle) {
        throw new Error(
          'A TSL material bundle registration is already pending (TSL-PKG-001).'
        );
      }
      if (!this._isCompatibleBundleReceipt(receipt)) {
        throw new Error(
          'Rejected incompatible TSL material bundle receipt (TSL-PKG-001).'
        );
      }
      this._pendingBundle = {
        receipt,
        definitions: new Map<string, gdjs.TSLMaterialDefinition>(),
      };
    }

    /**
     * Pins the exact descriptor that the next generated bundle must satisfy.
     * The expectation is consumed by a successful commit or any abort/failure.
     */
    expectNextBundle(
      resources: readonly { resourceName: string; sourceSha256: string }[]
    ): void {
      if (this._pendingBundle) {
        throw new Error(
          'Cannot change the expected TSL material bundle during registration (TSL-PKG-001).'
        );
      }
      if (!Array.isArray(resources) || resources.length > 4096) {
        throw new Error(
          'The expected TSL material bundle descriptor is invalid (TSL-PKG-001).'
        );
      }
      const expectation = new Map<string, string>();
      for (const resource of resources) {
        if (
          !resource ||
          !this._isValidResourceName(resource.resourceName) ||
          !this._isSha256(resource.sourceSha256) ||
          expectation.has(resource.resourceName)
        ) {
          throw new Error(
            'The expected TSL material bundle descriptor is invalid or contains duplicates (TSL-PKG-001).'
          );
        }
        expectation.set(resource.resourceName, resource.sourceSha256);
      }
      this._expectedNextBundle = expectation;
    }

    /** Commits every definition in a generated bundle as one logical update. */
    endBundle(): void {
      const pendingBundle = this._pendingBundle;
      if (!pendingBundle) {
        throw new Error(
          'No TSL material bundle registration is pending (TSL-PKG-001).'
        );
      }
      if (
        pendingBundle.definitions.size !== pendingBundle.receipt.definitionCount
      ) {
        this._rejectPendingBundle(
          'The TSL material bundle definition count does not match its receipt (TSL-PKG-001).'
        );
      }
      const receiptResourceNames = new Set<string>();
      const receiptMatchesDefinitions = pendingBundle.receipt.receipts.every(
        (definitionReceipt: any) => {
          if (receiptResourceNames.has(definitionReceipt.resourceName)) {
            return false;
          }
          receiptResourceNames.add(definitionReceipt.resourceName);
          const definition = pendingBundle.definitions.get(
            definitionReceipt.resourceName
          );
          return !!(
            definition &&
            definition.sourceHash === definitionReceipt.sourceSha256 &&
            definition.authoringApiVersion ===
              definitionReceipt.authoringApiVersion &&
            definition.compilerVersion === definitionReceipt.compilerVersion &&
            definition.threeRevision === definitionReceipt.threeRevision &&
            definition.portableProfileVersion ===
              definitionReceipt.portableProfileVersion
          );
        }
      );
      if (
        pendingBundle.receipt.receipts.length !==
          pendingBundle.receipt.definitionCount ||
        !receiptMatchesDefinitions
      ) {
        this._rejectPendingBundle(
          'The TSL material bundle definitions do not match their receipts (TSL-PKG-001).'
        );
      }
      const expectedNextBundle = this._expectedNextBundle;
      if (
        expectedNextBundle &&
        (expectedNextBundle.size !== pendingBundle.definitions.size ||
          Array.from(expectedNextBundle).some(
            ([resourceName, sourceSha256]) =>
              pendingBundle.definitions.get(resourceName)?.sourceHash !==
              sourceSha256
          ))
      ) {
        this._rejectPendingBundle(
          'The TSL material bundle does not match the expected preview descriptor (TSL-PKG-001).'
        );
      }

      const previousDefinitions = this._definitions;
      this._definitions = pendingBundle.definitions;
      this._pendingBundle = null;
      this._expectedNextBundle = null;
      const resourceNames = new Set<string>([
        ...previousDefinitions.keys(),
        ...this._definitions.keys(),
      ]);
      for (const resourceName of resourceNames) {
        const previous = previousDefinitions.get(resourceName) || null;
        const next = this._definitions.get(resourceName) || null;
        if (previous === next) continue;
        if (previous && next && previous.sourceHash === next.sourceHash) {
          continue;
        }
        for (const listener of Array.from(this._listeners)) {
          listener(resourceName, previous, next);
        }
      }
    }

    /** Discards a partially evaluated generated bundle. */
    abortBundle(): void {
      this._pendingBundle = null;
      this._expectedNextBundle = null;
    }

    isBundleRegistrationPending(): boolean {
      return !!this._pendingBundle;
    }

    addDefinitionChangedListener(
      listener: (
        resourceName: string,
        previous: gdjs.TSLMaterialDefinition | null,
        next: gdjs.TSLMaterialDefinition | null
      ) => void
    ): () => void {
      this._listeners.add(listener);
      let isRemoved = false;
      return () => {
        if (isRemoved) return;
        isRemoved = true;
        this._listeners.delete(listener);
      };
    }

    /** @internal Test and preview teardown helper. */
    clear(): void {
      this._pendingBundle = null;
      this._expectedNextBundle = null;
      this._definitions.clear();
    }

    private _rejectPendingBundle(message: string): never {
      this._pendingBundle = null;
      this._expectedNextBundle = null;
      throw new Error(message);
    }

    private _isSha256(value: any): boolean {
      return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
    }

    private _isValidResourceName(value: any): boolean {
      return (
        typeof value === 'string' &&
        value.length > 0 &&
        value.length <= 1024 &&
        !/[\u0000-\u001f\u007f]/.test(value)
      );
    }

    private _isValidSourcePath(value: any): boolean {
      if (
        typeof value !== 'string' ||
        !value ||
        value.length > 4096 ||
        value.startsWith('/') ||
        /^[A-Za-z]:/.test(value) ||
        value.includes('\\')
      ) {
        return false;
      }
      return !value.split('/').some((segment) => segment === '..');
    }

    private _isCompatibleDefinitionReceipt(receipt: any): boolean {
      if (
        !receipt ||
        receipt.apiVersion !== 1 ||
        !this._isValidResourceName(receipt.resourceName) ||
        !this._isValidSourcePath(receipt.normalizedSourcePath) ||
        !this._isSha256(receipt.sourceSha256) ||
        !this._isSha256(receipt.emittedSha256) ||
        receipt.authoringApiVersion !== '1' ||
        receipt.compilerVersion !== '1' ||
        receipt.threeRevision !== '185' ||
        receipt.portableProfileVersion !== '1' ||
        !this._isSha256(receipt.projectApiSha256) ||
        !this._isSha256(receipt.tslApiSha256) ||
        !this._isSha256(receipt.tslCatalogSha256) ||
        !this._isSha256(receipt.optionsSha256) ||
        !this._isSha256(receipt.parameterSchemaSha256) ||
        !Array.isArray(receipt.importedSymbols) ||
        receipt.importedSymbols.length > 256
      ) {
        return false;
      }
      const importedSymbols = new Set<string>();
      return receipt.importedSymbols.every((symbol: any) => {
        if (
          typeof symbol !== 'string' ||
          !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(symbol) ||
          importedSymbols.has(symbol)
        ) {
          return false;
        }
        importedSymbols.add(symbol);
        return true;
      });
    }

    private _isCompatibleBundleReceipt(
      receipt: gdjs.TSLMaterialBundleReceipt | null | undefined
    ): boolean {
      return !!(
        receipt &&
        receipt.apiVersion === 1 &&
        receipt.authoringApiVersion === '1' &&
        receipt.compilerVersion === '1' &&
        receipt.threeRevision === '185' &&
        receipt.portableProfileVersion === '1' &&
        receipt.target === 'webgl2-node-compat' &&
        Number.isSafeInteger(receipt.definitionCount) &&
        receipt.definitionCount >= 0 &&
        receipt.definitionCount <= 4096 &&
        this._isSha256(receipt.definitionsSha256) &&
        Array.isArray(receipt.receipts) &&
        receipt.receipts.length === receipt.definitionCount &&
        receipt.receipts.every((definitionReceipt: any) =>
          this._isCompatibleDefinitionReceipt(definitionReceipt)
        ) &&
        new Set(
          receipt.receipts.map(
            (definitionReceipt: any) => definitionReceipt.resourceName
          )
        ).size === receipt.definitionCount
      );
    }

    private _isCompatibleParameterDefinition(definition: any): boolean {
      if (!definition || typeof definition !== 'object') return false;
      const allowedFields = new Set([
        'type',
        'default',
        'label',
        'min',
        'max',
        'step',
        'colorSpace',
      ]);
      if (Object.keys(definition).some((key) => !allowedFields.has(key))) {
        return false;
      }
      if (
        ![
          'number',
          'boolean',
          'color',
          'vec2',
          'vec3',
          'vec4',
          'texture',
        ].includes(definition.type) ||
        (definition.label !== undefined &&
          (typeof definition.label !== 'string' ||
            definition.label.length > 4096))
      ) {
        return false;
      }
      if (definition.type === 'number') {
        if (!Number.isFinite(definition.default)) return false;
        for (const field of ['min', 'max', 'step']) {
          if (
            definition[field] !== undefined &&
            !Number.isFinite(definition[field])
          ) {
            return false;
          }
        }
        if (
          (definition.min !== undefined &&
            definition.max !== undefined &&
            definition.min > definition.max) ||
          (definition.step !== undefined && definition.step <= 0) ||
          (definition.min !== undefined &&
            definition.default < definition.min) ||
          (definition.max !== undefined && definition.default > definition.max)
        ) {
          return false;
        }
      } else if (definition.type === 'boolean') {
        if (typeof definition.default !== 'boolean') return false;
      } else if (definition.type === 'color') {
        if (
          typeof definition.default !== 'string' ||
          !/^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/.test(definition.default)
        ) {
          return false;
        }
      } else if (
        definition.type === 'vec2' ||
        definition.type === 'vec3' ||
        definition.type === 'vec4'
      ) {
        const length = Number(definition.type.slice(-1));
        if (
          !Array.isArray(definition.default) ||
          definition.default.length !== length ||
          !definition.default.every((value: any) => Number.isFinite(value))
        ) {
          return false;
        }
      } else if (
        typeof definition.default !== 'string' ||
        !definition.default ||
        !['srgb', 'linear', 'normal'].includes(definition.colorSpace || 'srgb')
      ) {
        return false;
      }
      if (
        definition.type !== 'texture' &&
        definition.colorSpace !== undefined
      ) {
        return false;
      }
      return true;
    }

    private _isCompatibleDefinition(
      definition: gdjs.TSLMaterialDefinition | null | undefined
    ): boolean {
      if (
        !definition ||
        definition.apiVersion !== 1 ||
        definition.authoringApiVersion !== '1' ||
        definition.compilerVersion !== '1' ||
        definition.threeRevision !== '185' ||
        definition.portableProfileVersion !== '1' ||
        !this._isSha256(definition.sourceHash) ||
        !['inherit', 'basic', 'standard', 'physical', 'custom'].includes(
          definition.base
        ) ||
        typeof definition.label !== 'string' ||
        definition.label.length > 4096 ||
        typeof definition.description !== 'string' ||
        definition.description.length > 16384 ||
        !Array.isArray(definition.importedSymbols) ||
        definition.importedSymbols.length > 256 ||
        typeof definition.build !== 'function' ||
        !definition.parameterSchema ||
        typeof definition.parameterSchema !== 'object' ||
        Array.isArray(definition.parameterSchema)
      ) {
        return false;
      }
      const allowedDefinitionFields = new Set([
        'apiVersion',
        'authoringApiVersion',
        'compilerVersion',
        'threeRevision',
        'portableProfileVersion',
        'sourceHash',
        'base',
        'label',
        'description',
        'parameterSchema',
        'importedSymbols',
        'build',
      ]);
      if (
        Object.keys(definition).some(
          (field) => !allowedDefinitionFields.has(field)
        )
      ) {
        return false;
      }
      const importedSymbols = new Set<string>();
      if (
        !definition.importedSymbols.every((symbol: any) => {
          if (
            typeof symbol !== 'string' ||
            !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(symbol) ||
            importedSymbols.has(symbol)
          ) {
            return false;
          }
          importedSymbols.add(symbol);
          return true;
        })
      ) {
        return false;
      }
      const parameterNames = Object.keys(definition.parameterSchema);
      return (
        parameterNames.length <= 128 &&
        parameterNames.every(
          (name) =>
            /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) &&
            this._isCompatibleParameterDefinition(
              definition.parameterSchema[name]
            )
        )
      );
    }
  }

  export const __tslMaterialRegistry = new gdjs.TSLMaterialRegistry();
}
