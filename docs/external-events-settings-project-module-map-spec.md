# External Events settings and project module map

**Status:** Approved for implementation on 2026-09-23. Version 6 compatibility is intentionally removed; JurassicWorld receives a one-time source conversion after engine verification.

## Problem and current behavior

Version 6 discovers each External Events fragment from a single `scenes/<Scene>/external-events/<Fragment>.events` file. The reader rejects any sibling `.settings` file. Fragment identity comes from its filename and owning scene; `link "Fragment"` expands it at the caller's position. The existing `.gdevelop/settings-catalog.json` describes this settings-free event kind. Catalog generation is owned by `LocalProjectWriter.js`, while multi-file composition and decomposition are owned by `MultiFileProjectFormat/index.js`.

The current files offer no structured place to describe a fragment's intent. The generated catalogs describe how to author files but do not give an AI reader a short route from a scene to its event bodies, linked fragments, and extension functions.

## Goals

1. Give every External Events fragment a same-stem settings file containing identity and human-authored logic descriptions, while retaining the existing `.events` body and Link execution semantics.
2. Generate `.gdevelop/project-module-map.json` beside the catalogs on project creation, save, and catalog regeneration. It should provide concise paths, purpose text, and statically observed relationships for scenes, external fragments, and extension event functions.
3. Keep the map deterministic, derived from source files and settings, and safe to regenerate. It must never become an editable source of truth.
4. Let AI tools locate an event source and distinguish an authored description from a relationship proven by static analysis.

## Non-goals

- No change to the runtime `gd::ExternalEvents` model, Link expansion, event order, or compiled event JSON.
- No AI-generated descriptions or guesses about gameplay behavior.
- No new registration manifest in `scene.settings` and no embedded event body in settings.
- No cross-scene duplicate fragment names or new Link syntax.
- No runtime loading of the module map.

## Proposed source contract

The new format requires a same-stem pair:

```text
scenes/Game/external-events/HUD.events
scenes/Game/external-events/HUD.settings
```

`HUD.settings` uses the canonical managed filename encoding and TOML settings conventions:

```toml
kind = "externalEvents"
settingsFormatVersion = 7
name = "HUD"
description = "更新 HUD 并处理菜单交互。"
eventsLogic = "读取玩家状态，刷新显示，并响应菜单操作。"
```

`kind`, version, and `name` are required. `description` and `eventsLogic` are optional strings, defaulting to empty text. `description` states the fragment's role; `eventsLogic` describes its event flow. These are author-owned documentation fields, not compiled event data. Do not infer them from instruction names during save. The scene association remains path-derived; settings must not duplicate it. The sibling `.events` path is derived from the settings stem and is not stored as a mutable URI.

The reader validates matching decoded stems and settings `name`, unique project-wide fragment names under the existing NFC/case-insensitive rule, exactly one file of each kind, and the established path, size, symlink, and unknown-field limits. A missing pair member is a load error. Save, rename, move, and delete operate on both files transactionally. A fragment with empty events is valid, but still has a settings owner.

## Format cutover and one-time project conversion

This intentionally replaces the version 6 settings-free contract, including the previously approved `external-events-snippets-spec.md` rule. Raise `MULTI_FILE_FORMAT_VERSION` and all affected settings markers from 6 to 7; update the settings catalog format contract and `eventFileKinds` to advertise the pair. Production accepts version 7 only. Convert JurassicWorld once by creating a settings file for every existing fragment, preserving each `.events` byte sequence and Link name, and updating version markers. There is no general version 6 reader or automatic migration. The legacy JSON import route emits version 7 pairs directly.

Project format documentation, DSL documentation, source catalog guidance, and editor file discovery must agree on the new pair. Generated catalogs and module maps are regenerated after migration; old generated copies are not migrated as authoritative data.

## Generated map contract

Output path: `.gdevelop/project-module-map.json`. Initial schema:

```json
{
  "format": "gdevelop-project-module-map",
  "formatVersion": 1,
  "sourceFormatVersion": 7,
  "project": { "name": "Example", "settingsPath": "project.gdevelop" },
  "scenes": [
    {
      "name": "Game",
      "settingsPath": "scenes/Game/scene.settings",
      "events": [
        {
          "name": "sceneUpdate",
          "settingsPath": "scenes/Game/functions/sceneUpdate.settings",
          "eventsPath": "scenes/Game/functions/sceneUpdate.events",
          "purpose": "Scene update",
          "purposeSource": "settings",
          "links": ["HUD"]
        }
      ]
    }
  ],
  "externalEvents": [
    {
      "name": "HUD",
      "scene": "Game",
      "settingsPath": "scenes/Game/external-events/HUD.settings",
      "eventsPath": "scenes/Game/external-events/HUD.events",
      "purpose": "更新 HUD 并处理菜单交互。",
      "eventsLogic": "读取玩家状态，刷新显示，并响应菜单操作。",
      "linkedFrom": ["scenes/Game/functions/sceneUpdate.events"],
      "links": []
    }
  ],
  "extensions": [],
  "diagnostics": []
}
```

All paths are canonical project-root-relative paths using `/`, with no absolute path or `game://` prefix. Array order is stable: scene order from settings, then function order; fragment and reference lists by normalized name/path; extension order from settings, then nested function order. Omit timestamps and machine-specific data. Empty purpose fields remain empty rather than invented. `purposeSource` is `settings` when a description is present and `none` otherwise; lifecycle roles may supply a clearly marked built-in label.

Each scene records its scene event functions with settings/events paths, purpose, and outgoing links. Each external fragment records scene, both source paths, description, event-logic description, incoming Link callers, and outgoing links. Each extension records its settings path and every events-based function under the extension, prefabs, and behaviors, with owner kind/name, function settings/events paths, authored description and event-logic description when those fields exist, plus outgoing fragment links. Include nested scene/external/extension event bodies without dropping functions with empty bodies. For extension functions lacking an `eventsLogic` settings field, use their existing function `description` for purpose and leave event logic empty until that field is added by a separate schema change.

Use a stable event-source identifier or path for references so an AI reader can jump directly to the caller. The exact JSON field names should be frozen by a fixture test before implementation. The example shows the intended content, not a second source schema.

## Static analysis

Parse `.events` through the existing IfDo AST rather than line matching. Walk nested events to collect `BuiltinCommonInstructions::Link` targets and source paths. Resolve targets against the project-wide fragment-name index, record reverse `linkedFrom` edges, and report missing targets and cycles under `diagnostics` without inventing a resolved path. Function calls should be mapped to an extension function only when catalog instruction metadata identifies the call unambiguously; unresolved or dynamic relationships remain absent or receive a diagnostic. The map may include a compact `calls` edge for statically resolved functions, but must never claim that a link or function executes unconditionally merely because it appears in a body.

Purpose text comes only from settings. Structural labels such as `sceneUpdate` lifecycle roles come from registered metadata. Preserve the distinction in the output. Limit the map to navigation information; do not duplicate full event ASTs, instructions, object definitions, or catalog schemas. Use deterministic JSON serialization and bounded traversal to avoid disproportionate work on large projects.

## Affected layers and implementation plan

1. `MultiFileProjectFormat/index.js`: version 7 settings pair creation, discovery, strict validation, composition, migration, and managed-file ownership.
2. `LocalMultiFileProject.js` and local file scanning/transactions: discover both files, track change times, and remove both on deletion.
3. `ProjectSourceCatalog.js`: expose `externalEvents` settings kind and update catalog authoring rules and validation.
4. `LocalProjectWriter.js`: build the module map from validated source files/settings and write it in the same generated-output phase as catalogs. Add the output to open/regeneration paths where required, without treating it as project input.
5. A small pure map builder near `ProjectSourceCatalog.js`: AST traversal, relationship resolution, deterministic serialization, and diagnostics.
6. Editor authoring surfaces, if needed, to edit the two description fields without editing generated JSON.
7. Update `gdevelop-new-formats-spec.md`, `embedded-layout-settings-format-spec.md`, `gdevelop-events-dsl-spec.md`, and `external-events-snippets-spec.md` to make version 7 the current contract and preserve version 6 as migration history.

## Errors, performance, and verification

- Source load fails with a precise file path for missing/mismatched pairs, invalid kind/version/name, duplicate identities, or unknown fields. Map generation may report unresolved references in `diagnostics` but must not silently suppress invalid source syntax already rejected by the event compiler.
- Reuse parsed event representations from save/catalog work where practical. Avoid a second filesystem-wide scan. The map is proportional to the number of event nodes plus references, and serialization is deterministic.
- Add round-trip, migration, rename/delete, strict-path, and transaction-recovery tests at the multi-file seam. Add focused map fixtures covering nested Links, reverse callers, unknown targets, cycles, Chinese/encoded names, scene lifecycle bodies, extension/prefab/behavior functions, empty descriptions, and repeat generation byte equality.
- Run focused `newIDE/app` storage/catalog tests, Flow, lint/format checks, and the required Windows detached launcher after code changes, as directed by `AGENT.md`.

## Alternatives considered and open questions

Keeping fragments settings-free and placing descriptions in a central manifest would make identity and intent have different owners. Adding only comments to `.events` would be hard to validate and less stable for structured navigation. A generated map alone cannot hold author-owned intent because regeneration would erase edits.

`eventsLogic` is a single free-text string. Any other version 6 project must be converted explicitly before opening with this engine.
