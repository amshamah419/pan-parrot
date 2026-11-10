#!/usr/bin/env python3
"""Every vendor-doc preset must match its committed excerpt, after the listed scrubs."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRESETS = ROOT / "public" / "presets" / "integrations"
SOURCES = ROOT / "public" / "presets" / "sources"
INDEX = ROOT / "public" / "presets" / "index.json"
EMAIL_HOSTS = {"example.com", "example.invalid"}


def scrub(value, scrubs: list[dict]):
    if isinstance(value, str):
        for item in scrubs:
            value = value.replace(item["find"], item["replace"])
        return value
    if isinstance(value, list):
        return [scrub(item, scrubs) for item in value]
    if isinstance(value, dict):
        return {key: scrub(item, scrubs) for key, item in value.items()}
    return value


def match_operation(operations: list[dict], entry: dict):
    wanted = entry.get("operationId")
    if wanted:
        for operation in operations:
            if operation.get("id") == wanted:
                return operation
        return None
    matches = [
        operation
        for operation in operations
        if operation.get("method") == entry.get("method") and operation.get("pathTemplate") == entry.get("path")
    ]
    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        return "ambiguous"
    return None


def emails(value) -> list[str]:
    import re

    found = re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", json.dumps(value))
    return found


def load_json(path: Path):
    return json.loads(path.read_text())


def check() -> list[str]:
    errors: list[str] = []
    if not SOURCES.is_dir():
        return ["public/presets/sources is missing"]
    index = load_json(INDEX)
    index_rows = {row["id"]: row for row in index.get("presets", [])}
    source_ids = {path.stem for path in SOURCES.glob("*.json")}
    vendor_ids = set()
    for path in sorted(PRESETS.glob("*.json")):
        preset = load_json(path)
        if preset.get("fidelity") != "vendor":
            if path.stem in source_ids:
                errors.append(f"{path.stem}: provenance file exists but fidelity is not vendor")
            continue
        vendor_ids.add(path.stem)
        source_path = SOURCES / f"{path.stem}.json"
        if not source_path.is_file():
            errors.append(f"{path.stem}: missing provenance file")
            continue
        source = load_json(source_path)
        if source.get("id") != path.stem:
            errors.append(f"{path.stem}: provenance id is {source.get('id')}")
        if source.get("sourceType") not in {"vendor-example", "vendor-schema"}:
            errors.append(f"{path.stem}: sourceType must be vendor-example or vendor-schema")
        doc = str(source.get("docUrl") or "")
        if not doc.startswith("https://"):
            errors.append(f"{path.stem}: docUrl must be https")
        if not str(source.get("retrievedAt") or ""):
            errors.append(f"{path.stem}: retrievedAt is missing")
        if preset.get("spec", {}).get("source", {}).get("fidelity") != "vendor":
            errors.append(f"{path.stem}: spec.source.fidelity is not vendor")
        catalog = index_rows.get(path.stem)
        if not catalog or catalog.get("fidelity") != "vendor":
            errors.append(f"{path.stem}: index fidelity is not vendor")
        elif (catalog.get("verification") or {}).get("docUrl") != doc:
            errors.append(f"{path.stem}: index docUrl does not match the provenance file")
        operations = preset["spec"]["operations"]
        seen_ids = set()
        for entry in source.get("operations") or []:
            operation = match_operation(operations, entry)
            if operation == "ambiguous":
                errors.append(f"{path.stem}: {entry.get('method')} {entry.get('path')} matches more than one operation; set operationId")
                continue
            if operation is None:
                errors.append(f"{path.stem}: provenance path {entry.get('method')} {entry.get('path')} is not an operation")
                continue
            seen_ids.add(operation.get("id"))
            entry_type = entry.get("sourceType") or source.get("sourceType")
            if entry_type not in {"vendor-example", "vendor-schema"}:
                errors.append(f"{path.stem}: operation sourceType must be vendor-example or vendor-schema")
            scrubs = entry.get("scrubs") or []
            if not isinstance(scrubs, list):
                errors.append(f"{path.stem}: scrubs must be a list")
                continue
            excerpt = entry.get("excerpt")
            blob = json.dumps(excerpt)
            for item in scrubs:
                if not isinstance(item, dict) or "find" not in item or "replace" not in item:
                    errors.append(f"{path.stem}: scrub needs find and replace")
                    continue
                if item["find"] not in blob:
                    errors.append(f"{path.stem}: scrub {item['find']!r} is not in the excerpt")
            expected = scrub(excerpt, scrubs)
            raw = operation.get("fixture")
            label = f"{entry.get('method')} {entry.get('path')}"
            if not isinstance(raw, str) or not raw.strip():
                errors.append(f"{path.stem}: {label} has no fixture")
                continue
            if isinstance(excerpt, str):
                if raw.strip() != str(expected).strip():
                    errors.append(f"{path.stem}: fixture does not match the scrubbed excerpt for {label}")
                got = raw
            else:
                try:
                    got = json.loads(raw)
                except json.JSONDecodeError as exc:
                    errors.append(f"{path.stem}: fixture is not JSON ({exc})")
                    continue
                if got != expected:
                    errors.append(f"{path.stem}: fixture does not deep-equal the scrubbed excerpt for {label}")
            for address in emails(got):
                host = address.rsplit("@", 1)[-1].lower()
                if host not in EMAIL_HOSTS:
                    errors.append(f"{path.stem}: fixture still contains {address}")
        for operation in operations:
            if operation.get("fixture") and operation.get("id") not in seen_ids:
                errors.append(f"{path.stem}: {operation.get('id')} has a fixture without an excerpt")
    orphan = source_ids - vendor_ids
    for preset_id in sorted(orphan):
        errors.append(f"{preset_id}: provenance file has no vendor preset")
    return errors


def self_test() -> int:
    excerpt = {"user": "a@contoso.com", "note": "ok"}
    scrubs = [{"find": "a@contoso.com", "replace": "user@example.invalid"}]
    assert scrub(excerpt, scrubs) == {"user": "user@example.invalid", "note": "ok"}
    assert scrub([excerpt], scrubs)[0]["user"] == "user@example.invalid"
    return 0


def main() -> int:
    if "--self-test" in sys.argv:
        return self_test()
    errors = check()
    if errors:
        print("\n".join(errors))
        print(f"{len(errors)} provenance error(s)")
        return 1
    vendor = len(list(SOURCES.glob("*.json")))
    print(f"Vendor provenance matches {vendor} presets")
    return 0


if __name__ == "__main__":
    sys.exit(main())
