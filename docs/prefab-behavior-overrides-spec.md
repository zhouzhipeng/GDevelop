# Prefab behavior property overrides

## Problem and goals

Scene objects currently contain copied prefab behavior configuration. Value-based
synchronization cannot distinguish inheritance from an explicitly authored value
that happens to equal a default. Scene objects must continue showing inherited
behaviors and allow every editable property to be overridden.

## Authoritative data

Prefab definitions own behavior names, types, and default configuration. A scene
object stores only a reference and explicit property overrides, for example:

```json
{"name":"Movement","type":"Extension::Movement","isInheritedFromObjectType":true,"overrides":{"Speed":"150"}}
```

New objects have empty overrides. Editing a property records an override only when its effective value differs
from the current prefab default. Editing back to the default or resetting removes
the override.
Resolution is scene-object override followed by prefab default. Existing
initial-instance behavior overrides remain a higher-priority layer. Standalone
behaviors retain their existing format. Deleting/renaming inherited behaviors
remains controlled by the prefab definition.

## Implementation boundaries

- Core behavior configuration exposes effective properties but keeps authored
  overrides separate. Effective content is a disposable cache, not saved data.
- Refresh resolves defaults again and reapplies overrides; values equal to current prefab defaults are omitted from overrides.
- Project persistence writes sparse overrides. Runtime export materializes full
  effective configuration through an explicit export path before stripping.
- Editing, resource refactoring, undo/redo, cloning, and clipboard operations must
  preserve the distinction between effective content and authored overrides.
- PrefabDetailEditor must delegate synchronization to Core instead of maintaining
  its own property-diff heuristics.
- The behaviors panel stays visible and supports reset-to-prefab defaults.
- GDL schema inventory, settings parser/writer, layout documents, and multi-file
  normalization must preserve the overrides object without treating it as a
  behavior property.

## Affected files

Core/GDCore/Project/{Behavior,BehaviorConfigurationContainer,BehaviorsContainer,
Project,Object}; Core/GDCore/IDE/Events/BehaviorDefaultFlagClearer;
GDevelop.js/Bindings/Bindings.idl; GDJS/GDJS/IDE/ExporterHelper;
newIDE/app/src/{BehaviorsEditor,PrefabDetailEditor,ProjectsStorage}; related tests.

## Format policy

Only the new overrides format is supported for inherited behavior configuration.
There is no migration or inference from legacy copied values. New inherited
behaviors start with empty overrides. Same-name different-type conflicts are
reported instead of reinterpreting overrides for another behavior type.

## Error handling and performance

Retain unresolved overrides if a property or extension temporarily disappears.
Only apply values accepted by the behavior's property implementation. Resolve
once per configuration refresh/export, not once per game frame. Do not mutate
source projects while materializing export data.

## Validation and rollout

Tests cover empty new overrides; edited values and removal when edited back to defaults;
prefab changes propagating only to unoverridden properties; reset; new-format load/save; save/load and GDL round trips; cloning and undo; resource refactoring;
missing extensions; name/type conflicts; initial-instance precedence; and full
runtime export with behavior execution. Rebuild WASM bindings before editor tests
using the new API. Run focused Core and IDE tests and perform the repository's
required desktop build/launch after implementation.

## Non-goals and alternatives

No hiding/private-behavior model, new prefab placement model, or private-variable
redesign. Copy-and-diff inheritance is rejected because values cannot encode
intent. Runtime behavior lifecycle and network state are unchanged by this
configuration-storage change.

## Open implementation details

Choose a representation that preserves behavior-specific typed serialization
while recording explicit property-level edits. Overrides must replace a whole
property value; nested merging is not implied. Mute is editor/runtime metadata,
not an ordinary behavior property, and must have a separately specified override
policy before extending its current semantics.
