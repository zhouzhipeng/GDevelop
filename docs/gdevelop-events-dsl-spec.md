# Events in GDevelop Language (GDL)

The independent IfDo author language and `.events` files have been removed.
The current contract is [Unified GDevelop Language (GDL)](unified-settings-events-dsl-spec.md),
format 11. This document is a navigation entry, not an alternate grammar.

Functions and external fragments store declarations and an `events {}` body in
one `.gdl` document. Use explicit `conditions` and `actions` containing bare
catalog instructions. Executable events use `event` with default standard type;
`group`, `comment`, and `link` are independent nodes. Child nodes are nested
directly. JavaScript uses a raw multiline `code { ... }` block within an event
whose type is javascript. No old syntax, compatibility reader or migration is
provided.

See the [bundled authoring reference](../newIDE/app/resources/gd-project-template/skills/gdevelop-project-files/references/events-dsl.md)
for examples. Instructions and expression operands remain project-catalog driven;
engine picking and runtime behavior are unchanged.
