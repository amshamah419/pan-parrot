#!/usr/bin/env python3
"""Re-fetch a random sample of vendor doc URLs and check that excerpt keys are still on the page.

Not a CI gate. Docs sites block bots, so this is run on demand:

    python3 scripts/recheck_vendor_docs.py --sample 5 --seed 20261110
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "public" / "presets" / "sources"
GENERIC = {
    "id",
    "type",
    "name",
    "value",
    "status",
    "data",
    "message",
    "self",
    "url",
    "ok",
    "error",
    "code",
}


def collect_keys(value, depth: int = 0, found: list[str] | None = None) -> list[str]:
    if found is None:
        found = []
    if depth > 2:
        return found
    if isinstance(value, dict):
        for key, item in value.items():
            if isinstance(key, str):
                found.append(key)
            collect_keys(item, depth + 1, found)
    elif isinstance(value, list) and value:
        collect_keys(value[0], depth, found)
    return found


def distinctive_keys(excerpt) -> list[str]:
    keys = []
    for key in collect_keys(excerpt):
        if key.startswith("@") or len(key) < 4 or key in GENERIC:
            continue
        if key not in keys:
            keys.append(key)
    if len(keys) < 3:
        for key in collect_keys(excerpt):
            if key not in keys and len(key) >= 2:
                keys.append(key)
    return keys[:8]


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "pan-parrot-doc-recheck/1.0"})
    with urllib.request.urlopen(request, timeout=25) as response:
        return response.read().decode("utf-8", "replace")


def page_text(html: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html)
    return text.replace("&quot;", '"').replace("&#34;", '"').replace("&amp;", "&")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sample", type=int, default=5)
    parser.add_argument("--seed", type=int, default=20261110)
    args = parser.parse_args()
    files = sorted(SOURCES.glob("*.json"))
    if not files:
        print("No provenance files")
        return 1
    random.seed(args.seed)
    chosen = files if args.sample >= len(files) else random.sample(files, args.sample)
    misses = 0
    for path in chosen:
        source = json.loads(path.read_text())
        url = source["operations"][0].get("docUrl") or source["docUrl"]
        keys = distinctive_keys(source["operations"][0]["excerpt"])
        try:
            text = page_text(fetch(url))
        except Exception as exc:
            misses += 1
            print(f"MISS {path.stem} fetch failed: {exc}")
            continue
        missing = [key for key in keys if key not in text]
        if missing:
            misses += 1
            print(f"MISS {path.stem} missing {missing} on {url}")
        else:
            print(f"HIT  {path.stem} keys {keys}")
    print(f"{len(chosen) - misses}/{len(chosen)} pages still contain the excerpt keys")
    return 0


if __name__ == "__main__":
    sys.exit(main())
