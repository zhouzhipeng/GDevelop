// @noflow
import {
  decodeSettingsDocument,
  serializeSettingsDocument,
  registerSettingsTypes,
  resetSettingsTypes,
  getSettingsSchemas,
} from '.';
import { parseSettingsSyntax, printSettingsSyntax } from './Syntax';
import { compileSettingsEvents } from './Events';

beforeEach(() => {
  resetSettingsTypes();
  registerSettingsTypes({
    behaviorTypes: [{ type: 'Movement::Platform', properties: [] }],
  });
});

test('object and behavior types are symbols, while declaration names remain strings', () => {
  const source = `object {
  name = "玩家"
  type = Sprite
  behaviors {
    "移动" {
      type = Movement::Platform
    }
  }
}`;
  const document = decodeSettingsDocument(source);
  expect(document.payload).toMatchObject({
    name: '玩家',
    type: 'Sprite',
    behaviors: [{ name: '移动', type: 'Movement::Platform' }],
  });
  const written = serializeSettingsDocument('object', document.payload);
  expect(written).toContain('type = Sprite');
  expect(written).toContain('type = Movement::Platform');
  expect(decodeSettingsDocument(written).payload).toEqual(document.payload);
  expect(document.syntax.root.properties.type).toMatchObject({
    value: 'Sprite',
    reference: true,
  });
});

test.each([
  'object {\n name = "Player"\n type = "Sprite"\n}',
  'object {\n name = Player\n type = Sprite\n}',
  'object {\n name = "Player"\n type = Sprite\n behavior {\n name = "Move"\n type = "Movement::Platform"\n }\n}',
  'scene {\n name = "Main"\n instances {\n   instance {\n   object = "Player"\n   }\n }\n}',
  'scene {\n name = "Main"\n instances {\n   instance {\n   object = Player\n   behavior {\n   name = "Move"\n   }\n   }\n }\n}',
  'scene {\n name = "Main"\n objectGroups {\n Actors = ["Player"]\n }\n}',
  'scene {\n name = "Main"\n objectGroupRequiredBehaviors {\n Actors = ["Movement::Platform"]\n }\n}',
  'scene {\n name = "Main"\n variables {\n Text {\n type = "string"\n value = Player\n }\n }\n}',
  'scene {\n name = "Main"\n title = Player\n}',
  'object {\n name = "Player"\n type = Sprite + Other\n}',
])('rejects confusing strings, references and expressions: %s', source => {
  expect(() => decodeSettingsDocument(source)).toThrow();
});

test('layout references and ordered reference arrays survive model saves and formatting', () => {
  const source = `scene {
  name = "Main"
  objectGroups {
    Actors = [玩家, Enemy,]
  }
  objectGroupRequiredBehaviors {
    Actors = [Movement::Platform]
  }
  instances {
    instance {
      id = "ef3ef49d-f20f-4450-b373-0ce43291a002"
      layer = "base"
      position = [0, 0]
      object = 玩家
      behaviors {
        移动 {
        }
      }
    }
  }
}`;
  const document = decodeSettingsDocument(source);
  const { layout, ...payload } = document.payload;
  const written = serializeSettingsDocument('scene', payload, layout);
  expect(written).toContain('Actors = [玩家, Enemy]');
  expect(written).toContain('Actors = [Movement::Platform]');
  expect(written).toContain('object = 玩家');
  expect(written).toContain('"移动" {');
  expect(decodeSettingsDocument(written).payload).toEqual(document.payload);
  const syntax = parseSettingsSyntax(source);
  const formatted = printSettingsSyntax(syntax.root);
  expect(printSettingsSyntax(parseSettingsSyntax(formatted).root)).toBe(
    formatted
  );
});

test('symbols retain source locations and cannot bypass event string or flag types', () => {
  const syntax = parseSettingsSyntax('object {\n  type = Sprite\n}');
  expect(syntax.root.properties.type.location).toMatchObject({
    line: 2,
    column: 10,
    endColumn: 16,
  });
  for (const body of [
    'group {\n name = Player\n}',
    'event {\n disabled = Player\n}',
    'comment {\n text = Player\n}',
    'javascript {\n code = Player\n}',
  ])
    expect(() =>
      compileSettingsEvents(`function {\n events {\n${body}\n }\n}`)
    ).toThrow();
});

test('catalog schemas publish distinct object, behavior and type references', () => {
  const schemas = getSettingsSchemas();
  expect(schemas.components.object.fields.type.type).toBe(
    'object type reference'
  );
  expect(
    schemas.components.object.children.behaviors.schema.namedEntries.schema
      .fields.type.type
  ).toBe('behavior type reference');
  expect(schemas.layout.instance.fields.object.type).toBe('object reference');
  expect(schemas.layout.behavior.fields.name.type).toBe('behavior reference');
});

test('parameter restrictions distinguish type symbols from ordinary supplementary text', () => {
  const source = `function {
  name = "Move"
  parameters {
    Target {
      type = "object"
      supplementaryInformation = Sprite
    }
    Movement {
      type = "behavior"
      supplementaryInformation = Movement::Platform
    }
    Label {
      type = "string"
      supplementaryInformation = "Display Name"
    }
  }
}`;
  const document = decodeSettingsDocument(source);
  const written = serializeSettingsDocument('function', document.payload);
  expect(written).toContain('supplementaryInformation = Sprite');
  expect(written).toContain('supplementaryInformation = Movement::Platform');
  expect(written).toContain('supplementaryInformation = "Display Name"');
  expect(() =>
    decodeSettingsDocument(source.replace('= Sprite', '= "Sprite"'))
  ).toThrow('unquoted');
  expect(() =>
    decodeSettingsDocument(source.replace('= "Display Name"', '= Label'))
  ).toThrow('symbol reference');
});

test('JavaScript selection uses a symbol and numeric loop expressions can be single names', () => {
  const source = `function {
  events {
    repeat {
      count = Count
      javascript {
        objects = 玩家
        code = ""
      }
    }
  }
}`;
  const events = compileSettingsEvents(source);
  expect(events[0].repeatExpression).toBe('Count');
  expect(events[0].events[0].parameterObjects).toBe('玩家');
  expect(() =>
    compileSettingsEvents(source.replace('objects = 玩家', 'objects = "玩家"'))
  ).toThrow('unquoted');
});
