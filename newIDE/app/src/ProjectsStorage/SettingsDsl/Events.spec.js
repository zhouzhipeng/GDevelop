// @noflow
/* eslint-disable no-template-curly-in-string -- These strings are raw JavaScript fixtures. */
import { parseSettingsSyntax, printSettingsSyntax } from './Syntax';
import {
  appendSettingsEvents,
  compileSettingsEvents,
  extractSettingsJavaScriptBlocks,
  EVENT_TYPES,
  EVENT_SCHEMAS,
  EVENTS_CONTAINER_SCHEMA,
} from './Events';
const wrap = body => `function {\n name = "Test"\n events {\n${body}\n}\n}\n`;
const resolveInstruction = ({ kind, source }) => ({
  type: { value: source.split(' ')[0] },
  parameters: [],
  subInstructions: [],
  disabled: false,
});
const formatInstruction = ({ instruction }) => `${instruction.type.value} {}`;
const options = { resolveInstruction, formatInstruction };
test('double-brace expressions retain quoted delimiters and nested braces', () => {
  const source = wrap(
    'event {\n actions {\n A { value={{Func("}}", { nested: 1 })}} other=2 }\n }\n}'
  );
  const syntax = parseSettingsSyntax(source);
  const printed = printSettingsSyntax(syntax.root, syntax.comments);
  expect(printed).toContain('{{ Func("}}", { nested: 1 }) }}');
  expect(printSettingsSyntax(parseSettingsSyntax(printed).root)).toBe(printed);
});

test('formats inline and block expressions with one space inside delimiters', () => {
  const source = wrap(
    'repeat {\n count = {{  MouseButton  }}\n actions {\n A { value={{MouseButton}} }\n }\n}'
  );
  const formatted = printSettingsSyntax(parseSettingsSyntax(source).root);
  expect(formatted).toContain('count = {{ MouseButton }}');
  expect(formatted).toContain('value = {{ MouseButton }}');
  expect(printSettingsSyntax(parseSettingsSyntax(formatted).root)).toBe(
    formatted
  );
});

test('rejects empty, unterminated, and old-style expression operands', () => {
  for (const operand of ['{{ }}', '{{1 + 2', 'expr(1 + 2)']) {
    expect(() =>
      parseSettingsSyntax(
        wrap(`event {\n actions {\n A { value=${operand} }\n }\n}`)
      )
    ).toThrow();
  }
});
test('keeps explicit sibling and child event boundaries; list context determines instruction kind', () => {
  const source = wrap(
    'event {\n actions {\n A {}\n }\n event {\n conditions {\n Or {\n C {}\n D {}\n }\n }\n actions {\n B {}\n }\n }\n}\nevent {\n actions {\n E {}\n }\n}'
  );
  const events = compileSettingsEvents(source, options);
  expect(events).toHaveLength(2);
  expect(events[0].events[0].conditions[0].subInstructions).toHaveLength(2);
  expect(
    compileSettingsEvents(
      appendSettingsEvents('function {\n name = "Test"\n}\n', events, options),
      options
    )
  ).toEqual(events);
  expect(printSettingsSyntax(parseSettingsSyntax(source).root)).toContain(
    'Or {'
  );
});
test('parses raw JS with nested templates, regex, comments and braces without escapes', () => {
  const code =
    'const re = /[}]/;\nconst x = `outer ${`inner ${ { x: "}" }.x }`}`;\n// }\n/* } */\nif (re.test(x)) { console.log(x); }\n';
  const source = wrap(`javascript {\n strict = true\n code {\n${code}}\n}`);
  expect(compileSettingsEvents(source, options)[0].inlineCode).toBe(code);
  expect(extractSettingsJavaScriptBlocks(source)[0].code).toBe(code);
  const formatted = printSettingsSyntax(parseSettingsSyntax(source).root);
  expect(compileSettingsEvents(formatted, options)[0].inlineCode).toBe(code);
  expect(printSettingsSyntax(parseSettingsSyntax(formatted).root)).toBe(
    formatted
  );
});
test.each([
  'event {\n type = "group"\n}',
  'event {\n type = "comment"\n}',
  'event {\n type = "link"\n}',
  'event {\n actions {}\n actions {}\n}',
  'event {\n events {}\n}',
  'event {\n do A\n}',
  'else {\n}',
  'javascript {\n code = "x"\n}',
  'javascript {\n code {}\n}',
  'javascript {\n code { foo(); }\n}',
  'link {\n target = "A"\n event {}\n}',
])('rejects retired and structurally invalid syntax: %s', body => {
  expect(() => compileSettingsEvents(wrap(body), options)).toThrow();
});
test('round trips groups, comments and links as dedicated ordered nodes', () => {
  const source = wrap(
    'group {\n name = "Combat"\n comment {\n text = "Explain"\n }\n link {\n target = "SharedCombat"\n }\n}'
  );
  const events = compileSettingsEvents(source, options);
  expect(events[0].events.map(e => e.type)).toEqual([
    EVENT_TYPES.comment,
    EVENT_TYPES.link,
  ]);
  expect(
    compileSettingsEvents(
      appendSettingsEvents('function {}\n', events, options),
      options
    )
  ).toEqual(events);
});
test('omits default group fields while preserving non-default values', () => {
  const events = compileSettingsEvents(
    wrap(
      'group {\n name = "Default"\n }\ngroup {\n name = "Custom"\n source = "template"\n creationTime = 123\n parameters = ["a"]\n color = [0, 176, 228]\n }'
    ),
    options
  );
  const output = appendSettingsEvents('function {}\n', events, options);
  const groups = parseSettingsSyntax(output).root.children[0].children;
  expect(Object.keys(groups[0].properties)).toEqual(['name']);
  expect(Object.keys(groups[1].properties)).toEqual(
    expect.arrayContaining([
      'name',
      'source',
      'creationTime',
      'parameters',
      'color',
    ])
  );
  expect(compileSettingsEvents(output, options)).toEqual(events);
});
test('expression operands and type-specific while lists stay separate', () => {
  const source = wrap(
    'while {\n while_conditions {\n C { value={{Func("(", (1 + 2))}} }\n }\n conditions {\n D {}\n }\n actions {\n A {}\n }\n}'
  );
  const events = compileSettingsEvents(source, options);
  expect(events[0].whileConditions[0].type.value).toBe('C');
  expect(events[0].conditions[0].type.value).toBe('D');
});

test('type discriminants reject empty, non-string and prototype names', () => {
  for (const type of [
    '""',
    '0',
    'false',
    '["standard"]',
    '"__proto__"',
    '"constructor"',
  ])
    expect(() =>
      compileSettingsEvents(wrap(`event {\n type = ${type}\n}`), options)
    ).toThrow();
});

test('explicit containers determine semantics independently of category placement', () => {
  const source = wrap(
    'event {\n actions {\n A {}\n }\n conditions {\n C {}\n }\n}'
  );
  const parsed = compileSettingsEvents(source, options);
  expect(parsed[0].conditions[0].type.value).toBe('C');
  expect(parsed[0].actions[0].type.value).toBe('A');
  const formatted = printSettingsSyntax(parseSettingsSyntax(source).root);
  expect(formatted.indexOf('actions {')).toBeLessThan(
    formatted.indexOf('conditions {')
  );
});

test('all loop kinds retain fields, locals, flags and children through the unified grammar', () => {
  const source = wrap(`repeat {
  count = {{Variable(Count) + 1}}
  index = "i"
  variable {
    name = "State"
    type = "enum"
    value = "Idle"
    values = ["Idle", "Run"]
  }
  for_each {
    object = "Enemy"
    index = "j"
    order_by = {{Enemy.X()}}
    order = "desc"
    limit = 10
  }
  for_each_child {
    iterable = "Inventory"
    index = "childIndex"
    value = "item"
    key = "itemKey"
  }
  while {
    infiniteLoopWarning = true
    while_conditions {
      C {
        flags {
inverted = true
}
      }
    }
    actions {
      A {
        flags {
disabled = true
        awaited = true
}
      }
    }
  }
}`);
  const events = compileSettingsEvents(source, options);
  const again = compileSettingsEvents(
    appendSettingsEvents('function {}\n', events, options),
    options
  );
  expect(again).toEqual(events);
});

test('empty code, final newline normalization and syntax errors have explicit behavior', () => {
  const empty = compileSettingsEvents(
    wrap('javascript {\n code {\n }\n}'),
    options
  );
  expect(empty[0].inlineCode).toBe('');
  const events = [
    {
      type: EVENT_TYPES.javascript,
      inlineCode: 'const text = `line1\nline2`;',
    },
  ];
  expect(
    compileSettingsEvents(
      appendSettingsEvents('function {}\n', events, options),
      options
    )[0].inlineCode
  ).toBe('const text = `line1\nline2`;\n');
  expect(() =>
    compileSettingsEvents(
      wrap('javascript {\n code {\nconst broken = ;\n }\n}'),
      options
    )
  ).toThrow('Invalid JavaScript');
});

test('rejects object literals masquerading as loop expressions and unsupported instruction flags', () => {
  expect(() =>
    compileSettingsEvents(
      wrap('repeat {\n count = { expression = "5" }\n}'),
      options
    )
  ).toThrow('requires a number or {{');
  expect(() =>
    compileSettingsEvents(
      wrap(
        'event {\n actions {\n A {\n flags {\ninverted = true\n}\n }\n }\n}'
      ),
      options
    )
  ).toThrow();
});

test('duplicate nonempty identities are rejected across nested event lists', () => {
  expect(() =>
    compileSettingsEvents(
      wrap(
        'event {\n aiGeneratedEventId = "same"\n event {\n aiGeneratedEventId = "same"\n }\n}'
      ),
      options
    )
  ).toThrow('Duplicate aiGeneratedEventId');
});

test('handles thousands of explicit events and rejects excessive event/code budgets', () => {
  const source = wrap(
    Array.from(
      { length: 3000 },
      () => 'event {\n actions {\n A {}\n }\n}'
    ).join('\n')
  );
  const parsed = compileSettingsEvents(source, options);
  expect(parsed).toHaveLength(3000);
  expect(
    compileSettingsEvents(
      appendSettingsEvents('function {}\n', parsed, options),
      options
    )
  ).toEqual(parsed);
  expect(() =>
    compileSettingsEvents(
      wrap('event {\n'.repeat(110) + '}\n'.repeat(110)),
      options
    )
  ).toThrow('nesting budget');
  expect(() =>
    parseSettingsSyntax(
      wrap(
        'javascript {\n code {\n//' + 'x'.repeat(2 * 1024 * 1024) + '\n }\n}'
      )
    )
  ).toThrow('code size budget');
});

test('instruction trailing comments are preserved once without truncating quoted URLs', () => {
  const source = wrap(
    'event {\n actions {\n A { url="https://example.com" } // explain action\n }\n}'
  );
  const syntax = parseSettingsSyntax(source);
  const printed = printSettingsSyntax(syntax.root, syntax.comments);
  expect(printed.match(/\/\/ explain action/g)).toHaveLength(1);
  expect(printed).toContain('url = "https://example.com"');
  expect(
    printSettingsSyntax(
      parseSettingsSyntax(printed).root,
      parseSettingsSyntax(printed).comments
    )
  ).toBe(printed);
});

test.each(['A', 'A value=1', 'A value=1 {\n disabled = true\n}'])(
  'rejects calls without the mandatory argument block: %s',
  call => {
    for (const list of ['actions', 'conditions', 'while_conditions']) {
      expect(() =>
        parseSettingsSyntax(wrap(`event {\n ${list} {\n ${call}\n }\n}`))
      ).toThrow('Expected {');
    }
  }
);

test('argument blocks preserve operand locations, comments, and flags with colliding names', () => {
  const source = wrap(`event {
  actions {
    A {
      // catalog parameter, separate from the execution flag
      disabled = "parameter"
      value = {{Max(1,
        2)}}
      flags { disabled = true awaited = true }
      B {}
    }
  }
}`);
  const syntax = parseSettingsSyntax(source);
  const instruction =
    syntax.root.children[0].children[0].children[0].children[0];
  expect(instruction.arguments.disabled.value).toBe('parameter');
  expect(instruction.properties.disabled.value).toBe(true);
  expect(instruction.properties.awaited.value).toBe(true);
  const location = instruction.arguments.value.location;
  expect(source.slice(location.offset, location.endOffset)).toBe(
    '{{Max(1,\n        2)}}'
  );
  expect(instruction.children[0].type).toBe('B');
  const printed = printSettingsSyntax(syntax.root, syntax.comments);
  expect(printed.match(/catalog parameter/g)).toHaveLength(1);
  const reparsed = parseSettingsSyntax(printed);
  expect(printSettingsSyntax(reparsed.root, reparsed.comments)).toBe(printed);
});

test.each([
  'A { value=1 value=2 }',
  'A { flags {} flags {} }',
  'A { flags { disabled=true disabled=false } }',
  'A { value={} }',
  'A { value=[] }',
  'A { B }',
  'A { value=1',
])('rejects malformed instruction blocks: %s', call => {
  expect(() =>
    parseSettingsSyntax(wrap(`event {\n actions {\n ${call}\n }\n}`))
  ).toThrow();
});

test('formats short calls on one line and expands long or annotated calls', () => {
  const source = wrap(`event {
  actions {
    A { value=1 }
    B {}
    C { value="${'x'.repeat(90)}" }
    D {
      // keep this comment inside the argument block
      value=2
    }
  }
}`);
  const syntax = parseSettingsSyntax(source);
  const printed = printSettingsSyntax(syntax.root, syntax.comments);
  expect(printed).toContain('A { value = 1 }');
  expect(printed).toContain('B {}');
  expect(printed).toMatch(/C \{\n\s+value =/);
  expect(printed).toMatch(/D \{\n\s+\/\/ keep this comment/);
});

test('dedicated event schemas have no type discriminator and round trip every node', () => {
  const source = wrap(`event {
  conditions {
    C {}
  }
}
else {}
repeat {
  count = 2
}
while {}
for_each {
  object = "Enemy"
}
for_each_child {
  iterable = "Inventory"
}
javascript {
  code {
const value = 1;
  }
}
group {
  name = "Group"
}
comment {
  text = "Comment"
}
link {
  target = "Fragment"
}`);
  for (const schema of Object.values(EVENT_SCHEMAS)) {
    expect(schema.fields).not.toHaveProperty('type');
    expect(EVENTS_CONTAINER_SCHEMA.children[schema.node].schemaRef).toBe(
      `eventSchemas.${schema.node === 'event' ? 'standard' : schema.node}`
    );
  }
  const events = compileSettingsEvents(source, options);
  const output = appendSettingsEvents('function {}', events, options);
  expect(output).not.toMatch(/\btype\s*=/);
  expect(compileSettingsEvents(output, options)).toEqual(events);
  for (const kind of Object.keys(EVENT_TYPES)) {
    expect(() =>
      compileSettingsEvents(wrap(`event {\n type = "${kind}"\n}`), options)
    ).toThrow(/Unknown event field type/);
  }
});
