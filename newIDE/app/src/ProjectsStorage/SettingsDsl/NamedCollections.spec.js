// @noflow
import {
  decodeSettingsDocument,
  serializeSettingsDocument,
  getSettingsSchemas,
} from '.';

test('parameters use names as nodes and preserve signature order including quoted names', () => {
  const source = `function {
 name = "TakeDamage"
 functionType = "Action"
 parameters {
   Target {
     type = "object"
     description = "Target object"
   }
   Amount {
     type = "expression"
   }
   "Display Name" {
     type = "string"
   }
 }
}`;
  const parsed = decodeSettingsDocument(source);
  expect(parsed.payload.parameters.map(p => p.name)).toEqual([
    'Target',
    'Amount',
    'Display Name',
  ]);
  const printed = serializeSettingsDocument('function', parsed.payload);
  expect(printed).toContain('parameters {');
  expect(printed).not.toContain('parameter {');
  expect(printed).not.toContain('name = "Target"');
  expect(decodeSettingsDocument(printed).payload).toEqual(parsed.payload);
});

test('property and shared property descriptors have separate named containers', () => {
  const source = `behavior {
 name = "Health"
 properties {
   maxHealth {
     type = "Number"
     value = "100"
     label = "Maximum health"
   }
 }
 shared_properties {
   DefaultHealth {
     type = "Number"
     value = "20"
   }
 }
}`;
  const parsed = decodeSettingsDocument(source);
  expect(parsed.payload.propertyDescriptors[0]).toMatchObject({
    name: 'maxHealth',
    type: 'Number',
    value: '100',
  });
  expect(parsed.payload.sharedPropertyDescriptors[0].name).toBe(
    'DefaultHealth'
  );
  expect(
    decodeSettingsDocument(
      serializeSettingsDocument('behavior', parsed.payload)
    ).payload
  ).toEqual(parsed.payload);
});

test.each([
  'parameter {\n name = "X"\n type = "expression"\n}',
  'parameters = []',
  'parameters {}\nparameters {}',
  'parameters {\n A {}\n A {}\n}',
  'parameters {\n A {\n name = "B"\n }\n}',
  'parameters {\n A = "expression"\n}',
])('rejects old and ambiguous parameter declarations: %s', body => {
  expect(() =>
    decodeSettingsDocument(`function {\n name = "F"\n${body}\n}`)
  ).toThrow();
});

test('empty named collections have a single canonical block representation', () => {
  expect(
    serializeSettingsDocument('function', { name: 'F', parameters: [] })
  ).toContain('parameters {');
  const schemas = getSettingsSchemas();
  expect(schemas.components.function.children.parameters).toMatchObject({
    named: true,
    key: 'parameters',
    maximum: 1,
  });
  expect(
    schemas.components.function.children.parameters.schema.fields.name
  ).toBeUndefined();
});

test('catalog distinguishes container fields from named member fields', () => {
  const schemas = getSettingsSchemas();
  const parameters = schemas.components.function.children.parameters.schema;
  expect(Object.keys(parameters.fields)).toEqual([]);
  expect(parameters.namedEntries).toMatchObject({ nameField: 'name' });
  expect(parameters.namedEntries.schema.fields.type).toBeDefined();
  expect(parameters.namedEntries.schema.fields.name).toBeUndefined();
  expect(
    schemas.variableSchemas.variables.namedEntries.declarationSchemaRef
  ).toBe('variableSchemas.variable');
  expect(schemas.variableSchemas.variable.fields.type.required).toBe(true);
  expect(schemas.variableSchemas.variables.dynamic).toBeUndefined();
});
