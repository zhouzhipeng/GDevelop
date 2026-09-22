# Development artifacts

- `verification/<task-or-version>/`: reviewed validation reports, receipts and related screenshots.
- `previews/`: independent presentation screenshots.
- `local/`: disposable local output, ignored by Git.

Create these subdirectories when used. No verification result is supplied by this template. Preserve source revisions and the distinction between static validation, gameplay tests and visual inspection; a historical pass does not verify the current revision.

Follow the [project structure conventions](../docs/PROJECT_STRUCTURE.md) for retention and relative paths. Game runtime resources belong in `assets/`.
