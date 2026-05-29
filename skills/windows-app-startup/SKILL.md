---
name: windows-app-startup
description: Use when starting, restarting, or troubleshooting the GDevelop Windows Electron app from this repository, especially after stale Electron processes, port 3000/5002 conflicts, dev server hangs, stale UI, or startup verification failures.
---

# Windows App Startup

## Overview

Start the Windows desktop app with the repository startup script. Do not recreate the launch flow by hand unless the script itself is being debugged.

## Command

Run from the repository root:

```powershell
.\scripts\start-windows-app.py
```

The script performs the full production-mode startup: stops existing GDevelop Electron processes, clears stale `3000/5002` dev-server listeners, ensures Electron dependencies, builds `newIDE/app`, syncs `newIDE/electron-app/app/www`, launches Electron with `ELECTRON_IS_DEV=0`, and verifies the `GDevelop 5` window.

## Options

```powershell
.\scripts\start-windows-app.py --dry-run --no-launch
.\scripts\start-windows-app.py --skip-build
.\scripts\start-windows-app.py --no-launch
```

Use `--skip-build` only when a fresh `newIDE/app/build` already exists and the task is just a quick restart.

## Verification

Trust the script's final verification. It should end by printing a `GDevelop 5` Electron window row. If it exits nonzero, read the step header immediately above the error and fix that step.

## Troubleshooting

- If startup fails while stopping processes, keep the stop phase best-effort; do not make individual `Stop-Process` failures abort startup.
- If the UI looks stale, rerun without `--skip-build`.
- If changing the script, run:

```powershell
python scripts\test_start_windows_app.py
python -m py_compile scripts\start-windows-app.py scripts\test_start_windows_app.py
.\scripts\start-windows-app.py --dry-run --no-launch
```
