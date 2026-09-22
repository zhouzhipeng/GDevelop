# Project tools

Put project-specific asset generation, conversion and maintenance scripts here. Bundled skill helpers remain in their skill's `scripts/` directory.

For each tool, document its purpose, dependencies, exact command, inputs, outputs, overwrite behavior and whether it can be run repeatedly. Derive project paths from the script location or explicit arguments rather than hardcoding one developer's machine path.

Use `sources/` for editable production output, `assets/` for runtime exports and `tmp/` for intermediate candidates. Some converters emit both source and export into one temporary directory; inspect the results and install each into its final location. Save reviewed evidence in `artifacts/verification/<task-or-version>/`.

Run Blender helpers through the Blender executable as described in the [Blender workflow](../skills/blender-workflow/SKILL.md). Mark historical one-off scripts that modify `.settings` or `.events` as such; do not include them in a repeatable asset build by default.
