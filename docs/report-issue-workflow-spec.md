# In-preview issue reporting specification

Status: approved and implemented, including the linked-artifact update.

## Problem

The preview debugger can pause a running game, inspect its serialized runtime
state, and capture the game canvas, but reporting a visual or state-dependent
bug is still a manual process. A user must separately take a screenshot,
describe the problem, and copy debugger data. These artifacts can easily refer
to different frames and are not packaged in a form that can be handed directly
to an AI model.

The requested workflow adds a **Report issue** button at the start of the
debugger toolbar, in the location highlighted in the supplied screenshot. It
must freeze the selected preview, let the user draw directly over the game,
collect a text description, and save a Markdown report under the local
project's `issues/` directory. The report links a compact annotated PNG under
`issues/images/` and a runtime debugger dump under `issues/dumps/`.

In this specification, "game memory data" means the JSON-safe runtime game
state already produced by the debugger's `dump` response. It does not mean a
raw operating-system process heap dump.

## Goals

- Put a Report issue icon before the profiler icon in the debugger toolbar.
- Operate on the debugger instance currently selected in the debugger UI.
- Pause the selected game and wait for pause acknowledgement before capturing
  state or accepting annotations.
- Allow mouse, pen, and touch freehand drawing directly over the selected game
  canvas while game input is blocked.
- Show a debugger-side dialog containing a multiline issue description and
  controls to undo or clear annotations, cancel, or save the report.
- Capture the paused game canvas with the annotation composited into a compact
  PNG no larger than 1280 by 720 pixels, preserving its aspect ratio.
- Capture the corresponding full debugger runtime dump while the game remains
  paused.
- Save Markdown under `<project-root>/issues/`, PNG under `issues/images/`, and
  dump JSON under `issues/dumps/`, using relative links between them.
- Tell an AI reader to inspect the dump only when the description and image
  are insufficient for a difficult investigation, avoiding wasted tokens for
  straightforward issues.
- Restore the preview's pre-report pause state after either saving or
  cancelling.
- Keep all report data local; nothing is uploaded or submitted automatically.

## Non-goals

- Capturing a V8/Electron heap snapshot or native process memory.
- Automatically sending the report to an AI service, issue tracker, or GDevelop
  telemetry.
- Including the authoring project, source files, console logs, profiler output,
  or signal history beyond what is already present in the runtime dump.
- Editing, listing, or deleting previously saved reports.
- Supporting exported production games that do not have a debugger client.
- Adding shapes, text labels, colors, cropping, or image editing beyond a
  high-contrast freehand pen, undo, and clear in the first version.
- Writing into cloud projects or browser-only storage, where a native project
  directory does not exist.

## Current behavior

The relevant existing paths are:

- `newIDE/app/src/Debugger/Toolbar.js` renders profiler, console, signal
  monitor, and play/pause controls. It has no issue-report action.
- `newIDE/app/src/Debugger/index.js` owns the selected debugger ID, pause/play
  commands, status, and the latest runtime `dump` payload.
- `newIDE/app/src/ExportAndShare/PreviewLauncher.flow.js` defines the debugger
  server interface. Its response helper currently broadcasts to every
  debugger, so it is unsuitable for a report tied to one selected preview.
- The local and browser debugger-server implementations route commands to
  runtime clients and correlate responses by `messageId`.
- `GDJS/Runtime/debugger-client/abstract-debugger-client.ts` handles `pause`,
  `refresh`, and `captureScreenshot`. `pause` freezes simulation and `refresh`
  serializes the runtime game with known large and circular fields excluded.
  `captureScreenshot` forces a render without stepping and returns the game
  canvas as a PNG data URL.
- `newIDE/electron-app/app/PreviewWindow.js` can capture a BrowserWindow page,
  but its current no-ID fallback selects the newest preview rather than the
  debugger instance selected by the user. The runtime canvas path is already
  targeted and is therefore the safer basis for this workflow.
- Local projects expose their entry path through `project.getProjectFile()`.
  The project root is its parent directory. Multi-file project saving preserves
  user-owned files outside the managed source set, so `issues/` is not deleted
  by a normal save.

## Proposed user experience

### Availability

The Report issue icon is the first debugger toolbar item, before the profiler
icon. It uses a bug/report glyph and the tooltip **Report an issue**.

The control is enabled only when:

1. the selected debugger belongs to an external game preview rather than an
   embedded frame or gameplay-test harness;
2. the preview is connected and not in in-game edition; and
3. the project has an absolute local project path and Node filesystem access.

When unavailable, its tooltip explains the specific reason, such as **Run a
local preview to report an issue** or **Save this project locally first**.

### Start

Clicking the icon performs these operations in order:

1. Record whether the selected preview was already paused.
2. Send a targeted `pause` command and wait for the status response.
3. Send a targeted `refresh` command and retain its tagged `dump` response.
4. Send `issueReport.startAnnotation` and wait until the preview has installed
   its annotation canvas.
5. Open the issue dialog and bring the preview to the user's attention without
   changing the selected debugger.

The icon and dialog actions show a busy state while setup is in progress. If
any required response times out, the dialog displays a recoverable error and
no file is written.

### Annotating and describing

The preview places a transparent annotation canvas exactly over the game
canvas. The layer:

- has a visible crosshair cursor and captures pointer events;
- records high-contrast red, round-capped freehand strokes in intrinsic game
  canvas coordinates;
- supports mouse, pen, and single-touch input;
- follows canvas movement and resize without changing stored coordinates;
- prevents pointer input from reaching the paused game; and
- remains editor/debugger-only and is never created in a normal exported game.

The issue dialog stays in the debugger window and contains:

- concise instructions to draw in the adjacent game preview;
- a required multiline **What went wrong?** field;
- **Undo last stroke** and **Clear annotations** actions;
- **Cancel**; and
- **Save report** (disabled until the description contains non-whitespace
  text and setup is complete).

Only one report session may be active per debugger component. Changing or
disconnecting the selected preview cancels the active session and removes the
annotation layer best-effort.

### Save

Save report performs these operations while the game is still paused:

1. Ask the selected runtime client for
   `issueReport.captureAnnotatedScreenshot`.
2. Force a render without stepping, copy the game canvas into a temporary 2D
   canvas, paint the recorded strokes, and downscale the result to fit within
   1280 by 720 while preserving aspect ratio.
3. Decode the transported PNG data URL into a real `.png` file and serialize
   the retained dump into a separate pretty-printed `.json` file.
4. Create `issues/`, `issues/images/`, and `issues/dumps/` if needed. Publish
   the image and dump first, then atomically publish a unique
   `issue-YYYYMMDD-HHmmss-SSS.md` linking both. A numeric suffix resolves
   filename collisions across the whole artifact bundle.
5. Remove the annotation layer and close the dialog.
6. Resume the game only if it was playing before the report started. A preview
   that was already paused remains paused.
7. Show a success notification containing the saved path.

The report is not considered saved until the final rename succeeds. Capture or
write errors leave the dialog open so the user can retry without losing the
description or strokes.

Cancel removes the annotation layer, restores the original pause state, and
writes nothing.

## Markdown format

The Markdown file is UTF-8 and uses project-relative artifact links:

````markdown
# Game issue report

- Created: 2026-08-13T07:30:12.123Z
- Project: Example game
- Scene: Level 1
- Preview debugger ID: preview-ws-15

## User description

The player falls through this platform after landing.

## Annotated screenshot

![Annotated paused game frame](images/issue-20260813-073012-123-screenshot.png)

## Runtime game memory dump

[Open the game-memory dump](dumps/issue-20260813-073012-123-game-memory-dump.json)

### AI investigation guidance

Start with the user description and annotated screenshot. Only read the linked
game-memory dump if the reported issue is very difficult to investigate or
those sources are insufficient. Otherwise, do not read it, to avoid wasting
context tokens.
````

The Markdown never embeds screenshot base64 or the full dump. The PNG is stored
under `issues/images/`; the JSON-safe dump received from the selected preview
is pretty-printed with two-space indentation under `issues/dumps/`. Metadata
is derived from the same selected debugger and dump; missing optional metadata
is omitted rather than guessed.

User text is treated as content, never as a path or filename. The writer does
not interpolate it into HTML or execute it.

## Protocol and API changes

All changes are additive and internal to preview/debugger communication.

### Targeted request helper

Extend `PreviewDebuggerServer` with:

```js
sendMessageToDebuggerWithResponse(
  id: DebuggerId,
  message: Object,
  timeoutMs?: number
): Promise<Object>;
```

The local and browser implementations allocate a `messageId`, register the
pending response before sending, target only `id`, clear the timeout on
completion, and reject if the debugger disconnects or the timeout expires.
The existing broadcast `sendMessageWithResponse` remains unchanged for
compatibility.

### Runtime debugger commands

Add these commands to `AbstractDebuggerClient`:

| Command | Response | Purpose |
| --- | --- | --- |
| `issueReport.startAnnotation` | `issueReport.annotationStarted` | Install/reset the overlay and begin pointer capture. |
| `issueReport.undoAnnotation` | `issueReport.annotationChanged` | Remove the last complete stroke. |
| `issueReport.clearAnnotation` | `issueReport.annotationChanged` | Remove every stroke. |
| `issueReport.captureAnnotatedScreenshot` | `issueReport.screenshot` | Return the composited PNG data URL and dimensions. |
| `issueReport.stopAnnotation` | `issueReport.annotationStopped` | Remove listeners and the overlay canvas. |

Each response echoes `messageId` and contains an explicit `error` field on
failure. Starting twice first cleans up the previous overlay, making session
setup idempotent. Stopping when no session exists succeeds.

Change `refresh` to pass an optional request `messageId` into
`sendRuntimeGameDump`. Untagged existing refresh and pause-triggered dumps keep
their current shape, while a targeted refresh can now be awaited reliably.

No serialized project schema, event semantics, export data, or public gameplay
API changes.

## Editor design

`Debugger/index.js` owns the report session because it already owns the
selected debugger, status, runtime dumps, and toolbar lifecycle. Session state
contains:

- selected debugger ID;
- original paused state;
- retained runtime dump;
- description;
- setup/saving/error state; and
- whether runtime annotation cleanup is still required.

The toolbar receives `onReportIssue`, `canReportIssue`, `isReportingIssue`, and
an unavailable-reason tooltip. A dedicated `IssueReportDialog` renders the
form but delegates debugger commands and persistence to the owner.

Pure formatting/path selection and filesystem writing live in
`Debugger/IssueReportWriter.js`. This keeps Node-only access out of the visual
components and makes the output contract unit-testable. The writer validates
that the resolved `issues` directory stays directly under the resolved project
root before creating or publishing files. It validates the PNG signature,
never overwrites any of the three artifacts, publishes the Markdown last, and
uses only forward-slash relative links inside it.

## Runtime annotation design

The annotation helper is private to
`debugger-client/abstract-debugger-client.ts`, avoiding a new runtime include
or exported game dependency. It retains strokes as arrays of intrinsic canvas
points rather than saving pixels on every move.

Pointer points use the current canvas bounding rectangle to map CSS coordinates
to `canvas.width`/`canvas.height`. Rendering the visible overlay maps the stored
intrinsic points back to its device-pixel-ratio backing store. Final capture
draws the paused game canvas first and the same intrinsic strokes second, so
the saved image remains correct after display scaling or a window resize. The
capture is downscaled only when necessary to fit within 1280 by 720 pixels.

Pointer-move events are sampled only after a small distance threshold, and the
session is bounded to 100,000 points. If the cap is reached, the current stroke
ends and the response/error UI tells the user to clear or save; the game and
editor remain responsive.

The helper removes every pointer/resize listener and DOM node on stop, hard
reload, debugger destruction where observable, or a new start. Annotation
state is not added to the runtime game dump.

## Files expected to change

- `newIDE/app/src/Debugger/Toolbar.js`
- `newIDE/app/src/Debugger/index.js`
- `newIDE/app/src/Debugger/IssueReportDialog.js` (new)
- `newIDE/app/src/Debugger/IssueReportWriter.js` (new)
- `newIDE/app/src/ExportAndShare/PreviewLauncher.flow.js`
- `newIDE/app/src/ExportAndShare/LocalExporters/LocalPreviewLauncher/LocalPreviewDebuggerServer.js`
- `newIDE/app/src/ExportAndShare/BrowserExporters/BrowserPreview/BrowserPreviewDebuggerServer.js`
- `GDJS/Runtime/debugger-client/abstract-debugger-client.ts`
- focused adjacent editor/runtime test files

No generated locale catalogs, copied runtime files under
`newIDE/app/resources/GDJS`, or managed project-source projections are edited
by hand.

## Compatibility and migration

- The project format is unchanged and needs no migration.
- The debugger protocol additions are backward compatible. A stale preview
  built from an older runtime ignores the annotation command; the editor times
  out with a message asking the user to relaunch the preview.
- Existing pause, refresh, screenshot, MCP screenshot, and debugger inspector
  behavior remains available.
- Reports are ordinary user-owned files. Existing projects with an `issues/`
  directory are supported; files are never overwritten.
- Browser/cloud projects show the control as unavailable in version one rather
  than silently downloading a file or writing to a different location.

## Error handling

- No selected/external preview: keep the action disabled.
- Project not saved locally or filesystem unavailable: keep the action disabled
  with a reason.
- Pause, dump, or annotation setup timeout: remove any partial overlay,
  best-effort restore pause state, and show an actionable error.
- Preview disconnect/hard reload during a report: cancel locally, retain no
  stale dump for later saving, and show that the preview ended.
- Screenshot compositing failure: keep dialog text/strokes and allow retry or
  cancel.
- Directory creation, temporary write, or rename failure: keep the dialog open,
  remove any temporary file best-effort, and report the exact destination and
  filesystem error.
- Cleanup or resume failure after a successful write: do not claim the file was
  lost; show the saved path plus the cleanup warning.

## Privacy and security

The dump can contain game variables and player-entered values. The dialog
states that the report includes current game state. Data is written only to the
local project and is never uploaded automatically.

The output path is generated internally. The user description, scene name, and
project name cannot influence directories or the filename. The writer resolves
and verifies the project root and `issues/` target before mutation. Existing
files are preserved.

## Performance implications

- Pausing happens before dump serialization or annotation, so simulation does
  not drift between artifacts.
- The existing bounded debugger serializer supplies the memory data; the
  report feature does not traverse a second runtime graph.
- Normal play has no annotation allocations. During a report, stored point
  data is bounded and pointer events are distance-sampled.
- Saving temporarily allocates one 2D canvas capped at 1280 by 720 plus the PNG
  and Markdown strings. These are released when the session closes.
- The PNG and dump are linked rather than embedded, keeping the Markdown small
  and preventing an AI from spending context tokens on the dump unless needed.

## Testing

### Editor unit tests

- Toolbar renders the report icon before profiler and calls the right handler.
- Disabled, busy, and tooltip states are correct.
- The targeted debugger response helper sends to only one ID, registers before
  sending, resolves matching responses, and cleans up on timeout/disconnect.
- Session orchestration pauses before refresh/start, always uses the selected
  debugger, blocks duplicate starts, and restores the original pause state on
  save/cancel.
- Disconnect and command/write failure paths do not write partial reports.
- Markdown formatting contains relative image/dump links, the exact
  description and metadata, no base64, no inline dump, and explicit AI token
  guidance.
- Path generation creates `issues/images/` and `issues/dumps/`, avoids bundle
  collisions, never overwrites, and rejects paths outside the project root.

### Runtime/browser tests

- Start creates one correctly positioned overlay and is idempotent.
- Pointer mapping remains correct for CSS scaling and device pixel ratios.
- Undo/clear update strokes; stop removes DOM nodes and listeners.
- Capture calls render-without-step, visibly composites a known stroke without
  advancing runtime time, preserves small dimensions, and caps large captures
  at 1280 by 720.
- The point cap is enforced without throwing.
- Tagged refresh returns the same dump payload contract plus `messageId`;
  untagged refresh remains unchanged.

### Verification commands

After implementation, run the closest focused specs followed by:

```text
cd GDJS
npm run check-types
npm run build

cd newIDE/app
npm run flow
npm run lint
npm run check-format
npm test -- --watchAll=false <focused-spec-paths>
```

Then start the required detached Windows desktop build/launch with
`python scripts/start-windows-app.py` as required by the repository workflow.
Manual acceptance uses a local sample project and verifies the file contents,
annotation alignment, pause restoration, retry behavior, and that a normal
project save preserves `issues/`.

## Rollout

Ship the feature enabled for local desktop projects without a feature flag.
The button's eligibility checks form the first-version boundary. If browser or
cloud persistence is desired later, add an explicit storage-provider contract
rather than reusing local filesystem assumptions.

## Alternatives considered

### Capture the Electron BrowserWindow page

`webContents.capturePage()` would naturally include a DOM overlay, but the
current API cannot reliably map an arbitrary selected debugger ID to its
BrowserWindow when multiple previews exist. It also excludes browser preview
implementations. Targeted runtime composition is deterministic and produces
the exact game resolution.

### Annotate a screenshot inside the dialog

This is simpler but does not satisfy drawing directly on the game window and
makes it harder to compare annotations with the live paused presentation.

### Embed PNG and JSON in the Markdown

A self-contained report is convenient to move as one file, but base64 makes
the Markdown larger and an inline dump encourages AI readers to spend tokens
on state that simple visual issues do not need. Linked artifacts keep the
default AI context compact while preserving deeper evidence on demand.

### Put filesystem writes in the Electron main process

That would add IPC surface and Electron-only implementation work. The existing
desktop editor already uses guarded Node filesystem access for local
project-adjacent artifacts. Keeping a small, path-validated writer in the
editor is narrower and unit-testable.

## Decisions to approve

Implementation can begin once these first-version choices are approved:

1. Reports are available only for external previews of local desktop projects.
2. Drawing is a red freehand pen with undo and clear, directly over the game
   canvas.
3. The saved image is the game canvas, not operating system window chrome, and
   is downscaled as needed to fit within 1280 by 720 pixels.
4. Cancel and successful save restore the preview's pause state from before
   the report started.
5. "Memory data" is the existing JSON-safe debugger runtime dump, not a raw
   heap snapshot, and AI readers open it only for difficult investigations.
6. Markdown, PNG, and JSON are linked artifacts under `issues/`,
   `issues/images/`, and `issues/dumps/` respectively.
