Any GDevelop project work must obey the bundled skill: read ./skills/gdevelop-project-files/SKILL.md in full before doing anything, and follow it as the source of truth.

For Blender, glTF/GLB, or Blender-to-GDevelop work, also read ./skills/blender-workflow/SKILL.md in full and use the Blender execution method appropriate to the task. Run the bundled Blender scripts through the Blender executable as described there.

Follow docs/PROJECT_STRUCTURE.md for auxiliary directories and output conventions. Keep runtime assets in assets/, editable art sources in sources/, project tooling in tools/, and maintained documentation in docs/. Save reviewed evidence in artifacts/verification/<task-or-version>/ and standalone screenshots in artifacts/previews/. Use tmp/ or artifacts/local/ for disposable outputs. These conventions do not change canonical GDevelop component paths.

When authoring GDL actions or conditions, use the generated instruction catalog entry’s `dslName` preferentially; keep parameter `dslName` unchanged. Native `type` is for exact identity and diagnostics. Never invent short names or edit generated catalogs. The project entry is `project.gdl`.

Instruction metadata is generated into three files: `.gdevelop/conditions-catalog.json`,
`.gdevelop/actions-catalog.json`, and `.gdevelop/expressions-catalog.json`. Read the
file matching the instruction kind and use its `entries` with
`authoringAvailable=true` for new GDL. Regenerate all three together; never edit
generated catalogs. See [the GDevelop authoring skill](skills/gdevelop-project-files/SKILL.md) for the full contract.
