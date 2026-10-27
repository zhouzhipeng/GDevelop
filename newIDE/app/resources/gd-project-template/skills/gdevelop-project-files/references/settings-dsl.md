# GDevelop Language (GDL) — current authoring syntax

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
  expr(...) as described in events-dsl.md. Integers must be safe integers.
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
