# Gameplay test sources in GDL projects

Status: current GDL authoring format 18. The [GDL documentation entry](settings-dsl-spec.md)
defines the shared grammar; this document defines test-source ownership.

## Files and metadata

Root `tests.gdl` contains the metadata for both project and extension gameplay
tests. Every test has one JavaScript source file directly under root `tests/`.
The file field is a canonical, scheme-free project-root-relative path. Test
bodies do not live in project or extension configuration nodes.

```settings
tests {
  test {
    name = "Player can jump"
    scope = "project"
    type = "gameplay"
    order = 0
    description = "Space starts an upward movement."
    file = "tests/Player%20can%20jump.js"
  }
}
```

The registered fields are `scope`, `extension`, `order`, `name`, `type`,
`description` and `file`. Extension tests use `scope = "extension"` and name
the owning extension in `extension`; project tests use `scope = "project"`.
`type` is `gameplay`. Preserve test order within its owner, descriptions and
JavaScript source. Use the writer's canonical filename encoding rather than
inventing paths from display names.

## Native model and generated state

The native test model still stores source text in `gd::Test::source`.
Composition reads the script into that field; decomposition writes it back to
the script file. This storage split does not change the test runner API.

Last-run summaries belong only in ignored
`.gdevelop/gameplay-test-results.json`. They are bounded local state, not
source-controlled metadata. Missing, stale or malformed result records must not
invalidate authored tests. Generated game data and exported games do not become
the owners of test scripts or result summaries.

## Validation and saving

Reject missing scripts, duplicate or ambiguous ownership, orphan managed
scripts, path escapes and unsupported metadata. Renames and deletion of a test
update metadata and its script through the project transaction. Saving compares
the recomposed authored model before committing changed files; local run state
is excluded from authored equivalence.

Reading, formatting and saving source does not run a gameplay test. Execution
and result collection are explicit operations; see the
[gameplay test MCP tools](gameplay-test-mcp-tools-spec.md).

## Implementation

- `newIDE/app/src/ProjectsStorage/MultiFileProjectFormat/index.js`: metadata, source splitting, composition and result-state separation.
- `newIDE/app/src/ProjectsStorage/SettingsDsl/SchemaInventory.js`: registered test fields.
- `newIDE/app/src/ProjectsStorage/LocalFileStorageProvider/LocalMultiFileProject.js`: filesystem validation and transactions.
- Corresponding storage and format tests cover round trips, ownership and recovery.
