# Scene lifecycle functions

Status: current GDL authoring format 12. See the [GDL documentation entry](settings-dsl-spec.md) and [event contract](unified-settings-events-dsl-spec.md).

## Ownership and presence

Scene lifecycle functions live in `scenes/<Scene>/functions/<Role>.gdl`.
Each file contains one `function` root with its fixed signature and an `events`
body. There is no paired body file or per-function directory.

| Role | Order | Presence | Execution |
| --- | --- | --- | --- |
| `sceneLoad` | 0 | Omit when its event list is empty | Once on the first active frame, before scene signal handlers and update |
| `sceneSignal` | 1 | Omit when its event list is empty | Once per delivered scene signal, in delivery order |
| `sceneUpdate` | 2 | Required, including an empty body | Every active frame, including the first |
| `sceneUnload` | 3 | Omit when its event list is empty | Synchronously before the scene and its objects are unloaded |

The storage reader rejects a missing `sceneUpdate`, an empty optional lifecycle
file, or metadata that differs from the fixed registry. Do not infer presence
from editor UI proposals. Preserve the generated lifecycle signature when
editing a body.

All roles have `functionType = "Action"`, `folder = ["Lifecycle"]`,
`lifecycleRole` equal to their name, `private = true`, `async = false`, an empty
sentence and no object groups. Names, order, fullName and description come from
`SCENE_LIFECYCLE_FUNCTION_DEFINITIONS` in
`newIDE/app/src/ProjectsStorage/MultiFileProjectFormat/index.js`.
`sceneSignal` has two required string parameters, `SignalName` and `Payload`,
with empty defaults. Other roles have no parameters.

## Execution and signals

The generated active-frame sequence is load (first frame only), delivered scene
signals, then update. The existing runtime pre-events phase delivers the fixed
signal batch to subscribed component handlers before scene lifecycle execution.
Do not move component signal callbacks after sceneLoad when editing scene logic.
See [Signal System](SignalSystem.md) for queue timing and payload context.

Scene unload executes before extension unloading callbacks and object teardown.
It is not an ordinary per-frame child event. Runtime frame and teardown behavior
are implemented by `GDJS/Runtime/runtimescene.ts` and generated scene code in
`GDJS/GDJS/Events/CodeGeneration/EventsCodeGenerator.cpp`.

## External fragments and Link

External Events are scene-owned fragments at
`scenes/<Scene>/external-events/<Fragment>.gdl`. Their root is `external_events`
and owns metadata plus one event list. They have no lifecycle functions of their
own and do not execute automatically.

A `link` expands the entire fragment at the call site and inherits the caller's
lifecycle, visible scope and object selection. It does not select a matching
role from the fragment. Cycles and unresolved targets are errors. Link syntax,
source ordering and picking rules are maintained in the event contract.

## Implementation and verification

- Fixed signatures, source paths and presence validation: `ProjectsStorage/MultiFileProjectFormat/index.js`.
- Function and event decoding: `ProjectsStorage/SettingsDsl`.
- Model and runtime integration: `Core/GDCore/Project/Layout.*`, scene code generation and `GDJS/Runtime/runtimescene.ts`.
- Regression coverage: `ProjectsStorage/MultiFileProjectFormat/index.spec.js`, native event tests and runtime lifecycle tests.

Parsing a lifecycle document does not verify its runtime effects. Validate the
project and use preview/gameplay evidence for changes to signal timing, object
selection or teardown behavior.
