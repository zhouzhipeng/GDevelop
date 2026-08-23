#!/usr/bin/env python3
"""Build and start a hidden GDevelop Windows editor for AI/MCP automation.

This is intentionally a thin wrapper around ``start-windows-app.py``. The
normal launcher remains the source of truth for dependency checks, builds,
process cleanup, and Electron startup; this entry point only forces the
headless flag. Its default MCP port is therefore the same 32110 default used
by the visible editor Preferences path.

Examples::

    python scripts/start-windows-headless-app.py --skip-build game.gdevelop
    python scripts/start-windows-headless-app.py --mcp-port=0 game.gdevelop
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType


BASE_SCRIPT = Path(__file__).with_name("start-windows-app.py")


def load_base_launcher() -> ModuleType:
    spec = importlib.util.spec_from_file_location("start_windows_app", BASE_SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load Windows launcher: {BASE_SCRIPT}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main(argv: list[str] | None = None) -> int:
    base_launcher = load_base_launcher()
    forwarded_args = list(sys.argv[1:] if argv is None else argv)
    if "--headless" not in forwarded_args:
        forwarded_args.insert(0, "--headless")
    return base_launcher.main(forwarded_args)


if __name__ == "__main__":
    raise SystemExit(main())
