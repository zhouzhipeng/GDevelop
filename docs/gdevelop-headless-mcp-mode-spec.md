# GDevelop headless MCP editor mode

Status: reviewed and approved for implementation in this change

Date: 2026-08-22

## Summary

Add a desktop-only headless host mode for GDevelop. The host keeps the normal
React editor, WASM project model, project storage, exporter, debugger, and MCP
bridge, but starts the editor window and preview windows hidden. It starts the
existing localhost MCP Streamable HTTP server automatically and grants the
existing MCP catalogue its normal write/command permissions for that process.

The result is a long-lived process that an AI client can launch with a project,
edit project files on disk, ask GDevelop to validate/reload them, launch a
deterministic preview, drive frames/input, inspect runtime state, run gameplay
tests, and capture evidence without opening an interactive editor window.

The implementation deliberately reuses the current editor bridge. It does not
create a second project model, a second exporter, or a second MCP vocabulary.

## Problem

The current MCP server is opt-in through Preferences and is attached to a
visible editor window. This is inconvenient for an AI worker because startup
requires UI state, the MCP URL is not available until the user enables the
server, and preview/debugger windows can appear on the desktop. The current
MCP bridge already has the important authoring and verification operations, but
there is no deterministic process-level contract for starting them headlessly.

## Goals

1. `GDevelop.exe --headless <project.gdevelop>` starts a hidden editor host.
2. The host automatically starts MCP on `127.0.0.1` and prints machine-readable
   listening/ready records to stdout.
3. The MCP client sees the complete existing catalogue for the process,
   including write-enabled tools and any command tools registered by a future
   release. Tool names, schemas, and result shapes remain unchanged.
4. The model can use the existing file-first workflow: edit files, call
   `validate_project_files`, call `reload_project`, then use preview/runtime
   tools. No unsaved UI confirmation or modal dialog may block this workflow.
5. Preview and debugger windows remain hidden, while their renderers continue
   to run and debugger requests remain responsive.
6. Existing visible-editor behavior and the Preferences-controlled MCP server
   remain backward compatible.
7. Startup, readiness, request timeouts, and shutdown have explicit bounded
   behavior that is testable without a desktop click-through.

## Non-goals

- Replacing or redesigning the existing MCP protocol, tool catalogue, or
  renderer bridge.
- Adding a general arbitrary-filesystem MCP tool. The AI host may edit project
  files using its normal filesystem capability; GDevelop remains responsible
  for validation, loading, code generation, and runtime verification.
- Running the full editor in a separate lightweight service process. The WASM
  model and existing React callbacks remain the source of truth for this first
  version.
- Making the browser/PWA build headless.
- Removing localhost-only security boundaries or adding remote authentication
  to the first version.
- Guaranteeing audio/user-gesture semantics in a hidden window. Runtime logic,
  input, inspection, screenshots, and authored gameplay tests are supported;
  native user gestures are best effort and must not unhide a headless preview.

## Current architecture and constraints

The authoritative flow is:

```text
AI client -> Electron MCP HTTP server -> IPC -> MainFrame MCP bridge
          -> gd::Project / project storage / exporter / debugger
          -> hidden preview BrowserWindow -> GDJS runtime
```

Relevant existing seams are:

- `newIDE/electron-app/app/Mcp/McpServer.js`: localhost JSON-RPC transport;
- `newIDE/electron-app/app/Mcp/McpRendererRequestBroker.js`: bounded IPC,
  progress, retry, and operation coalescing;
- `newIDE/app/src/Mcp/McpToolCatalog.js`: the public catalogue and permission
  filtering;
- `newIDE/app/src/Mcp/McpEditorBridge.js`: project, source, preview, and
  runtime operations;
- `newIDE/app/src/MainFrame/index.js`: bridge callbacks, project lifecycle,
  preview launch, debugger, save/reload, and renderer IPC registration;
- `newIDE/electron-app/app/PreviewWindow.js`: native preview lifecycle;
- `newIDE/electron-app/app/main.js`: command-line parsing, BrowserWindow
  lifecycle, IPC, and MCP server ownership.

The editor model and exported runtime are separate systems. Headless mode must
continue to cross that boundary through serialization/export and must not make
runtime code depend on `gd::Project`.

## User-facing contract

### Invocation

```text
GDevelop.exe --headless [--mcp-port=<port>] <absolute-path-to-project.gdevelop>
```

The positional project argument follows the existing local-project opening
rules and may be a legacy JSON project file. `--mcp-port` accepts `0` (choose an
ephemeral port) or a fixed TCP port. The default is `32110`.

Headless mode implies:

- MCP server enabled;
- write tools enabled;
- command tools enabled;
- update checks, recent-project UI bookkeeping, autosave prompts, and dialogs
  suppressed by the existing CLI/headless paths;
- one hidden editor window for the supplied project.

The existing `--run-command` CLI mode is unchanged. Preferences continue to
control MCP for ordinary visible windows.

### Windows launcher

The repository launcher keeps the existing visible-editor entry point intact:

```text
python scripts/start-windows-app.py [normal launcher options]
```

For automation, `scripts/start-windows-headless-app.py` is a thin wrapper over
that same build/dependency/process pipeline. It forces `--headless`, requires
the project path, and defaults to MCP port `32110`:

```text
python scripts/start-windows-headless-app.py [--skip-build] [--mcp-port=<port>] <project.gdevelop>
```

The visible launcher does not pass `--mcp-port` to Electron, so its existing
Preferences-controlled MCP port remains unchanged. The headless launcher
passes the requested port explicitly. When `--mcp-port=0` is used with the
Windows wrapper, it selects and prints a free localhost port before launching
so the wrapper can poll `/health` and report readiness. Headless launches run
in the foreground, inherit the terminal's stdin/stdout/stderr, and wait for
Electron to exit; main-process logs, renderer warnings/errors, and Electron's
own diagnostics remain visible in that terminal. Headless launches leave
already-running Electron instances alive; if the selected port is already used
by a visible GDevelop MCP server, startup fails with an actionable message to
choose a different port.

### Startup records

When stdout is available, the main process emits one JSON object per line with a
stable prefix:

```text
GDEVELOP_MCP_LISTENING {"url":"http://127.0.0.1:32110/mcp","port":32110,"rendererReady":false}
GDEVELOP_MCP_READY {"url":"http://127.0.0.1:32110/mcp","rendererReady":true}
```

The listening record means the TCP server is bound. The ready record means the
renderer has registered the MCP request handler and a request can be served.
Errors use `GDEVELOP_MCP_ERROR {"code":"...","message":"..."}` and the
process remains alive long enough for the caller to inspect/terminate it.

### HTTP health endpoint

`GET http://127.0.0.1:<port>/health` returns JSON and never forwards to the
renderer:

```json
{
  "ok": true,
  "server": "gdevelop-editor",
  "protocolVersion": "2025-06-18",
  "rendererReady": true,
  "headless": true,
  "mcpUrl": "http://127.0.0.1:32110/mcp"
}
```

Before renderer registration, `ok` is `false`, `rendererReady` is `false`, and
the endpoint remains useful for launchers polling readiness. `/mcp` keeps its
current POST-only behavior.

## Headless lifecycle

1. Parse command-line arguments before Electron single-instance handling.
2. A headless invocation owns its own Electron instance so it can coexist with
   a visible editor and use an independent MCP port.
3. Create one hidden main `BrowserWindow` with
   `skipTaskbar:true`, `show:false`, and
   `webPreferences.backgroundThrottling:false`.
4. Open the supplied project through the existing `LocalApp` and
   `MainFrame` storage path. Auto-save and confirmation prompts remain disabled
   for the initial load.
5. Start the MCP server on the requested port. Register the renderer through a
   dedicated readiness IPC message after the existing MCP request listener is
   installed.
6. Serve all existing tools using headless permissions. Calls received before
   renderer readiness return a bounded `MCP_RENDERER_NOT_READY` tool/health
   response rather than hanging.
7. On shutdown, close previews, stop the MCP server, clear broker requests, and
   let Electron exit through the existing window lifecycle.

## MCP compatibility and permissions

The headless host calls the same `getMcpTools`, `canCallMcpTool`, and
`handleRendererMcpRequest` paths as the visible editor. The only difference is
the permission source: command-line headless mode supplies
`allowWriteTools:true` and `allowCommandTools:true` for the active window.

`tools/list`, `resources/list`, and `prompts/list` are unchanged. A future tool
added to the catalogue automatically becomes available in headless mode if it
is available under those permissions. Unknown tools still return the existing
MCP error shape.

Long operations continue to use the existing operation IDs, progress phases,
timeouts, coalescing, and retry semantics. In particular, the expected file
first sequence is:

```text
write project files
  -> validate_project_files
  -> reload_project
  -> launch_preview { start_paused: true }
  -> run_frames / inspect / capture / run_gameplay_tests
```

## Hidden preview contract

Preview and debugger windows created by a headless parent are created with:

- `show:false` and `skipTaskbar:true`;
- `backgroundThrottling:false`;
- no parent/always-on-top relationship that could steal desktop focus;
- the existing power-save and Chromium anti-occlusion protections.

Hidden previews remain capturable with the existing main-process
`webContents.capturePage` path. Debugger websocket requests remain the source of
truth for runtime state and deterministic stepping. `control_preview { action:
"focus" }` reports a best-effort/no-op result in headless mode and must not
make a window visible. Native click injection likewise never unhides a headless
preview; synthetic debugger input remains available.

## Performance requirements

The implementation is performance-oriented but does not invent a second
runtime:

- no additional project serialization per MCP request;
- one in-flight project reload/catalog generation and one in-flight preview
  launch, using the existing broker coalescing;
- renderer and preview background throttling disabled so hidden windows do not
  stall debugger messages;
- bounded JSON/resource output remains in force;
- project files are written by the caller and are validated/reloaded in one
  explicit operation, avoiding per-file editor reloads;
- deterministic frame stepping is preferred over wall-clock preview playback
  for AI verification;
- startup readiness is observable without polling a UI window.

Initial SLO targets (measured on the repository's normal CI/desktop baseline):

| Operation | Target |
| --- | --- |
| Process to `/health` listening | <= 2 s after Electron process creation |
| Renderer-ready after listening | <= 15 s for a normal local project |
| `ping` after ready | <= 100 ms p95 |
| Read-only state/list request | <= 2 s p95, excluding project open |
| Duplicate reload/validation calls | one renderer operation, multiple attached waiters |
| Hidden preview `run_frames` | same timeout budget and response shape as visible MCP preview |

These are acceptance targets, not new correctness shortcuts. A slow project may
use the existing per-operation timeout fields and progress polling.

## Error handling and safety

- Bind only to `127.0.0.1`; never expose a headless MCP listener on `0.0.0.0`.
- Invalid port values fail before binding with a structured startup error.
- Port conflicts are reported in `GDEVELOP_MCP_ERROR`; no MCP listener is
  exposed when binding fails.
- No project or a failed project load keeps the server alive so the caller can
  read diagnostics; project-scoped tools return the existing error result.
- Requests before renderer readiness fail quickly with
  `MCP_RENDERER_NOT_READY`.
- Renderer crash/close clears pending requests and reports the existing broker
  diagnostics.
- Headless mode never enables arbitrary shell execution. If command tools are
  registered by a later build, they are subject to the existing catalogue and
  command permission checks.
- Shutdown is idempotent; stale preview/debugger windows are closed before the
  host exits.

## Compatibility

- No serialized project schema changes.
- No MCP tool name, schema, resource URI, prompt, or result-shape changes.
- No visible-window default changes.
- Existing Preferences MCP enable/port behavior remains intact.
- Existing `--run-command`, project-file associations, and single-instance
  routing remain intact for non-headless invocations.
- The only new public CLI flags are `--headless` and `--mcp-port`.

## Implementation plan

1. Add argument parsing and a small `Window` headless/config helper.
2. Make the main editor window headless-aware and auto-start MCP with a
   readiness state and `/health` endpoint.
3. Pass headless permissions into the existing renderer bridge.
4. Keep preview/debugger windows hidden and prevent focus/user-gesture helpers
   from un-hiding them.
5. Add focused unit tests for argument parsing, MCP health/startup, hidden
   window options, and renderer readiness wiring.
6. Run focused Electron/editor tests, format checks, and the repository's
   required Windows launcher.

## Acceptance tests

Automated tests must prove:

1. `parseGDevelopArgs` recognizes `--headless` and `--mcp-port=0` without
   treating Chromium switches as project arguments.
2. The MCP server `/health` reports listening versus renderer-ready states.
3. A headless MCP request is rejected quickly before renderer registration and
   succeeds after registration.
4. Headless permissions expose every currently registered catalogue tool,
   including write-enabled tools.
5. Main-window options hide a headless editor and disable background throttling.
6. Preview-window options hide headless previews and do not focus them during
   synthetic click injection.
7. The existing visible MCP server and visible preview behavior remain covered
   by their current tests.

Manual smoke verification (after build):

```text
GDevelop.exe --headless --mcp-port=0 C:\games\demo\project.gdevelop
GET /health until rendererReady:true
POST /mcp initialize
POST /mcp tools/list
POST /mcp tools/call open_project / validate_project_files / reload_project
POST /mcp tools/call launch_preview {start_paused:true}
POST /mcp tools/call run_frames {frames:1}
POST /mcp tools/call capture_preview_screenshot
```

The desktop must not show an editor, preview, or debugger window during this
sequence.

## Self-review

The design was reviewed against `AGENT.md`, `docs/Architecture.md`, the
existing MCP server/bridge/broker, local multi-file storage, and preview
window/debugger lifecycle. The review found and addressed the important risks:

- reuse of the existing bridge avoids API drift;
- readiness is explicit so startup cannot race React listener registration;
- hidden windows disable background throttling, preserving debugger progress;
- project-file writes remain file-first and are validated before reload;
- visible-editor and Preferences paths remain unchanged;
- localhost binding and bounded broker timeouts are preserved;
- no generated files or serialized formats are edited.

The scope is intentionally limited to host lifecycle and window behavior. It is
complete enough to implement the requested AI authoring workflow without
pretending that a new arbitrary filesystem or shell API is required.
