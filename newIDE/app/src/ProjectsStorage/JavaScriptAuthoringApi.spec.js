// @flow

import {
  JAVASCRIPT_AUTHORING_API_VERSION,
  PROJECT_HARNESS_API_RELATIVE_PATH,
  buildHarnessApiDeclaration,
  buildJavaScriptAuthoringArtifacts,
  buildProjectApiDeclaration,
  buildRuntimeApiDeclaration,
  collectSerializedProjectJavaScriptBlocks,
  collectSourceFileJavaScriptBlocks,
  validateJavaScriptAuthoringBlocks,
  validateProjectJavaScriptAuthoring,
  validateReviewedExtensionJavaScriptAuthoring,
} from './JavaScriptAuthoringApi';
import optionalRequire from '../Utils/OptionalRequire';

const typescript = optionalRequire('typescript');

const serializedProject = {
  properties: { name: 'Typed project' },
  variables: [{ name: 'HighScore', type: 'number', value: 0 }],
  objects: [],
  objectsGroups: [],
  resources: {
    resources: [
      { name: 'player.png', kind: 'image', file: 'assets/player.png' },
    ],
  },
  layouts: [
    {
      name: 'Main',
      variables: [{ name: 'Score', type: 'number', value: 0 }],
      layers: [{ name: '' }, { name: 'UI' }],
      objects: [
        {
          name: 'Player',
          type: 'Sprite',
          variables: [{ name: 'Health', type: 'number', value: 3 }],
          behaviors: [
            {
              name: 'Platformer',
              type: 'PlatformBehavior::PlatformerObjectBehavior',
            },
          ],
        },
        {
          name: 'Bullet',
          type: 'Sprite',
          variables: [],
          behaviors: [],
        },
      ],
      objectsGroups: [{ name: 'Actors', objects: [{ name: 'Player' }] }],
      events: [],
    },
  ],
  externalEvents: [],
  eventsFunctionsExtensions: [
    {
      name: 'Combat',
      eventsFunctions: [
        {
          name: 'Damage',
          functionType: 'Action',
          parameters: [
            { name: 'Target', type: 'object' },
            { name: 'Amount', type: 'number' },
          ],
          events: [],
        },
      ],
      eventsBasedObjects: [],
      eventsBasedBehaviors: [],
    },
  ],
};

const getGameplayTestTypeScriptDiagnostics = (source: string): Array<any> => {
  if (!typescript) throw new Error('TypeScript is required for this test.');
  const ts = typescript;
  const artifacts = buildJavaScriptAuthoringArtifacts(serializedProject);
  const root = 'C:/__gdevelop_gameplay_test_api__';
  const runtimePath = `${root}/runtime-api.d.ts`;
  const projectPath = `${root}/project-api.d.ts`;
  const harnessPath = `${root}/harness-api.d.ts`;
  const sourcePath = `${root}/gameplay-test.js`;
  const virtualFiles = new Map([
    [runtimePath.toLowerCase(), artifacts.runtimeApi],
    [projectPath.toLowerCase(), artifacts.projectApi],
    [harnessPath.toLowerCase(), artifacts.harnessApi],
    [
      sourcePath.toLowerCase(),
      `async function __gdevelopGameplayTestBody__() {\n${source}\n}\n`,
    ],
  ]);
  const compilerOptions = {
    allowJs: true,
    checkJs: true,
    noEmit: true,
    strict: true,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.None,
    lib: ['lib.es2020.d.ts'],
    types: [],
    skipLibCheck: true,
  };
  const baseHost = ts.createCompilerHost(compilerOptions, true);
  const readVirtual = (fileName: string): ?string =>
    virtualFiles.get(fileName.toLowerCase());
  const host = {
    ...baseHost,
    fileExists: (fileName: string): boolean =>
      readVirtual(fileName) !== undefined || baseHost.fileExists(fileName),
    readFile: (fileName: string): ?string => {
      const virtual = readVirtual(fileName);
      return virtual !== undefined ? virtual : baseHost.readFile(fileName);
    },
    getSourceFile: (fileName: string, languageVersion: any): any => {
      const virtual = readVirtual(fileName);
      if (virtual !== undefined) {
        return ts.createSourceFile(
          fileName,
          virtual,
          languageVersion,
          true,
          fileName.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS
        );
      }
      return baseHost.getSourceFile(fileName, languageVersion);
    },
  };
  const program = ts.createProgram(
    [runtimePath, projectPath, harnessPath, sourcePath],
    compilerOptions,
    host
  );
  const sourceFile = program.getSourceFile(sourcePath);
  return [
    ...program.getSyntacticDiagnostics(sourceFile),
    ...program.getSemanticDiagnostics(sourceFile),
  ];
};

describe('JavaScript authoring API', () => {
  test('reports one validator-environment diagnostic when TypeScript is unavailable', () => {
    const validation = validateJavaScriptAuthoringBlocks({
      serializedProject,
      typescript: null,
      blocks: [
        { inlineCode: 'const first = 1;', useStrict: true },
        { inlineCode: 'const second = 2;', useStrict: true },
      ],
    });

    expect(validation).toMatchObject({
      checked: false,
      valid: false,
      blocks: 2,
      checkedBlocks: 0,
      typescriptAvailable: false,
      typescriptVersion: null,
    });
    expect(validation.environmentDiagnostics).toEqual([
      expect.objectContaining({
        code: 'JS_API_TYPESCRIPT_UNAVAILABLE',
        scope: 'validator',
        affectedBlocks: 2,
      }),
    ]);
    expect(validation.sourceDiagnostics).toEqual([]);
    expect(validation.errors).toHaveLength(1);
  });

  test('generates a deterministic curated runtime declaration', () => {
    const declaration = buildRuntimeApiDeclaration();
    expect(buildRuntimeApiDeclaration()).toBe(declaration);
    expect(declaration).toContain('class RuntimeScene');
    expect(declaration).toContain('class RuntimeObject');
    expect(declaration).toContain('addPolarForce');
    expect(declaration).toContain('resetTimer(name: string)');
    expect(declaration).toContain('setCameraX(value: number');
    expect(declaration).toContain(
      'Return the live, engine-owned array of living instances'
    );
    expect(declaration).toContain(
      'iterate backward when calling deleteFromScene()'
    );
    expect(declaration).not.toContain('_instances');
    expect(declaration).not.toContain('_behaviorData');
    expect(declaration).not.toContain('evtsExt__');
  });

  test('generates project-aware scene, object, variable, resource, and function types', () => {
    const declaration = buildProjectApiDeclaration(serializedProject);
    expect(declaration).toContain('readonly "Main"');
    expect(declaration).toContain(
      'readonly "Player": ObjectDefinition<gdjs.SpriteRuntimeObject'
    );
    expect(declaration).toContain('readonly "Health": number');
    expect(declaration).toContain('readonly "Actors": "Player"');
    expect(declaration).toContain('readonly "Score": number');
    expect(declaration).toContain('readonly "player.png"');
    expect(declaration).toContain('readonly "Combat::Damage"');

    const artifacts = buildJavaScriptAuthoringArtifacts(serializedProject);
    expect(artifacts.counts).toEqual({
      scenes: 1,
      globalObjects: 0,
      resources: 1,
      functions: 1,
    });
    expect(artifacts.hashes.runtimeApi).toHaveLength(64);
    expect(artifacts.hashes.projectApi).toHaveLength(64);
    expect(artifacts.hashes.harnessApi).toHaveLength(64);
  });

  test('generates a deterministic reviewed gameplay-test harness declaration', () => {
    const artifacts = buildJavaScriptAuthoringArtifacts(serializedProject);
    const declaration = buildHarnessApiDeclaration(
      artifacts.runtimeApi,
      artifacts.projectApi
    );

    expect(JAVASCRIPT_AUTHORING_API_VERSION).toBe(2);
    expect(PROJECT_HARNESS_API_RELATIVE_PATH).toBe(
      '.gdevelop/harness-api.d.ts'
    );
    expect(artifacts.harnessApi).toBe(declaration);
    expect(
      buildHarnessApiDeclaration(artifacts.runtimeApi, artifacts.projectApi)
    ).toBe(declaration);
    expect(declaration).toContain(
      `// runtimeApiHash: sha256:${artifacts.hashes.runtimeApi}`
    );
    expect(declaration).toContain(
      `// projectApiHash: sha256:${artifacts.hashes.projectApi}`
    );
    expect(declaration).toMatch(/\/\/ harnessApiHash: sha256:[0-9a-f]{64}/);
    expect(declaration).toContain(
      'declare const harness: GDevelopGameplayTests.GameplayTestHarness'
    );
    expect(declaration).toContain('stepFrames(');
    expect(declaration).toContain('stepUntilObjectIsStable(');
    expect(declaration).toContain('releaseAllInputs(): void');
    expect(declaration).toContain('getCameraState(layerName?: string)');
    expect(declaration).toContain('getObjectVariable(');
    expect(declaration).toContain('resetSceneAndProbeControls(');
    expect(declaration).toContain('makeProgressTracker(');
    expect(declaration).toContain('lookTowardWithMouseDelta(');
    expect(declaration).toContain('interface GameplayTestProfilingResult');
    expect(declaration).toContain('interface GameplayTestResult');
    expect(declaration).not.toContain('requestStop');
    expect(declaration).not.toContain('_runtimeGame');
    expect(declaration).not.toContain('_makeResult');
    expect(declaration).not.toContain('_installPointerLockShim');
    expect(declaration).not.toContain('getRenderer');
  });

  test('reports harness declaration building after its dependencies are available', () => {
    const onHarnessApiBuilding: any = jest.fn();
    const artifacts = buildJavaScriptAuthoringArtifacts(serializedProject, {
      onHarnessApiBuilding,
    });

    expect(onHarnessApiBuilding).toHaveBeenCalledTimes(1);
    expect(artifacts.runtimeApi).toContain('declare namespace gdjs');
    expect(artifacts.projectApi).toContain('declare namespace GDevelopProject');
    expect(artifacts.harnessApi).toContain('declare const harness');
  });

  test('type-checks representative async gameplay-test bodies against all declarations', () => {
    const diagnostics = getGameplayTestTypeScriptDiagnostics(`
await harness.goToScene('Main');
const player = harness.spawn('Player', 100, 200);
harness.setSceneVariable('Score', 10);
harness.setObjectVariable(player.id, 'Health', 3);
harness.setKeyPressed('Right', true);
await harness.stepFrames(30, {
  onFrame: ({ frame }) => {
    if (frame === 10) harness.setMousePosition(100, 50, 'UI');
  },
});
harness.setKeyPressed('Right', false);
harness.releaseAllInputs();
const reached = await harness.stepUntil(
  () => harness.getObjects('Player')[0].x >= 100,
  { maxFrames: 60 }
);
const stable = await harness.stepUntilObjectIsStable('Player', {
  maxFrames: 120,
});
const relative = harness.getRelativePosition('Player', { x: 200, y: 200 });
const nearby = harness.getNearby('Bullet', 'Player', 300);
const lineOfSight = harness.has2dLineOfSight('Player', 'Bullet', ['Wall']);
const tracker = harness.makeProgressTracker('Player', { x: 200, y: 200 });
const progress = tracker.update();
const controls = await harness.resetSceneAndProbeControls(
  'Player',
  ['Left', 'Right']
);
const aim = await harness.lookTowardWithMouseDelta('Player', {
  name: 'Bullet',
});
const layer = harness.getRuntimeLayer('UI');
const score = harness.getSceneVariable('Score');
harness.startProfiling();
await harness.stepFrames(2);
const profile = harness.stopProfiling();
harness.watch('Player');
await harness.takeScreenshot('movement');
harness.assert(
  reached && stable && !!relative && nearby.length >= 0 &&
    lineOfSight.clear === true && !!progress && !!controls.keys.Right &&
    !!aim && !!layer && score?.value === 10 && !!profile,
  'The movement scenario completed'
);
`);

    expect(
      diagnostics.map(diagnostic =>
        typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
      )
    ).toEqual([]);
  });

  test('does not type-check unsupported or runtime-private harness members', () => {
    const diagnostics = getGameplayTestTypeScriptDiagnostics(`
await harness.stepFrame(1);
harness.requestStop();
harness._runtimeGame;
harness.getRenderer();
`);
    const messages = diagnostics.map(diagnostic =>
      typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    );

    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Property 'stepFrame' does not exist"),
        expect.stringContaining("Property 'requestStop' does not exist"),
        expect.stringContaining("Property '_runtimeGame' does not exist"),
        expect.stringContaining("Property 'getRenderer' does not exist"),
      ])
    );
  });

  test('extracts JavaScript with exact IfDo source locations', () => {
    const blocks = collectSourceFileJavaScriptBlocks({
      'game://scenes/Main/Main.events': `@event
if SceneJustBegins
> @js objects="Player" strict=true
const value = 1;
> @end js
`,
    });
    expect(blocks).toEqual([
      expect.objectContaining({
        fileUri: 'game://scenes/Main/Main.events',
        parameterObjects: 'Player',
        useStrict: true,
        headerLine: 3,
        bodyLine: 4,
        inlineCode: 'const value = 1;',
      }),
    ]);
  });

  test('uses scene-owned source paths and scene context for external JavaScript', () => {
    const projectWithExternal = {
      ...serializedProject,
      externalEvents: [
        {
          name: 'Shared Combat',
          associatedLayout: 'Main',
          events: [
            {
              type: 'BuiltinCommonInstructions::JsCode',
              useStrict: true,
              inlineCode: 'runtimeScene.getObjects("Plaeyr");',
            },
          ],
        },
      ],
    };
    expect(
      collectSerializedProjectJavaScriptBlocks(projectWithExternal)
    ).toEqual([
      expect.objectContaining({
        fileUri:
          'game://scenes/Main/external-events/Shared%20Combat/functions/sceneUpdate.events',
      }),
    ]);
    expect(
      validateProjectJavaScriptAuthoring({
        serializedProject: projectWithExternal,
      }).errors
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'JS_API_TYPE_MISMATCH',
          fileUri:
            'game://scenes/Main/external-events/Shared%20Combat/functions/sceneUpdate.events',
        }),
      ])
    );
  });

  test('accepts public project-aware JavaScript in strict blocks', () => {
    const validation = validateProjectJavaScriptAuthoring({
      serializedProject,
      sourceFiles: {
        'game://scenes/Main/Main.events': `@js objects="Player" strict=true
for (const player of objects) {
  player.setX(player.getX() + 1);
  player.getVariables().get("Health").sub(1);
  const platformer = player.getBehavior("Platformer");
  if (platformer) platformer.activate(true);
}
runtimeScene.getVariables().get("Score").add(10);
runtimeScene.getGame().getVariables().get("HighScore").add(10);
if (runtimeScene.getElapsedTime() < 0) return;
const bullet = runtimeScene.createObject("Bullet");
if (bullet) bullet.addPolarForce(0, 720, 1);
@end js
`,
      },
    });
    expect(validation.errors).toEqual([]);
    expect(validation.valid).toBe(true);
    expect(validation.blocks).toBe(1);
    expect(validation.strictBlocks).toBe(1);
  });

  test('exposes pointer-lock and bounded 3D raycast facades to strict code', () => {
    const validation = validateProjectJavaScriptAuthoring({
      serializedProject,
      sourceFiles: {
        'game://scenes/Main/Main.events': `@js objects="Player" strict=true
gdjs.evtTools.input.requestPointerLock(runtimeScene, "first-person-camera");
if (gdjs.evtTools.input.isPointerLocked(runtimeScene)) {
  const movementX = gdjs.evtTools.input.getPointerMovementX(runtimeScene);
  const movementY = gdjs.evtTools.input.getPointerMovementY(runtimeScene);
  objects[0].setPosition(movementX, movementY);
  gdjs.evtTools.input.exitPointerLock(runtimeScene);
}
const hits = gdjs.evtTools.scene3d.raycastObjects(
  0, 0, 0, 1, 0, 0, objects, 0, 1000, true
);
if (hits.length > 0) hits[0].object.setX(hits[0].pointX);
@end js
`,
      },
    });

    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  test('rejects stale project literals in a known scene context', () => {
    const validation = validateProjectJavaScriptAuthoring({
      serializedProject,
      sourceFiles: {
        'game://scenes/Main/Main.events': `@js objects="Player" strict=true
runtimeScene.getObjects("Plaeyr");
runtimeScene.getLayer("HUD");
runtimeScene.getVariables().get("Scroe");
objects[0].getVariables().get("HP");
objects[0].getBehavior("Physics");
@end js
`,
      },
    });
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThanOrEqual(5);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'JS_API_TYPE_MISMATCH',
          fileUri: 'game://scenes/Main/Main.events',
        }),
      ])
    );
  });

  test('rejects private fields, forbidden globals, and unknown public methods in strict blocks', () => {
    const validation = validateProjectJavaScriptAuthoring({
      serializedProject,
      sourceFiles: {
        'game://scenes/Main/Main.events': `@js objects="Player" strict=true
objects[0]._behaviorData;
objects[0].notAPublicMethod();
fetch("https://example.com");
@end js
`,
      },
    });
    expect(validation.valid).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'JS_API_PRIVATE_MEMBER',
          fileUri: 'game://scenes/Main/Main.events',
          line: 2,
        }),
        expect.objectContaining({ code: 'JS_API_UNKNOWN_MEMBER' }),
        expect.objectContaining({ code: 'JS_API_FORBIDDEN_GLOBAL' }),
      ])
    );
  });

  test('keeps compatibility diagnostics non-blocking without strict=true', () => {
    const validation = validateProjectJavaScriptAuthoring({
      serializedProject,
      sourceFiles: {
        'game://scenes/Main/Main.events': `@js objects="Player"
objects[0]._behaviorData;
@end js
`,
      },
    });
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(validation.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'JS_API_PRIVATE_MEMBER' }),
      ])
    );
  });

  test('limits reviewed registry compatibility to pinned downloaded content', () => {
    const serializedExtension = {
      name: 'MousePointerLock',
      eventsFunctions: [
        {
          name: 'Request',
          events: [
            {
              type: 'BuiltinCommonInstructions::JsCode',
              useStrict: true,
              inlineCode:
                'document.body.requestPointerLock(); runtimeScene._instances;',
            },
          ],
        },
      ],
      eventsBasedBehaviors: [],
      eventsBasedObjects: [],
    };
    const validation = validateReviewedExtensionJavaScriptAuthoring({
      serializedExtension,
      registryHeader: { name: 'MousePointerLock', version: '1.2.3' },
    });

    expect(validation.valid).toBe(true);
    expect(validation.provenanceVerified).toBe(true);
    expect(validation.contentHash).toHaveLength(64);
    expect(validation.errors).toEqual([]);
    expect(validation.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'EXTENSION_REVIEWED_COMPATIBILITY_PROFILE',
        }),
        expect.objectContaining({ code: 'JS_API_FORBIDDEN_GLOBAL' }),
        expect.objectContaining({ code: 'JS_API_PRIVATE_MEMBER' }),
      ])
    );

    const spoofed = validateReviewedExtensionJavaScriptAuthoring({
      serializedExtension,
      registryHeader: { name: 'DifferentExtension', version: '1.2.3' },
    });
    expect(spoofed.valid).toBe(false);
    expect(spoofed.code).toBe('EXTENSION_STRICT_API_INCOMPATIBLE');
  });

  test('warns about syntax failures without blocking reviewed extensions', () => {
    const validation = validateReviewedExtensionJavaScriptAuthoring({
      serializedExtension: {
        name: 'Raycaster3D',
        eventsFunctions: [
          {
            name: 'Raycast',
            events: [
              {
                type: 'BuiltinCommonInstructions::JsCode',
                useStrict: true,
                inlineCode: 'const broken = ;',
              },
            ],
          },
        ],
        eventsBasedBehaviors: [],
        eventsBasedObjects: [],
      },
      registryHeader: { name: 'Raycaster3D', version: '2.0.0' },
    });

    expect(validation.valid).toBe(true);
    expect(validation.code).toBeUndefined();
    expect(validation.errors).toEqual([]);
    expect(validation.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'JS_API_SYNTAX_ERROR' }),
        expect.objectContaining({
          code: 'EXTENSION_REVIEWED_COMPATIBILITY_PROFILE',
        }),
      ])
    );
  });

  test('keeps installed store extension JavaScript warnings non-blocking during project validation', () => {
    const validation = validateProjectJavaScriptAuthoring({
      serializedProject: {
        ...serializedProject,
        eventsFunctionsExtensions: [
          {
            name: 'MousePointerLock',
            origin: {
              name: 'gdevelop-extension-store',
              identifier: 'MousePointerLock',
            },
            eventsFunctions: [],
            eventsBasedBehaviors: [],
            eventsBasedObjects: [],
          },
        ],
      },
      sourceFiles: {
        'game://extensions/MousePointerLock/functions/RequestPointerLock.events': `@js strict=true
document.body.requestPointerLock();
gdjs._MousePointerLockExtension.handler.requestPointerLock();
const broken = ;
@end js
`,
      },
    });

    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(validation.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'JS_API_FORBIDDEN_GLOBAL' }),
        expect.objectContaining({ code: 'JS_API_PRIVATE_MEMBER' }),
        expect.objectContaining({ code: 'JS_API_SYNTAX_ERROR' }),
        expect.objectContaining({
          code: 'EXTENSION_REVIEWED_COMPATIBILITY_PROFILE',
          provenance: expect.objectContaining({
            source: 'installed-gdevelop-extension-store',
            extensionNames: ['MousePointerLock'],
          }),
        }),
      ])
    );
  });

  test('does not trust a local extension or mismatched store origin during project validation', () => {
    const extensionSource = `@js strict=true
document.body.requestPointerLock();
@end js
`;
    const validateExtension = (extension: Object) =>
      validateProjectJavaScriptAuthoring({
        serializedProject: {
          ...serializedProject,
          eventsFunctionsExtensions: [extension],
        },
        sourceFiles: {
          'game://extensions/MousePointerLock/functions/RequestPointerLock.events': extensionSource,
        },
      });

    const localValidation = validateExtension({
      name: 'MousePointerLock',
      eventsFunctions: [],
      eventsBasedBehaviors: [],
      eventsBasedObjects: [],
    });
    const mismatchedOriginValidation = validateExtension({
      name: 'MousePointerLock',
      origin: {
        name: 'gdevelop-extension-store',
        identifier: 'DifferentExtension',
      },
      eventsFunctions: [],
      eventsBasedBehaviors: [],
      eventsBasedObjects: [],
    });

    expect(localValidation.valid).toBe(false);
    expect(mismatchedOriginValidation.valid).toBe(false);
    expect(localValidation.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'JS_API_FORBIDDEN_GLOBAL' }),
      ])
    );
    expect(mismatchedOriginValidation.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'JS_API_FORBIDDEN_GLOBAL' }),
      ])
    );
  });

  test('keeps strict scene JavaScript blocking when store extensions are installed', () => {
    const validation = validateProjectJavaScriptAuthoring({
      serializedProject: {
        ...serializedProject,
        eventsFunctionsExtensions: [
          {
            name: 'MousePointerLock',
            origin: {
              name: 'gdevelop-extension-store',
              identifier: 'MousePointerLock',
            },
            eventsFunctions: [],
            eventsBasedBehaviors: [],
            eventsBasedObjects: [],
          },
        ],
      },
      sourceFiles: {
        'game://scenes/Main/Main.events': `@js strict=true
document.body.requestPointerLock();
@end js
`,
      },
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'JS_API_FORBIDDEN_GLOBAL',
          fileUri: 'game://scenes/Main/Main.events',
        }),
      ])
    );
  });

  test('checks every JavaScript block with its own source and location', () => {
    const validation = validateProjectJavaScriptAuthoring({
      serializedProject,
      sourceFiles: {
        'game://scenes/Main/Main.events': `@js strict=true
runtimeScene.getObjects("Player");
@end js
@js strict=true
runtimeScene._instances.length;
@end js
`,
      },
    });
    expect(validation.blocks).toBe(2);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'JS_API_PRIVATE_MEMBER',
          line: 5,
        }),
      ])
    );
  });

  test('always blocks syntax errors and warns about unbounded loops', () => {
    const syntaxValidation = validateProjectJavaScriptAuthoring({
      serializedProject,
      sourceFiles: {
        'game://scenes/Main/Main.events': `@js
if (
@end js
`,
      },
    });
    expect(syntaxValidation.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'JS_API_SYNTAX_ERROR', line: 2 }),
      ])
    );

    const loopValidation = validateProjectJavaScriptAuthoring({
      serializedProject,
      sourceFiles: {
        'game://scenes/Main/Main.events': `@js strict=true
while (true) {}
@end js
`,
      },
    });
    expect(loopValidation.valid).toBe(true);
    expect(loopValidation.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'JS_API_PERFORMANCE_RISK' }),
      ])
    );
  });

  test('exposes eventsFunctionContext in extension and scene lifecycle function sources', () => {
    const functionValidation = validateProjectJavaScriptAuthoring({
      serializedProject,
      sourceFiles: {
        'game://extensions/Combat/functions/Damage.events': `@js strict=true
const amount = eventsFunctionContext.getArgument("Amount");
eventsFunctionContext.returnValue = typeof amount === "number" ? amount : 0;
@end js
`,
      },
    });
    expect(functionValidation.errors).toEqual([]);

    const lifecycleValidation = validateProjectJavaScriptAuthoring({
      serializedProject,
      sourceFiles: {
        'game://scenes/Main/functions/sceneSignal.events': `@js strict=true
const signalName = eventsFunctionContext.getArgument("SignalName");
if (typeof signalName === "string" && signalName.length > 0) runtimeScene.getElapsedTime();
@end js
`,
      },
    });
    expect(lifecycleValidation.errors).toEqual([]);

    const sceneValidation = validateProjectJavaScriptAuthoring({
      serializedProject,
      sourceFiles: {
        'game://scenes/Main/Main.events': `@js strict=true
eventsFunctionContext.returnValue = 1;
@end js
`,
      },
    });
    expect(sceneValidation.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'JS_API_UNKNOWN_MEMBER' }),
      ])
    );
  });
});
