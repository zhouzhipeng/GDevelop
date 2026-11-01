# MCP receipt presentation

`generate-catalogs`, `validate_project_files`, `reload_project`, and
`verify_project_change` return compact JSON text by default. Text omits catalog
metadata already available on disk, reload progress histories, and duplicate
nested validation/reload receipts. Verification stages retain status, failures,
diagnostics, assertion results, and screenshot paths.

The complete existing receipt remains unchanged in `structuredContent`, including
catalog paths, detailed stage receipts and progress history. Existing structured
consumers and internal verification assertions keep the same data contract.
Call with `detail: "full"` to restore the original full text response, or
`detail: "summary"` explicitly for the default presentation. Full detail controls
presentation only; it does not repeat or alter execution within a call. Reissuing
a mutating tool solely to retrieve text can rerun the operation, so read the
original call's `structuredContent` instead.

Errors, source locations, excerpts, unknown semantic coverage, and the difference
between structural validation and runtime verification are retained. Non-text
content and MCP `isError` are unchanged. This reduces duplicated text, not the
size of the complete structured receipt; clients that print both still receive
the full structured data once.
