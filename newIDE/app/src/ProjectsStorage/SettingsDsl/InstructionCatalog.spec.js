// @flow

import { appendSettingsEvents, compileSettingsEvents } from './Events';
import { parseLegacyEventsJson } from './EventModel';
import {
  buildProjectDeprecatedInstructionCatalog,
  buildProjectInstructionCatalog,
  buildLegacyInstructionCatalogDelta,
  createCatalogInstructionFormatter,
  createCatalogInstructionResolver,
  getCatalogCodeOnlyParameterIndicesByType,
  mergeProjectInstructionCatalogs,
  normalizeLegacyProjectInstructionParameters,
  serializeProjectInstructionCatalog,
  validateProjectInstructionCatalog,
} from './InstructionCatalog';
import { enumerateAllInstructions } from '../../InstructionOrExpression/EnumerateInstructions';
import { enumerateAllExpressions } from '../../InstructionOrExpression/EnumerateExpressions';
import { normalizeInstructionParameterDslName } from '../../Mcp/McpEventKnowledge';

const compileSettingsJson = (source, options) =>
  JSON.stringify(compileSettingsEvents(source, options));
const serializeEventDocument = (json, options) =>
  appendSettingsEvents('function {}\n', JSON.parse(json), options);
const areLegacyEventsEquivalent = (left, right) =>
  JSON.stringify(parseLegacyEventsJson(left)) ===
  JSON.stringify(parseLegacyEventsJson(right));

const catalogFixture = {
  format: 'gdevelop-settings-instruction-catalog',
  formatVersion: 3,
  actions: [
    {
      type: 'Network::Send',
      parameters: [
        {
          dslName: 'url',
          type: 'string',
          valueKind: 'text',
          isOptional: false,
          isCodeOnly: false,
        },
        {
          dslName: 'body',
          type: 'string',
          valueKind: 'text',
          isOptional: false,
          isCodeOnly: false,
        },
        {
          dslName: 'runtime',
          type: 'currentScene',
          isOptional: false,
          isCodeOnly: true,
        },
      ],
    },
  ],
  conditions: [
    {
      type: 'Network::Succeeded',
      parameters: [
        {
          dslName: 'request_id',
          type: 'identifier',
          valueKind: 'name',
          isOptional: false,
          isCodeOnly: false,
        },
      ],
    },
  ],
  expressions: [],
};

describe('project Settings instruction catalog', () => {
  test('requires the semantic version 3 catalog without authoring prose', () => {
    expect(() =>
      validateProjectInstructionCatalog({
        ...catalogFixture,
        formatVersion: 1,
      })
    ).toThrow('expected version 3');
    expect(() =>
      validateProjectInstructionCatalog({
        ...catalogFixture,
        authoring: { rules: [] },
      })
    ).toThrow('must not contain authoring prose');
  });

  test('normalizes digit-leading parameter names into valid DSL identifiers', () => {
    expect(normalizeInstructionParameterDslName('3d_capability', 1)).toBe(
      'parameter_3d_capability'
    );
    expect(normalizeInstructionParameterDslName('object', 0)).toBe('object');
  });

  test('rejects catalog parameter names that the DSL cannot parse', () => {
    expect(() =>
      validateProjectInstructionCatalog({
        ...catalogFixture,
        actions: [
          {
            type: 'Invalid::Action',
            parameters: [{ dslName: '3d_capability' }],
          },
        ],
      })
    ).toThrow('invalid parameter');
  });

  test('round-trips an instruction whose displayed parameter starts with a digit', () => {
    const digitParameterCatalog = {
      ...catalogFixture,
      actions: [
        {
          type: 'FireBullet::RotateObject',
          parameters: [
            {
              dslName: normalizeInstructionParameterDslName('3d_capability', 0),
              type: 'object',
              valueKind: 'object',
            },
          ],
        },
      ],
    };
    const input = JSON.stringify([
      {
        type: 'BuiltinCommonInstructions::Standard',
        conditions: [],
        actions: [
          {
            type: { value: 'FireBullet::RotateObject' },
            parameters: ['Object3D'],
          },
        ],
      },
    ]);
    const dsl = serializeEventDocument(input, {
      formatInstruction: createCatalogInstructionFormatter(
        digitParameterCatalog
      ),
    });

    expect(dsl).toContain('parameter_3d_capability="Object3D"');
    expect(
      areLegacyEventsEquivalent(
        input,
        compileSettingsJson(dsl, {
          resolveInstruction: createCatalogInstructionResolver(
            digitParameterCatalog
          ),
        })
      )
    ).toBe(true);
  });

  test('compiles named catalog instructions with semantic operands', () => {
    const source =
      'function {\n events {\n event {\n conditions {\n Network::Succeeded request_id="RequestId"\n }\n actions {\n Network::Send url="https://example.com" body=expr(VariableString(Payload))\n }\n }\n }\n }\n';
    const output = compileSettingsEvents(source, {
      resolveInstruction: createCatalogInstructionResolver(catalogFixture),
    });
    expect(output[0].conditions[0].parameters).toEqual(['RequestId']);
    expect(output[0].actions[0].parameters).toEqual([
      '"https://example.com"',
      'VariableString(Payload)',
      '',
    ]);
  });

  test('omits empty legacy operands without encoding them as typed values', () => {
    const input = JSON.stringify([
      {
        type: 'BuiltinCommonInstructions::Standard',
        conditions: [],
        actions: [
          {
            type: { value: 'Network::Send' },
            parameters: ['', '"payload"', 'legacy runtime data'],
          },
        ],
      },
    ]);
    const dsl = serializeEventDocument(input, {
      formatInstruction: createCatalogInstructionFormatter(catalogFixture),
    });

    expect(dsl).toContain('Network::Send body="payload"');
    expect(dsl).not.toContain('url=');
    expect(dsl).not.toContain('legacy runtime data');
    expect(
      JSON.parse(
        compileSettingsJson(dsl, {
          resolveInstruction: createCatalogInstructionResolver(catalogFixture),
        })
      )[0].actions[0].parameters
    ).toEqual(['', '"payload"', '']);
    expect(getCatalogCodeOnlyParameterIndicesByType(catalogFixture)).toEqual({
      'Network::Send': [2],
    });
  });

  test('normalizes parameters that cannot be represented by a catalog signature', () => {
    const normalizationCatalog = {
      ...catalogFixture,
      actions: [
        ...catalogFixture.actions,
        {
          type: 'Property::Set',
          parameters: [
            { dslName: 'object', type: 'object', valueKind: 'object' },
            {
              dslName: 'operator',
              type: 'operator',
              valueKind: 'name',
              acceptedValues: ['=', '+'],
            },
            { dslName: 'value', type: 'string', valueKind: 'text' },
          ],
        },
      ],
      conditions: [
        ...catalogFixture.conditions,
        {
          type: 'SceneBool',
          parameters: [
            { dslName: 'variable', type: 'scenevar', valueKind: 'variable' },
            {
              dslName: 'check',
              type: 'trueorfalse',
              valueKind: 'boolean',
            },
          ],
        },
      ],
    };
    const normalized = normalizeLegacyProjectInstructionParameters(
      {
        layouts: [
          {
            events: [
              {
                actions: [
                  {
                    type: { value: 'Network::Send' },
                    parameters: [
                      '"url"',
                      'ToString(\r\n  Variable(Value), \r\n)',
                      'stale runtime data',
                      'removed parameter',
                    ],
                  },
                  {
                    type: { value: 'Property::Set' },
                    parameters: ['Object', 'GetArgumentAsString("Color")'],
                  },
                ],
                whileConditions: [
                  {
                    type: { value: 'SceneBool' },
                    parameters: ['Flag', 'shouldBreakTheLoop'],
                  },
                ],
              },
            ],
          },
        ],
      },
      normalizationCatalog
    );

    expect(normalized.layouts[0].events[0].actions[0].parameters).toEqual([
      '"url"',
      'ToString(\nVariable(Value),\n)',
      '',
    ]);
    expect(normalized.layouts[0].events[0].actions[1].parameters).toEqual([
      'Object',
      '=',
      'GetArgumentAsString("Color")',
    ]);
    expect(
      normalized.layouts[0].events[0].whileConditions[0].parameters
    ).toEqual(['Flag', '']);
  });

  test('infers semantic signatures for legacy instructions absent from metadata', () => {
    const input = JSON.stringify([
      {
        type: 'BuiltinCommonInstructions::Standard',
        conditions: [],
        actions: [
          {
            type: { value: 'Removed::Action' },
            parameters: [
              'Object',
              'Object.PointX("Center")',
              '"Checkpoint"',
              '',
            ],
          },
        ],
      },
    ]);
    const delta = buildLegacyInstructionCatalogDelta(
      catalogFixture,
      JSON.parse(input)
    );
    const catalog = mergeProjectInstructionCatalogs(catalogFixture, delta);
    const dsl = serializeEventDocument(input, {
      formatInstruction: createCatalogInstructionFormatter(catalog),
    });

    expect(dsl).toContain('parameter_0="Object"');
    expect(dsl).toContain('parameter_1=expr(Object.PointX("Center"))');
    expect(dsl).toContain('parameter_2="Checkpoint"');
    expect(dsl).not.toContain('\\"');
    expect(
      areLegacyEventsEquivalent(
        input,
        compileSettingsJson(dsl, {
          resolveInstruction: createCatalogInstructionResolver(catalog),
        })
      )
    ).toBe(true);
  });

  test('rejects operands that do not match the catalog valueKind', () => {
    const typedCatalog = {
      ...catalogFixture,
      actions: [
        {
          type: 'Typed::Action',
          parameters: [
            { dslName: 'count', type: 'number', valueKind: 'number' },
            { dslName: 'object', type: 'object', valueKind: 'object' },
            { dslName: 'runtime', type: 'currentScene', isCodeOnly: true },
          ],
        },
      ],
    };
    const compile = (source: string): string =>
      compileSettingsJson(source, {
        resolveInstruction: createCatalogInstructionResolver(typedCatalog),
      });

    expect(() =>
      compile(
        'function {\n\n  events {\n\n    event {\n\n      actions {\n\n        Typed::Action count="1" object="Enemy"\n      }\n    }\n  }\n}\n'
      )
    ).toThrow('expects a semantic number');
    expect(() =>
      compile(
        'function {\n\n  events {\n\n    event {\n\n      actions {\n\n        Typed::Action count=1 object=expr("Enemy")\n      }\n    }\n  }\n}\n'
      )
    ).toThrow('does not accept expr(...)');
    expect(() =>
      compile(
        'function {\n\n  events {\n\n    event {\n\n      actions {\n\n        Typed::Action count=1 object="Enemy" runtime="scene"\n      }\n    }\n  }\n}\n'
      )
    ).toThrow('code-only and must be omitted');
  });

  test('scans nested calculated expressions without exposing raw operands', () => {
    const output = JSON.parse(
      compileSettingsJson(
        'function {\n\n  events {\n\n    event {\n\n      actions {\n\n        Network::Send url="https://example.com" body=expr(ToString(Max(Variable(A), Variable(B))))\n      }\n    }\n  }\n}\n',
        { resolveInstruction: createCatalogInstructionResolver(catalogFixture) }
      )
    );
    expect(output[0].actions[0].parameters[1]).toBe(
      'ToString(Max(Variable(A), Variable(B)))'
    );
    expect(() =>
      compileSettingsJson(
        'function {\n events {\n event {\n actions {\n Network::Send url="https://example.com" body=expr()\n}\n}\n}\n}\n',
        { resolveInstruction: createCatalogInstructionResolver(catalogFixture) }
      )
    ).toThrow('cannot be empty');
    expect(
      JSON.parse(
        compileSettingsJson(
          'function {\n\n  events {\n\n    event {\n\n      actions {\n\n        Network::Send url="https://example.com" body=expr(ToString(\nMax(Variable(A), Variable(B))\n))\n      }\n    }\n  }\n}\n',
          {
            resolveInstruction: createCatalogInstructionResolver(
              catalogFixture
            ),
          }
        )
      )[0].actions[0].parameters[1]
    ).toContain('Max(Variable(A), Variable(B))');
    expect(
      JSON.parse(
        compileSettingsJson(
          'function {\n\n  events {\n\n    event {\n\n      actions {\n\n        Network::Send url="https://example.com" body=expr("first line\nsecond line")\n      }\n    }\n  }\n}\n',
          {
            resolveInstruction: createCatalogInstructionResolver(
              catalogFixture
            ),
          }
        )
      )[0].actions[0].parameters[1]
    ).toBe('"first line\nsecond line"');
  });

  test('writes empty text and calculated text without nested operand quoting', () => {
    const textCatalog = {
      ...catalogFixture,
      actions: [
        {
          type: 'Text::Set',
          parameters: [
            {
              dslName: 'text',
              type: 'string',
              valueKind: 'text',
            },
          ],
        },
      ],
    };
    const input = JSON.stringify([
      {
        type: 'BuiltinCommonInstructions::Standard',
        conditions: [],
        actions: [
          { type: { value: 'Text::Set' }, parameters: ['""'] },
          {
            type: { value: 'Text::Set' },
            parameters: ['"Score: " + ToString(Variable(Score))'],
          },
        ],
      },
    ]);
    const dsl = serializeEventDocument(input, {
      formatInstruction: createCatalogInstructionFormatter(textCatalog),
    });
    const output = compileSettingsJson(dsl, {
      resolveInstruction: createCatalogInstructionResolver(textCatalog),
    });

    expect(dsl).toContain('Text::Set text=""');
    expect(dsl).toContain(
      'Text::Set text=expr("Score: " + ToString(Variable(Score)))'
    );
    expect(dsl).not.toContain('\\"');
    expect(areLegacyEventsEquivalent(input, output)).toBe(true);
  });

  test('decompiles and recompiles catalog instructions without @exact', () => {
    const input = JSON.stringify([
      {
        type: 'BuiltinCommonInstructions::Standard',
        conditions: [
          {
            type: { value: 'Network::Succeeded' },
            parameters: ['RequestId'],
          },
        ],
        actions: [
          {
            type: { value: 'Network::Send' },
            parameters: ['"https://example.com"', 'Variable(Payload)', ''],
          },
        ],
      },
    ]);
    const dsl = serializeEventDocument(input, {
      formatInstruction: createCatalogInstructionFormatter(catalogFixture),
    });
    const output = compileSettingsJson(dsl, {
      resolveInstruction: createCatalogInstructionResolver(catalogFixture),
    });

    expect(dsl).toContain('Network::Succeeded request_id="RequestId"');
    expect(dsl).toContain('Network::Send');
    expect(dsl).not.toContain('runtime=');
    expect(dsl).not.toContain('@exact');
    expect(areLegacyEventsEquivalent(input, output)).toBe(true);
  });

  test('quotes and round-trips an exact instruction type containing whitespace', () => {
    const spacedTypeCatalog = {
      ...catalogFixture,
      actions: [
        {
          type: 'Physics2::Remove joint',
          parameters: [
            { dslName: 'object', type: 'object', valueKind: 'object' },
            {
              dslName: 'behavior',
              type: 'behavior',
              valueKind: 'behavior',
            },
            { dslName: 'joint_id', type: 'number', valueKind: 'number' },
          ],
        },
      ],
    };
    const input = JSON.stringify([
      {
        type: 'BuiltinCommonInstructions::Standard',
        conditions: [],
        actions: [
          {
            type: { value: 'Physics2::Remove joint' },
            parameters: ['Object', 'PhysicsBehavior', '12'],
          },
        ],
      },
    ]);
    const dsl = serializeEventDocument(input, {
      formatInstruction: createCatalogInstructionFormatter(spacedTypeCatalog),
    });
    const output = compileSettingsJson(dsl, {
      resolveInstruction: createCatalogInstructionResolver(spacedTypeCatalog),
    });

    expect(dsl).toContain('"Physics2::Remove joint"');
    expect(dsl).not.toContain('@exact');
    expect(areLegacyEventsEquivalent(input, output)).toBe(true);
  });

  test('round-trips the real Physics2 spaced instruction type used by templates', () => {
    const gd: libGDevelop = global.gd;
    // $FlowFixMe[cannot-resolve-module] The extension is loaded by the app in production.
    const physics2ExtensionModule = require('../../../../../Extensions/Physics2Behavior/JsExtension');
    const physics2Extension = physics2ExtensionModule.createExtension(
      message => message,
      gd
    );
    gd.JsPlatform.get().addNewExtension(physics2Extension);
    physics2Extension.delete();
    const project = gd.ProjectHelper.createNewGDJSProject();
    try {
      const authoringCatalog = buildProjectInstructionCatalog(project);
      const deprecatedCatalog = buildProjectDeprecatedInstructionCatalog(
        project
      );
      const completeCatalog = mergeProjectInstructionCatalogs(
        authoringCatalog,
        deprecatedCatalog
      );
      const instruction = completeCatalog.actions.find(
        ({ type }) => type === 'Physics2::Remove joint'
      );
      expect(instruction).toBeDefined();
      const input = JSON.stringify([
        {
          type: 'BuiltinCommonInstructions::Standard',
          conditions: [],
          actions: [
            {
              type: { value: 'Physics2::Remove joint' },
              parameters: ['Object', 'PhysicsBehavior', 'MouseJointID'],
            },
          ],
        },
      ]);
      const dsl = serializeEventDocument(input, {
        formatInstruction: createCatalogInstructionFormatter(completeCatalog),
      });
      const output = compileSettingsJson(dsl, {
        resolveInstruction: createCatalogInstructionResolver(completeCatalog),
      });

      expect(dsl).toContain('"Physics2::Remove joint"');
      expect(dsl).not.toContain('@exact');
      expect(areLegacyEventsEquivalent(input, output)).toBe(true);
    } finally {
      project.delete();
      gd.JsPlatform.get().removeExtension('Physics2');
    }
  });

  test('rejects the removed @ catalog prefix', () => {
    expect(() =>
      compileSettingsJson(
        'function {\n events {\n event {\n actions {\n @Network::Send url="x" body="y"\n}\n}\n}\n}\n',
        {
          resolveInstruction: createCatalogInstructionResolver(catalogFixture),
        }
      )
    ).toThrow('Expected a node, property, or value');
  });

  test('generates a deterministic complete catalog from the loaded platform', () => {
    const gd: libGDevelop = global.gd;
    const project = gd.ProjectHelper.createNewGDJSProject();
    const catalog = buildProjectInstructionCatalog(project);
    const deprecatedCatalog = buildProjectDeprecatedInstructionCatalog(project);
    const serializationCatalog = mergeProjectInstructionCatalogs(
      catalog,
      deprecatedCatalog
    );
    const serialized = serializeProjectInstructionCatalog(catalog);
    const deprecatedActionTypes = new Set(
      enumerateAllInstructions(false, project, (null: any), {
        includeHiddenAndCompatibility: true,
      })
        .filter(
          ({ metadata }) =>
            metadata.isHidden() || !!metadata.getDeprecationMessage()
        )
        .map(({ type }) => type)
    );
    const deprecatedConditionTypes = new Set(
      enumerateAllInstructions(true, project, (null: any), {
        includeHiddenAndCompatibility: true,
      })
        .filter(
          ({ metadata }) =>
            metadata.isHidden() || !!metadata.getDeprecationMessage()
        )
        .map(({ type }) => type)
    );
    const deprecatedExpressionKeys = new Set(
      enumerateAllExpressions('', project, (null: any))
        .filter(
          ({ metadata }) =>
            !metadata.isShown() ||
            metadata.isDeprecated() ||
            !!metadata.getDeprecationMessage()
        )
        .map(({ type, metadata }) => `${type}\u0000${metadata.getReturnType()}`)
    );

    expect(catalog.counts.actions).toBeGreaterThan(100);
    expect(catalog.counts.conditions).toBeGreaterThan(100);
    expect(catalog.counts.expressions).toBeGreaterThan(100);
    const resetTimer = catalog.actions.find(
      ({ type }) => type === 'ResetTimer'
    );
    expect(resetTimer).toBeDefined();
    const resetTimerHint = resetTimer.parameters.find(({ hint }) => hint).hint;
    expect(resetTimerHint).toBe(
      'Scene timers must be started (for example, with the ResetTimer action) ' +
        'before being used. They are scene-wide and should not be (re)started ' +
        'at each frame, otherwise they keep restarting.'
    );
    expect(resetTimerHint).not.toContain('"');
    expect(
      deprecatedActionTypes.size + deprecatedConditionTypes.size
    ).toBeGreaterThan(0);
    expect(
      catalog.actions.some(({ type }) => deprecatedActionTypes.has(type))
    ).toBe(false);
    expect(
      catalog.conditions.some(({ type }) => deprecatedConditionTypes.has(type))
    ).toBe(false);
    expect(
      catalog.expressions.some(({ type, returnType }) =>
        deprecatedExpressionKeys.has(`${type}\u0000${returnType}`)
      )
    ).toBe(false);
    expect(
      serializationCatalog.actions.some(({ type }) =>
        deprecatedActionTypes.has(type)
      ) ||
        serializationCatalog.conditions.some(({ type }) =>
          deprecatedConditionTypes.has(type)
        )
    ).toBe(true);
    expect(
      deprecatedCatalog.actions.some(({ type }) =>
        catalog.actions.some(entry => entry.type === type)
      )
    ).toBe(false);
    expect(
      deprecatedCatalog.conditions.some(({ type }) =>
        catalog.conditions.some(entry => entry.type === type)
      )
    ).toBe(false);
    expect(deprecatedCatalog.authoring).toBeUndefined();
    expect(
      [...catalog.actions, ...catalog.conditions, ...catalog.expressions].some(
        entry => entry.deprecationMessage !== undefined
      )
    ).toBe(false);
    expect(
      catalog.actions.some(({ type }) => type === 'TextObject::String')
    ).toBe(false);
    expect(
      catalog.conditions.some(({ type }) => type === 'TextObject::String')
    ).toBe(false);
    expect(
      catalog.expressions.some(({ type }) => type === 'TextObject::String')
    ).toBe(false);
    expect(catalog.formatVersion).toBe(3);
    expect(catalog.authoring).toBeUndefined();
    expect(serialized).not.toContain('"authoring"');
    expect(serialized).not.toContain('serialized operand');
    expect(serialized).not.toContain('embedded quotes');
    expect(
      [...catalog.actions, ...catalog.conditions, ...catalog.expressions].some(
        entry => entry.kind !== undefined
      )
    ).toBe(false);
    expect(
      [...catalog.actions, ...catalog.conditions, ...catalog.expressions].some(
        entry =>
          entry.parameters.some(parameter => parameter.index !== undefined)
      )
    ).toBe(false);
    expect(
      [...catalog.actions, ...catalog.conditions, ...catalog.expressions].every(
        entry =>
          entry.parameters.every(
            parameter =>
              parameter.isCodeOnly ||
              [
                'text',
                'number',
                'boolean',
                'object',
                'behavior',
                'variable',
                'resource',
                'name',
              ].includes(parameter.valueKind)
          )
      )
    ).toBe(true);
    const sceneInput = JSON.stringify([
      {
        type: 'BuiltinCommonInstructions::Standard',
        conditions: [
          {
            type: { value: 'SceneJustBegins' },
            parameters: [''],
          },
        ],
        actions: [],
      },
    ]);
    const sceneDsl = serializeEventDocument(sceneInput, {
      formatInstruction: createCatalogInstructionFormatter(catalog),
    });
    expect(sceneDsl).toContain('SceneJustBegins');
    expect(sceneDsl).not.toContain('scene begins');
    expect(sceneDsl).not.toContain('parameter_0=');
    expect(
      areLegacyEventsEquivalent(
        sceneInput,
        compileSettingsJson(sceneDsl, {
          resolveInstruction: createCatalogInstructionResolver(catalog),
        })
      )
    ).toBe(true);
    expect(
      catalog.actions.some(entry => entry.type === 'SetNumberVariable')
    ).toBe(true);
    const setTextEntry = catalog.actions.find(
      entry =>
        entry.type ===
        'TextContainerCapability::TextContainerBehavior::SetValue'
    );
    expect(setTextEntry).toBeDefined();
    expect(
      setTextEntry.parameters.map(parameter => parameter.valueKind)
    ).toEqual(['object', 'behavior', 'name', 'text']);
    const emptyTextInput = JSON.stringify([
      {
        type: 'BuiltinCommonInstructions::Standard',
        conditions: [],
        actions: [
          {
            type: {
              value: 'TextContainerCapability::TextContainerBehavior::SetValue',
            },
            parameters: ['MessageText', 'Text', '=', '""'],
          },
        ],
      },
    ]);
    const emptyTextDsl = serializeEventDocument(emptyTextInput, {
      formatInstruction: createCatalogInstructionFormatter(catalog),
    });
    expect(emptyTextDsl).toContain('text=""');
    expect(emptyTextDsl).not.toContain('\\"');
    expect(
      areLegacyEventsEquivalent(
        emptyTextInput,
        compileSettingsJson(emptyTextDsl, {
          resolveInstruction: createCatalogInstructionResolver(catalog),
        })
      )
    ).toBe(true);
    const collisionEntry = catalog.conditions.find(
      entry => entry.type === 'CollisionNP'
    );
    expect(collisionEntry).toBeDefined();
    if (!collisionEntry) throw new Error('CollisionNP catalog entry missing.');
    const optionalCollisionParameter = collisionEntry.parameters[4];
    expect(optionalCollisionParameter).toMatchObject({
      type: 'yesorno',
      valueKind: 'boolean',
      isOptional: true,
      defaultValue: false,
    });
    const omittedCollisionDefaultInput = JSON.stringify([
      {
        type: 'BuiltinCommonInstructions::Standard',
        conditions: [
          {
            type: { value: 'CollisionNP' },
            parameters: ['Player', 'Platform', ''],
          },
        ],
        actions: [],
      },
    ]);
    const omittedCollisionDefaultDsl = serializeEventDocument(
      omittedCollisionDefaultInput,
      {
        formatInstruction: createCatalogInstructionFormatter(catalog),
      }
    );
    expect(omittedCollisionDefaultDsl).toContain(
      'CollisionNP first_object="Player" second_object="Platform"'
    );
    expect(omittedCollisionDefaultDsl).not.toContain(
      `${optionalCollisionParameter.dslName}=`
    );
    const normalizedCollisionDefaultOutput = JSON.parse(
      compileSettingsJson(omittedCollisionDefaultDsl, {
        resolveInstruction: createCatalogInstructionResolver(catalog),
      })
    );
    expect(
      normalizedCollisionDefaultOutput[0].conditions[0].parameters
    ).toEqual(['Player', 'Platform', '', '', '']);
    const explicitCollisionDefaultOutput = JSON.parse(
      compileSettingsJson(
        `function {

  events {

    event {

      conditions {

        CollisionNP first_object="Player" second_object="Platform" ${
          optionalCollisionParameter.dslName
        }=false
      }
    }
  }
}
`,
        {
          resolveInstruction: createCatalogInstructionResolver(catalog),
        }
      )
    );
    expect(explicitCollisionDefaultOutput[0].conditions[0].parameters[4]).toBe(
      'no'
    );
    expect(
      catalog.conditions.some(entry => entry.type === 'SceneJustBegins')
    ).toBe(true);
    const compatibilityInput = JSON.stringify([
      {
        type: 'BuiltinCommonInstructions::Standard',
        conditions: [
          {
            type: { value: 'BooleanVariable' },
            parameters: ['Disabled', 'True', ''],
          },
          {
            type: { value: 'Egal' },
            parameters: ['Variable(Value)', '=', '1'],
          },
        ],
        actions: [
          {
            type: { value: 'MettreX' },
            parameters: ['Object', '+', '1'],
          },
          {
            type: { value: 'SetBooleanVariable' },
            parameters: ['Disabled', 'True', ''],
          },
        ],
      },
    ]);
    const compatibilityDsl = serializeEventDocument(compatibilityInput, {
      formatInstruction: createCatalogInstructionFormatter(
        serializationCatalog
      ),
    });
    expect(compatibilityDsl).not.toContain('@exact');
    expect(
      areLegacyEventsEquivalent(
        compatibilityInput,
        compileSettingsJson(compatibilityDsl, {
          resolveInstruction: createCatalogInstructionResolver(
            serializationCatalog
          ),
        })
      )
    ).toBe(true);
    expect(Array.isArray(catalog.actions[0].eventScopes)).toBe(true);
    expect(catalog.actions[0].iconFilename).toBeUndefined();
    expect(catalog.actions[0].parameterShape).toBeUndefined();
    expect(catalog.actions[0].parameters[0].valueType).toBeUndefined();
    expect(() =>
      validateProjectInstructionCatalog(JSON.parse(serialized))
    ).not.toThrow();
    expect(serialized.length).toBeLessThan(1000000);
    expect(serialized.split('\n').length).toBeGreaterThan(
      catalog.counts.actions +
        catalog.counts.conditions +
        catalog.counts.expressions
    );
    expect(serialized.endsWith('\n')).toBe(true);
    project.delete();
  });
});

test('unified operand diagnostics identify the exact argument value in the owning settings source', () => {
  const source =
    'function {\n events {\n event {\n actions {\n Network::Send url=42 body="payload"\n }\n }\n }\n}\n';
  try {
    compileSettingsEvents(
      source,
      { resolveInstruction: createCatalogInstructionResolver(catalogFixture) },
      'game://Test.gdl'
    );
    throw new Error('Expected invalid operand');
  } catch (failure) {
    expect(failure.code).toBe('SETTINGS_INSTRUCTION_ARGUMENT');
    expect(failure.fileUri).toBe('game://Test.gdl');
    expect(source.slice(failure.offset, failure.endOffset)).toBe('42');
  }
});
