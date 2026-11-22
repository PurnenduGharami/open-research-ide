#!/usr/bin/env python3
"""Run the existing Node export renderer and surface its file manifests as JSON."""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="Export canonical research state through scripts/export-project.mjs and print its manifest as JSON.")
    result.add_argument("project_root", nargs="?", default=".", help="project root containing workspace/research-project.json (default: current directory)")
    result.add_argument("--node", default="node", help="Node.js executable (default: node)")
    result.add_argument("--timeout", type=float, default=180.0, metavar="SECONDS", help="export subprocess timeout (default: 180)")
    return result


def parse_manifest(output: str) -> dict:
    revision = None
    files = []
    for raw_line in output.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        revision_match = re.fullmatch(r"revision\t(\d+)", line)
        file_match = re.fullmatch(r"(html|pdf|latex)\t(.+)\tsha256:([a-f0-9]{64})", line)
        if revision_match:
            revision = int(revision_match.group(1))
        elif file_match:
            files.append({"format": file_match.group(1), "path": file_match.group(2), "sha256": file_match.group(3)})
        else:
            raise ValueError(f"unrecognized exporter output line: {line[:200]}")
    if revision is None or not files:
        raise ValueError("exporter output did not contain a revision and file manifests")
    return {"revision": revision, "files": files}


def main() -> int:
    args = parser().parse_args()
    if args.timeout <= 0:
        print("Export failed: --timeout must be greater than zero.", file=sys.stderr)
        return 2
    exporter = Path(__file__).resolve().with_name("export-project.mjs")
    if not exporter.is_file():
        print(f"Export failed: existing renderer CLI is missing at {exporter}; no substitute renderer was used.", file=sys.stderr)
        return 2
    root = str(Path(args.project_root).expanduser().resolve())
    command = [args.node, str(exporter), root]
    try:
        completed = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=args.timeout, check=False)
    except FileNotFoundError:
        print(f"Export failed: Node.js executable not found: {args.node}.", file=sys.stderr)
        return 2
    except subprocess.TimeoutExpired:
        print(f"Export failed: renderer exceeded {args.timeout:g} seconds.", file=sys.stderr)
        return 2
    except OSError as error:
        print(f"Export failed: could not start Node.js: {error}.", file=sys.stderr)
        return 2
    if completed.returncode != 0:
        print(f"Export failed: renderer exited {completed.returncode}.", file=sys.stderr)
        detail = (completed.stderr.strip() or completed.stdout.strip())[-2000:]
        if detail:
            print(detail, file=sys.stderr)
        return completed.returncode if completed.returncode > 0 else 2
    try:
        manifest = parse_manifest(completed.stdout)
    except ValueError as error:
        print(f"Export failed: {error}.", file=sys.stderr)
        return 2
    manifest["projectRoot"] = root
    print(json.dumps(manifest, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
