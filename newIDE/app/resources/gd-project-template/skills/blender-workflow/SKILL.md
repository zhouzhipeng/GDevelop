---
name: blender-workflow
description: Create, inspect, prepare, optimize, animate, convert, merge, export, and verify Blender 3D assets for GDevelop using the Blender control method available for the task. Use for Blender-to-GDevelop workflows, `.blend` scene work, glTF/GLB export, `.fbx`-to-`.glb` or `.gltf`-to-`.glb` conversion, same-rig GLB animation merging, material or transform cleanup, collision preparation, and diagnosing imported 3D assets in GDevelop.
---

# Blender Workflow

## Choose a Blender execution method

Use the Blender control method that is available and appropriate for the task. This skill does not require a particular add-on, UI automation, or scripting interface. The model may use its own suitable way to inspect or modify Blender.

For the bundled workflow scripts, invoke the Blender executable directly. Use a path supplied by the user when available; otherwise use the installed `blender` executable on `PATH`. Pass script arguments after Blender's `--` separator:

```text
"ABSOLUTE_BLENDER_PATH" --background --python "ABSOLUTE_SCRIPT_PATH" -- SCRIPT_ARGUMENTS
```

Use absolute, task-owned paths. Preserve the source `.blend` or work on a safe copy before destructive changes, and write generated assets to a temporary or task-owned output before replacing an existing project asset.

## Coordinate the two skills

Read [references/blender-to-gdevelop.md](references/blender-to-gdevelop.md) in full before preparing, exporting, importing, or debugging a Blender asset for GDevelop. Follow it for asset boundaries, axes, scale, transforms, origins, materials, animation, optimization, GLB export, GDevelop setup, collision, preview checks, updates, and troubleshooting.

When the task also changes GDevelop project sources, read [the GDevelop project-files skill](../gdevelop-project-files/SKILL.md) in full. Let this skill govern Blender and GLB work; let that skill govern GDevelop source authoring, validation, Git commit, reload, and preview-verification gates.

## Project paths

Follow [the project directory conventions](../../docs/PROJECT_STRUCTURE.md).
Keep editable `.blend` and other production inputs in `sources/` (for example
`sources/models/hero.blend`), runtime GLB and texture exports in `assets/`, and
project-specific generators in `tools/`. Bundled helpers stay in this skill's
`scripts/` directory. Create asset categories only when needed.

Use `tmp/` for intermediate conversion/export candidates. If a helper produces
both an editable source and a GLB in one output directory, inspect them there
and install each into its respective final directory. Document inputs,
outputs, dependencies and overwrite behavior in `tools/README.md`.

When reorganizing existing files, preserve runtime resource paths and check
Blender's relative image and linked-library paths after moving a source.
Update producer scripts so the next run saves to the new source directory.
Keep companion inputs where required by an existing workflow and document
their location. Save reviewed reports and images together under
`artifacts/verification/<task-or-version>/`, using project-relative report
paths; use `artifacts/previews/` for independent presentation images.

## Work in Blender

1. Inspect the current file, objects, linked data, missing files, and target asset before changing anything. Use bounded summaries or focused queries instead of dumping the entire scene.
2. Use the Blender Python API or other available Blender controls appropriate to the task, and consult the matching Blender API documentation when an unfamiliar operation is needed.
3. Return or record changed data-blocks, output paths, warnings, and verification facts when the chosen control method supports structured results.
4. Never overwrite an existing GLB unless the user requested replacement and the exact target was verified.
5. Inspect the result again through the chosen Blender control method, object details, screenshots, or a bounded Blender Python check. Do not infer success from a command that returned no error.
6. Export binary `.glb`, keep stable data-block and animation names, and verify output existence, non-zero size, intended object/action counts, and absence of missing external resources.
7. If the GLB is a GDevelop resource, keep it inside the project and continue with the GDevelop skill's project validation and fresh-preview workflow.

## Use the bundled workflow scripts

Use the bundled scripts directly for supported jobs; do not rewrite their logic in an ad hoc script.

- Use [scripts/convert_fbx_to_glb.py](scripts/convert_fbx_to_glb.py) for one-file or batch `.fbx` to `.glb` conversion. FBX animation import and GLB action export are enabled by default, and the script verifies the GLB container plus animation count before replacing the destination. Use `--input` with `--output` for one file, or `--input` with `--output-dir` for a directory; add `--recursive` for nested inputs, `--require-animations` when an animation-less result must fail, and `--overwrite` only for an approved replacement. Bone-orientation flags change the imported skeleton and must be used only when the source rig requires them. Require the returned summary to report `success: true` and zero failures.
- Use [scripts/convert_gltf_to_glb.py](scripts/convert_gltf_to_glb.py) for one-file or batch `.gltf` to `.glb` conversion. Use `--input` with `--output` for one file, or `--output-dir` for a directory; add `--recursive` for nested inputs and `--overwrite` only for an approved replacement. Require the returned summary to report `success: true` and zero failures.
- Use [scripts/combine_same_rig_glb_animations.py](scripts/combine_same_rig_glb_animations.py) to embed animations from a GLB into a character GLB that uses the same skeleton. Supply `--character`, `--animations`, and `--output`; repeat `--action` to select clips. Keep strict compatibility checking unless the user explicitly accepts a weaker check. This performs direct action reuse, not retargeting; stop and use a real retargeting workflow when rigs differ.
- Use [scripts/bake_material_textures.py](scripts/bake_material_textures.py) for repeatable image-space material preparation. Supply a version-1 JSON recipe containing one or more jobs. Each job may color-adjust a base texture while preserving alpha, derive a normal map from height, and optionally wire the verified outputs into a glTF-compatible Principled material. Use `--apply-materials` only on a task-owned `.blend`; add `--pack-images` when the generated images must travel with it, and use `--save-blend` to persist to a new path. The script deliberately does not perform geometry/cage, ambient-occlusion, or high-to-low projection bakes.

Run every bundled conversion, animation-combination, and material-preparation script through the Blender executable:

```text
"ABSOLUTE_BLENDER_PATH" --background --python "ABSOLUTE_SCRIPT_PATH" -- --input "ABSOLUTE_INPUT_PATH\character.fbx" --output "ABSOLUTE_TASK_OWNED_OUTPUT\character.glb" --require-animations
```

Use the corresponding script's documented options for glTF conversion, GLB animation combination, or material baking. For operations that need an existing Blender scene, load a disposable or task-owned `.blend` before `--python`:

```text
"ABSOLUTE_BLENDER_PATH" --background "ABSOLUTE_TASK_OWNED_SCENE.blend" --python "ABSOLUTE_SCRIPT_PATH\bake_material_textures.py" -- --recipe "ABSOLUTE_PATH_TO_RECIPE\materials.json" --apply-materials --pack-images --save-blend "ABSOLUTE_TASK_OWNED_OUTPUT\materials_baked.blend"
```

The scripts run in that background Blender process and do not modify the user's currently open Blender session. Do not run conversion against the user's live unsaved scene because conversion resets the background scene while processing.

For a recursive FBX batch, replace `--output` with `--output-dir` and add
`--recursive`. Animations remain enabled unless `--no-animations` is passed
explicitly.

Generate a temporary output first and inspect it through the chosen Blender control method before replacing an existing project asset.

## Verify completion

Before finishing:

- Confirm the Blender executable or other chosen Blender control method completed successfully.
- Confirm the source `.blend` or its safe copy is preserved.
- Confirm transforms, origin, normals, materials, actions, export selection, and GLB settings against the detailed workflow.
- Confirm every expected output exists and has non-zero size.
- Confirm inspection matches the intended exported objects, materials, armature, and actions.
- Confirm no task-unrelated Blender data or existing output was overwritten.
- When GDevelop sources changed, report the GDevelop skill's validation, commit, reload, and fresh-preview evidence too.
