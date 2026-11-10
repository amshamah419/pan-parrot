#!/usr/bin/env python3
"""Build XSIAM dataset samples from demisto/content modeling and parsing rules.

Field names come from the modeling-rule schema. Sample values come from an
integration test_data object when that object has the same key. Fields the
test data does not contain are omitted. Nothing here invents a field name.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/content")
OUT = ROOT / "public" / "xsiam" / "samples.json"
COMMIT = "ff4a8f7ee870499a73807b538cdbf42ee9f6c8f1"

# Most-used packs that ship ModelingRules in this content commit.
PACKS = [
    "Okta",
    "AWS-CloudTrail",
    "AWS-GuardDuty",
    "MicrosoftDefenderAdvancedThreatProtection",
    "MicrosoftGraphSecurity",
    "GitHub",
    "Zscaler",
    "Mimecast",
    "CiscoASA",
    "ServiceNow",
]

INGEST = re.compile(
    r'\[INGEST:\s*vendor="([^"]+)"\s*,\s*product="([^"]+)"\s*,\s*target_dataset="([^"]+)"',
    re.I,
)
DATASET = re.compile(r'dataset="?([A-Za-z0-9_]+)"?')


def git_show(path: str) -> str:
    return subprocess.check_output(["git", "-C", str(CONTENT), "show", f"HEAD:{path}"], text=True)


def git_list(path: str) -> list[str]:
    try:
        out = subprocess.check_output(
            ["git", "-C", str(CONTENT), "ls-tree", "-r", "--name-only", f"HEAD:{path}"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
    except subprocess.CalledProcessError:
        return []
    return [line for line in out.splitlines() if line]


def version_key(name: str) -> tuple[int, int]:
    match = re.search(r"_(\d+)_(\d+)$", name)
    if not match:
        return (0, 0)
    return (int(match.group(1)), int(match.group(2)))


def latest_rule_dir(pack: str) -> str | None:
    base = f"Packs/{pack}/ModelingRules"
    dirs = []
    try:
        out = subprocess.check_output(
            ["git", "-C", str(CONTENT), "ls-tree", "--name-only", f"HEAD:{base}"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
    except subprocess.CalledProcessError:
        return None
    for name in out.splitlines():
        if name:
            dirs.append(name)
    if not dirs:
        return None
    dirs.sort(key=version_key)
    return f"{base}/{dirs[-1]}"


def yml_value(text: str, key: str) -> str:
    match = re.search(rf"^{re.escape(key)}:\s*(.+)$", text, re.M)
    if not match:
        return ""
    return match.group(1).strip().strip("'\"")


def iter_dicts(node: object, limit: int = 40):
    seen = 0
    stack = [node]
    while stack and seen < limit:
        current = stack.pop(0)
        if isinstance(current, dict):
            seen += 1
            yield current
            stack.extend(current.values())
        elif isinstance(current, list):
            stack.extend(current[:15])


def clip(value: object) -> object:
    if isinstance(value, str):
        return value if len(value) <= 240 else value[:240] + "…"
    if isinstance(value, list):
        return [clip(item) for item in value[:8]]
    if isinstance(value, dict):
        out = {}
        for index, (key, item) in enumerate(value.items()):
            if index >= 20:
                break
            out[key] = clip(item)
        return out
    if isinstance(value, (int, float, bool)) or value is None:
        return value
    return str(value)[:240]


def load_test_records(pack: str) -> list[tuple[str, dict]]:
    records = []
    for rel in git_list(f"Packs/{pack}/Integrations"):
        if "/test_data/" not in rel or not rel.endswith(".json"):
            continue
        try:
            data = json.loads(git_show(f"Packs/{pack}/Integrations/{rel}"))
        except (subprocess.CalledProcessError, json.JSONDecodeError):
            continue
        path = f"Packs/{pack}/Integrations/{rel}"
        for record in iter_dicts(data):
            records.append((path, record))
    return records


def best_record(fields: list[str], records: list[tuple[str, dict]]) -> tuple[str, dict] | None:
    best: tuple[int, str, dict] | None = None
    names = set(fields)
    for path, record in records:
        score = len(names & set(record))
        if score == 0:
            continue
        if best is None or score > best[0]:
            best = (score, path, record)
    if not best:
        return None
    return best[1], best[2]


def parsing_map(pack: str) -> dict[str, dict[str, str]]:
    found: dict[str, dict[str, str]] = {}
    for rel in git_list(f"Packs/{pack}/ParsingRules"):
        if not rel.endswith(".xif"):
            continue
        text = git_show(f"Packs/{pack}/ParsingRules/{rel}")
        path = f"Packs/{pack}/ParsingRules/{rel}"
        for vendor, product, dataset in INGEST.findall(text):
            found[dataset] = {"vendor": vendor, "product": product, "path": path}
    return found


def correlation_rules(pack: str) -> list[dict]:
    rules = []
    for rel in git_list(f"Packs/{pack}/CorrelationRules"):
        if not rel.endswith(".yml"):
            continue
        text = git_show(f"Packs/{pack}/CorrelationRules/{rel}")
        query = ""
        match = re.search(r'^xql_query:\s*"(.*)"\s*$', text, re.M | re.S)
        if match:
            query = bytes(match.group(1), "utf-8").decode("unicode_escape")
        rules.append(
            {
                "pack": pack,
                "name": yml_value(text, "name"),
                "dataset": yml_value(text, "dataset"),
                "alertName": yml_value(text, "alert_name"),
                "severity": yml_value(text, "severity"),
                "xqlQuery": query[:4000],
                "sourcePath": f"Packs/{pack}/CorrelationRules/{rel}",
            }
        )
    return rules


def build() -> dict:
    datasets = []
    correlations = []
    for pack in PACKS:
        rule_dir = latest_rule_dir(pack)
        if not rule_dir:
            continue
        files = subprocess.check_output(
            ["git", "-C", str(CONTENT), "ls-tree", "--name-only", f"HEAD:{rule_dir}"],
            text=True,
        ).splitlines()
        schema_name = next((name for name in files if name.endswith("_schema.json")), "")
        yml_name = next((name for name in files if name.endswith(".yml")), "")
        xif_name = next((name for name in files if name.endswith(".xif")), "")
        if not schema_name:
            continue
        schema = json.loads(git_show(f"{rule_dir}/{schema_name}"))
        yml = git_show(f"{rule_dir}/{yml_name}") if yml_name else ""
        xif = git_show(f"{rule_dir}/{xif_name}") if xif_name else ""
        declared = set(DATASET.findall(xif))
        routes = parsing_map(pack)
        records = load_test_records(pack)
        correlations.extend(correlation_rules(pack))
        for dataset, fields in schema.items():
            if not isinstance(fields, dict):
                continue
            names = [name for name in fields if isinstance(fields[name], dict)]
            chosen = best_record(names, records)
            sample = {}
            present = []
            missing = []
            source = ""
            if chosen:
                source, record = chosen
                for name in names:
                    if name in record:
                        sample[name] = clip(record[name])
                        present.append(name)
                    else:
                        missing.append(name)
            else:
                missing = names
            route = routes.get(dataset, {})
            datasets.append(
                {
                    "id": f"{pack}-{dataset}",
                    "pack": pack,
                    "dataset": dataset,
                    "declaredInXif": (not declared) or dataset in declared,
                    "modelingRule": yml_value(yml, "name"),
                    "modelingRuleId": yml_value(yml, "id"),
                    "fromVersion": yml_value(yml, "fromversion"),
                    "schemaPath": f"{rule_dir}/{schema_name}",
                    "xifPath": f"{rule_dir}/{xif_name}" if xif_name else "",
                    "parsingPath": route.get("path", ""),
                    "vendor": route.get("vendor", ""),
                    "product": route.get("product", ""),
                    "fields": [
                        {
                            "name": name,
                            "type": str(fields[name].get("type", "")),
                            "isArray": bool(fields[name].get("is_array", False)),
                        }
                        for name in names
                    ],
                    "sample": sample,
                    "sampleSource": source,
                    "fieldsFromTestData": present,
                    "fieldsAbsentFromTestData": missing,
                }
            )
    return {
        "contentCommit": COMMIT,
        "contentRepo": "https://github.com/demisto/content",
        "note": "Field names are the modeling-rule schema. Sample values are copied from integration test_data when the key exists. Absent fields are listed and omitted.",
        "datasets": datasets,
        "correlations": correlations,
    }


def main() -> int:
    payload = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2) + "\n")
    covered = sum(1 for item in payload["datasets"] if item["fieldsFromTestData"])
    print(
        f"datasets {len(payload['datasets'])} with test data {covered} correlations {len(payload['correlations'])}"
    )
    for item in payload["datasets"]:
        print(
            f"  {item['pack']} {item['dataset']} fields {len(item['fields'])} "
            f"from test {len(item['fieldsFromTestData'])} missing {len(item['fieldsAbsentFromTestData'])}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
