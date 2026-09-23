# IfDo Events DSL

**Status:** Current syntax contract for multi-file project format 6.
**Source:** UTF-8 `.events` files.
**Implementation:** `newIDE/app/src/EventsSheet/IfDoEventsDsl/index.js` and
`ProjectInstructionCatalog.js`. The parser's coverage version is `3.0`.

This document describes the syntax accepted by the current converter. The
project-specific instruction vocabulary is generated in
`.gdevelop/instructions-catalog.json` (format version 2). Always consult that
catalog for exact instruction `type`, parameter `dslName`, and `valueKind`.
The event DSL version and instruction catalog version are separate values.

## Files and ownership

An `.events` file contains only event statements. It has no TOML front matter,
function declaration, or raw event JSON. Scene lifecycle and function settings
live in same-stem `.settings` files; external event fragments are standalone
`scenes/<Scene>/external-events/<Fragment>.events` files. A fragment has no own
settings or lifecycle. `link "Fragment"` expands the whole external fragment
in the caller's scope and lifecycle. Empty and unreferenced fragments are valid.

## A current example

```events
@event folded=true
if CollisionNP first_object="Player" second_object="Coin"
do Delete object="Coin"
do SetNumberVariable variable="Score" modification_sign="+" value=1

if SceneJustBegins
do DebuggerTools::ConsoleLog message_to_log="scene started"

> if CollisionNP first_object="Player" second_object="Enemy"
> do Delete object="Enemy"
```

`CollisionNP`, `Delete`, and `SetNumberVariable` are catalog instruction types.
The parameter names shown are catalog `dslName` values; use the generated
catalog for the current project rather than copying a signature blindly.
There are no built-in prose aliases such as `collision Player Coin`, and
assignment syntax such as `do Player.health -= 10` is not parsed as an action.

## Instruction lines

| Source | Meaning |
| --- | --- |
| `if Type name=value ...` | Condition in the current event |
| `or Type name=value ...` | Alternative to the immediately preceding condition group |
| `do Type name=value ...` | Action in the current event |
| `do await Type name=value ...` | Awaited action |

Use exact catalog types and named arguments. An instruction type containing
whitespace is a JSON-quoted string, for example `do "Physics2::Remove joint"
...`. An `@` prefix is reserved for structural annotations, not catalog types.
Do not write positional instruction arguments or `@exact`/raw JSON fallbacks.
Code-only catalog parameters are omitted. New instructions supply all required
semantic values. An existing imported instruction may omit a named parameter
when its stored positional slot is blank; keep that omission during a targeted
edit.

Values follow each parameter's catalog `valueKind`:

```events
do DebuggerTools::ConsoleLog message_to_log="Ready"
do SetNumberVariable variable="Score" modification_sign="=" value=100
do SetBooleanVariable variable="RoundActive" value=true
do DebuggerTools::ConsoleLog message_to_log=expr("Score: " + ToString(Variable(Score)))
```

Text, object, behavior, variable, resource, and name values are quoted strings.
Numbers and booleans are direct literals. `expr(...)` carries GDevelop
expression source for a calculated text or number parameter; it is not a
general IfDo expression or an instruction alias. An empty `expr()` is invalid.
The catalog adapter checks the outer semantic kind and expression non-emptiness;
full GDevelop expression validity must be checked by project validation. The
compiler lowers semantic values to the legacy positional parameter strings.

Multiple `if` lines are AND groups. Consecutive `or` lines extend the last
group, so the following means `(collision with Enemy OR collision with Coin)
AND scene just began`:

```events
if CollisionNP first_object="Player" second_object="Enemy"
or CollisionNP first_object="Player" second_object="Coin"
if SceneJustBegins
do DebuggerTools::ConsoleLog message_to_log="contact on first frame"
```

Conditions precede actions; actions keep source order. An event may have
actions without conditions. `event` denotes an empty Standard event or one
that owns only locals or child events.

`@event` carries `disabled`, `folded`, and `aiGeneratedEventId`. The canonical
formatter writes it when these fields are non-default or when a Standard event
would otherwise merge into its preceding sibling. It omits an empty `@event`
before an unambiguous event. `@instruction` immediately before an instruction
carries non-default `disabled`, `inverted`, or `awaited`; it is omitted when
those flags are false. An awaited action may use `do await`; conflicting
awaited annotations are rejected.

Instruction trees use `?` for child instruction lines. A child line has the
same instruction kind as its parent, so it does not repeat `if` or `do`.
Repeat `?` for each instruction depth and put child metadata at that depth:

```text
if Or
? A
? @instruction disabled=true
? B
do X
```

This structure preserves the serializer's ordered `subInstructions`. `??`
marks a grandchild. The child metadata line applies only to the next `?`
instruction. A plain `or` line is a convenient way to form a logical OR of
sibling conditions; it is not a substitute for every instruction tree. The
names in this tree are schematic; an actual file uses catalog types and named
parameters.

## Event boundaries and depth

One condition, action, declaration, or structural marker occupies one physical
line. Blank lines separate sibling events in canonical output but do not
define hierarchy. Leading `>` characters alone define child event depth.
Repeat the complete prefix on every line in a child event; a depth jump may
increase by only one. Parent actions must precede child events.

```events
if SceneJustBegins
do DebuggerTools::ConsoleLog message_to_log="ready"

> if CollisionNP first_object="Player" second_object="Enemy"
> do Delete object="Enemy"
```

An `else` or `else if <catalog condition>` is a sibling Else event immediately
after its matching conditional event. Branch locals follow the Else header and
precede its conditions/actions. A dedent closes a child event. Structural
headers (loops, groups, comments, links, and code blocks) start distinct
events. The current parser decides the Standard event boundary from the next
header, metadata line, or an `if` after actions/children; blank lines alone do
not start another Standard event. For example, a second `do` joins the first
event, even across a blank line. Put `@event` before a second action-only event,
before a condition-only event following another condition-only event, or before
locals following a sibling that remains open. The explicit `event` keyword
already starts a new empty Standard event. Existing source may keep redundant
`@event` lines; the formatter removes them when it can infer the boundary.

```events
do DebuggerTools::ConsoleLog message_to_log="first event"

@event
do DebuggerTools::ConsoleLog message_to_log="second event"
```

## Locals and structural events

`local name = value` precedes its owning event. `local name:type = value` is
accepted for typed shorthand. `var(...)` preserves full variable metadata
such as enum values, persistent UUIDs, folded state, or nested children.
Simple local values can be strings, numbers, booleans, arrays, or structures.
The local is serialized on its owning event, not as an independent event.

The current structural spellings are:

```events
@group "Combat" source="" creationTime=0 color=[74,176,228] parameters=[]
@comment "Handle contact" background=[255,230,109] text=[0,0,0]
@end group

for each Enemy index="i" order_by="Enemy.Variable(HP)" order="desc" limit="10"

for each child "inventory" value="item" key="itemKey" index="i"

repeat "5" index="i"

@while infiniteLoopWarning=true
while NumberVariable variable="QueueSize" comparison_sign=">" value=0 index="i"
and while AnotherCondition

link "Shared Combat"
```

These are independent examples of headers, not one executable event list.
`AnotherCondition` denotes a catalog condition available to the project.
The formatter quotes stored loop strings; the parser also accepts unquoted
simple values in these structural positions. A `for each` sort may use
`order_by`, `order`, and `limit`; `for each child` accepts the shown `value=`/
`key=` form or `as <alias>`. `@while` carries `infiniteLoopWarning`.
`and while` preserves a separate condition in `whileConditions` and must appear
before ordinary `if`, `do`, or child statements. A bare `while` represents an
empty `whileConditions` list. The formatter emits `@while` only when
`infiniteLoopWarning` is true; an empty `@while` is accepted but omitted on
round-trip.

`while ... limit=<value>` is a source-only safety guard. The context-free
parser needs the project-aware `lowerWhileLimit` callback to compile it; the
formatter does not recover that source-only guard from legacy JSON. AI-authored
loops should use a positive bound and progress toward termination.

Groups use one `@group` header and an `@end group` terminator. They contain
same-depth events. Group metadata belongs on `@group`, and comment metadata
belongs on `@comment`; `@event` cannot attach to either. Hash comments and
inline comments are not IfDo syntax.

Links use exactly `link "<external fragment name>"`. They are leaf events and
include the full fragment (`includeConfig = 0`). `link scene`, `link external`,
`group=`, and `range=` are not accepted. Link targets must resolve to external
fragments; link cycles must be rejected by project validation.

## JavaScript events

```events
@js objects="Enemy" strict=true expanded=false
const count = 1;
@end js
```

The body is raw JavaScript, not IfDo lines. `@js` may carry `disabled`,
`folded`, `aiGeneratedEventId`, `objects`, `strict`, `expanded`, and an optional
`delimiter`. The matching terminator is `@end js` or `@end js <delimiter>`.
The formatter chooses a delimiter when a body line would otherwise look like
the terminator. JavaScript events are leaves. JavaScript availability and API
validity are determined by the owning project context.

## Function bodies and runtime meaning

Function identity, parameters, return type, owner, and lifecycle come from the
same-stem `.settings` file. The `.events` body has no `function` header.
Function calls and return-value actions use exact catalog instruction names
and named parameters. The core IfDo parser does not interpret prose shorthand
such as `do result = false`.

IfDo retains GDevelop event semantics: conditions pick objects; OR conditions
preserve their picking behavior; child events inherit parent picks and locals;
actions execute before child events; and sibling order matters. Links expand
in the caller context. Comments and groups do not execute gameplay actions.
The DSL is an event source format, not a replacement for GDevelop expressions
or runtime validation.

## Conversion and validation boundary

`parseIfDoEvents` parses source to legacy event objects, and
`compileIfDoToLegacyEventsJson` serializes them. The inverse
`convertLegacyEventsJsonToIfDo` emits canonical source. Instruction-bearing
conversion requires project catalog resolver/formatter callbacks; the core
does not guess aliases or preserve unsupported instructions as raw JSON.
Unknown event types, unsupported fields, malformed metadata, unrepresentable
operands, invalid depth, and dangling annotations produce errors.

The supported persisted event kinds are Standard, Else, While, Repeat,
ForEach, ForEachChildVariable, Group, Comment, Link, and JsCode. Common event
metadata includes `disabled`, `folded`, and `aiGeneratedEventId`. Instructions
preserve `type.value`, `inverted`, `await`, `disabled`, ordered parameters, and
sub-instructions. The converter normalizes optional serializer defaults before
equivalence comparison. `BuiltinAsync::Async` is an internal preprocessing
event, not an authored source event.

The generated normal instruction catalog excludes hidden and deprecated
entries. A separate deprecated catalog exists only for round-tripping or
targeted edits of existing legacy instructions. Do not use it to author new
events. The project owner supplies object, behavior, variable, resource, scene,
function, and lifecycle context for validation.

For an AI authoring workflow, read the owning settings and current catalog,
write exact instruction types with semantic named values, compile and validate
the project, then compare behavior-sensitive changes in preview. The compact
project authoring reference is
`newIDE/app/resources/gd-project-template/skills/gdevelop-project-files/references/events-dsl.md`.
