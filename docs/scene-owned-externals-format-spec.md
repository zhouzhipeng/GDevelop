# Scene-Owned Externals Multi-File Format

Status: version 6 contract, updated 2026-09-20.

This document replaces the earlier combined external owner and lifecycle-function
layouts. Production reads and writes version 6 only. No compatibility reader or
implicit upgrade is provided for the retired external function directories.

## Source ownership

```text
scenes/<Scene>/
  scene.settings
  functions/<Lifecycle>.settings
  functions/<Lifecycle>.events
  external-events/<Fragment>.events
  external-layout/<Layout>.settings
```

External event fragments and external layouts are independent project items.
Their physical scene directory supplies `associatedLayout` in the composed model.
The scene must exist. They may share a name across these two independent kinds.
There is no combined `externals/` owner, root external settings, or scene manifest.

## External event fragments

Each direct `.events` child declares one fragment. Its filename, decoded and
stripped of the final `.events` suffix, is its project-wide name. Names are
non-empty NFC strings and unique ignoring case, including across scenes. Use the
managed reversible path encoding for unsafe characters and reserved filenames.
Nested directories, fragment `.settings`, `functions/`, TOML headers and
registration arrays are invalid. Empty, comment-only and unused files are valid.

A fragment is a `gd::EventsList`. It has no function metadata, parameters, return
value or lifecycle role. `link "Name"` expands it at the Link position,
with the caller's conditions, picked objects, local variables and lifecycle
restrictions. Every lifecycle role expands the same body. Merely owning a file
never executes it. A Link target must be an external event fragment.
Disabled Links retain their semantics. IfDo Links include the whole fragment.

Fragments are displayed by name and composed in scene order then name order.
There is no persisted fragment order; Link positions determine execution order.
Moving a fragment file changes its authoring scene context; renaming it also
requires updating Link targets. Editor refactoring performs those updates.

## External layouts

`external-layout/<Layout>.settings` retains identity, project-wide contiguous
`order`, and an embedded `[layout]` tree for layers and initial instances. It is
independently discovered and has no companion `.events` file. See
[embedded-layout-settings-format-spec.md](embedded-layout-settings-format-spec.md)
for the layout schema, object lookup, and transaction rules.

## Tools, catalogs and validation

The External Events editor opens one event sheet, without a lifecycle function
list or parameter dialog. Search and rename traverse each fragment once.
Semantic validation expands Links in an owned copy of each caller event tree and
maps diagnostics back to fragment names and source event paths. Unreferenced
fragments receive structural instruction checks without an invented caller.

Settings catalog version 3 has an `eventFileKinds` entry for fragments and an
owner entry containing `scene`, `name`, and `eventsUri`. It has no fragment
`settingsUri` or lifecycle-function entries. JavaScript blocks use the owning
scene's public types and inherit the caller's function context.

Local discovery and saves retain canonical URI validation, filesystem containment,
symlink checks, size limits, transaction recovery and entry-last commits. A new
save never recreates the retired external owner/settings/function directories.

## One-time JurassicWorld conversion

After engine checks, convert each existing update body to one flat fragment,
preserve its bytes and every Link location, remove only verified format wrappers,
and update format markers, documentation and authoring tools. Regenerate catalogs
through the engine and verify composition, saving and code generation. This is
an explicit project conversion, not a supported legacy loading mode. The full
approved scope is [external-events-snippets-spec.md](external-events-snippets-spec.md).
