# Events in GDevelop Language (GDL)

Events are part of GDevelop Language (GDL) format 12, not a separate language. Each
function's signature and body live in one functions/<Name>.gdl file.
External fragments use external-events/<Name>.gdl. Never create .events
files or write IfDo syntax. Read the current settings and instruction catalogs.

## Complete function

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
          CollisionNP first_object="Player" second_object="Coin"
        }
        actions {
          Delete object="Coin"
          SetNumberVariable variable="Score" modification_sign="+" value=1
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

## Structure

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
- Conditions and actions determine catalog instruction kind. Write exact
  instruction types followed by semantic named arguments. No positional args,
  aliases, @ annotations, > depth prefixes, ? prefixes or raw JSON.
- Ordinary text/object/behavior/variable/resource/name operands are quoted;
  numbers and booleans are literals. Use expr(...) for calculated expressions.
  Balanced expr bodies may span lines; preserve their exact expression source.
- An instruction's block contains disabled/inverted (condition) or
  disabled/awaited (action) flags and catalog-supported child instructions.
  Child instruction kind is inherited; do not add conditions/actions wrappers.
- Event members have explicit ownership; source placement of entire categories
  does not change runtime order: conditions, actions, then children. Within
  each list, source order matters. Canonical order is properties, variables,
  while_conditions, conditions, actions, then children.

```text
conditions {
  Or {
    SomeCondition target="Enemy"
    AnotherCondition target="Enemy" {
      inverted = true
    }
  }
}
```

SomeCondition/AnotherCondition stand for real catalog entries, not aliases.

## Event variants

```text
event {
  type = "repeat"
  count = 5
  index = "i"
  actions {
    SomeAction amount=1
  }
}

event {
  type = "for_each"
  object = "Enemy"
  order_by = expr(Enemy.Variable(HP))
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
    NumberVariable variable="QueueSize" comparison_sign=">" value=0
  }
  actions {
    SetNumberVariable variable="QueueSize" modification_sign="-" value=1
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

## JavaScript

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

## Execution and picking analysis

Instruction catalog version 4 adds structured `semantics`. Each action and
condition is explicitly known, partial or unknown. Exact parameter names still
come from the catalog; no picking attributes are authored in GDL.

Before changing object-sensitive logic, inspect:

```json
{"kind":"condition","type":"CollisionNP"}
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
