#!/usr/bin/env python3
"""Build and deploy the GDevelop web editor to a remote Linux server.

The script uploads the static React build over SSH, installs/configures Nginx
when requested, and switches the remote web root atomically through a
``current`` symlink.
usage:    ./scripts/deploy-web-editor.py --host <host> --user <user>  --password '<password>' --my-cloud-token '<token>'

"""

from __future__ import annotations

import argparse
import os
import pathlib
import posixpath
import re
import shlex
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
from typing import Optional

try:
    import paramiko
except ImportError:  # pragma: no cover - depends on local environment.
    paramiko = None


REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
DEFAULT_BUILD_DIR = REPO_ROOT / "newIDE" / "app" / "build"
DEFAULT_APP_DIR = REPO_ROOT / "newIDE" / "app"


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(line_buffering=True)
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(line_buffering=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build and deploy the GDevelop web editor to a remote server.",
        epilog=(
            "Examples:\n"
            "  # Windows (cmd / PowerShell), double quotes are fine:\n"
            '  python scripts\\deploy-web-editor.py --host 8.153.146.11 --user root --password "<password>"\n'
            "\n"
            "  # macOS / Linux (bash / zsh): use SINGLE quotes around values\n"
            "  # containing ! $ ` or \" so the shell does not expand them.\n"
            "  # (In zsh a '!' inside double quotes triggers history expansion and\n"
            "  #  silently rewrites your command instead of running it.)\n"
            "  ./scripts/deploy-web-editor.py --host 8.153.146.11 --user root \\\n"
            "      --password '<your_password>' --my-cloud-token '123456'"
        ),
        formatter_class=argparse.RawTextHelpFormatter,
    )
    parser.add_argument("--host", required=True, help="Remote server host or IP.")
    parser.add_argument("--user", required=True, help="SSH user.")
    parser.add_argument("--port", type=int, default=22, help="SSH port. Defaults to 22.")
    parser.add_argument(
        "--password",
        required=True,
        help=(
            "SSH password. On macOS/Linux wrap it in SINGLE quotes if it contains "
            "special characters like ! $ ` or \" (e.g. --password '<your_password>'), "
            "otherwise the shell may alter it before the script sees it."
        ),
    )
    parser.add_argument(
        "--remote-path",
        default="/var/www/gdevelop-editor",
        help="Remote deployment directory. Defaults to /var/www/gdevelop-editor.",
    )
    parser.add_argument(
        "--build-dir",
        default=str(DEFAULT_BUILD_DIR),
        help="Local build directory to upload. Defaults to newIDE/app/build.",
    )
    parser.add_argument(
        "--app-dir",
        default=str(DEFAULT_APP_DIR),
        help="Local app directory used for npm build. Defaults to newIDE/app.",
    )
    parser.add_argument(
        "--build-command",
        default="npm run build",
        help="Build command executed in --app-dir. Defaults to 'npm run build'.",
    )
    parser.add_argument(
        "--no-nginx",
        action="store_true",
        help="Do not install or configure Nginx.",
    )
    parser.add_argument(
        "--site-name",
        default="gdevelop-editor",
        help="Nginx site/config name. Defaults to gdevelop-editor.",
    )
    parser.add_argument(
        "--server-name",
        help="Nginx server_name value. Defaults to '<host> _'.",
    )
    parser.add_argument(
        "--public-origin",
        help=(
            "Optional fixed public origin, e.g. https://gd.zhouzhipeng.com. "
            "Normally NOT needed: proxied GDevelop URLs are rewritten to "
            "root-relative paths and the My Cloud server derives its base URL "
            "from each request, so the site works by IP or domain, http or "
            "https. Only set this to pin My Cloud's absolute resource/share "
            "links to a specific origin."
        ),
    )
    parser.add_argument(
        "--nginx-port",
        type=int,
        default=80,
        help="Nginx listen port. Defaults to 80.",
    )
    parser.add_argument(
        "--keep-releases",
        type=int,
        default=3,
        help="Number of old releases to keep on the server. Defaults to 3.",
    )
    parser.add_argument(
        "--no-my-cloud",
        action="store_true",
        help=(
            "Do not deploy the self-hosted 'My Cloud' project server, and do not "
            "build the editor with the My Cloud same-origin proxy path."
        ),
    )
    parser.add_argument(
        "--my-cloud-path",
        default="/my-cloud",
        help=(
            "Same-origin URL path where the My Cloud server is reverse-proxied "
            "and where the editor expects it. Defaults to /my-cloud."
        ),
    )
    parser.add_argument(
        "--my-cloud-token",
        default=None,
        help=(
            "Shared access token required by the My Cloud server. Strongly "
            "recommended for any public deployment. If omitted, the server runs "
            "open (only acceptable on a trusted/private network). On macOS/Linux "
            "wrap it in SINGLE quotes if it contains special characters "
            "(e.g. --my-cloud-token 'abc!123')."
        ),
    )
    parser.add_argument(
        "--my-cloud-port",
        type=int,
        default=3030,
        help="Local port the My Cloud Node server listens on. Defaults to 3030.",
    )
    parser.add_argument(
        "--my-cloud-server-dir",
        default=str(REPO_ROOT / "newIDE" / "my-cloud-server"),
        help="Local path to the my-cloud-server source. Defaults to newIDE/my-cloud-server.",
    )
    parser.add_argument(
        "--show-account-ui",
        action="store_true",
        help=(
            "Keep GDevelop's account UI (login/register/profile) visible. By "
            "default it is hidden on self-hosted deployments, since projects are "
            "stored and shared with the My Cloud token set in Preferences."
        ),
    )
    parser.add_argument(
        "--mcp-host",
        action="store_true",
        help=(
            "Enable the headless MCP host inside the My Cloud server (reuses the "
            "real editor MCP tools via libGD in Node — no Electron). Reachable at "
            "<domain>/my-cloud/mcp, sharing the My Cloud token. Requires building "
            "the MCP bundle (done automatically). Pair with --mcp-project."
        ),
    )
    parser.add_argument(
        "--mcp-project",
        default=None,
        help=(
            "The My Cloud project id the MCP host operates on (the AI tools "
            "inspect/operate on this single stored project)."
        ),
    )
    return parser.parse_args()


def require_paramiko() -> None:
    if paramiko is None:
        raise SystemExit(
            "paramiko is required for password-based SSH. Install it with "
            "'python -m pip install paramiko' or use an environment that already "
            "provides it."
        )


def validate_args(args: argparse.Namespace) -> None:
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", args.site_name):
        raise SystemExit("--site-name can only contain letters, numbers, dots, dashes, and underscores.")
    if args.nginx_port < 1 or args.nginx_port > 65535:
        raise SystemExit("--nginx-port must be between 1 and 65535.")
    if args.keep_releases < 1:
        raise SystemExit("--keep-releases must be at least 1.")
    if not args.remote_path.startswith("/"):
        raise SystemExit("--remote-path must be an absolute Linux path.")
    if not args.no_my_cloud:
        if not re.fullmatch(r"/[A-Za-z0-9_./-]*", args.my_cloud_path):
            raise SystemExit(
                "--my-cloud-path must be an absolute URL path like /my-cloud."
            )
        args.my_cloud_path = args.my_cloud_path.rstrip("/") or "/my-cloud"
        if args.my_cloud_port < 1 or args.my_cloud_port > 65535:
            raise SystemExit("--my-cloud-port must be between 1 and 65535.")


def run_local_build(args: argparse.Namespace) -> float:
    app_dir = pathlib.Path(args.app_dir).resolve()
    if not app_dir.exists():
        raise SystemExit(f"App directory does not exist: {app_dir}")

    env = os.environ.copy()
    env.setdefault("CI", "false")
    env.setdefault("REACT_APP_DISABLE_ANALYTICS", "true")
    env.setdefault("REACT_APP_GDEVELOP_API_PROXY_PATH", "/gdevelop-api")
    env.setdefault("REACT_APP_GDEVELOP_API_WS_PROXY_PATH", "/gdevelop-api-ws")
    env.setdefault("REACT_APP_GDEVELOP_RESOURCES_PROXY_PATH", "/gdevelop-resources")
    env.setdefault(
        "REACT_APP_GDEVELOP_PUBLIC_RESOURCES_PROXY_PATH",
        "/gdevelop-public-resources",
    )
    env.setdefault(
        "REACT_APP_GDEVELOP_PROJECT_RESOURCES_PROXY_PATH",
        "/gdevelop-project-resources",
    )
    env.setdefault(
        "REACT_APP_GDEVELOP_PRIVATE_ASSETS_PROXY_PATH",
        "/gdevelop-private-assets",
    )
    env.setdefault(
        "REACT_APP_GDEVELOP_PRIVATE_GAME_TEMPLATES_PROXY_PATH",
        "/gdevelop-private-game-templates",
    )
    env.setdefault(
        "REACT_APP_GDEVELOP_ASSET_RESOURCES_PROXY_PATH",
        "/gdevelop-asset-resources",
    )
    # Self-hosted "My Cloud" storage server, served same-origin behind nginx at
    # /my-cloud (see configure_nginx / deploy_my_cloud_server). When disabled,
    # the storage provider still works if the user enters a full server URL in
    # the editor Preferences.
    if not args.no_my_cloud:
        env.setdefault("REACT_APP_MY_CLOUD_PROXY_PATH", args.my_cloud_path)
    # Self-hosted deployments don't use GDevelop accounts: projects are stored
    # and shared with the My Cloud token configured in Preferences. Hide the
    # login/register/profile UI entirely. Disable with --show-account-ui.
    if not args.show_account_ui:
        env.setdefault("REACT_APP_HIDE_ACCOUNT_UI", "1")
    # Self-hosted GDJS Runtime (game engine for previews/exports). The official
    # CDN only serves official version-hash paths, so a self-built version 403s.
    # We serve our own copy at /gdjs-runtime (staged into build/ by
    # stage_gdjs_runtime). Pin to the public domain when known, else relative.
    domain = configured_public_domain(args)
    env.setdefault(
        "REACT_APP_GDJS_RUNTIME_BASE_URL",
        f"{domain}/gdjs-runtime" if domain else "/gdjs-runtime",
    )
    build_started_at = time.time()
    print(f"Building web editor with '{args.build_command}' in {app_dir}...")
    result = subprocess.run(args.build_command, cwd=str(app_dir), env=env, shell=True)
    if result.returncode != 0:
        raise SystemExit(f"Build failed with exit code {result.returncode}.")
    print("Local web editor build completed.")
    return build_started_at


def assert_build_dir(build_dir: pathlib.Path, build_started_at: float) -> None:
    required_files = ["index.html", "asset-manifest.json", "libGD.js", "libGD.wasm"]
    missing = [name for name in required_files if not (build_dir / name).exists()]
    if missing:
        raise SystemExit(
            f"Build directory is missing required file(s): {', '.join(missing)}. "
            "The deployment was stopped before upload."
        )
    index_html_mtime = (build_dir / "index.html").stat().st_mtime
    if index_html_mtime + 2 < build_started_at:
        raise SystemExit(
            "Build output does not look freshly generated. "
            "The deployment was stopped before upload."
        )


def stage_gdjs_runtime(args: argparse.Namespace, build_dir: pathlib.Path) -> None:
    """Copy the locally-built GDJS Runtime into build/gdjs-runtime/Runtime so it
    is uploaded and served same-origin. The editor fetches it from
    ${REACT_APP_GDJS_RUNTIME_BASE_URL}/Runtime/... (see BrowserS3GDJSFinder).

    The Runtime is produced by `npm run import-resources` (part of the build)
    into newIDE/app/resources/GDJS/Runtime. It is NOT in public/, so CRA does
    not copy it automatically — we stage it here at deploy time only.
    """
    app_dir = pathlib.Path(args.app_dir).resolve()
    source = app_dir / "resources" / "GDJS" / "Runtime"
    if not (source / "index.html").exists():
        print(
            f"⚠️ GDJS Runtime not found at {source} — previews/exports may 403. "
            "Did `npm run import-resources` run as part of the build?"
        )
        return
    destination = build_dir / "gdjs-runtime" / "Runtime"
    if destination.exists():
        shutil.rmtree(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    print(f"Staging GDJS Runtime {source} -> {destination}...")
    shutil.copytree(source, destination)


def create_archive(build_dir: pathlib.Path, build_started_at: float) -> pathlib.Path:
    assert_build_dir(build_dir, build_started_at)
    archive_path = pathlib.Path(tempfile.gettempdir()) / (
        f"gdevelop-editor-{int(time.time())}.tar.gz"
    )
    print(f"Packaging {build_dir} into {archive_path}...")
    with tarfile.open(archive_path, "w:gz") as tar:
        for item in build_dir.rglob("*"):
            tar.add(item, arcname=item.relative_to(build_dir))
    return archive_path


def create_my_cloud_archive(server_dir: pathlib.Path) -> pathlib.Path:
    """Package the my-cloud-server source (excluding node_modules / data)."""
    if not (server_dir / "server.js").exists():
        raise SystemExit(
            f"My Cloud server source not found at {server_dir} "
            "(expected server.js). Use --no-my-cloud to skip, or fix --my-cloud-server-dir."
        )
    archive_path = pathlib.Path(tempfile.gettempdir()) / (
        f"my-cloud-server-{int(time.time())}.tar.gz"
    )
    excluded_top = {"node_modules", "data", "test"}
    print(f"Packaging My Cloud server from {server_dir}...")
    with tarfile.open(archive_path, "w:gz") as tar:
        for item in sorted(server_dir.rglob("*")):
            rel = item.relative_to(server_dir)
            if rel.parts and rel.parts[0] in excluded_top:
                continue
            tar.add(item, arcname=rel)
    return archive_path


def build_mcp_bundle(server_dir: pathlib.Path) -> bool:
    """Build the headless MCP tool bundle (reuses the real editor MCP stack).

    Returns True on success. The bundle + libGD are produced into
    my-cloud-server/mcp-build and shipped with the server archive.
    """
    script = server_dir / "mcp-build" / "build-mcp-bundle.js"
    if not script.exists():
        print(f"⚠️ MCP bundle script not found at {script}; skipping MCP host.")
        return False
    print("Building headless MCP tool bundle...")
    result = subprocess.run(["node", str(script)])
    if result.returncode != 0:
        print("⚠️ MCP bundle build failed; deploying without the MCP host.")
        return False
    return True


def deploy_my_cloud_server(client, args: argparse.Namespace) -> None:
    """Upload, install, and (re)start the My Cloud Node server via systemd."""
    server_dir = pathlib.Path(args.my_cloud_server_dir).resolve()

    # Build the MCP bundle before packaging so mcp-build/ ships in the archive.
    mcp_ready = False
    if args.mcp_host:
        mcp_ready = build_mcp_bundle(server_dir)

    archive_path = create_my_cloud_archive(server_dir)

    remote_app_dir = "/opt/gdevelop-my-cloud"
    remote_data_dir = "/var/lib/gdevelop-my-cloud"
    remote_archive = posixpath.join("/tmp", archive_path.name)

    try:
        with client.open_sftp() as sftp:
            sftp_mkdir_p(sftp, remote_app_dir)
            sftp.put(str(archive_path), remote_archive, confirm=False)
    finally:
        try:
            archive_path.unlink()
        except OSError:
            pass

    token = args.my_cloud_token or ""
    token_env_line = (
        f'Environment=MY_CLOUD_TOKEN={remote_quote(token)}' if token else ""
    )
    # By default, do NOT hard-code a base URL: the server derives absolute
    # resource/share URLs from the incoming request (Host + X-Forwarded-Proto +
    # X-Forwarded-Prefix, which nginx sets on the /my-cloud location). This keeps
    # links working whether the site is reached by IP or domain, http or https.
    # Only pin MY_CLOUD_BASE_URL when the user explicitly passes --public-origin.
    base_url_env_line = (
        f'Environment=MY_CLOUD_BASE_URL={args.public_origin.rstrip("/")}{args.my_cloud_path}'
        if args.public_origin
        else ""
    )

    # Headless MCP host (reuses the real editor MCP tools via libGD in Node).
    # Enabled with --mcp-host; operates on --mcp-project, shares the My Cloud token.
    # Reachable at <domain>/my-cloud/mcp (nginx already proxies /my-cloud -> server).
    mcp_env_lines = ""
    if args.mcp_host and mcp_ready:
        mcp_env_lines = "Environment=MY_CLOUD_MCP=on\n"
        if args.mcp_project:
            mcp_env_lines += (
                f"Environment=MY_CLOUD_MCP_PROJECT={remote_quote(args.mcp_project)}\n"
            )

    service = f"""[Unit]
Description=GDevelop My Cloud project server
After=network.target

[Service]
Type=simple
Environment=PORT={args.my_cloud_port}
Environment=HOST=127.0.0.1
Environment=MY_CLOUD_DATA_DIR={remote_data_dir}
{base_url_env_line}
{token_env_line}
{mcp_env_lines}WorkingDirectory={remote_app_dir}
ExecStart=/usr/bin/env node {remote_app_dir}/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
"""

    command = f"""
set -euo pipefail
if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js (required by My Cloud server)..."
  if command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  elif command -v dnf >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y nodejs
  elif command -v yum >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    yum install -y nodejs
  else
    echo "Node.js is not installed and no supported package manager was found." >&2
    exit 1
  fi
fi

mkdir -p {remote_quote(remote_app_dir)} {remote_quote(remote_data_dir)}
tar -xzf {remote_quote(remote_archive)} -C {remote_quote(remote_app_dir)}
rm -f {remote_quote(remote_archive)}

cd {remote_quote(remote_app_dir)}
npm install --omit=dev --no-audit --no-fund

cat > /etc/systemd/system/gdevelop-my-cloud.service <<'MY_CLOUD_SERVICE'
{service}
MY_CLOUD_SERVICE

if command -v systemctl >/dev/null 2>&1; then
  systemctl daemon-reload
  systemctl enable --now gdevelop-my-cloud
  systemctl restart gdevelop-my-cloud
  sleep 1
  systemctl --no-pager --full status gdevelop-my-cloud | head -n 5 || true
else
  echo "systemd not available; start the server manually with: node {remote_app_dir}/server.js" >&2
fi
"""
    run_remote(client, command, label="Deploying My Cloud server...")


def connect(args: argparse.Namespace):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {args.user}@{args.host}:{args.port}...")
    client.connect(
        args.host,
        port=args.port,
        username=args.user,
        password=args.password,
        look_for_keys=False,
        allow_agent=False,
        timeout=30,
        banner_timeout=30,
        auth_timeout=30,
    )
    return client


def remote_quote(value: str) -> str:
    return shlex.quote(value)


def run_remote(client, command: str, *, label: Optional[str] = None) -> None:
    if label:
        print(label)

    wrapped = f"bash -lc {remote_quote(command)}"
    transport = client.get_transport()
    if transport is None:
        raise RuntimeError("SSH transport is not connected.")

    channel = transport.open_session()
    channel.exec_command(wrapped)
    stdout = bytearray()
    stderr = bytearray()

    while True:
        if channel.recv_ready():
            chunk = channel.recv(4096)
            stdout.extend(chunk)
            sys.stdout.write(chunk.decode("utf-8", errors="replace"))
            sys.stdout.flush()
        if channel.recv_stderr_ready():
            chunk = channel.recv_stderr(4096)
            stderr.extend(chunk)
            sys.stderr.write(chunk.decode("utf-8", errors="replace"))
            sys.stderr.flush()
        if channel.exit_status_ready():
            while channel.recv_ready():
                chunk = channel.recv(4096)
                stdout.extend(chunk)
                sys.stdout.write(chunk.decode("utf-8", errors="replace"))
                sys.stdout.flush()
            while channel.recv_stderr_ready():
                chunk = channel.recv_stderr(4096)
                stderr.extend(chunk)
                sys.stderr.write(chunk.decode("utf-8", errors="replace"))
                sys.stderr.flush()
            break
        time.sleep(0.1)

    exit_code = channel.recv_exit_status()
    if exit_code != 0:
        raise SystemExit(f"Remote command failed with exit code {exit_code}.")


def sftp_mkdir_p(sftp, path: str) -> None:
    parts = [part for part in path.split("/") if part]
    current = "/"
    for part in parts:
        current = posixpath.join(current, part)
        try:
            sftp.stat(current)
        except IOError:
            sftp.mkdir(current)


def remote_file_size(client, remote_path: str) -> Optional[int]:
    try:
        with client.open_sftp() as sftp:
            return sftp.stat(remote_path).st_size
    except Exception:
        return None


def upload_archive(client, args: argparse.Namespace, archive_path: pathlib.Path, remote_dir: str):
    remote_archive = posixpath.join(remote_dir, archive_path.name)
    local_size = archive_path.stat().st_size
    print(f"Uploading archive to {remote_archive}...")

    try:
        with client.open_sftp() as sftp:
            sftp_mkdir_p(sftp, remote_dir)
            sftp.put(str(archive_path), remote_archive, confirm=False)
    except Exception as error:
        print(f"Upload connection dropped; checking remote archive size ({error})...")
        try:
            client.close()
        except Exception:
            pass
        client = connect(args)

        remote_size = remote_file_size(client, remote_archive)
        if remote_size == local_size:
            print("Remote archive is complete; continuing deployment.")
            return client, remote_archive

        print("Remote archive was incomplete; retrying upload once.")
        with client.open_sftp() as sftp:
            sftp_mkdir_p(sftp, remote_dir)
            try:
                sftp.remove(remote_archive)
            except IOError:
                pass
            sftp.put(str(archive_path), remote_archive, confirm=False)

    remote_size = remote_file_size(client, remote_archive)
    if remote_size != local_size:
        raise SystemExit(
            f"Remote archive size mismatch after upload: expected {local_size}, got {remote_size}."
        )
    return client, remote_archive


def infer_public_origin(args: argparse.Namespace) -> str:
    if args.public_origin:
        return args.public_origin.rstrip("/")

    if args.server_name:
        for name in args.server_name.split():
            if name != "_" and not re.fullmatch(r"[0-9.]+", name):
                return f"https://{name}"

    port_suffix = "" if args.nginx_port == 80 else f":{args.nginx_port}"
    return f"http://{args.host}{port_suffix}"


def configured_public_domain(args: argparse.Namespace) -> Optional[str]:
    """Return the explicit public origin (scheme://host) if a real DOMAIN is
    known (from --public-origin or a non-IP --server-name), else None.

    Used to rewrite proxied GDevelop URLs to a fixed origin instead of nginx's
    $host. $host is unreliable behind Cloudflare (it can resolve to the origin
    IP, which has no public HTTPS listener -> ERR_CONNECTION_REFUSED). When a
    domain is configured we pin to it; otherwise we fall back to
    $public_scheme://$host.
    """
    if args.public_origin:
        return args.public_origin.rstrip("/")
    if args.server_name:
        for name in args.server_name.split():
            if name != "_" and not re.fullmatch(r"[0-9.]+", name):
                return f"https://{name}"
    return None


def sub_filter_origin(args: argparse.Namespace) -> str:
    """The origin prefix used in sub_filter rewrites for proxied GDevelop URLs."""
    domain = configured_public_domain(args)
    return domain if domain else "$public_scheme://$host"


def my_cloud_nginx_location(args: argparse.Namespace) -> str:
    """Nginx location block reverse-proxying /my-cloud to the local Node server.

    The trailing slash on proxy_pass strips the /my-cloud prefix before
    forwarding, so the Node server sees /api/..., /share/..., etc. The server
    rebuilds absolute resource/share URLs from the forwarded request headers
    (Host + X-Forwarded-Proto + X-Forwarded-Prefix), so links keep the
    /my-cloud prefix and match whatever origin the browser used (no hard-coded
    host).
    """
    if args.no_my_cloud:
        return ""
    path = args.my_cloud_path
    return f"""
    location ^~ {path}/ {{
        proxy_pass http://127.0.0.1:{args.my_cloud_port}/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Prefix {path};
        proxy_redirect off;
        client_max_body_size 0;
        proxy_request_buffering off;
        proxy_read_timeout 3600s;
    }}
"""


def nginx_config(args: argparse.Namespace, document_root: str) -> str:
    server_name = args.server_name or f"{args.host} _"
    my_cloud_location = my_cloud_nginx_location(args)
    origin = sub_filter_origin(args)
    return f"""# Resolve the REAL public scheme. Behind Cloudflare (or any TLS-terminating
# proxy), the origin connection is plain http, so $scheme would be "http" even
# though the browser used https — causing mixed-content blocks. Honor
# X-Forwarded-Proto when present, otherwise fall back to $scheme.
map $http_x_forwarded_proto $public_scheme {{
    default $scheme;
    https https;
    http http;
}}

server {{
    listen {args.nginx_port};
    listen [::]:{args.nginx_port};
    server_name {server_name};

    root {document_root};
    index index.html;
{my_cloud_location}

    # Self-hosted GDJS Runtime (game engine for previews/exports), staged into
    # build/gdjs-runtime by the deploy script. Served from disk and cached hard.
    # ^~ keeps it out of the SPA /index.html fallback.
    location ^~ /gdjs-runtime/ {{
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }}

    location ^~ /gdevelop-api/ {{
        proxy_pass https://api.gdevelop.io/;
        proxy_http_version 1.1;
        proxy_ssl_server_name on;
        proxy_set_header Host api.gdevelop.io;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Accept-Encoding "";
        proxy_buffering off;
        proxy_redirect off;
        sub_filter_once off;
        sub_filter_types application/json text/plain;
        # Rewrite GDevelop hostnames to proxy paths on this deployment's own
        # origin. These must stay ABSOLUTE (not bare relative paths): some of
        # these URLs are parsed with `new URL(...)` and concatenated by the app,
        # so a relative value breaks them (e.g. assets-database 403).
        # `origin` is a fixed https://<domain> when a domain is configured
        # (--server-name/--public-origin), which is required behind Cloudflare
        # (nginx $host can resolve to the origin IP, which has no public HTTPS
        # listener). Without a domain it falls back to $public_scheme://$host.
        sub_filter 'https://api.gdevelop.io' '{origin}/gdevelop-api';
        sub_filter 'wss://api-ws.gdevelop.io' '{origin}/gdevelop-api-ws';
        sub_filter 'https://resources.gdevelop-app.com' '{origin}/gdevelop-resources';
        sub_filter 'https://public-resources.gdevelop.io' '{origin}/gdevelop-public-resources';
        sub_filter 'https://project-resources.gdevelop.io' '{origin}/gdevelop-project-resources';
        sub_filter 'https://private-assets.gdevelop.io' '{origin}/gdevelop-private-assets';
        sub_filter 'https://private-game-templates.gdevelop.io' '{origin}/gdevelop-private-game-templates';
        sub_filter 'https://asset-resources.gdevelop.io' '{origin}/gdevelop-asset-resources';
    }}

    location ^~ /gdevelop-api-ws/ {{
        proxy_pass https://api-ws.gdevelop.io/;
        proxy_http_version 1.1;
        proxy_ssl_server_name on;
        proxy_set_header Host api-ws.gdevelop.io;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 3600s;
    }}

    location ^~ /gdevelop-resources/ {{
        proxy_pass https://resources.gdevelop-app.com/;
        proxy_ssl_server_name on;
        proxy_set_header Host resources.gdevelop-app.com;
        proxy_redirect off;
    }}

    location ^~ /gdevelop-public-resources/ {{
        proxy_pass https://public-resources.gdevelop.io/;
        proxy_ssl_server_name on;
        proxy_set_header Host public-resources.gdevelop.io;
        proxy_redirect off;
    }}

    location ^~ /gdevelop-project-resources/ {{
        proxy_pass https://project-resources.gdevelop.io/;
        proxy_ssl_server_name on;
        proxy_set_header Host project-resources.gdevelop.io;
        proxy_redirect off;
    }}

    location ^~ /gdevelop-private-assets/ {{
        proxy_pass https://private-assets.gdevelop.io/;
        proxy_ssl_server_name on;
        proxy_set_header Host private-assets.gdevelop.io;
        proxy_redirect off;
    }}

    location ^~ /gdevelop-private-game-templates/ {{
        proxy_pass https://private-game-templates.gdevelop.io/;
        proxy_ssl_server_name on;
        proxy_set_header Host private-game-templates.gdevelop.io;
        proxy_redirect off;
    }}

    location ^~ /gdevelop-asset-resources/ {{
        proxy_pass https://asset-resources.gdevelop.io/;
        proxy_ssl_server_name on;
        proxy_set_header Host asset-resources.gdevelop.io;
        proxy_redirect off;
    }}

    location = /service-worker.js {{
        add_header Cache-Control "no-cache";
        try_files $uri =404;
    }}

    location ~* \\.wasm$ {{
        default_type application/wasm;
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }}

    location ~* \\.(?:js|css|png|jpg|jpeg|gif|ico|svg|webp|map|json|woff|woff2)$ {{
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }}

    location / {{
        try_files $uri $uri/ /index.html;
    }}
}}
"""


def configure_nginx(client, args: argparse.Namespace, current_link: str) -> None:
    config = nginx_config(args, current_link)
    site_available = f"/etc/nginx/sites-available/{args.site_name}"
    site_enabled = f"/etc/nginx/sites-enabled/{args.site_name}"
    conf_d = f"/etc/nginx/conf.d/{args.site_name}.conf"

    command = f"""
set -euo pipefail
if ! command -v nginx >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update
    apt-get install -y nginx
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y nginx
  elif command -v yum >/dev/null 2>&1; then
    yum install -y nginx
  else
    echo "Nginx is not installed and no supported package manager was found." >&2
    exit 1
  fi
fi

if [ -d /etc/nginx/sites-available ] && [ -d /etc/nginx/sites-enabled ]; then
  cat > {remote_quote(site_available)} <<'NGINX_CONFIG'
{config}
NGINX_CONFIG
  ln -sfn {remote_quote(site_available)} {remote_quote(site_enabled)}
  rm -f /etc/nginx/sites-enabled/default
else
  mkdir -p /etc/nginx/conf.d
  cat > {remote_quote(conf_d)} <<'NGINX_CONFIG'
{config}
NGINX_CONFIG
fi

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow {args.nginx_port}/tcp
fi

if command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld; then
  firewall-cmd --permanent --add-port={args.nginx_port}/tcp
  firewall-cmd --reload
fi

nginx -t
if command -v systemctl >/dev/null 2>&1; then
  systemctl enable --now nginx
  systemctl reload nginx
else
  service nginx restart || nginx -s reload || nginx
fi
"""
    run_remote(client, command, label="Installing/configuring Nginx...")


def deploy_release(client, args: argparse.Namespace, remote_archive: str) -> str:
    release_id = time.strftime("%Y%m%d%H%M%S")
    releases_dir = posixpath.join(args.remote_path, "releases")
    release_dir = posixpath.join(releases_dir, release_id)
    current_link = posixpath.join(args.remote_path, "current")
    command = f"""
set -euo pipefail
mkdir -p {remote_quote(release_dir)}
tar -xzf {remote_quote(remote_archive)} -C {remote_quote(release_dir)}
ln -sfn {remote_quote(release_dir)} {remote_quote(current_link)}
chmod -R a+rX {remote_quote(args.remote_path)}
rm -f {remote_quote(remote_archive)}
if [ -d {remote_quote(releases_dir)} ]; then
  ls -1dt {remote_quote(releases_dir)}/* 2>/dev/null | tail -n +{args.keep_releases + 1} | xargs -r rm -rf --
fi
"""
    run_remote(client, command, label=f"Deploying release {release_id}...")
    return current_link


def main() -> None:
    require_paramiko()
    args = parse_args()
    validate_args(args)

    build_dir = pathlib.Path(args.build_dir).resolve()
    build_started_at = run_local_build(args)
    stage_gdjs_runtime(args, build_dir)
    archive_path = create_archive(build_dir, build_started_at)

    client = connect(args)
    try:
        client, remote_archive = upload_archive(client, args, archive_path, args.remote_path)
        current_link = deploy_release(client, args, remote_archive)
        if not args.no_my_cloud:
            deploy_my_cloud_server(client, args)
        if not args.no_nginx:
            configure_nginx(client, args, current_link)
    finally:
        client.close()
        try:
            archive_path.unlink()
        except OSError:
            pass

    protocol = "http"
    port_suffix = "" if args.nginx_port == 80 else f":{args.nginx_port}"
    print(f"Deployment complete: {protocol}://{args.host}{port_suffix}/")
    if not args.no_my_cloud:
        origin = infer_public_origin(args)
        print(
            f"My Cloud server deployed at {origin}{args.my_cloud_path} "
            f"(systemd service 'gdevelop-my-cloud')."
        )
        if args.my_cloud_token:
            print(
                "  In the editor: Preferences -> My Cloud server, set the access "
                f"token to your --my-cloud-token value to save/share projects."
            )
        else:
            print(
                "  WARNING: deployed WITHOUT an access token (open server). "
                "Re-run with --my-cloud-token <secret> for a private deployment."
            )


if __name__ == "__main__":
    main()
