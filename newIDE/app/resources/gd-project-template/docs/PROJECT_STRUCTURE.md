# Project structure

Paths are relative to the directory containing `project.gdevelop`. This document defines the template's auxiliary-directory conventions. Engine-owned source paths still follow the [GDevelop file contract](../skills/gdevelop-project-files/SKILL.md) and generated catalogs.

| Path | Purpose | Version control |
| --- | --- | --- |
| `project.gdevelop`, `resources.settings`, `constants.toml` | Project entry, resource registry and editor constants | Track |
| `scenes/`, `extensions/`, `objects/` | Canonical scene, extension and global-object sources | Track components when created; preserve prescribed hierarchy |
| `tests.settings`, `tests/*.js` | Gameplay-test manifest and flat test sources | Track; no nested test source directories |
| `assets/` | Runtime resources, accompanying manifests and license notices | Track; preserve registered resource paths |
| `sources/` | Editable art, model and audio production sources | Track; existing `.gitattributes` applies LFS to `.blend` |
| `materials/` | `.tsl.ts` material source | Track when used; this is runtime source, not an output cache |
| `tools/` | Project asset generation, conversion and maintenance scripts | Track with invocation and input/output documentation |
| `docs/` | Maintained design and development documentation | Track |
| `artifacts/verification/<task-or-version>/` | Reviewed reports, receipts and related screenshots | Track selected evidence |
| `artifacts/previews/` | Standalone presentation screenshots | Track selected images |
| `artifacts/local/`, `tmp/` | Frequent local output and intermediate files | Ignore |
| `builds/` | Local exported game packages | Ignore |
| `issues/` | Local diagnostic reports, recordings, logs and dumps | Ignore |
| `.gdevelop/` | Generated catalogs, declarations and editor state | Ignore; do not author source here |
| `skills/` | Bundled authoring workflows | Track |

Create optional directories when they have content; do not pre-create empty scenes, extensions, tests or manifests in the template. Project creation and the canonical writer supply those files. Asset categories such as `models/`, `audio/`, `ui/` and `environment/` are optional, not required for every game.

## Assets and production sources

Use `sources/` for editable production files, for example `sources/models/hero.blend`, and `assets/` for their runtime exports, for example `assets/models/hero.glb`. Record their relationship and generation commands in `tools/README.md`. Keep the only editable source out of disposable directories.

Preserve registered runtime paths when organizing an existing project. Move files only within the requested scope and update affected tooling, documentation and external dependencies. Open moved Blender files to check relative image and library references. Companion inputs and manifests can remain next to existing assets when their workflow depends on that location; record how their paths resolve. See [asset provenance](ASSET_SOURCES.md) for source and license records.

## Evidence and temporary output

Save each reviewed verification batch in `artifacts/verification/<task-or-version>/` with its reports and screenshots together. Record the source commit, validation scope, actual tool results, failures and unverified areas. Use project-relative paths in report data and document-relative Markdown links. Do not store local absolute machine paths in new reports.

Historical reports apply only to their recorded revisions. Moving them does not rerun validation; preserve outcomes and do not invent missing commit IDs. When consolidating older evidence, `artifacts/verification/legacy/` may be used without making it a default directory for new work.

Use `artifacts/previews/` for independent display screenshots and `artifacts/local/` or `tmp/` for disposable runs. Promote selected evidence to the tracked verification directory. Do not create parallel root `preview/` or `docs/verification/` directories, and keep results out of `tests/`.

## Tool and documentation ownership

Project-specific tools live in `tools/`; bundled workflow helpers stay in their owning skill's `scripts/` directory. State each project tool's inputs, outputs, dependencies, overwrite behavior and repeatability. Identify historical one-off project modifiers so they are not mistaken for a current build pipeline.

Keep the root README concise and current. Put detailed design and instructions in `docs/`, with superseded descriptions in `docs/history/` when useful. Neither a historical report nor a template placeholder is evidence that a new project has passed validation.
