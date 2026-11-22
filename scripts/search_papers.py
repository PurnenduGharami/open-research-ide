#!/usr/bin/env python3
"""Search real literature through the repository's tested Node implementation."""

import argparse
import json
import subprocess
import sys
from pathlib import Path


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(
        description="Search OpenAlex and Semantic Scholar and print normalized papers and source provenance as JSON."
    )
    result.add_argument("query", help="non-empty literature search query")
    result.add_argument("--limit", type=int, choices=range(1, 21), default=8, metavar="N", help="maximum merged papers (1-20; default: 8)")
    result.add_argument("--node", default="node", help="Node.js executable (default: node)")
    result.add_argument("--timeout", type=float, default=60.0, metavar="SECONDS", help="subprocess timeout (default: 60)")
    return result


def main() -> int:
    args = parser().parse_args()
    query = args.query.strip()
    if not query:
        print("Search failed: query must not be empty.", file=sys.stderr)
        return 2
    if args.timeout <= 0:
        print("Search failed: --timeout must be greater than zero.", file=sys.stderr)
        return 2

    literature = Path(__file__).resolve().parent.parent / "plugins" / "research-engine" / "literature.mjs"
    if not literature.is_file():
        print(f"Search failed: literature implementation is missing at {literature}.", file=sys.stderr)
        return 2

    bridge = """
(async () => {
  const { searchLiterature } = await import(process.argv[1]);
  const result = await searchLiterature(process.argv[2], { limit: Number(process.argv[3]) });
  process.stdout.write(JSON.stringify(result));
})().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
"""
    command = [args.node, "-e", bridge, literature.as_uri(), query, str(args.limit)]
    try:
        completed = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=args.timeout, check=False)
    except FileNotFoundError:
        print(f"Search failed: Node.js executable not found: {args.node}.", file=sys.stderr)
        return 2
    except subprocess.TimeoutExpired:
        print(f"Search failed: literature bridge exceeded {args.timeout:g} seconds.", file=sys.stderr)
        return 2
    except OSError as error:
        print(f"Search failed: could not start Node.js: {error}.", file=sys.stderr)
        return 2

    if completed.returncode != 0:
        detail = (completed.stderr.strip() or completed.stdout.strip())[-2000:]
        print(f"Search failed: literature bridge exited {completed.returncode}.", file=sys.stderr)
        if detail:
            print(detail, file=sys.stderr)
        return completed.returncode if completed.returncode > 0 else 2

    try:
        result = json.loads(completed.stdout)
        if not isinstance(result, dict) or not isinstance(result.get("papers"), list) or not isinstance(result.get("sources"), list):
            raise ValueError("response did not contain papers and sources arrays")
    except (json.JSONDecodeError, ValueError) as error:
        print(f"Search failed: invalid literature bridge response: {error}.", file=sys.stderr)
        return 2

    print(json.dumps(result, indent=2, ensure_ascii=False))
    if not result["papers"] and result["sources"] and all(source.get("status") == "error" for source in result["sources"]):
        print("Search failed: every literature source returned an error; details are preserved in JSON sources.", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
