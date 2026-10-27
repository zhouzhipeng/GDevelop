// @noflow
import { appendSettingsEvents, compileSettingsEvents } from './Events';
import { parseLegacyEventsJson } from './EventModel';
import {
  buildProjectInstructionCatalog,
  createCatalogInstructionResolver,
  createCatalogInstructionFormatter,
} from './InstructionCatalog';
import {
  serializeToJSObject,
  unserializeFromJSObject,
} from '../../Utils/Serializer';
import { generateEventsCodeForScope } from '../../EventsSheet/GenerateEventsCode';

test('real engine generates identical picking, OR, child-JS and loop code after unified source round trip', () => {
  const gd = global.gd;
  const project = gd.ProjectHelper.createNewGDJSProject();
  const restored = gd.ProjectHelper.createNewGDJSProject();
  try {
    const layout = project.insertNewLayout('Main', 0);
    for (const name of ['Player', 'Enemy', 'Coin'])
      layout
        .getObjects()
        .insertNewObject(
          project,
          'Sprite',
          name,
          layout.getObjects().getObjectsCount()
        );
    const catalog = buildProjectInstructionCatalog(project);
    const orType = catalog.conditions.find(
      entry =>
        entry.type === 'Or' || entry.type === 'BuiltinCommonInstructions::Or'
    ).type;
    const options = {
      resolveInstruction: createCatalogInstructionResolver(catalog),
      formatInstruction: createCatalogInstructionFormatter(catalog),
    };
    const source = `function {
  name = "Test"
  events {
    group {
      name = "Picking"
      comment {
        text = "Parent selections are inherited by children."
      }
      event {
        conditions {
          ${orType} {
            CollisionNP first_object="Player" second_object="Enemy"
            CollisionNP first_object="Player" second_object="Coin"
          }
        }
        actions {
          Delete object="Coin"
        }
        event {
          type = "javascript"
          strict = true
          objects = "Player"
          code {
const pickedCount = objects.length;
if (pickedCount > 0) { objects[0].setX(42); }
          }
        }
      }
      event {
        type = "repeat"
        count = 2
        index = "i"
        actions {
          SetNumberVariable variable="Score" modification_sign="+" value=1
        }
      }
      event {
        conditions {
          NumberVariable variable="Score" comparison_sign=">=" value=100
        }
        actions {
          SetNumberVariable variable="Score" modification_sign="+" value=100
        }
      }
      event {
        type = "else"
        actions {
          SetNumberVariable variable="Score" modification_sign="+" value=3
        }
      }
      event {
        type = "while"
        infiniteLoopWarning = true
        while_conditions {
          NumberVariable variable="QueueSize" comparison_sign=">" value=0
        }
        actions {
          SetNumberVariable variable="QueueSize" modification_sign="-" value=1
          SetNumberVariable variable="Score" modification_sign="+" value=1
        }
      }
      event {
        type = "for_each"
        object = "Enemy"
        actions {
          SetNumberVariable variable="Score" modification_sign="+" value=1
        }
      }
      event {
        type = "for_each_child"
        iterable = "Inventory"
        index = "childIndex"
        value = "item"
        key = "itemKey"
        actions {
          SetNumberVariable variable="Score" modification_sign="+" value=1
        }
      }
    }
  }
}`;
    const model = serializeToJSObject(project);
    model.layouts[0].variables = [
      { name: 'Score', type: 'number', value: 0 },
      {
        name: 'Inventory',
        type: 'array',
        children: [1, 2, 3].map(value => ({ type: 'number', value })),
      },
      { name: 'QueueSize', type: 'number', value: 2 },
      { name: 'item', type: 'number', value: 0 },
      { name: 'itemKey', type: 'string', value: '' },
      { name: 'childIndex', type: 'number', value: 0 },
    ];
    model.layouts[0].events = compileSettingsEvents(source, options);
    unserializeFromJSObject(project, model);
    const nativeEvents = serializeToJSObject(project).layouts[0].events;
    const written = appendSettingsEvents(
      'function {\n name = "Test"\n}\n',
      nativeEvents,
      options
    );
    expect(written).not.toContain('metadata {');
    const decoded = compileSettingsEvents(written, options);
    expect(parseLegacyEventsJson(JSON.stringify(decoded))).toEqual(
      parseLegacyEventsJson(JSON.stringify(nativeEvents))
    );
    const reconstructed = serializeToJSObject(project);
    reconstructed.layouts[0].events = decoded;
    unserializeFromJSObject(restored, reconstructed);
    const before = generateEventsCodeForScope(project, {
      layout: project.getLayoutAt(0),
    });
    const after = generateEventsCodeForScope(restored, {
      layout: restored.getLayoutAt(0),
    });
    expect(before.error).toBeNull();
    expect(after.error).toBeNull();
    expect(before.code.length).toBeGreaterThan(500);
    // The engine names JS callbacks after native heap addresses. Normalize only
    // those generated identifiers, preserving distinct callbacks and all logic.
    const stableCode = code => {
      const names = new Map();
      return code.replace(/userFunc0x[0-9a-f]+/g, name => {
        if (!names.has(name)) names.set(name, `userFunc${names.size}`);
        return names.get(name);
      });
    };
    expect(stableCode(after.code)).toBe(stableCode(before.code));
    if (process.env.GDEVELOP_UNIFIED_RUNTIME_FIXTURE) {
      // The opt-in headless-runtime runner consumes exactly this generated code.
      require('fs').writeFileSync(
        process.env.GDEVELOP_UNIFIED_RUNTIME_FIXTURE,
        `window.__unifiedSettingsGeneratedCode = ${JSON.stringify(
          after.code
        )};\nwindow.__unifiedSettingsVariables = ${JSON.stringify(
          reconstructed.layouts[0].variables
        )};\n`
      );
    }
    // eslint-disable-next-line no-new-func -- Parse generated code without executing it.
    expect(() => new Function('gdjs', after.code)).not.toThrow();
  } finally {
    project.delete();
    restored.delete();
  }
});

// These fixtures are executed by scripts/test-unified-settings-runtime.cjs.
// Each case reaches its event list once, so frame repetition cannot hide a
// mistaken action/instance cardinality assumption.
test('generates native cardinality fixtures and checks their static contracts', () => {
  const { analyzeGdlEvents } = require('../../EventsSemantics/AnalyzeEvents');
  const fixtures = [];
  const project = global.gd.ProjectHelper.createNewGDJSProject();
  try {
    const scene = project.insertNewLayout('Main', 0);
    ['Player', 'Coin', 'Enemy'].forEach(name =>
      scene
        .getObjects()
        .insertNewObject(
          project,
          'Sprite',
          name,
          scene.getObjects().getObjectsCount()
        )
    );
    const catalog = buildProjectInstructionCatalog(project);
    const options = {
      resolveInstruction: createCatalogInstructionResolver(catalog),
    };
    const objectArgument = type =>
      catalog.actions
        .find(entry => entry.type === type)
        .parameters.find(parameter => parameter.valueKind === 'object').dslName;
    const collision = 'CollisionNP first_object="Player" second_object="Coin"';
    const score =
      'SetNumberVariable variable="Score" modification_sign="+" value=1';
    const picked = 'conditions {\n' + collision + '\n}\n';
    const cases = [
      {
        name: 'multi-delete-single-score',
        body: `event {\n${picked}actions {\nDelete object="Coin"\n${score}\n}\n}`,
        coins: 1,
        score: 1,
        advisory: true,
      },
      {
        name: 'post-filter-for-each',
        body: `event {\n${picked}event {\ntype = "for_each"\nobject = "Coin"\nactions {\nDelete object="Coin"\n${score}\n}\n}\n}`,
        coins: 1,
        score: 2,
        advisory: false,
      },
      {
        name: 'repick-all-after-filter',
        body: `event {\n${picked}actions {\nPickAllInstances ${objectArgument(
          'PickAllInstances'
        )}="Coin"\nDelete object="Coin"\n${score}\n}\n}`,
        coins: 0,
        score: 1,
        advisory: true,
      },
      {
        name: 'random-current-selection',
        body: `event {\n${picked}actions {\nPickRandomInstance ${objectArgument(
          'PickRandomInstance'
        )}="Coin"\nDelete object="Coin"\n${score}\n}\n}`,
        coins: 2,
        score: 1,
        advisory: false,
      },
      {
        name: 'sibling-selection-reset',
        body: `event {\n${picked}}\nevent {\nactions {\nDelete object="Coin"\n}\n}`,
        coins: 0,
        score: 0,
        advisory: false,
      },
      {
        name: 'selected-js-versus-container',
        body: `event {\n${picked}event {\ntype = "javascript"\nobjects = "Coin"\ncode {\nruntimeScene.getVariables().get("Score").setNumber(objects.length);\nruntimeScene.getVariables().get("AllCoins").setNumber(runtimeScene.getObjects("Coin").length);\n}\n}\n}`,
        coins: 3,
        score: 2,
        allCoins: 3,
        advisory: false,
      },
    ];
    for (const fixture of cases) {
      const source = `function {\nname = "sceneUpdate"\nevents {\n${
        fixture.body
      }\n}\n}\n`;
      const analysis = analyzeGdlEvents({
        source,
        catalog,
        owner: {
          kind: 'scene',
          functionName: 'sceneUpdate',
          variables: { Score: 'scene' },
        },
        symbols: {
          Player: { id: 'Player' },
          Coin: { id: 'Coin' },
          Enemy: { id: 'Enemy' },
        },
      });
      expect(analysis.success).toBe(true);
      expect(
        analysis.diagnostics.some(
          item => item.code === 'GDL_MULTI_SELECTION_SINGLE_EFFECT'
        )
      ).toBe(fixture.advisory);
      const model = serializeToJSObject(project);
      model.layouts[0].variables = [
        { name: 'Score', type: 'number', value: 0 },
      ];
      model.layouts[0].events = compileSettingsEvents(source, options);
      unserializeFromJSObject(project, model);
      const generated = generateEventsCodeForScope(project, {
        layout: project.getLayoutAt(0),
      });
      expect(generated.error).toBeNull();
      fixtures.push({ ...fixture, code: generated.code });
    }
    if (process.env.GDEVELOP_UNIFIED_RUNTIME_FIXTURE)
      require('fs').appendFileSync(
        process.env.GDEVELOP_UNIFIED_RUNTIME_FIXTURE,
        `window.__gdlSemanticsFixtures = ${JSON.stringify(fixtures)};\n`
      );
  } finally {
    project.delete();
  }
});
