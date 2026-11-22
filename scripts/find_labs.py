#!/usr/bin/env python3
"""Derive uncontacted institution candidates from real OpenAlex authorships."""

import argparse
import hashlib
import json
import socket
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

USER_AGENT = "OpenResearchIDE/0.1 (local-first academic research)"


def normalize_doi(value: object) -> str:
    doi = str(value or "").strip()
    doi = urllib.parse.urlsplit(doi).path.lstrip("/") if doi.lower().startswith(("http://", "https://")) and "doi.org" in urllib.parse.urlsplit(doi).netloc.lower() else doi
    if doi.lower().startswith("doi:"):
        doi = doi[4:].strip()
    return doi


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(
        description="Fetch OpenAlex works for DOIs or canonical paper nodes and print institution candidates as JSON. No outreach is performed and pricing is unavailable unless present in a real source."
    )
    inputs = result.add_mutually_exclusive_group(required=True)
    inputs.add_argument("--project", type=Path, help="canonical research-project.json to read (never modified)")
    inputs.add_argument("--doi", action="append", help="paper DOI; repeat for multiple papers")
    result.add_argument("--limit", type=int, choices=range(1, 101), default=20, metavar="N", help="maximum institution candidates (1-100; default: 20)")
    result.add_argument("--timeout", type=float, default=15.0, metavar="SECONDS", help="timeout for each OpenAlex request (default: 15)")
    result.add_argument("--openalex-base-url", default="https://api.openalex.org", help="OpenAlex API base URL (default: https://api.openalex.org)")
    return result


def project_dois(path: Path) -> tuple[list[str], dict[str, list[str]]]:
    try:
        project = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise ValueError(f"canonical project not found: {path}") from error
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"could not read canonical project {path}: {error}") from error
    nodes = project.get("nodes") if isinstance(project, dict) else None
    if not isinstance(nodes, list):
        raise ValueError(f"canonical project {path} does not contain a nodes array")
    node_ids: dict[str, list[str]] = {}
    for node in nodes:
        if not isinstance(node, dict) or node.get("type") != "paper":
            continue
        data = node.get("data")
        doi = normalize_doi(data.get("doi")) if isinstance(data, dict) else ""
        if doi:
            node_ids.setdefault(doi.casefold(), []).append(str(node.get("id", "")))
    return list(node_ids), node_ids


def fetch_work(doi: str, base_url: str, timeout: float) -> tuple[dict, dict]:
    url = f"{base_url.rstrip('/')}/works/doi:{urllib.parse.quote(doi, safe='')}?select=id,doi,title,display_name,authorships"
    queried_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    source = {"id": f"openalex:{doi.casefold()}", "provider": "OpenAlex", "url": url, "status": "ok", "queriedAt": queried_at}
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            work = json.load(response)
        if not isinstance(work, dict):
            raise ValueError("OpenAlex returned a non-object work")
        return work, source
    except urllib.error.HTTPError as error:
        source.update(status="error", error=f"HTTP {error.code}")
    except (urllib.error.URLError, socket.timeout, TimeoutError, OSError, json.JSONDecodeError, ValueError) as error:
        source.update(status="error", error=str(error)[:300])
    return {}, source


def candidate_from_work(work: dict, requested_doi: str, node_ids: list[str], candidates: dict[str, dict]) -> None:
    work_id = str(work.get("id") or "")
    work_doi = normalize_doi(work.get("doi")) or requested_doi
    work_title = str(work.get("title") or work.get("display_name") or "")
    authorships = work.get("authorships")
    if not isinstance(authorships, list):
        return
    for authorship in authorships:
        if not isinstance(authorship, dict):
            continue
        author = authorship.get("author") if isinstance(authorship.get("author"), dict) else {}
        author_name = str(author.get("display_name") or "").strip()
        institutions = authorship.get("institutions")
        if not isinstance(institutions, list):
            continue
        for institution in institutions:
            if not isinstance(institution, dict):
                continue
            name = str(institution.get("display_name") or "").strip()
            if not name:
                continue
            institution_id = str(institution.get("id") or institution.get("ror") or "")
            identity = institution_id or f"name:{name.casefold()}"
            key = identity.casefold()
            if key not in candidates:
                digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:16]
                candidates[key] = {
                    "id": f"lab:openalex:{digest}",
                    "candidateType": "institution-affiliation",
                    "name": name,
                    "institution": name,
                    "url": institution.get("ror") or institution.get("id") or None,
                    "fit": "OpenAlex authorship affiliation; suitability for a specific experiment has not been assessed.",
                    "contacted": False,
                    "contactStatus": "uncontacted",
                    "price": {"kind": "unavailable", "note": "OpenAlex authorship metadata does not supply service pricing."},
                    "authors": [],
                    "paperDois": [],
                    "paperNodeIds": [],
                    "sourceRefs": [],
                    "provenance": [],
                }
            candidate = candidates[key]
            if author_name and author_name not in candidate["authors"]:
                candidate["authors"].append(author_name)
            if work_doi and work_doi not in candidate["paperDois"]:
                candidate["paperDois"].append(work_doi)
            for node_id in node_ids:
                if node_id and node_id not in candidate["paperNodeIds"]:
                    candidate["paperNodeIds"].append(node_id)
            if work_id and work_id not in candidate["sourceRefs"]:
                candidate["sourceRefs"].append(work_id)
            provenance = {
                "workId": work_id or None,
                "workDoi": work_doi,
                "workTitle": work_title or None,
                "author": author_name or None,
                "authorId": author.get("id") or None,
                "authorPosition": authorship.get("author_position") or None,
                "institutionId": institution.get("id") or None,
                "institutionRor": institution.get("ror") or None,
                "rawAffiliationStrings": authorship.get("raw_affiliation_strings") if isinstance(authorship.get("raw_affiliation_strings"), list) else [],
            }
            if provenance not in candidate["provenance"]:
                candidate["provenance"].append(provenance)


def main() -> int:
    args = parser().parse_args()
    if args.timeout <= 0:
        print("Lab discovery failed: --timeout must be greater than zero.", file=sys.stderr)
        return 2
    try:
        if args.project:
            dois, nodes_by_doi = project_dois(args.project)
        else:
            normalized = [normalize_doi(value) for value in args.doi]
            dois = list(dict.fromkeys(value.casefold() for value in normalized if value))
            nodes_by_doi = {doi: [] for doi in dois}
        if not dois:
            raise ValueError("no paper DOIs were supplied or found; provide --doi or a project containing paper nodes with DOIs")
    except ValueError as error:
        print(f"Lab discovery failed: {error}.", file=sys.stderr)
        return 2

    candidates: dict[str, dict] = {}
    sources = []
    works = []
    for lookup_doi in dois:
        work, source = fetch_work(lookup_doi, args.openalex_base_url, args.timeout)
        sources.append(source)
        if work:
            works.append({"id": work.get("id"), "doi": normalize_doi(work.get("doi")) or lookup_doi, "title": work.get("title") or work.get("display_name") or None})
            candidate_from_work(work, lookup_doi, nodes_by_doi.get(lookup_doi, []), candidates)

    ordered = sorted(candidates.values(), key=lambda candidate: (candidate["name"].casefold(), candidate["id"]))
    result = {
        "retrievedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "works": works,
        "labs": ordered[:args.limit],
        "totalCandidates": len(ordered),
        "sources": sources,
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))
    if not works and sources and all(source["status"] == "error" for source in sources):
        print("Lab discovery failed: every OpenAlex work request failed; details are preserved in JSON sources.", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
