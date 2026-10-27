# GDevelop Language (GDL) usage

Only format 13 is accepted. `.gdl` and `project.gdl` use the same
parser. constants.toml remains TOML; event bodies are embedded in function/fragment settings. .events files are forbidden.

## Syntax

```settings
scene {
  name = "Main"
  order = 0
  background = "#101820"

  variable {
    name = "Score"
    value = 0
  }

  layer {
    id = "base"
    name = ""
  }

  instance {
    id = "ef3ef49d-f20f-4450-b373-0ce43291a002"
    object = "Player"
    layer = "base"
    position = [100, 200]

    variable {
      name = "Health"
      value = 100
    }
  }
}
```

Player must be defined in the matching objects directory or global scope.
Layer ids are file-local references; names are runtime layer names. Instances
remain root children, preserving their global order. Nested instances and
screen/row/column layout nodes are not implemented.

## Rules

- Properties use `key = value`; child nodes use `type { ... }`. No named node
  arguments, semicolons, inline objects outside variable.value, TOML headers or settings/layout wrapper.
- One declaration per line. Strings use JSON escapes. Arrays can span lines
  and have a trailing comma. `//` starts a comment outside a string.
- Values are strings, finite numbers, booleans and arrays; variable.value also accepts structure literals. Null, dates and includes are forbidden. Ordinary configuration fields do not
  accept expressions; event instruction operands and supported loop fields use
  {{...}} as described in [Events](#events). Integers must be safe integers.
- Unknown fields/nodes and duplicate properties/singleton nodes are errors.
- Only project.gdl declares formatVersion. All other root fields come
  directly from the matching component schema.
- Read fileKinds[].root and schema.rootFields/childNodes in the generated
  GDL catalog. Node schemas map author node names to model keys and state
  whether a child is repeated. Object type schemas use fields and children.
- Empty repeated collections can use the registered model key with `[]`;
  nonempty record arrays use repeated child nodes. Never mix both forms.
- Preserve instance UUIDv4 ids. `position` is [x,y] or [x,y,z]; rotation is a
  Z angle or [x,y,z] in degrees. `size` and `auto_size` are mutually exclusive.
- Camera size/viewport accept default or numeric arrays. In default mode,
  stored_size/stored_viewport retain inactive values.

## Other component roots

```settings
external_events {
  name = "SharedCombat"
  description = "Shared combat fragment"
  eventsLogic = "Apply damage after collision selection"
}
```

```settings
function {
  name = "TakeDamage"
  order = 0
  folder = []
  functionType = "Action"

  parameter {
    name = "Amount"
    type = "expression"
    description = "Damage amount"
  }
}
```

Scene/prefab/behavior lifecycle signatures and order have fixed contracts.
External layouts use `external`; variants use `variant`. Both retain name
and applicable order inside the root. External layer nodes only contain id
and name, resolving existing layers in the owning scene.

## Variables and behaviors

Declare repeated variable nodes directly on the owner. Each has name and value.
Types are inferred from scalar, array and structure literals; enum requires type
and a nonempty values array. Nested data uses key = value inside {} and values
inside []. Extension defaults require scope = "scene" or "global". Descendant
UUID, enum and editor fields belong directly to nested variable declarations.
Containers with child declarations require type = "structure" or "array" and
must omit value. Structure children require unique names; array children forbid
name and use source order. Descendant scope is forbidden. Ordinary branches
continue to use value literals. Collection wrappers, metadata/path annotations
and scalar shorthand are rejected.

```settings
scene {
  name = "Main"
  variable {
    name = "State"
    type = "structure"
    variable {
      name = "Mode"
      type = "enum"
      value = "Idle"
      values = ["Idle", "Run"]
    }
  }
}
```

Object behavior attachments require name and registered type; their dynamic
configuration goes inside properties. Instance behavior overrides use name and
properties without a type declaration; the object already owns that behavior.

## File ownership

Each component has one settings document. Objects and functions remain separate
components. Scene configuration, background, layers and instances are one scene
root. Prefab/variant require bounds with min/max arrays. Function declarations and event bodies share one .gdl file. JavaScript uses raw multiline code blocks inside event { type = "javascript" ... }. No .layout file or layout URI exists.

Never edit generated catalogs or .gdevelop/game.json. Validate direct source
edits, reload, and verify behavior using the project workflow in SKILL.md.

## Events

Events are part of GDevelop Language (GDL) format 13, not a separate language. Each
function's signature and body live in one functions/<Name>.gdl file.
External fragments use external-events/<Name>.gdl. Never create .events
files or write IfDo syntax. Read the current settings and instruction catalogs.

### Catalog instruction names

Author actions and conditions using each catalog entry's **`dslName`**. Its
`type` is the native engine identifier for exact lookup and diagnostics; do not
prefer it when a shorter `dslName` is published. System names are fixed by the
engine. Third-party and user instruction `dslName` remains its complete `type`.
Use parameter `dslName` unchanged. Never invent abbreviations or edit generated
catalogs. Expressions inside `{{...}}` retain their existing names. The
formatter writes the catalog instruction `dslName`, except for the behavior
property syntax aliases described below (`setProperty` / `getProperty`).

### Complete function

```settings
function {
  name = "CollectCoin"
  functionType = "Action"
  order = 0
  folder = []

  events {

    group {
      name = "Coins"

      comment {
        text = "Select the coins before deleting them."
      }

      event {

        conditions {

          collision { first_object = "Player" second_object = "Coin" }
        }

        actions {

          deleteObject { object = "Coin" }

          setNumberVariable { variable = "Score" modification_sign = "+" value = 1 }
        }

        event {
          type = "javascript"
          strict = true

          code {
            const score = runtimeScene.getVariables().get("Score").getAsNumber();
            console.log("Current score:", score);
          }
        }
      }
    }
  }
}
```

Exact instruction names, parameters and scope must match the project catalog.
Collision can pick multiple coins; deleting all selected coins does not imply
that a scene-variable action adds once per coin. Use for_each when required.

### Structure

- Only function and external_events roots own one optional top-level events
  container. Canonical output includes an empty events container when needed.
- Executable events use event. Its type defaults to standard. Other types:
  else, repeat, while, for_each, for_each_child and javascript.
- Grouping, persistent comments and external references use group, comment,
  and link nodes directly, never event.type = group/comment/link.
- Child event/group/comment/link nodes are nested directly in their parent.
  Do not add a nested events wrapper. Mixed child source order is significant.
- Standard and loop events have at most one conditions and one actions block.
  Missing or empty blocks represent empty lists. No if/do keywords.
- Conditions and actions determine catalog instruction kind. Write catalog
  instruction `dslName` followed by semantic named arguments. No positional args,
  user-defined aliases, @ annotations, > depth prefixes, ? prefixes or raw JSON.
- Ordinary text/object/behavior/variable/resource/name operands are quoted;
  numbers and booleans are literals. Use {{...}} for calculated expressions.
  Expression bodies inside `{{...}}` may span lines; preserve their expression source.
- `{{ ... }}` contains a GDevelop expression, not JavaScript or a GDL block.
  For example, `angle_in_degrees = {{ MousePointerLock::MovementX() * HorizontalSpeed / SceneWindowWidth() }}`.
  A plain string such as `message = "Hello"` is a literal, while
  `message = {{ "Score: " + ToString(Score) }}` is an expression. The old
  `expr(...)` wrapper is not supported.
- Every instruction uses `Instruction { parameter = value }`, including empty
  calls (`Instruction {}`). Parameters belong inside the braces. Execution
  flags belong in a nested `flags {}` block: disabled/inverted for conditions,
  disabled/awaited for actions. Catalog-supported child instructions stay
  directly inside the parent instruction block.
  Child instruction kind is inherited; do not add conditions/actions wrappers.
- Event members have explicit ownership; source placement of entire categories
  does not change runtime order: conditions, actions, then children. Within
  each list, source order matters. Canonical order is properties, variables,
  while_conditions, conditions, actions, then children.

```text
conditions {

  or {
    SomeCondition { target = "Enemy" }
    AnotherCondition {
      target = "Enemy"
      flags {
        inverted = true
      }
    }
  }
}
```

SomeCondition/AnotherCondition stand for real catalog entries, not aliases.

### Event variants

```text
event {
  type = "repeat"
  count = 5
  index = "i"
  actions {
    SomeAction { amount=1 }
  }
}

event {
  type = "for_each"
  object = "Enemy"
  order_by = {{Enemy.Variable(HP)}}
  order = "desc"
  limit = 10
}

event {
  type = "for_each_child"
  iterable = "Inventory"
  value = "item"
  key = "itemKey"
}

event {
  type = "while"
  infiniteLoopWarning = true
  while_conditions {
    numberVariable { variable="QueueSize" comparison_sign=">" value=0 }
  }
  actions {
    setNumberVariable { variable="QueueSize" modification_sign="-" value=1 }
  }
}

link {
  target = "SharedCombat"
}
```

Else uses event { type = "else" ... } directly after its conditional sibling.
No group, comment or other event may intervene. Keep original engine picking
and Else semantics. While's while_conditions is distinct from conditions;
there is no source-only while limit. Bound loops and ensure progress.

Declare event locals using variable nodes, with the same value/enum/identity
rules as settings variables. Nested declarations replace metadata/path.
Groups do not create a new runtime local-variable scope.

### JavaScript

Use only event { type = "javascript" ... code { ... } }. Code must be a raw
multiline block, never a quoted string, triple-quoted string or tagged literal.
Strings, regexes, comments and template interpolations follow JavaScript
syntax; braces inside them do not end the outer block. The code closing brace
occupies its own line. Empty code still uses separate opening/closing lines.

Preserve code whitespace and template text during Settings formatting and
block moves. JavaScript formatting is an explicit separate operation. Use
strict = true for new code and the generated public API declarations. Parent
picking does not automatically turn object names into JavaScript variables;
use the actual JS event object-parameter bridge. Javascript events are leaves.

Initialization belongs in sceneLoad.gdl, per-frame logic in
sceneUpdate.gdl. Preserve lifecycle signatures. Guard per-frame actions
with effective conditions. Validate, reload, then verify behavior using the
project workflow; successful parsing alone is not runtime verification.

### Execution and picking analysis

Instruction catalog version 6 publishes instruction `dslName` and structured `semantics`. Each action and
condition is explicitly known, partial or unknown. Exact parameter names still
come from the catalog; no picking attributes are authored in GDL.

Before changing object-sensitive logic, inspect:

```json
{"kind":"condition","type":"collision"}
```

with `get_gdl_instruction_semantics`, then call `analyze_gdl_events`:

```json
{"file":"scenes/Game/functions/sceneUpdate.gdl","detail":"summary","max_events":40}
```

`event_path` indexes the original mixed event/group/comment/link list. A subtree
query still analyzes its parent context and necessary preceding actions.
`expected_snapshot` rejects outdated source locations. The tools read saved
sources, never regenerate catalogs and never execute the game. Run
`generate-catalogs` when they return `catalog-stale`.

A condition can filter objects or change selection; actions such as PickAll,
PickRandom and Create can change later selection too. Parent actions run before
child events. Siblings have separate temporary selections, but world side
effects persist. ForEach narrows its own target, not every referenced object.
Collision selection lists do not preserve one-to-one collider pairing.

A variable write runs when its event body reaches it; deleting multiple selected
coins does not automatically award once per coin. To count each selected coin,
place a Coin ForEach child after the parent collision filter, then delete and
increment inside that child. Do not automatically move collision conditions
inside a new outer loop: that changes when selection happens.

`complete` describes supported static rules only. `partial`, `unknownReasons`
and `truncated` expose limitations; complex logical merge, inversion, arbitrary
expressions/JavaScript, loop invariants and cross-file calls can remain unknown.
No unknown coverage is a save error by itself. `validate_project_files` reports
`pickingAnalysis` separately from structural validity and keeps runtime behavior
unverified. Use real preview/gameplay evidence for behavior-sensitive edits.

### Instruction metadata files

Read `.gdevelop/conditions-catalog.json` for condition metadata,
`.gdevelop/actions-catalog.json` for action metadata, and
`.gdevelop/expressions-catalog.json` for expression metadata. Each file exposes
its corresponding `kind`, `entries`, and `count`. Use entries whose
`authoringAvailable` is `true` for new GDL. All three files must be regenerated
together; do not use the retired combined or deprecated catalog files.

### Behavior properties

Within `extensions/<Extension>/behaviors/<Behavior>/functions/*.gdl`, use generic
property aliases instead of constructing `SetPropertyX` / `PropertyX` names:

```settings
function {
  name = "Initialize"
  events {
    event {
      conditions {
        getProperty { name = "HasJustBeenCreated" }
      }
      actions {
        setProperty { name = "HasJustBeenCreated" value = false }
        setProperty { name = "CameraZ" value = {{getProperty(name="CameraZ") + 10}} }
      }
    }
  }
}
```

The owning behavior comes from the file path. `object="Object"` and
`behavior="Behavior"` default automatically on instructions. `name` must be a
literal existing property name. Keep values typed: numbers as numbers, text as
strings, booleans as `true`/`false`, calculations inside `{{...}}`.
`modification_sign` on numeric/text setters defaults to `"="`; boolean setters
require an explicit value. Numeric/text conditions accept `value` and
`comparison_sign` (default `"="`). A boolean condition tests true; use
`flags { inverted = true }` to test false. Expression `getProperty(name="CameraZ")`
reads a numeric/text property of the current `Object.Behavior`, including in loop
expressions. Boolean properties use conditions, not expressions.

These are syntax mappings to existing private behavior instructions. Hidden
properties work through the complete generated catalogs. The aliases are scoped
to behavior function files; they do not grant scene events direct access. Old
fully qualified instruction names and bare property expressions remain accepted.
Saving canonicalizes supported accesses to the aliases while preserving legacy
empty parameter slots. Embedded JavaScript continues to use its own API.
