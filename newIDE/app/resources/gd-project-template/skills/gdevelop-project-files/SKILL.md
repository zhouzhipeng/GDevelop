---
name: gdevelop-project-files
description: Create, inspect, modify, refactor, and verify GDevelop games through the version 13 multi-file project sources (`project.gdl`, `constants.toml`, `.gdl`, `tests.gdl`, and flat `tests/*.js` scripts). Use for any GDevelop project, scene, object, behavior, prefab, extension, third-party extension installation, reusable-component refactor, variable, resource, GLB animation/bone-name inspection, TSL material (`.tsl.ts`) authoring and GLB binding, Constants/placeholder, signal-system, SpringBoneDynamics hair/chest secondary bone animation, layout, event-sheet, JavaScript-event, or gameplay-test work. Read the generated authoring catalogs and public JavaScript/TSL declarations when relevant; regenerate catalogs after large structural changes, then validate direct edits before reload and runtime verification.
---

# GDevelop Project Files

## Catalog instruction names

For a catalog parameter, `valueKind` defaults to `type` when omitted.

Author actions and conditions using the catalog entry's **`dslName`** when present;
otherwise use its exact `type`. A `dslName` equal to `type` is omitted.
System names are fixed by the engine.
Use parameter `dslName` unchanged. Never invent abbreviations or edit generated
catalogs. Expressions inside `{{...}}` retain their existing names. The
formatter writes `dslName` when present and `type` otherwise.

## Source of truth

Treat project files as authoritative. Modify them directly; do not use MCP to
author the game after initialization. Use `create_project` to initialize a new
game, and `import_extension` to import and convert an official legacy extension
into canonical multi-file sources. Continue by editing generated sources directly.
There are no dedicated Constants MCP tools. Read and modify `constants.toml`
directly.


## Navigate project event logic

Read `.gdevelop/project-module-map.json` first when locating project logic.
`scenes[].events[]`, `externalEvents[]`, and `extensions[].events[]` provide
`settingsPath`, and an authored `purpose`. Fragment entries also
provide `eventsLogic` and `linkedFrom`. `links` contains statically found Link
target names; `linkPaths` gives their resolved event paths. Check `diagnostics`
body before reasoning about execution. The map is generated with the catalogs;
never edit it directly. Regenerate catalogs after source edits.

## Create a new game

When no project exists, call `create_project` with `project_directory` (an
absolute path to a directory that does not exist) and `project_name`. Its parent
directory must already exist. Optional integer `width` and `height` range from
1 to 16384 and default to 1280 and 720. For example:

```json
{"project_directory":"D:/Games/MyGame","project_name":"My Game","width":1280,"height":720}
```

The tool saves a canonical multi-file project with a default `Game` scene,
generated authoring catalogs/declarations, and bundled template/skill files.
It works without an open project and leaves the current editor project alone.
Require `created: true`, then call `open_project` with `project_path` equal to
the returned `projectFile`. Existing unsaved editor changes are protected by
`open_project`; save them or obtain authorization before explicitly discarding.
Read the new project's sources and generated catalogs before further edits.
Creation refuses all existing target directories. If it fails, inspect any
partial files before retrying with a fresh destination.

## Engine-level bugs

If you encounter an engine-level issue or bug while working on a GDevelop
project, pause the current project task immediately. Investigate and fix the
engine bug first in the GDevelop engine source at `D:\code\GDevelop`, verify
the engine fix, and only then resume the project task. Do not work around an
engine bug solely in project files or continue the project task while the
engine issue remains unresolved.

Read, in order:

1. `project.gdl` for project metadata and non-constants project data.
2. `resources.gdl` for the complete project resource registry.
3. `constants.toml` for the complete editor-only Constants object.
4. `tests.gdl`, then the selected flat `tests/*.js` source when gameplay
   tests are in scope.
5. `.gdevelop/gdl-catalog.json`, then relevant child `.gdl` files
   for semantic configuration, object definitions, and root layer and instance nodes, including instances, layers, spatial bounds, background, and
   editor-canvas state.
6. `.gdevelop/project-module-map.json` to locate scene, external-fragment, and
   extension event sources and their static Link relationships; then read the
   referenced `.gdl` documents for current logic.
7. Read `.gdevelop/conditions-catalog.json` for conditions,
   `.gdevelop/actions-catalog.json` for actions, and
   `.gdevelop/expressions-catalog.json` for expressions. Each file has `kind`,
   `entries`, and `count`; search its `entries` for exact metadata. Catalogs also include compatibility entries; check deprecation information
   before using an instruction in new events.
8. `.gdevelop/runtime-api.d.ts` and `.gdevelop/project-api.d.ts` before adding
   or changing any JavaScript event, and `.gdevelop/harness-api.d.ts` plus its
   runtime/project declaration dependencies before adding or changing a
   gameplay test.
9. `.gdevelop/tsl-api.d.ts` and `.gdevelop/tsl-catalog.json` before creating or
   changing a `.tsl.ts` material. Use the TSL reference and, when available,
   `get_tsl_authoring_context` to retrieve the matching declarations,
   capability rules, examples, and diagnostics.

The generated catalogs and JavaScript/TSL declarations are regenerated from the
loaded project every time GDevelop saves. Never edit them. Search them narrowly
with `rg`: use file kind, object,
behavior, effect, owner, or layout context in the source catalogs, and use
instruction type, displayed name, group, description, parameter `dslName`, or
expression name in the instruction catalog. Generated JSON keeps one catalog
entry per line so a matching search returns only relevant metadata. The three
instruction files share an instruction catalog version and source fingerprint;
regenerate all three together if any is absent or stale. Old combined and
deprecated catalog files are removed during generation and are never read.

After a large structural source change, call the no-input GDevelop MCP
`generate-catalogs` tool and wait for `catalogsRegenerated: true` before making
edits that depend on the changed structure. Large structural changes include
installing or importing an extension and creating, deleting, renaming, or
substantially changing a prefab, behavior, function, extension, object type, or
other catalog-owned component. Re-read the relevant freshly generated
settings, layout, and instruction catalogs before continuing; if JavaScript is
in scope, also re-read the applicable declarations, including
`harness-api.d.ts` for gameplay tests; if TSL is in scope, re-read
`tsl-api.d.ts` and `tsl-catalog.json`. Do not rely on generated content
read before the structural change. A later structural change invalidates that
view and requires another `generate-catalogs` call.
This refresh is not validation and does not replace the final
`validate_project_files` gate.

Use the catalogs as authoring contracts:

- In `gdl-catalog.json`, read `fileKinds` for the target document's path,
  typed DSL root, required fields, and ownership boundary.
  Treat the matching `schema.rootFields` and recursively nested
  `schema.childNodes` as the complete structural contract, including exact
  node types, child-record fields, dynamic-key rules, and empty forms;
  Search
  `objectTypes`, `behaviorTypes`, and `effectTypes` for exact registered type
  names, defaults, requirements, and property metadata. Use `settingsOwners`
  to resolve existing project components and their object definitions. For an
  attached behavior, initialize or edit only properties listed in its
  `behaviorTypes` entry. Editor-hidden, deprecated, extension-owned, and legacy
  serializer properties are deliberately absent from the authoring surface;
  never invent them, but retain only registered serializer fields; unknown fields are rejected.
- In `gdl-catalog.json`, read `layoutNodes` for exact context-specific
  nodes, fields, value types, defaults, and constraints. Select the one
  `layoutContexts` entry whose `owner` matches the scene, prefab, variant, or
  external layout, then use only its listed layers, objects, and attached
  behaviors. Search `effectTypes` for exact effect parameters and types.
- If the relevant registered type, file kind, layout table, or effect is absent,
  stop instead of guessing. If a direct edit introduces a new object or
  attached behavior name, validate its registered type in the GDL catalog,
  define it first in the owning `.gdl` file, and then reference that exact
  new name in the same coherent owner-settings patch; the saved layout context will
  list it after GDevelop regenerates the catalogs.

Treat additive semantic and capability metadata as enforceable contracts:

- `lighting = true` means a dedicated 2D Lighting Layer. It is invalid with
  `rendering = "3d"` or `"2d+3d"`; use `lighting = false` plus catalog-listed
  Scene3D light effects.
- Resource `kind = "image"` has `image-2d` and `three-texture` capabilities.
  SVG image resources are valid Three textures after Pixi rasterization.
  Preserve and report any `THREE_TEXTURE_UNSUPPORTED_SOURCE` diagnostic instead
  of assuming every loaded resource is texture-compatible.
- For new or changed Physics3D data, author every writable catalog property and
  require finite gravity values and `worldScale > 0`. Runtime/default hydration
  protects partial legacy data but is not a reason to omit cataloged fields in
  new source.
- Keyboard parameters use the catalog's canonical names. Main-row digits are
  `Num0` through `Num9`; aliases such as `"1"` and `Digit1` normalize to
  `Num1`, while `Numpad1` remains distinct. Unknown static literals fail with
  `INPUT_UNKNOWN_KEY_NAME`.

Search narrowly, for example:

```sh
rg '"type":"Sprite"' .gdevelop/gdl-catalog.json
rg '"type":"Tween::TweenBehavior"' .gdevelop/gdl-catalog.json
rg '"table":"instance"' .gdevelop/gdl-catalog.json
rg '"owner":{"scene":"Main"}' .gdevelop/gdl-catalog.json
```

Do not edit legacy project JSON, including `.gdevelop/game.json`. It is
generated compatibility/runtime output, not multi-file source.

## File contract

All `.gdl` and `project.gdl` use **GDevelop Language (GDL)**, not TOML. Read
[GDevelop Language (GDL)](references/gdl-usage.md) before editing declarations.

- Use `key = value` for properties and `node { ... }` for structure. Names,
  IDs and all properties belong inside the node. Two-space indentation is
  canonical; braces determine ownership. One declaration per line.
- Every document has exactly one typed root: project, resources, tests,
  scene, prefab, variant, layout, fragment, object, function,
  extension or behavior. The physical path supplies the owning scope.
- Only project.gdl has `formatVersion = 13`. Do not write kind,
  settingsFormatVersion, TOML headers, per-document format versions, or
  settings/layout wrapper nodes. Extension metadata can still have a semantic
  version string when its schema defines one.
- Scene, prefab, variant and layout settings contain their own configuration
  and layout. Put layer and instance directly below that root. Layer contains
  camera/effect; instance contains properties/variable/behavior overrides.
  Root instance order is global serialized order; preserve UUIDs.
- Object definitions remain flat `objects/<Object>.gdl` files. An
  object.behavior defines an attachment; instance.behavior only overrides an
  existing attachment. Dynamic fields must be registered in the catalog.
- Declare repeated `variable {}` nodes directly on the owner, with `name` and
  `value`. Use `{ Key = value }` structures and `[]` arrays inside value; infer
  ordinary types and declare enum explicitly. Extension defaults require scope.
  Descendant UUID/enum/editor fields live directly on nested variable declarations.
  Expanded containers require explicit structure/array type and omit value.
  Structure children require unique names; array children forbid names and use source order.
  UUID id is optional; preserve existing ids for editor variable refactoring.
  Collection wrappers, metadata/path annotations and shorthand are rejected.
  Root variables and instance variables have different scopes.
- Object groups use `objectGroups { Group = ["Player"] }`, expanded across
  lines. Required behaviors use objectGroupRequiredBehaviors. Empty repeated
  collections may use an empty array assignment; nonempty record collections
  use child nodes.
- Sprite points use structured originPoint/centerPoint/point nodes; collision
  masks use polygon nodes containing point nodes. No inline object literals.
- Functions and external fragments keep signature/identity and events in one .gdl file.
  Use a top-level events container; never create .events files.
- tests.gdl has a tests root with repeated test nodes. Scripts remain
  direct children of tests/; `file` is a canonical root-relative path, with
  no game:// prefix. Run results are ignored state below .gdevelop.
- constants.toml remains direct-root TOML for editor Constants. It is the
  explicit exception and has no settings markers. Assets, events and generated
  JSON do not change their formats.
- Only the latest DSL is accepted. Unknown fields/types are errors. There is
  no old-format reader, rawJson escape hatch or migration workflow.

## Project layout

The following paths are the engine's canonical component contract. Auxiliary
production and documentation directories are described separately below.

```text
project.gdl
resources.gdl
constants.toml
tests.gdl
tests/<Encoded name>.js
objects/<Object>.gdl
scenes/<Scene>/scene.gdl
scenes/<Scene>/objects/<Object>.gdl
scenes/<Scene>/functions/sceneUpdate.gdl
scenes/<Scene>/functions/<OptionalLifecycle>.gdl # only when non-empty
scenes/<Scene>/external-events/<Fragment>.gdl
scenes/<Scene>/external-layout/<External>.gdl
extensions/<Extension>/extension.gdl
extensions/<Extension>/functions/<Function>.gdl
extensions/<Extension>/prefabs/<Prefab>/prefab.gdl
extensions/<Extension>/prefabs/<Prefab>/functions/<Function>.gdl
extensions/<Extension>/prefabs/<Prefab>/objects/<Object>.gdl
extensions/<Extension>/prefabs/<Prefab>/variants/<Variant>/variant.gdl
extensions/<Extension>/prefabs/<Prefab>/variants/<Variant>/objects/<Object>.gdl
extensions/<Extension>/behaviors/<Behavior>/behavior.gdl
extensions/<Extension>/behaviors/<Behavior>/functions/<Function>.gdl
.gdevelop/conditions-catalog.json
.gdevelop/actions-catalog.json
.gdevelop/expressions-catalog.json
.gdevelop/gdl-catalog.json
.gdevelop/project-module-map.json
.gdevelop/runtime-api.d.ts
.gdevelop/project-api.d.ts
.gdevelop/harness-api.d.ts
.gdevelop/tsl-api.d.ts
.gdevelop/tsl-catalog.json
```

Do not create optional component-grouping folders. Canonical component directories are
fixed; object/function grouping belongs in each settings file's `folder`
array. Settings files never reference other settings files.

In format version 13, each `.gdl` document under
`external-events/` declares a fragment. Its decoded filename and settings
`name` supply its project-unique NFC identity; the physical scene supplies its
authoring context. Names must also be unique ignoring case. There is no
fragment `order`: display is sorted by name, while execution follows Link
positions. `link "Name"` expands the same body in every caller lifecycle and
inherits parent conditions, picked objects and local variables. Empty,
comment-only and unreferenced event bodies are valid, but the settings file is
still required. Declare an external layout
independently with `scenes/<Scene>/external-layout/<External>.gdl`; it owns
its identity, project-wide contiguous `order`, and root layout nodes subtree.
Do not write `externalEventFiles`, `externalLayoutFiles`, layout URIs,
`associatedLayout`, `linkedScene`, or `unresolvedScene`, and never create a
root `externals/external.gdl`.

### Auxiliary directories and outputs

For project initialization, directory organization, resource production, or
verification output, follow [the project directory conventions](../../docs/PROJECT_STRUCTURE.md).
These conventions supplement, rather than replace, the component contract:

```text
README.md                              # current game entry and documentation index
assets/                                # runtime resources and companion notices
sources/                               # editable art/model/audio production files
materials/                             # optional TSL runtime source
tools/                                 # project-specific production/maintenance scripts
docs/                                  # maintained design and development documents
docs/history/                          # optional superseded descriptions
artifacts/verification/<task-version>/  # reviewed reports and related screenshots
artifacts/previews/                     # standalone display screenshots
artifacts/local/                        # ignored local results
tmp/                                   # ignored intermediate output
builds/                                # ignored exported packages
issues/                                # ignored local diagnostics
skills/                                # bundled authoring workflows
```

Create optional directories only when used. `sources/` contains production
inputs, not GDevelop scenes or events. Keep `tests/*.js` flat and reserve
`.gdevelop/` for generated/editor files. Do not create competing root
`preview/` or `docs/verification/` output directories. Project tools belong in
`tools/`; bundled helpers remain in their owning skill's `scripts/` directory.

Preserve registered runtime paths during auxiliary reorganization and update
only affected production-tool, document and external-dependency references.
For source-only moves, verify file preservation and dependency resolution;
apply the usual source validation and runtime gates whenever game data or
runtime assets change. A documentation-only change does not require starting
or reloading the game.

New verification reports identify their source commit, scope, actual results
and unverified areas. Store report file paths relative to `project.gdl`;
Markdown links remain document-relative. Historical evidence applies only to
its recorded revision; moving it does not rerun tests. Keep temporary runs
ignored and commit selected evidence rather than all generated output.

## Task references

Load only the references required by the task:

- Read [references/create-extensions.md](references/create-extensions.md) in
  full before creating an extension or adding/removing extension-level
  functions, prefabs, behaviors, or their functions.
- Read [references/gdl-usage.md](references/gdl-usage.md) in full before
  creating or changing layout nodes. Preserve existing UUIDs and use its
  exact scene, prefab/variant, or external-layout context rules.
- Read [references/gdl-usage.md](references/gdl-usage.md) in full before
  creating or changing embedded events in a `.gdl` file. Use only its canonical Settings event
  structures and the instruction `dslName` and parameter `dslName` found in the
  generated project instruction catalog.
- Also read [references/javascript-api.md](references/javascript-api.md) in
  full before creating or changing any event with type = "javascript". Use only the generated
  public declarations, author new blocks with `strict=true`, and preserve
  compatibility mode only for existing legacy JavaScript.
- Read
  [references/gameplay-test-harness.md](references/gameplay-test-harness.md)
  in full before creating or materially modifying `tests.gdl` or any
  `tests/*.js` script. Use the exact flat version 13 file identity, read the
  generated `.gdevelop/harness-api.d.ts` contract, and complete its
  validation, reload, run, and result-polling workflow.
- Read [references/tsl-materials.md](references/tsl-materials.md) in full
  whenever the task creates or changes a `.tsl.ts` source, a `tslMaterial`
  resource, a `TSLMaterial::Material` behavior, a TSL material event binding,
  or TSL validation/preview. Read `.gdevelop/tsl-api.d.ts` and
  `.gdevelop/tsl-catalog.json` (or retrieve the equivalent
  `get_tsl_authoring_context` result), use `inspect_model_materials` for exact
  GLB selector/geometry metadata, and call `validate_tsl_file` on the saved
  source before activation.
- Read [references/constants.md](references/constants.md) in full
  whenever the user asks to create, edit, reorganize, or consume Constants,
  or to add/change a `{{...}}` placeholder. Also read the events guide for an
  event consumer and the extension guide when injecting config into a prefab,
  behavior, or reusable extension.
- Read [references/signal-system.md](references/signal-system.md) in full
  whenever the user asks for signals, messaging, notification, scene/prefab
  communication, `SignalReceived`, signal payload handling, or an
  `onSignal` lifecycle. Also read the events guide, and read the extension guide
  before adding or changing a prefab/custom-object `onSignal` function. Read
  the Constants guide too when signal names use placeholders.
- Read
  [references/springbone-behavior.md](references/springbone-behavior.md) in
  full whenever the user asks to create or tune simulated hair, ponytail,
  chest/breast, tail, strap, or other secondary 3D bone animation with
  `SpringBoneDynamics`. Also read the events guide before adding runtime
  controls, and use collision-shape preview verification when colliders change.
- Read
  [references/reuse-community-extensions.md](references/reuse-community-extensions.md)
  in full before implementing a substantial reusable system or installing a
  third-party extension. Search the official GDevelop extensions repository
  first and prefer adapting a reviewed existing extension over rebuilding a
  heavy feature from scratch.
- Read
  [references/refactor-with-reusable-components.md](references/refactor-with-reusable-components.md)
  in full whenever the user asks to refactor, extract, deduplicate, modularize,
  or reorganize project logic with prefabs, behaviors, or functions. Also load
  the creation guide and, for any substantial subsystem, the reuse guide.
  Complete the migration and verification; do not stop after suggesting an
  architecture or creating empty component shells.

Build from scratch only when repository search finds no suitable extension,
the available extension is incompatible or unsafe, or a small project-specific
implementation is materially simpler. Record that decision in the task result.

## Event authoring

Read [the unified event syntax](references/gdl-usage.md) before editing function
or fragment bodies. Only GDevelop Language (GDL) format 13 is supported. Function signatures
and events share one .gdl file; .events files are rejected. Use explicit
conditions/actions blocks containing bare catalog instructions, typed event
nodes, independent group/comment/link nodes, and raw multiline code blocks.

For comment nodes, keep the text readable against its background. Omit
`background` and `color` to use the defaults when possible. If specifying
colors, use contrasting values; never set both to black. For example:

```gdl
comment {
  text = "游戏进行时执行以下事件；结束后停止移动、生成与碰撞处理。"
  background = [255, 230, 109]
  color = [0, 0, 0]
}
```

Use sceneLoad for initialization; never author SceneJustBegins. Guard per-frame
sceneUpdate actions with effective conditions. Keep parent picking and source
order semantics. New JavaScript uses strict=true and the generated public API.

For behavior-sensitive edits, use `get_gdl_instruction_semantics` with exact
`kind` and `type`, then `analyze_gdl_events` with the project-relative GDL file
and optional mixed-list `event_path`. These tools do not refresh catalogs or
reload the editor. On `catalog-stale`, run `generate-catalogs` and retry.
Read `unknownReasons`, coverage and truncation before relying on a summary.
`complete` means covered static rules, not verified gameplay. Current complex
logical merges, inversion, arbitrary expressions/JS, loops and cross-file calls
may remain partial. See [event analysis](references/gdl-usage.md#execution-and-picking-analysis).

## Direct-edit workflow

1. Inspect manifests and only the owned files relevant to the request. Search
   `.gdevelop/gdl-catalog.json` before adding or changing settings-owned
   object, behavior, effect, component, or embedded layout definitions. Search
   its `layoutNodes` and `layoutContexts` for the exact layout schema and
   matching project context before adding or changing layout content. For
   gameplay tests, inspect `tests.gdl` and the exact selected flat source
   before editing either one.
2. Search `.gdevelop/conditions-catalog.json`, `.gdevelop/actions-catalog.json`, and `.gdevelop/expressions-catalog.json` for required instructions and
   expressions. The generated catalog excludes editor-hidden and deprecated
   APIs; never invent or reuse an instruction identifier that is absent from it
   when authoring new events.
   If a JavaScript event is required, read `runtime-api.d.ts`,
   `project-api.d.ts`, and the JavaScript reference before editing the block.
   If a gameplay test is required, first run `generate-catalogs`, then read the
   three generated JavaScript declarations and the gameplay-test reference in full. Do
   not infer either authoring API from raw engine source or preview code. If a
   TSL material is required, read `tsl-api.d.ts`, `tsl-catalog.json`, and the
   TSL reference before editing; save the source and call `validate_tsl_file`
   before treating it as an activation candidate.
3. Patch source files directly. Use `apply_patch` for precise edits.
   Creating or changing an object type or one of its behaviors is a settings
   edit; creating or moving an instance is a layout edit.
4. After any large structural change (including extension installation or
   creating/changing a prefab, behavior, function, extension, or object type),
   call the no-input MCP `generate-catalogs` tool. Require
   `catalogsRegenerated: true`, then re-read every refreshed catalog relevant
   to subsequent edits. Re-read the applicable declarations too when
   JavaScript events or gameplay tests are in scope. Do not continue from
   generated metadata read before the structural change. Repeat this step
   after each later structural phase.
5. Re-read every changed manifest reference. Verify each `game://` URI exists
   and stays inside the project; separately verify each `tests.gdl` file
   identity is a scheme-free canonical flat `tests/<Encoded name>.js` path.
6. Check settings and GDevelop Language (GDL) layout syntax/semantics, duplicate
   namespaces, event depth, instruction names, named parameters, gameplay-test
   manifest/source ownership, and asset paths.
7. Call the no-input GDevelop MCP `validate_project_files` tool after the most
   recent source edit. Require `valid: true`, `structurallyValid: true`,
   `eventCodeGenerationValid: true`, `semanticLintPassed: true`,
   `extensionGeneratedCodeValid !== false`, and
   `javascriptAuthoringValid !== false`; use its file URI, error code, line,
   column, and source excerpt to fix every reported settings, layout, events,
   reference, generated-code, JavaScript-authoring, or semantic failure. This
   call first regenerates the generated `.gdevelop` catalogs and declarations,
   including `tsl-api.d.ts` and `tsl-catalog.json`, then validates the sources
   using those fresh contracts. This project-level gate does not replace the
   single-file `validate_tsl_file` check for a TSL source.
   Call it at least once before any reload; a failed validation does not satisfy
   this gate. `validMeaning = "pre-runtime-validation-passed"` still means
   `runtimeVerified: false` and `completionReady: false`. Never summarize
   `valid: true` as "the game works" or as task completion without preview
   evidence.
8. After the requested task is complete and validation succeeds, use Git from
   the project repository root to commit every task-owned change before
   `reload_project`. Inspect `git status` and the final diff, stage all changes
   made for the user's task without including unrelated pre-existing work, and
   create a commit with a concise, descriptive imperative message. Record the
   commit hash and message for the final report. If any source edit is needed
   afterward, validate again and create a follow-up commit before reloading.
9. For a manual verification sequence, call `reload_project` with
   `mode: "start"`, record its `operation_id`, and poll that exact ID with
   `mode: "status"` until it completes successfully. Use `mode: "wait"` with
   the same ID only when a blocking wait is useful. If interrupted before
   recording the ID, call status without an ID to discover the active/latest
   operation. Never start a duplicate while one is running, invoke an MCP save,
   or dismiss a catalog artifact/subphase failure as a generic timeout. Skip
   this manual reload only when step 10 will call `verify_project_change`,
   because that workflow performs its own validated reload.
10. For gameplay or visual changes, prefer `verify_project_change` after the
    Git commit. It performs validation → reload → optional stale-preview close
    → fresh paused launch → deterministic frames → bounded inspection → typed
    assertions → optional screenshot, stops at the first failed stage, and
    retains each stage receipt. Use only its closed assertion schema (object
    count, finite instance position, runtime-error count, and renderer
    group/visible-mesh/texture-failure/rejection checks). Require
    `runtimeVerified: true` and `completionReady: true`. For a manual sequence,
    call `launch_preview` only after step 9, start paused, and use `run_frames`
    with `objects`, `include`, and optional `instance_indexes`. Runtime
    verification is mandatory for rendering/input changes and extension
    actions that create, delete, pick, or mutate objects.
    Pass `display_collision_shapes: true` when collision geometry must be
    visually verified. Every `launch_preview` call closes the previous game and
    debugger windows before opening a fresh pair.
    If any project source changes after the reload, call `reload_project` again
    before the next preview, preceded by a new successful
    `validate_project_files` call and Git commit for those edits.
11. When an authored gameplay test covers the behavior, run it only after the
    final successful validation, commit, and reload. Call `run_gameplay_tests`
    with the exact scheme-free `tests.gdl` `file`, or omit `file` to run
    all tests. Record the returned `operation_id` and poll
    `get_gameplay_test_results` until `status` is `completed` or `failed`.
    The floating gameplay-test game window closes automatically when the MCP
    batch finishes.
    Report the behavior as gameplay-test verified only when the operation is
    `completed` and `summary.all_passed` is `true`. A source edit after reload
    requires validation, a follow-up commit, and another reload before a new
    run.

For assets, write the asset file inside the project, add/update its resource
entry in `resources.gdl`, then reference its project-relative path from UI
configuration. Do not create generated images when a code-native or existing
asset is appropriate.

For an existing `.glb`, resolve its resource path through `resources.gdl`,
then call the read-only MCP tool before authoring an animation, bone-name, or
TSL mesh/material reference:

```text
inspect_glb_model { file_path: "assets/models/hero.glb" }
```

`file_path` may be absolute or relative to the directory containing
`project.gdl`. Each returned `animationNames` entry is an exact animation
clip source name: use it as the Model3D animation `source`. A configured local
animation `name` (the alias selected by events) may differ from that source.
Use returned source and `boneNames` values exactly, including case; never guess
names from a filename or substitute preview-only labels. The returned bone
names are canonical names usable by GDevelop, so the tool omits empty or
ambiguous duplicate names as well as runtime-generated fallback names that
cannot be identified safely from metadata alone. The result also includes the
same `meshCount`, `materialSlotCount`, and `meshes[].materials[]` structure
shown by the TSL Resources editor, including exact runtime mesh/material names,
material classes, texture channels, skinning, morph targets, transparency, and
transmission. Runtime mesh/material inspection is bounded to 256 MiB and may
load the model's geometry and textures; use the Blender workflow for deeper
scene inspection or any mutation.

## MCP boundary

MCP is extension-import/synchronization/read/debug/gameplay-test-only. Use it
only for:

The complete public protocol surface is the following allowlist:

- Local project opening: `open_project`.
- Editor/project inspection:
  `gdevelop_get_editor_state`, `gdevelop_get_editor_selection`,
  `gdevelop_get_project_summary`, `gdevelop_list_scenes`,
  `gdevelop_list_objects`, and `gdevelop_inspect_signal_usage`.
- Local asset inspection: `inspect_glb_model` and
  `inspect_model_materials`.
- TSL authoring and validation: `get_tsl_authoring_context`,
  `validate_tsl_file`, and `render_tsl_material_preview`.
- GDL execution and picking inspection: `analyze_gdl_events` and
  `get_gdl_instruction_semantics` (read-only disk-source analysis).
- Catalog, validation, and tool discovery:
  `generate-catalogs`, `validate_project_files`, `inspect_tool_schema`,
  and `get_tool_usage_examples`.
- Synchronization and runtime verification:
  `reload_project`, `launch_preview`, `wait_until_preview_ready`,
  `preview_health_check`, `gdevelop_inspect_running_preview`, `run_frames`,
  `verify_project_change`, `simulate_preview_input`, `control_preview`,
  `set_runtime_state`, and `capture_preview_screenshot`.
- Gameplay tests: `run_gameplay_tests` and `get_gameplay_test_results`.
- Public write operations: `create_project` and `import_extension`.

No other MCP tool name is supported, introspectable, or callable, even when
write/command permissions are enabled. The two gameplay-test tools are always
available because they execute and inspect existing authored tests rather than
author project source. In particular, there is no generic
editor-call, command, save, project patch/sync, scene/object/resource authoring,
or hidden resource-read escape hatch. The allowlist describes protocol
availability; this file-first skill still permits only the narrower workflows
below and authors project source directly.

Constants are outside this MCP surface. The AI model must author them by
reading and editing `constants.toml` directly.

- Initializing a new local game with `create_project` as described above.
- Importing and converting an official legacy extension with
  `import_extension`. It must return the generated source paths; all later adaptation is a
  direct file edit.
- Opening a specific local project entry in the editor with `open_project`.
- Reloading direct disk edits into the editor with `reload_project`.
- Regenerating and synchronously waiting for the generated source catalogs and
  JavaScript/TSL declarations with `generate-catalogs` after large structural
  source changes, so subsequent authoring can read current contracts.
- Retrieving the pinned TSL authoring pack, validating one saved `.tsl.ts` file,
  inspecting one GLB's material metadata, and rendering a validated TSL
  material preview with the read-only TSL tools. `validate_tsl_file` is the
  authoritative single-file check; it does not replace `validate_project_files`.
- Regenerating all source catalogs and validating direct disk edits without
  changing editor memory by calling the no-input `validate_project_files` tool
  before `reload_project`.
- Current editor/project/selection queries.
- Inspecting a local `.glb` with `inspect_glb_model` to obtain exact animation
  clip source and canonical bone names before authoring references to them.
- Launching or controlling a debug preview.
- Deterministic frame stepping and input simulation.
- Inspecting live runtime state, logs, errors, audio, and bounded targeted
  instance position, angle, force, variable, and behavior state.
- Capturing preview screenshots.
- Starting one existing authored gameplay test by canonical file identity, or
  all authored tests, with `run_gameplay_tests` after validation and reload.
- Polling and paging a retained gameplay-test operation with
  `get_gameplay_test_results` until it reaches a terminal state.
- Running the staged `verify_project_change` gate with typed assertions and
  bounded renderer diagnostics. Renderer receipts expose scalar scene,
  layer/group/camera/mesh/visibility/texture-failure/rejection information;
  they never serialize raw Three.js, Pixi, renderer, canvas, or DOM objects.

Except for `create_project` initialization and the single `import_extension`
conversion transaction, never use MCP
to create scenes, objects, resources, variables, instances, extensions,
behaviors, prefabs, or events. Never use generic editor-call, command, patch,
sync, or save tools for authoring.

`run_gameplay_tests` starts an asynchronous run of existing authored tests. To
select one test, pass its exact scheme-free `tests.gdl` `file`, such as
`tests/Player%20can%20jump.js`; never pass a name, `game://` URI, absolute
path, nested path, or guessed alias. Omit `file` to run all project tests first
and then extension tests in canonical project order. `timeout_ms`, when used,
is the 1,000-to-300,000 ms wall-clock budget for each selected test, not the
whole batch. The start response is expected to be immediate and normally has
`status: "queued"`; record its stable `operation_id`.

Poll `get_gameplay_test_results` with that `operation_id` until the operation
is terminal. `queued`, `launching`, and `running` are non-terminal;
`completed` and `failed` are terminal. Use `offset` and `limit` to page the
completed per-test results, with a maximum page size of 100. If the start
response was lost, omit `operation_id` to recover the active or most recently
retained operation; an omitted ID never starts or retries a run. Individual
`failed`, `error`, `stopped`, or `timeout` test results are result data and can
appear in a successfully `completed` operation. Only `completed` together with
`summary.all_passed: true` is passing gameplay-test evidence. An operation
status of `failed` means the batch itself could not execute or finish its
result persistence; inspect its bounded `operation_error` and any partial
results.

The run resolves the canonical selector against the active project and then
executes the current in-memory source; it never reads the selected path from
disk. Therefore every direct test-source edit must pass
`validate_project_files` and a successful `reload_project` before the run.
Only one gameplay-test batch runs at a time, and project open/reload/preview
workflows are unavailable while it is active. MCP gameplay-test runs are
unpaced and suppress harness screenshots; use the final frozen preview with
`capture_preview_screenshot` only when visual evidence is needed. Read the
dedicated gameplay-test reference for deterministic authoring rules and result
interpretation.

`generate-catalogs` is a mandatory mid-task refresh after every large
structural source change. Require `catalogsRegenerated: true`, then read the
latest relevant `.gdevelop/gdl-catalog.json` and
`.gdevelop/conditions-catalog.json`, `.gdevelop/actions-catalog.json`, and `.gdevelop/expressions-catalog.json` and,
for JavaScript work, the applicable generated `.d.ts` files, or for TSL work
`.gdevelop/tsl-api.d.ts` and `.gdevelop/tsl-catalog.json`, before making
dependent edits. The tool writes and verifies all generated authoring files,
including the TSL declaration/catalog pair, and does not validate sources or
reload editor memory.

`validate_project_files` is a mandatory reload gate. In every direct-edit task,
call it successfully with no inputs at least once after the most recent
source-file edit and before `reload_project`. It regenerates the instruction
catalogs, the GDL catalog (including embedded layout authoring data), and
the JavaScript/TSL declarations first, then
reconstructs the generated `game.json` representation from the multi-file
settings, layouts, and events and type-checks JavaScript event blocks against
the fresh runtime/project public APIs without replacing editor memory. It also
regenerates the harness declaration for test authoring; the later gameplay-test
run, not this validation receipt, executes a test script. A later source edit
invalidates the earlier validation receipt. Require its structural,
event-code-generation, extension-generated-code, JavaScript-authoring, and
semantic statuses, not only the compatibility `valid` boolean. Its successful
result deliberately keeps `runtimeVerified: false` and
`completionReady: false`; behavior-sensitive changes still require a paused
preview and deterministic runtime inspection. Never report the game as working
or the task as complete from this receipt alone.

The Git commit is also a mandatory reload gate. After the final successful
validation, inspect the repository diff, stage every change made for the user's
task, and commit it with a proper concise, descriptive message. Do not include
unrelated pre-existing changes. `reload_project` must run only after this commit
succeeds. A later source edit requires a new validation and follow-up commit
before another reload.

`reload_project` remains a mandatory preview gate, either as an explicit call
or as the reload stage inside `verify_project_change`. After both the validation
and Git-commit gates, a manual workflow starts it with `mode: "start"`, records
the immediate `operation_id`, and polls that exact operation with
`mode: "status"` until its receipt completes successfully. A status call
without an ID discovers the active/latest retained operation after caller
interruption. Never launch or relaunch a preview from stale editor memory. A
later source edit invalidates the validation, commit, and reload receipts.
Never start another reload while the current operation is running.
The reload writes generated catalogs itself and acknowledges their modification
times; do not respond to a "Project files changed on disk" dialog by starting a
second reload while the recorded operation is still running.

## Verification

Before finishing:

- Confirm every changed `.gdl` parses as latest GDevelop Language (GDL) and validates against its registered component and layout schemas.
- Confirm layer and instance nodes contain only placement/layout concepts and
  contain no `objects`, `objectGroups`, or behavior definitions.
- Confirm no `.gdl` file contains a legacy `*FolderStructure` property;
  object/function grouping uses only a valid local `folder` array.
- Confirm every global, scene, and prefab object definition and its complete
  behaviors are at the local root of its individual `<Object>.gdl` file.
- Confirm attached behaviors use catalog-listed properties for new edits and
  use the complete registered serializer schema; unknown fields are errors.
- Confirm prefab and behavior property descriptor arrays are flat and contain
  no grouping/folder metadata.
- Confirm every prefab/behavior function has one flat
  `<Function>.gdl` document containing signature and events, and
  owner settings contain no embedded function entries.
- Confirm settings references use `game://` and resolve to existing files.
- Confirm settings file kinds and every object/behavior/effect type against
  `gdl-catalog.json`.
- Confirm layout tables, fields, layers, objects, attached behaviors,
  and effect parameters against the matching `layoutContexts` entry and
  `layoutNodes` definitions in `gdl-catalog.json`.
- Confirm no `3d` or `2d+3d` layer is marked `lighting = true`; inspect
  renderer diagnostics for a Three scene/group/camera, visible meshes, zero
  rejected objects, and zero failed textures when 3D rendering changed.
- Confirm image resources used by 3D materials have the cataloged
  `three-texture` capability. SVG image resources are supported through the
  cached Pixi raster source.
- Confirm every authored Model3D animation `source` and bone-name reference
  exactly matches an `animationNames` or `boneNames` entry returned by
  `inspect_glb_model` for that asset. Do not require the local animation alias
  selected by events to match its clip source.
- Confirm Physics3D world scale is finite and positive and runtime instance
  coordinates remain finite.
- Confirm catalog instruction types, kinds, scopes, and `dslName` arguments.
- For every changed JavaScript event, confirm `strict=true`, validate all
  context globals/project literals/public members against both generated
  `.d.ts` files, and confirm no forbidden private or ambient API is used.
- For every changed gameplay test, confirm its `tests.gdl` record and
  unique source agree, its scheme-free `file` is flat and canonical, and its
  script is an async body rather than a wrapper. Confirm every advancing
  harness call is awaited, waits are bounded, inputs are released, snapshots
  are refreshed after stepping, and only members declared by
  `.gdevelop/harness-api.d.ts` are used.
- For Constants changes, confirm `constants.toml` ownership, direct-root
  TOML data, placeholder paths/types, and regeneration-time behavior
  against the Constants reference.
- For TSL material changes, confirm the source ends in `.tsl.ts`, imports only
  the approved modules/symbols, preserves the material contract, and has a
  saved `validate_tsl_file` result at the required level. For automatic
  activation require `activation_ready: true`, a current source hash, matching
  registered `tslMaterial` resource, and verified TSL catalog hashes. Use a
  model-level result when claiming compatibility with a particular GLB.
- For signal changes, confirm target kind, receiver kind, fixed `onSignal`
  signature, guarded emission, next-dispatch timing, and preview signal-monitor
  evidence against the signal-system reference.
- Confirm scene initialization uses `sceneLoad` (On scene load), with no
  authored `SceneJustBegins` condition or simulated scene-load trigger in
  `sceneUpdate`.
- Confirm every action executed in `sceneUpdate` has an effective condition
  in its event or ancestor chain, including Link callers, and no unconditional
  action can execute every frame. Action-only initialization in `sceneLoad`
  does not require an additional condition.
- Confirm object-targeting actions use the intended current picking set. Accept
  actions that apply to multiple picked instances as normal GDevelop behavior;
  narrow the selection or use `for each` only when the logic requires one
  instance at a time.
- Confirm no legacy JSON was changed.
- Confirm `generate-catalogs` returned `catalogsRegenerated: true` after the
  final large structural change and that subsequent dependent edits used the
  refreshed relevant catalogs and declarations. Confirm the generated TSL
  declaration/catalog pair was also written and verified when TSL was in scope.
- Confirm `validate_project_files` returned `valid: true` with all checked
  pre-runtime phase fields successful after the final source edit and before
  reload. Confirm that receipt still says `runtimeVerified: false` and
  `completionReady: false`.
- Confirm every task-owned change was committed after final validation and
  before `reload_project`; record the commit hash and descriptive commit
  message, and confirm no unrelated pre-existing change entered the commit.
- Confirm explicit `reload_project` or the reload stage of
  `verify_project_change` succeeded after the final source edit and before any
  preview frames.
- Debug runtime behavior with a fresh preview when behavior, rendering, input,
  audio, timing, or object picking changed.
- When gameplay tests are the verification evidence, confirm
  `run_gameplay_tests` used the exact current canonical selector after reload,
  `get_gameplay_test_results` was polled to a terminal state, and the final
  operation was `completed` with `summary.all_passed: true`.
- Prefer one successful `verify_project_change` receipt for final runtime
  acceptance; require every typed assertion to pass and both
  `runtimeVerified: true` and `completionReady: true`.
- Report changed source files, concrete verification evidence, and the final
  Git commit hash and message.
