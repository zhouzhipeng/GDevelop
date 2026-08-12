# Resource Path Separator Normalization

**Status:** Implemented
**Scope:** New resource registration and multi-file `project.gdevelop` file paths
**Canonical file separator:** `/`

## 1. Problem

On Windows, a resource discovered with `path.relative` can receive a logical
resource name containing its full relative path and backslashes:

```toml
[[resources]]
name = "assets\\models\\model.glb"
file = "assets\\models\\model.glb"
kind = "three-dimensional-model"
```

The resource `name` is a project-wide identifier, while `file` locates the
resource payload. Newly registered resource names should be short and stable:
the source filename only, without its directory. Local resource files should
use `/` on every operating system.

Existing projects may contain resource names with directories, either path
separator, or names chosen explicitly by users. Those names are already
referenced by objects, events, effects, extension data, and other typed
resource consumers. Rewriting them during load, save, or migration risks
breaking compatibility and creates noisy project-wide changes.

The contract must therefore distinguish existing resource names from names
assigned when a resource is newly registered.

## 2. Goals

- Name each newly registered resource after its source filename, for example
  `model.glb` rather than `assets/models/model.glb`.
- Resolve a new-name conflict with a numeric suffix before the extension, for
  example `model2.glb`, `model3.glb`, and so on.
- Preserve every previously registered resource name byte-for-byte, including
  names containing `/` or `\\`.
- Write local resource `file` paths with `/` on every operating system.
- Ensure all standard discovery, import, and creation paths apply the new
  naming rule before adding the resource to the project.
- Keep name allocation deterministic and avoid overwriting an existing
  resource.
- Preserve preview, export, and generated `.gdevelop/game.json` behavior.

## 3. Non-goals

- Renaming or otherwise normalizing existing resource names.
- Updating typed project references for existing resources.
- Replacing resource names with UUIDs or adding a resource UUID field.
- Making a resource name mirror its containing directory.
- Renaming the physical source file to match a conflict-resolved resource
  name.
- Converting SVG resources to PNG during export.
- Normalizing arbitrary user text, variable strings, JavaScript code, or
  resource metadata JSON.
- Changing `resourceFolders` display names.
- Rewriting URL payloads such as `data:` or `blob:` resources.
- Changing legacy single-file JSON save behavior unless that project is being
  migrated into the multi-file format.

## 4. Current behavior

The multi-file decompiler clones the legacy `project.resources` container into
`resources.settings` without normalizing resource names or files.

Local resource discovery currently uses the host operating system's
`path.relative` result as both the proposed resource name and file. On Windows,
this can produce a long name with `\\`; on every platform it exposes the
resource's directory structure as part of its logical identifier.

GDevelop's `newNameGenerator` already provides the required numeric allocation
behavior for a name stem: an unsuffixed name is tried first, then suffixes begin
at `2`. Registration must apply it to the filename stem, keeping the extension
at the end.

## 5. Proposed behavior

### 5.1 New resource name

When a resource is newly registered from a file, its proposed logical name is
the file's basename:

```text
assets/models/model.glb -> model.glb
audio/music/theme.ogg   -> theme.ogg
```

The directory is never included. Both `/` and `\\` are recognized while
extracting the basename so behavior does not depend on the host operating
system or on which separator the caller supplied.

The original filename spelling and extension are preserved. The only permitted
departure from the exact filename is the conflict suffix described in section
5.2.

This rule applies at the registration boundary: discovery, file import, drag
and drop, extension-driven registration, and other standard paths that add a
new file-backed resource must obtain the name through the same helper before
calling `addResource`.

### 5.2 Name conflicts

The proposed basename is checked against all names already present in the
resource manager, including legacy names. If it is available, it is used
unchanged. If it is already taken, the lowest available numeric suffix is
inserted immediately before the final extension:

```text
model.glb   -> model2.glb
model2.glb  -> model3.glb
model3.glb  -> model4.glb
```

For a filename without an extension, the suffix is appended to the complete
name:

```text
LICENSE -> LICENSE2
```

Names that already end in a positive integer continue from that integer. The
shared `newNameGenerator` behavior is authoritative, so importing `model2.glb`
when that name exists proposes `model3.glb` rather than `model22.glb`.

The uniqueness check uses `ResourcesManager::hasResource`, matching the
resource registry's existing name semantics. Allocation completes before the
resource is inserted; registration never replaces an existing resource.

The suffix changes only the logical `name`. It does not rename or duplicate
the physical file:

```toml
[[resources]]
name = "model2.glb"
file = "characters/model.glb"
kind = "three-dimensional-model"
```

### 5.3 Existing resource names

A resource already present when a project is opened is a legacy resource for
this rule. Its name is an opaque project identifier and is preserved exactly,
regardless of whether it is short, contains a directory, uses `/`, uses `\\`,
or conflicts stylistically with the new convention.

For example, this remains unchanged after open, Save, Save As, migration,
preview, and export:

```toml
[[resources]]
name = "assets\\models\\model.glb"
file = "assets/models/model.glb"
kind = "three-dimensional-model"
```

Because existing names are not changed, no project-wide resource refactor is
run and typed references keep their original values. A user may still rename a
resource explicitly through the editor; that existing explicit-rename workflow
remains outside this automatic naming rule.

Deserialization is not considered new registration. Loading a resource from an
existing single-file or multi-file project must not pass its name through the
new-name helper.

### 5.4 Local resource file paths

For multi-file projects, `/` is the only separator written for local resource
`file` values. File normalization is independent from resource naming:

```toml
name = "model.glb"
file = "assets/models/model.glb"
```

An absolute Windows file path is serialized with a drive prefix and forward
slashes:

```toml
file = "C:/SharedAssets/model.glb"
```

The `file` value of an `http:`, `https:`, `ftp:`, `blob:`, or `data:` resource
is preserved byte-for-byte. Resource metadata is also preserved byte-for-byte.
A path stored inside metadata remains owned by that metadata's feature and is
outside this normalization.

### 5.5 Registration algorithm

For a new file-backed resource:

1. Normalize the local project-relative `file` value to `/`.
2. Extract the basename while accepting both `/` and `\\` as input
   separators.
3. Split the basename into its filename stem and final extension.
4. Pass the stem to `newNameGenerator`, using a callback that checks the
   complete candidate name, including its extension, with
   `resourcesManager.hasResource`.
5. Set the normalized `file` and allocated short `name` on the resource.
6. Add the resource without renaming any resource already in the manager.

Conceptually:

```js
const canonicalFile = relativeFilePath.replace(/\\/g, '/');
const basename = getBasenameAcceptingEitherSeparator(canonicalFile);
const extension = path.extname(basename);
const stem = path.basename(basename, extension);
const uniqueStem = newNameGenerator(stem, candidateStem =>
  resourcesManager.hasResource(candidateStem + extension)
);
const resourceName = uniqueStem + extension;
```

If no non-empty basename can be derived, registration fails with a diagnostic
instead of creating an unnamed resource.

### 5.6 Existing multi-file projects

Backslashes and directories in existing resource names remain valid
compatibility input and valid writer output. A normal Save or Save As does not
rename them.

Before serialization, local `file` values are normalized to `/`. This does not
change resource registry keys or typed references. Running file normalization
on an already canonical project makes no changes.

### 5.7 Legacy JSON migration

When a legacy JSON project is converted to `project.gdevelop`, all resource
names from the legacy project are preserved exactly. Only local resource
`file` values are normalized before the new source tree is decomposed. The
original legacy JSON remains byte-for-byte unchanged, as required by the
existing migration contract.

Resources newly added after migration use the filename-only registration rule.

### 5.8 Defensive boundaries

The naming invariant is enforced when a new resource is registered, where the
system can distinguish a new resource from loaded project data. The writer
must not attempt to infer whether a serialized name is legacy and must not
rewrite or reject an existing name merely because it does not follow the new
convention.

Every multi-file save still normalizes local `file` separators before
serialization. This catches projects opened from old source and direct file
path mutations without altering logical identifiers.

## 6. Conflict and error handling

A name conflict for a newly registered resource is resolved automatically with
the numeric suffix from section 5.2. It is not an error and never triggers a
rename of the existing resource.

Name allocation and insertion must occur synchronously, or otherwise reserve
the allocated name until insertion, so two concurrent imports cannot choose
the same candidate. Batch import also treats names allocated earlier in the
same batch as occupied.

If registration cannot derive a filename, or cannot allocate a usable name, it
fails before insertion. No existing registry entry or typed reference is
mutated.

File normalization must retain the normal transactional save behavior. A
failure after mutation begins prevents source replacement, and the writer
self-check retains the previous source files.

## 7. Data and compatibility contract

### 7.1 Schema

No TOML key or value type changes. `name` and `file` remain strings.

The value contract is:

- A newly registered file-backed resource has a basename-only `name`, with an
  optional numeric conflict suffix immediately before its final extension.
- An existing resource `name` remains opaque and may contain either path
  separator.
- A local resource `file` written by the multi-file writer must not contain
  `\\`.
- URL-backed `file` values are exempt and remain opaque.

### 7.2 Reader and writer compatibility

The reader accepts every existing resource name without normalization. The
writer preserves those names exactly, so no `settingsFormatVersion` increase
is required.

Old source remains readable, and new short names use the existing string field
and lookup behavior. Canonical legacy-tree equivalence checks allow only local
`file` separator normalization; resource names are not part of that allowlist.

### 7.3 Runtime and export

Runtime project data continues using resource names as lookup keys. Existing
keys and references are unchanged. A new resource's short allocated name is
used consistently from the moment it is inserted, so no later refactor is
needed.

The physical exported filename is not inferred from the logical name. Future
export-only SVG-to-PNG conversion can therefore preserve the resource `name`
while changing only the export projection of `file`.

## 8. Affected layers and likely files

### Documentation

- `docs/gdevelop-new-formats-spec.md`
  - Declare canonical `/` separators for local resource `file` values.
  - Document filename-only names for newly registered resources.
  - Explicitly state that names loaded from existing projects are preserved.
  - Add local `file` normalization to the equivalence allowlist.

### Resource naming helper

- `newIDE/app/src/ResourcesList/ResourceUtils.js`
  - Add or expose one helper that extracts a cross-platform basename and
    allocates a unique filename-only resource name.
- `newIDE/app/src/ResourcesList/ResourceUtils.spec.js`
  - Cover basename extraction, extensions, numeric suffixes, legacy-name
    occupancy, and deterministic batch allocation.

### Local resource creation

- `newIDE/app/src/ProjectsStorage/LocalFileStorageProvider/LocalProjectResourcesHandler.js`
  - Canonicalize project-relative file paths.
  - Use the shared short-name helper before adding discovered resources.
- Other traced file-backed resource creation sites
  - Route all new registration through the same helper.

### Multi-file migration and save

- `newIDE/app/src/ProjectsStorage/LocalFileStorageProvider/LocalProjectOpener.js`
  - Preserve names and normalize only local `file` paths during legacy
    conversion.
- `newIDE/app/src/ProjectsStorage/LocalFileStorageProvider/LocalProjectWriter.js`
  - Run defensive local `file` normalization before multi-file serialization.
- `newIDE/app/src/ProjectsStorage/LocalFileStorageProvider/LocalMultiFileProject.spec.js`
  - Verify name preservation and canonical files across save and reopen.

The multi-file TOML serializer remains a pure ownership projection. It must not
derive or rewrite resource names because it cannot distinguish loaded legacy
resources from newly registered resources.

## 9. Performance

Name allocation performs registry lookups for the unsuffixed candidate and, if
needed, successive numeric candidates. With the resource manager's normal name
lookup, each check is constant time. Batch registration additionally reserves
the names chosen within the batch.

Defensive file normalization is `O(R)` for `R` resources. It does not traverse
typed project references, copy binary resources, or decode their contents.

## 10. Rollout

1. Add the shared filename-only naming helper and focused tests.
2. Route newly discovered and imported local resources through the helper.
3. Trace and update other standard file-backed registration sites.
4. Add defensive local `file` normalization and integration tests.
5. Apply only file normalization to legacy-to-multi-file migration.
6. Update the normative multi-file format documentation.
7. Validate representative Windows projects and repository fixtures.

No feature flag is proposed. Existing projects retain their logical resource
identifiers, while resources registered after the change receive short names.

## 11. Verification

Required tests:

- Discovering `assets/models/model.glb` registers the name `model.glb` and the
  file `assets/models/model.glb`.
- Discovering `assets\\models\\model.glb` produces the same values on Windows.
- If `model.glb` exists, the next resource is named `model2.glb`.
- If `model.glb` and `model2.glb` exist, the next resource is named
  `model3.glb`.
- Importing an already numbered filename continues its numeric suffix using
  `newNameGenerator` semantics.
- A filename without an extension receives its suffix at the end.
- Two same-basename resources in one batch receive distinct deterministic
  names.
- A legacy name counts as occupied only when it exactly matches a candidate.
- Existing names containing `/` or `\\` remain byte-for-byte unchanged after
  Save, Save As, reopen, preview, and export.
- Typed references to legacy names remain unchanged.
- A local resource `file` containing `\\` is written with `/`.
- `http:`, `https:`, `ftp:`, `blob:`, and `data:` file values are unchanged.
- Absolute Windows and UNC local file paths receive `/`.
- Legacy JSON migration preserves all resource names, produces canonical local
  file paths, and leaves the original JSON unchanged.
- A newly added resource after migration follows the short-name rule.
- The project reopens and round-trips without renaming resources.
- Preview and export resource validation succeeds.

After implementation, run the closest editor tests, formatting/type checks
required by the changed files, and the required Windows desktop build/launch
script.

## 12. Alternatives considered

### Normalize separators in every resource name

Rejected. Existing names are logical identifiers, not file paths. Rewriting
them requires a project-wide refactor and violates the requirement to preserve
legacy names.

### Rename every existing resource to its filename

Rejected. It creates collisions and changes references throughout established
projects. The short-name rule applies only when a new resource is registered.

### Include the directory in new resource names

Rejected. New names must be exactly the source filename except for the numeric
conflict suffix.

### Fail when a new filename conflicts

Rejected. A conflict is resolved deterministically as `model2.glb`,
`model3.glb`, and so on.

### Append the suffix after the extension

Rejected. `model.glb2` no longer preserves the recognizable file extension.
The required form is `model2.glb`.

### Normalize only when serializing

Rejected for names. References are created against the name assigned at
registration, so the short unique name must be chosen before insertion. The
writer normalizes only local `file` separators.

### Treat `name` and `file` as the same field

Rejected. Their separation permits short stable identifiers, directory-bearing
source paths, and export-time file substitution.

### Replace resource names with UUIDs

Rejected for this change. It requires a new persistent identity field and a
much broader migration across editor, project, extension, exporter, and runtime
contracts.

## 13. Approval decisions captured

1. New file-backed resources use the filename only as their logical name.
2. Conflicts use a numeric suffix before the extension, beginning at `2`.
3. Existing resource names are preserved exactly and are never automatically
   migrated to the new convention.
