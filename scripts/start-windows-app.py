#!/usr/bin/env python3
"""Build and start the GDevelop Windows Electron app.

This intentionally uses the production Electron path because the development
server path can hang on this Windows checkout and can race with GDJS resource
regeneration.

Missing or out-of-date npm dependencies are installed automatically before the
build: each package dir gets an ``npm install`` when its ``node_modules`` is
absent or its ``package.json``/``package-lock.json`` is newer than the last
install (so a newly-added dependency does not fail the build with a late
"Can't resolve" error).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from libgd_build import LIBGD_VARIANTS, build_libgd, npm_install_needed


DEV_PORTS = (3000, 5002)
DEFAULT_MCP_PORT = 32110
HEADLESS_STARTUP_TIMEOUT_SECONDS = 30
REACT_BUILD_MINIMUM_HEAP_MB = 8192
NODE_MAX_OLD_SPACE_SIZE_PATTERN = re.compile(
    r"(?<!\S)--max[-_]old[-_]space[-_]size(?:=|\s+)(\d+)(?!\S)"
)


def parse_mcp_port(value: str) -> int:
    try:
        port = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("MCP port must be an integer.") from error
    if not 0 <= port <= 65535:
        raise argparse.ArgumentTypeError("MCP port must be between 0 and 65535.")
    return port


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Fully build, sync, and start the GDevelop Windows app. "
            "Use --headless with a project path for the AI/MCP host."
        )
    )
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="Path to the GDevelop repository root.",
    )
    parser.add_argument(
        "--build",
        dest="build",
        action="store_true",
        default=True,
        help="Run npm run build before launching. This is the default.",
    )
    parser.add_argument(
        "--skip-build",
        dest="build",
        action="store_false",
        help="Launch faster by reusing the existing libGD.js, newIDE/app/build and app/www.",
    )
    parser.add_argument(
        "--libgd-variant",
        choices=LIBGD_VARIANTS,
        help=(
            "Optional GDevelop.js build variant to pass as --variant=<value>. "
            "For development, --libgd-variant dev links faster."
        ),
    )
    parser.add_argument(
        "--libgd-use-mingw",
        action="store_true",
        help="Build GDevelop.js with npm run build-with-MinGW instead of the default Ninja build.",
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        help=(
            "Start a hidden editor and automatically enable its localhost MCP "
            "server. Requires a project path."
        ),
    )
    parser.add_argument(
        "--mcp-port",
        type=parse_mcp_port,
        default=DEFAULT_MCP_PORT,
        help=(
            "MCP port for --headless (0 chooses a free port; default: "
            f"{DEFAULT_MCP_PORT}). Ignored by the normal visible launch, "
            "which keeps its Preferences-controlled MCP port."
        ),
    )
    parser.add_argument(
        "project",
        nargs="?",
        type=Path,
        help="Optional project file to open; required by --headless.",
    )
    parser.add_argument(
        "--no-launch",
        action="store_true",
        help="Build and sync app/www but do not start Electron.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the planned commands without running them.",
    )
    return parser.parse_args(argv)


def step(title: str) -> None:
    print(f"\n==> {title}", flush=True)


def resolve_tool(name: str) -> str:
    candidates = [f"{name}.cmd", name] if os.name == "nt" else [name]
    for candidate in candidates:
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
    raise RuntimeError(f"Could not find required tool on PATH: {name}")


def command_line(command: list[str]) -> str:
    return " ".join(command)


def node_options_with_minimum_heap(current_options: str) -> str:
    """Keep existing Node options while guaranteeing enough heap for React."""
    configured_heap_sizes = [
        int(match.group(1))
        for match in NODE_MAX_OLD_SPACE_SIZE_PATTERN.finditer(current_options)
    ]
    heap_size_mb = max(
        [REACT_BUILD_MINIMUM_HEAP_MB, *configured_heap_sizes]
    )
    options_without_heap = NODE_MAX_OLD_SPACE_SIZE_PATTERN.sub(
        "", current_options
    ).strip()
    heap_option = f"--max-old-space-size={heap_size_mb}"
    return " ".join(option for option in (options_without_heap, heap_option) if option)


def run_command(
    command: list[str],
    *,
    cwd: Path,
    dry_run: bool,
    env_updates: dict[str, str] | None = None,
) -> None:
    env = os.environ.copy()
    if env_updates:
        env.update(env_updates)

    print(f"[run] {cwd}> {command_line(command)}", flush=True)
    if dry_run:
        return

    subprocess.run(command, cwd=cwd, env=env, check=True)


def run_powershell(script: str, *, cwd: Path, dry_run: bool) -> str:
    powershell = shutil.which("powershell") or shutil.which("pwsh")
    if not powershell:
        raise RuntimeError("Could not find powershell or pwsh on PATH.")

    command = [
        powershell,
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script,
    ]
    print(f"[run] {cwd}> powershell -NoProfile -Command <script>", flush=True)
    if dry_run:
        print(script.strip(), flush=True)
        return ""

    result = subprocess.run(
        command,
        cwd=cwd,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
    )
    stdout = result.stdout or ""
    stderr = result.stderr or ""
    if stdout.strip():
        print(stdout.rstrip(), flush=True)
    if stderr.strip():
        print(stderr.rstrip(), file=sys.stderr, flush=True)
    if result.returncode != 0:
        raise RuntimeError(f"PowerShell command failed with exit code {result.returncode}.")
    return stdout


def quote_powershell_string(path: Path | str) -> str:
    return "'" + str(path).replace("'", "''") + "'"


def is_running_as_administrator() -> bool:
    """Return True if the current process has an elevated (Administrator) token.

    Only meaningful on Windows; returns False on other platforms.
    """
    if os.name != "nt":
        return False

    try:
        import ctypes

        # IsUserAnAdmin() returns non-zero when the process runs elevated.
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        # If we cannot determine the elevation state, do not block the user.
        return False


def ensure_not_running_as_administrator() -> None:
    """Refuse to run elevated: Administrator breaks drag-and-drop on Windows.

    When GDevelop runs as Administrator (High integrity level), Windows' User
    Interface Privilege Isolation (UIPI) silently blocks drag-and-drop coming
    from normal-integrity processes such as Explorer. The result is that
    dragging an image onto the scene canvas shows the "blocked" cursor and does
    nothing. Running GDevelop as a normal user keeps it at the same integrity
    level as Explorer, so drag-and-drop works. GDevelop does not need
    Administrator rights for normal use.
    """
    if not is_running_as_administrator():
        return

    print(
        "\n".join(
            [
                "ERROR: GDevelop must not be started as Administrator on Windows.",
                "",
                "Running elevated breaks drag-and-drop (e.g. dragging an image onto",
                "the scene canvas): Windows blocks drops from normal programs like",
                "Explorer into an Administrator process (UIPI), so you only get the",
                '"blocked" cursor.',
                "",
                "How to fix: close this window and run the script again from a NORMAL",
                "(non-elevated) terminal. Do NOT use 'Run as administrator'. GDevelop",
                "does not need Administrator rights.",
            ]
        ),
        file=sys.stderr,
        flush=True,
    )


def stop_existing_processes(
    repo_root: Path,
    electron_exe: Path,
    dry_run: bool,
    *,
    stop_electron: bool = True,
) -> None:
    if stop_electron:
        step("Stop existing GDevelop Electron processes")
        script = f"""
$electronPath = {quote_powershell_string(electron_exe)}
$processes = Get-Process electron -ErrorAction SilentlyContinue |
  Where-Object {{ $_.Path -eq $electronPath }}

foreach ($process in $processes) {{
  try {{
    Stop-Process -Id $process.Id -Force -ErrorAction Stop
  }} catch {{
    Write-Warning "Could not stop Electron process $($process.Id): $($_.Exception.Message)"
  }}
}}
exit 0
"""
        run_powershell(script, cwd=repo_root, dry_run=dry_run)
    else:
        step("Keep existing GDevelop Electron processes")
        print(
            "Headless mode keeps visible/headless Electron instances running "
            "so they can coexist (including their development servers).",
            flush=True,
        )
        return

    step("Stop stale dev servers on ports 3000 and 5002")
    ports_pattern = "|".join(f":{port}.*LISTENING" for port in DEV_PORTS)
    script = f"""
$owners = netstat -ano |
  Select-String {quote_powershell_string(ports_pattern)} |
  ForEach-Object {{ ($_ -split '\\s+')[-1] }} |
  Sort-Object -Unique

foreach ($owner in $owners) {{
  if ($owner -match '^\\d+$') {{
    try {{
      Stop-Process -Id ([int]$owner) -Force -ErrorAction Stop
    }} catch {{
      Write-Warning "Could not stop process $owner for dev server port cleanup: $($_.Exception.Message)"
    }}
  }}
}}
exit 0
"""
    run_powershell(script, cwd=repo_root, dry_run=dry_run)


def ensure_electron_dependencies(
    repo_root: Path,
    electron_app_dir: Path,
    electron_exe: Path,
    dry_run: bool,
) -> None:
    step("Ensure Electron dependencies")
    needed, reason = npm_install_needed(electron_app_dir)
    if electron_exe.exists() and not needed:
        print(f"Electron executable exists: {electron_exe}", flush=True)
        return

    if not electron_exe.exists():
        reason = "Electron executable is missing"
    print(
        f"electron-app dependencies out of date ({reason}); installing.",
        flush=True,
    )
    run_command([resolve_tool("npm"), "install"], cwd=electron_app_dir, dry_run=dry_run)

    if not dry_run and not electron_exe.exists():
        raise RuntimeError(f"Electron executable still missing after npm install: {electron_exe}")


def ensure_packaged_electron_runtime_dependencies(
    electron_runtime_dir: Path, dry_run: bool
) -> None:
    step("Ensure packaged Electron runtime dependencies")
    node_modules = electron_runtime_dir / "node_modules"
    needed, reason = npm_install_needed(
        electron_runtime_dir, required_dependencies=("typescript",)
    )
    if not needed:
        print(
            f"Packaged runtime dependencies present: {node_modules}",
            flush=True,
        )
        return

    print(
        "Packaged Electron runtime dependencies out of date "
        f"({reason}); running npm install in newIDE/electron-app/app.",
        flush=True,
    )
    run_command(
        [resolve_tool("npm"), "install"],
        cwd=electron_runtime_dir,
        dry_run=dry_run,
    )

    if not dry_run:
        still_needed, still_needed_reason = npm_install_needed(
            electron_runtime_dir, required_dependencies=("typescript",)
        )
        if still_needed:
            raise RuntimeError(
                "Packaged Electron runtime dependencies are still invalid after "
                f"npm install: {still_needed_reason}"
            )


def ensure_react_app_dependencies(app_dir: Path, dry_run: bool) -> None:
    step("Ensure React app dependencies")
    node_modules = app_dir / "node_modules"
    needed, reason = npm_install_needed(app_dir)
    if not needed:
        print(f"React app dependencies present: {node_modules}", flush=True)
        return

    print(
        f"React app dependencies out of date ({reason}); running npm install in newIDE/app.",
        flush=True,
    )
    run_command([resolve_tool("npm"), "install"], cwd=app_dir, dry_run=dry_run)

    if not dry_run and not node_modules.exists():
        raise RuntimeError(f"React app node_modules still missing after npm install: {node_modules}")


def build_react_app(app_dir: Path, build: bool, dry_run: bool) -> None:
    step("Build React app")
    if not build:
        print(
            "Fast launch: reusing existing newIDE/app/build because --skip-build was set.",
            flush=True,
        )
        return

    node_options = node_options_with_minimum_heap(os.environ.get("NODE_OPTIONS", ""))
    print(
        f"React build Node heap limit: at least {REACT_BUILD_MINIMUM_HEAP_MB} MB",
        flush=True,
    )
    run_command(
        [resolve_tool("npm"), "run", "build"],
        cwd=app_dir,
        dry_run=dry_run,
        env_updates={"NODE_OPTIONS": node_options},
    )


def sync_electron_www(electron_app_dir: Path, build: bool, dry_run: bool) -> None:
    step("Sync Electron app/www")
    if not build:
        print(
            "Fast launch: reusing existing app/www because --skip-build was set.",
            flush=True,
        )
        return

    run_command(
        [
            resolve_tool("npm"),
            "run",
            "app-build",
            "--",
            "--skip-app-build",
            "--allow-development-libgd",
        ],
        cwd=electron_app_dir,
        dry_run=dry_run,
    )


def launch_electron(
    electron_app_dir: Path,
    electron_exe: Path,
    dry_run: bool,
    *,
    headless: bool = False,
    mcp_port: int = DEFAULT_MCP_PORT,
    project: Path | None = None,
) -> int | subprocess.Popen | None:
    """Start Electron and return its PID, or its process in foreground mode.

    The visible launcher keeps its historical detached behavior. Headless mode
    deliberately inherits this terminal's stdin/stdout/stderr and returns the
    live ``Popen`` object so the caller can wait for the editor and propagate
    its exit code.
    """
    step("Launch Electron")
    command = [str(electron_exe), "--force_high_performance_gpu", "app"]
    if headless:
        command.extend(["--headless", f"--mcp-port={mcp_port}"])
    if project is not None:
        command.append(str(project))
    print(
        f"[run] {electron_app_dir}> ELECTRON_IS_DEV=0 {command_line(command)}",
        flush=True,
    )
    if dry_run:
        return None

    env = os.environ.copy()
    env["ELECTRON_IS_DEV"] = "0"
    if headless:
        env["ELECTRON_ENABLE_LOGGING"] = "1"
        process = subprocess.Popen(
            command,
            cwd=electron_app_dir,
            env=env,
            stdin=None,
            stdout=None,
            stderr=None,
            creationflags=0,
        )
        print(
            f"Started foreground headless Electron process PID: {process.pid}",
            flush=True,
        )
        return process

    process = subprocess.Popen(
        command,
        cwd=electron_app_dir,
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=(
            subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
        ),
    )
    print(f"Started detached Electron process PID: {process.pid}", flush=True)
    return process.pid


def verify_inputs(
    repo_root: Path,
    electron_app_dir: Path,
    electron_exe: Path,
    dry_run: bool,
    check_dev_ports: bool = True,
) -> None:
    step("Verify startup inputs")
    www_index = electron_app_dir / "app" / "www" / "index.html"
    print(f"Electron executable: {electron_exe}", flush=True)
    print(f"Electron app index: {www_index}", flush=True)
    if dry_run:
        return

    if not electron_exe.exists():
        raise RuntimeError(f"Electron executable missing: {electron_exe}")
    if not www_index.exists():
        raise RuntimeError(f"Electron app index missing: {www_index}")

    if not check_dev_ports:
        return

    ports_pattern = "|".join(f":{port}.*LISTENING" for port in DEV_PORTS)
    script = f"""
$ports = netstat -ano | Select-String {quote_powershell_string(ports_pattern)}
if ($ports) {{
  $ports
  Write-Error 'Unexpected dev server port listener found.'
  exit 1
}}
"""
    run_powershell(script, cwd=repo_root, dry_run=dry_run)


def reserve_headless_mcp_port(requested_port: int, dry_run: bool) -> int:
    """Resolve --mcp-port=0 before launch so the launcher can verify readiness.

    The Electron process still receives a valid fixed port. This keeps the
    foreground launcher discoverable even when the caller requested an
    ephemeral port. The short bind/release interval has the same best-effort
    race as any command-line port probe; a real bind failure is reported by
    Electron's structured MCP startup event.
    """
    if requested_port != 0 or dry_run:
        return requested_port

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        selected_port = int(probe.getsockname()[1])
    print(
        f"Headless MCP requested an ephemeral port; selected {selected_port}.",
        flush=True,
    )
    return selected_port


def verify_headless_mcp_started(
    repo_root: Path,
    mcp_port: int,
    *,
    timeout_seconds: int = HEADLESS_STARTUP_TIMEOUT_SECONDS,
    process: subprocess.Popen | None = None,
) -> None:
    """Wait for the hidden editor's MCP listener and renderer readiness."""
    del repo_root  # Kept in the public verifier signature for launcher symmetry.
    health_url = f"http://127.0.0.1:{mcp_port}/health"
    deadline = time.monotonic() + timeout_seconds
    last_status = "no health response yet"

    while time.monotonic() < deadline:
        if process is not None:
            exit_code = process.poll()
            if exit_code is not None:
                raise RuntimeError(
                    "Headless Electron exited before MCP became ready "
                    f"(exit code {exit_code})."
                )
        try:
            request = urllib.request.Request(
                health_url,
                headers={"Accept": "application/json"},
            )
            with urllib.request.urlopen(request, timeout=1.5) as response:
                payload = json.loads(response.read().decode("utf-8"))
            if not isinstance(payload, dict):
                last_status = f"unexpected health payload: {payload}"
                time.sleep(0.25)
                continue
            if (
                payload.get("server") == "gdevelop-editor"
                and payload.get("headless") is True
                and payload.get("ok")
                and payload.get("rendererReady")
            ):
                print(
                    "Headless MCP is ready: "
                    f"{payload.get('mcpUrl') or health_url}",
                    flush=True,
                )
                return
            if (
                payload.get("server") == "gdevelop-editor"
                and payload.get("headless") is False
            ):
                raise RuntimeError(
                    f"MCP port {mcp_port} is already owned by a visible GDevelop "
                    "editor; pass --mcp-port=<different-port> for headless mode."
                )
            last_status = (
                "listener is up but rendererReady is false"
                if payload.get("server") == "gdevelop-editor"
                else f"unexpected health payload: {payload}"
            )
        except urllib.error.URLError as error:
            last_status = str(error.reason or error)
        except (OSError, ValueError) as error:
            last_status = str(error)
        time.sleep(0.25)

    raise RuntimeError(
        f"Headless MCP did not become ready on {health_url} within "
        f"{timeout_seconds}s ({last_status})."
    )


def verify_electron_started(
    repo_root: Path,
    electron_exe: Path,
    dry_run: bool,
    *,
    headless: bool = False,
    mcp_port: int = DEFAULT_MCP_PORT,
    process: subprocess.Popen | None = None,
) -> None:
    step("Verify headless MCP readiness" if headless else "Verify Electron window")
    if dry_run:
        print("Dry run: not checking live Electron processes.", flush=True)
        return

    if headless:
        verify_headless_mcp_started(repo_root, mcp_port, process=process)
        return

    time.sleep(5)
    script = f"""
$electronPath = {quote_powershell_string(electron_exe)}
$windows = Get-Process electron -ErrorAction SilentlyContinue |
  Where-Object {{ $_.Path -eq $electronPath -and $_.MainWindowTitle -like 'GDevelop 6*' }}
if (!$windows) {{
  Get-Process electron -ErrorAction SilentlyContinue |
    Where-Object {{ $_.Path -eq $electronPath }} |
    Select-Object Id,MainWindowTitle,StartTime |
    Format-Table -AutoSize
  Write-Error 'Could not find a GDevelop 6 Electron window.'
  exit 1
}}
$windows | Select-Object Id,MainWindowTitle,StartTime | Format-Table -AutoSize
"""
    run_powershell(script, cwd=repo_root, dry_run=dry_run)


def terminate_headless_electron(process: subprocess.Popen, reason: str) -> None:
    """Stop a foreground headless process after a launcher-side failure."""
    if process.poll() is not None:
        return

    print(f"Stopping headless Electron ({reason})...", file=sys.stderr, flush=True)
    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        print(
            "Headless Electron did not stop after 10 seconds; terminating it.",
            file=sys.stderr,
            flush=True,
        )
        process.kill()
        process.wait()


def wait_for_headless_electron(process: subprocess.Popen) -> int:
    """Keep the headless editor attached to the terminal until it exits."""
    step("Run headless Electron in foreground")
    print(
        "Headless GDevelop is running in this terminal. Press Ctrl+C to stop it.",
        flush=True,
    )
    try:
        exit_code = process.wait()
    except KeyboardInterrupt:
        terminate_headless_electron(process, "Ctrl+C")

        # Ctrl+C is an expected user action, but return the conventional shell
        # status so scripts can distinguish it from a clean editor exit.
        return 130

    if exit_code:
        print(
            f"Headless Electron exited with code {exit_code}.",
            file=sys.stderr,
            flush=True,
        )
    else:
        print("Headless Electron exited normally.", flush=True)
    return int(exit_code or 0)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    if args.headless and args.project is None:
        print(
            "ERROR: --headless requires a project file path.",
            file=sys.stderr,
            flush=True,
        )
        return 2

    # Refuse to run elevated: Administrator breaks drag-and-drop on Windows
    # (see ensure_not_running_as_administrator). Checked before doing any work.
    if is_running_as_administrator():
        ensure_not_running_as_administrator()
        return 1

    repo_root = args.repo_root.resolve()
    app_dir = repo_root / "newIDE" / "app"
    electron_app_dir = repo_root / "newIDE" / "electron-app"
    electron_runtime_dir = electron_app_dir / "app"
    electron_exe = electron_app_dir / "node_modules" / "electron" / "dist" / "electron.exe"
    project_path = args.project.resolve() if args.project is not None else None

    if args.headless and project_path is not None and not args.dry_run:
        if not project_path.is_file():
            print(
                f"ERROR: headless project file does not exist: {project_path}",
                file=sys.stderr,
                flush=True,
            )
            return 2

    if args.dry_run:
        print("DRY RUN: no commands will be executed.", flush=True)

    build = args.build

    try:
        ensure_electron_dependencies(repo_root, electron_app_dir, electron_exe, args.dry_run)
        ensure_packaged_electron_runtime_dependencies(
            electron_runtime_dir, args.dry_run
        )
        ensure_react_app_dependencies(app_dir, args.dry_run)
        build_libgd(
            repo_root,
            skip_build=not build,
            variant=args.libgd_variant,
            use_mingw=args.libgd_use_mingw,
            dry_run=args.dry_run,
            required=False,
            auto_install_emscripten=False,
            skip_message="Fast launch: reusing existing libGD.js because --skip-build was set.",
        )
        build_react_app(app_dir, build, args.dry_run)
        sync_electron_www(electron_app_dir, build, args.dry_run)

        if args.no_launch:
            step("Launch Electron")
            print("Skipping launch because --no-launch was set.", flush=True)
            verify_inputs(
                repo_root,
                electron_app_dir,
                electron_exe,
                args.dry_run,
                check_dev_ports=False,
            )
        else:
            # Keep the currently running app open while the build runs. Only
            # stop it after the rebuilt app artifacts are ready to launch.
            verify_inputs(
                repo_root,
                electron_app_dir,
                electron_exe,
                args.dry_run,
                check_dev_ports=False,
            )
            stop_existing_processes(
                repo_root,
                electron_exe,
                args.dry_run,
                stop_electron=not args.headless,
            )
            verify_inputs(
                repo_root,
                electron_app_dir,
                electron_exe,
                args.dry_run,
                check_dev_ports=not args.headless,
            )
            mcp_port = reserve_headless_mcp_port(args.mcp_port, args.dry_run)
            launched_process = launch_electron(
                electron_app_dir,
                electron_exe,
                args.dry_run,
                headless=args.headless,
                mcp_port=mcp_port,
                project=project_path,
            )
            headless_process = launched_process if args.headless else None
            try:
                verify_electron_started(
                    repo_root,
                    electron_exe,
                    args.dry_run,
                    headless=args.headless,
                    mcp_port=mcp_port,
                    process=headless_process,
                )
            except KeyboardInterrupt:
                if headless_process is not None:
                    terminate_headless_electron(
                        headless_process, "Ctrl+C during startup"
                    )
                return 130
            except Exception:
                if headless_process is not None:
                    terminate_headless_electron(
                        headless_process, "startup verification failed"
                    )
                raise
            if headless_process is not None:
                return wait_for_headless_electron(headless_process)
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print(f"ERROR: {error}", file=sys.stderr, flush=True)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
