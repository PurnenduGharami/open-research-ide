#!/usr/bin/env python3
"""Delegate environment checks to the integrator-owned Node preflight script."""

import argparse
import subprocess
import sys
from pathlib import Path


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="Run scripts/preflight.mjs and return its output and exit status unchanged.")
    result.add_argument("project_root", nargs="?", help="repository root (default: the repository containing this script)")
    result.add_argument("--node", default="node", help="Node.js executable (default: node)")
    result.add_argument("--timeout", type=float, default=180.0, metavar="SECONDS", help="preflight subprocess timeout (default: 180)")
    return result


def main() -> int:
    args = parser().parse_args()
    if args.timeout <= 0:
        print("Preflight failed: --timeout must be greater than zero.", file=sys.stderr)
        return 2
    repository_root = Path(__file__).resolve().parent.parent
    root = Path(args.project_root).expanduser().resolve() if args.project_root else repository_root
    preflight = root / "scripts" / "preflight.mjs"
    if not preflight.is_file():
        print(f"Preflight unavailable: expected the integrator-owned script at {preflight}. Add scripts/preflight.mjs before retrying; no substitute checks were run.", file=sys.stderr)
        return 2
    try:
        completed = subprocess.run([args.node, str(preflight)], cwd=root, timeout=args.timeout, check=False)
    except FileNotFoundError:
        print(f"Preflight failed: Node.js executable not found: {args.node}.", file=sys.stderr)
        return 2
    except subprocess.TimeoutExpired:
        print(f"Preflight failed: checks exceeded {args.timeout:g} seconds.", file=sys.stderr)
        return 2
    except OSError as error:
        print(f"Preflight failed: could not start Node.js: {error}.", file=sys.stderr)
        return 2
    return completed.returncode if completed.returncode >= 0 else 2


if __name__ == "__main__":
    sys.exit(main())
