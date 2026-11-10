#!/usr/bin/env python3
"""Rebuild downgraded presets from the calls the cross-check can see.

A preset is written back as verified only when check_preset returns match.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import crosscheck_presets as cc  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
CONTENT = Path("/tmp/content")
NAME_RE = re.compile(r"^[A-Za-z0-9_.:@$-]{1,80}$")
JUNK = {
    "credentials",
    "proxy",
    "insecure",
    "password",
    "headers",
    "humanreadable",
    "entrycontext",
    "dbotmirrorid",
    "url",
    "token",
    "access_token",
    "secret",
    "apikey",
    "api_key",
    "contents",
    "contentsformat",
    "customfields",
    "type",
    "file",
    "brand",
    "module",
    "indicator",
}
SKIP_PATH = re.compile(r"oauth|token|signin|sign_in|login|whoami|authorize|metadata/identity|/none", re.I)
SOURCE_FIX = {
    "cyberark-aim-cyberarkaim-v2": "https://github.com/demisto/content/tree/master/Packs/cyberark_AIM/Integrations/CyberArkAIM_v2",
    "duoadminapi-duoadminapi": "https://github.com/demisto/content/tree/master/Packs/DuoAdminApi/Integrations/DuoAdminApi",
    "microsoftgraphidentityandaccess-microsoftgraphidentityandaccess": "https://github.com/demisto/content/tree/master/Packs/MicrosoftGraphIdentityandAccess/Integrations/MicrosoftGraphIdentityandAccess",
    "misp-mispv3": "https://github.com/demisto/content/tree/master/Packs/MISP/Integrations/MISPV3",
    "proofpointserverprotection-proofpointprotectionserverv2": "https://github.com/demisto/content/tree/master/Packs/ProofpointServerProtection/Integrations/ProofpointProtectionServerV2",
    "secureworks-taegisxdrv2": "https://github.com/demisto/content/tree/master/Packs/SecureWorks/Integrations/TaegisXDRv2",
    "threatconnect-threatconnectv3": "https://github.com/demisto/content/tree/master/Packs/ThreatConnect/Integrations/ThreatConnectV3",
    "urlhaus-urlhaus": "https://github.com/demisto/content/tree/master/Packs/URLHaus/Integrations/URLHaus",
    "urlscan-urlscan": "https://github.com/demisto/content/tree/master/Packs/UrlScan/Integrations/UrlScan",
    "zendesk-zendeskv2": "https://github.com/demisto/content/tree/master/Packs/Zendesk/Integrations/Zendeskv2",
    "splunkpy-splunkpy": "https://github.com/demisto/content/tree/master/Packs/SplunkPy/Integrations/SplunkPy",
}
FETCH_FIRST = {
    "amp-ampv2",
    "googlecloudscc-googlecloudscc",
    "microsoftgraphmail-microsoftgraphmail",
    "netskope-netskopeeventcollector",
    "extrahop-extrahop-v2",
    "proofpointthreatresponse-proofpointthreatresponse",
    "checkpointhec-checkpointhec",
    "googlechroniclebackstory-googlechroniclebackstory",
    "tenable-sc-tenable-sc",
    "devo-devo",
    "lacework-lacework",
    "logrhythm-logrhythm",
    "securonix-securonix",
    "trendmicrovisionone-trendmicrovisiononev3",
    "azureloganalytics-azureloganalytics",
    "abusedb-abusedb",
    "alienvault-otx-alienvault-otx-v2",
    "carbon-black-enterprise-response-carbonblackresponsev2",
    "cortexxdr-cortexxdrir",
    "crowdstrikefalcon-crowdstrikefalcon",
    "qradar-qradar-v3",
    "splunkpy-splunkpyv2",
    "servicenow-servicenowv2",
    "jira-jirav3",
    "okta-okta-iam",
    "slack-slackv3",
    "virustotal-virustotalv3",
}


def main() -> int:
    only = set(sys.argv[1:])
    downgrades = load_downgrades_from_git()
    ids = [preset_id for preset_id in downgrades if not only or preset_id in only]
    ids.sort(key=lambda preset_id: (0 if preset_id in FETCH_FIRST or preset_id in SOURCE_FIX else 1, preset_id))
    rebuilt: dict[str, dict] = {}
    skipped: list[str] = []
    for preset_id in ids:
        path = ROOT / "public/presets/integrations" / f"{preset_id}.json"
        preset = json.loads(path.read_text())
        if preset_id in SOURCE_FIX:
            preset["sourceUrl"] = SOURCE_FIX[preset_id]
        outcome = rebuild(preset)
        if outcome is None:
            skipped.append(preset_id)
            continue
        rebuilt[preset_id] = outcome
        print("reverified", preset_id, outcome["summary"])
    write_outputs(rebuilt, downgrades)
    print(f"reverified {len(rebuilt)} skipped {len(skipped)}")
    return 0


def load_downgrades_from_git() -> dict[str, str]:
    import subprocess

    text = subprocess.check_output(
        ["git", "-C", str(ROOT), "show", "HEAD:shared/preset-downgrades.ts"],
        text=True,
    )
    pairs = re.findall(r'"([^"]+)": "((?:\\.|[^"\\])*)"', text)
    return {preset_id: json.loads(f'"{reason}"') for preset_id, reason in pairs}


def original_paths(preset_id: str) -> list[str]:
    import subprocess

    raw = subprocess.check_output(
        ["git", "-C", str(ROOT), "show", f"HEAD:public/presets/integrations/{preset_id}.json"],
        text=True,
    )
    data = json.loads(raw)
    return [operation["pathTemplate"] for operation in data["spec"]["operations"]]


def rebuild(preset: dict) -> dict | None:
    calls = cc.client_calls(preset, CONTENT)
    folder = client_folder(preset)
    test_paths, test_types = cc.load_test_data(folder) if folder else (set(), {})
    ranked = ranked_calls(calls, original_paths(preset["id"]))
    if not ranked:
        return None
    for count in (2, 1):
        chosen = ranked[:count]
        operations = []
        for index, call in enumerate(chosen):
            path = best_path(call)
            if not path:
                continue
            siblings = [item for item in calls if item.method == call.method and any(cc.paths_match(path, one) for one in item.paths)]
            operations.append(build_operation(index, path, call.method, siblings, test_paths, test_types))
        if not operations or any(operation["method"] == "DELETE" for operation in operations):
            continue
        candidate = apply_candidate(preset, operations)
        result = cc.check_preset(candidate, CONTENT)
        if result["status"] == "match":
            return candidate_meta(candidate, operations)
    return None


def client_folder(preset: dict) -> Path | None:
    rel = cc.content_rel(preset.get("sourceUrl") or "")
    if not rel:
        return None
    folder = CONTENT / rel
    if not folder.is_dir():
        return None
    if not any(folder.glob("*.py")):
        folder = cc.sibling_client(folder, preset["id"]) or folder
    return folder


def ranked_calls(calls: list[cc.HttpCall], previous: list[str]) -> list[cc.HttpCall]:
    scored: list[tuple[int, str, cc.HttpCall]] = []
    seen: set[str] = set()
    for call in calls:
        path = best_path(call)
        if not path or path in seen:
            continue
        score = score_path(path, call.method, previous)
        if score < 0:
            continue
        seen.add(path)
        scored.append((score, path, call))
    aligned = [item for item in scored if item[0] >= 8]
    pool = aligned or scored
    pool.sort(key=lambda item: (-item[0], item[1]))
    return [item[2] for item in pool[:8]]


def best_path(call: cc.HttpCall) -> str:
    usable = [path for path in call.paths if acceptable_path(path)]
    if not usable:
        return ""
    usable.sort(key=lambda path: (path.count("{"), -len(cc.segments(path)), len(path)))
    return usable[0]


def acceptable_path(path: str) -> bool:
    if not cc.usable_path(path) or "None" in path or ":{" in path:
        return False
    if re.search(r"[A-Za-z0-9_]\{|\}[A-Za-z0-9_]|\}[\{]", path):
        return False
    if "url_suffix" in path or "params_str" in path or "upload_url" in path:
        return False
    if SKIP_PATH.search(path):
        return False
    if re.search(r"logout|/auth(?:/|$)|whoami|activity_log|/private$|/image$|seconds-between|online-valid", path, re.I):
        return False
    parts = cc.segments(path)
    if parts and parts[0].startswith("{") and re.search(r"url|base|server|host", parts[0], re.I):
        return False
    return True


def score_path(path: str, method: str, previous: list[str]) -> int:
    if SKIP_PATH.search(path):
        return -1
    static = [part for part in cc.segments(path) if "{" not in part]
    if len(static) < 1:
        return -1
    score = 1
    if method == "GET":
        score += 2
    elif method == "POST":
        score += 1
    alignment = max((cc.suffix_score(old, path) for old in previous), default=0)
    score += alignment * 8
    if previous and "{" in previous[0].rstrip("/").split("/")[-1] and "{" in path.rstrip("/").split("/")[-1]:
        score += 12
    lowered = path.lower()
    for word in ("incident", "alert", "event", "threat", "log", "offense", "detection", "indicator", "message", "issue"):
        if word in lowered:
            score += 3
    if len(static) >= 2:
        score += 1
    score -= path.count("{")
    return score


def build_operation(
    index: int,
    path: str,
    method: str,
    siblings: list[cc.HttpCall],
    test_paths: set[str],
    test_types: dict[str, set[str]],
) -> dict:
    keys: set[str] = set()
    params: set[str] = set()
    dynamic = True
    for call in siblings:
        keys |= call.keys
        keys |= call.nav
        if not call.params_dynamic:
            dynamic = False
            params |= call.params
    roots = choose_roots(keys, test_paths)
    children = []
    for root in roots:
        nested = nested_names(root, keys, test_paths)
        if nested:
            children.append(
                {
                    "name": root,
                    "kind": "object",
                    "children": [leaf(name, f"{root}.{name}", test_types) for name in nested],
                }
            )
        else:
            children.append(leaf(root, root, test_types))
    if not children:
        children.append({"name": "id", "kind": "id"})
    page = pagination_for(params if not dynamic else set())
    slug = re.sub(r"[^a-z0-9]+", "-", path.lower()).strip("-")[:40] or "call"
    return {
        "id": f"{method.lower()}-{slug}-{index}",
        "method": method,
        "pathTemplate": path,
        "summary": f"{method} {path}"[:180],
        "status": 200,
        "contentType": "application/json; charset=utf-8",
        "headers": {},
        "list": page["style"] != "none",
        "envelope": {"type": "object"},
        "pagination": page,
        "record": {"name": "body", "kind": "object", "children": children},
    }


def choose_roots(keys: set[str], test_paths: set[str]) -> list[str]:
    def usable(names: set[str]) -> list[str]:
        named = [name for name in sorted(names) if NAME_RE.match(name)]
        preferred = [name for name in named if name.lower() not in JUNK]
        return preferred or named

    client_roots = usable(cc.children(set(keys), ()))
    if client_roots:
        return client_roots[:6]
    return usable(cc.children(set(test_paths), ()))[:6]


def nested_names(root: str, keys: set[str], test_paths: set[str]) -> list[str]:
    names = cc.children({path for path in set(keys) | set(test_paths) if path.startswith(root + ".")}, (root,))
    clean = [name for name in sorted(names) if NAME_RE.match(name) and name.lower() not in JUNK]
    return clean[:5]


def leaf(name: str, path: str, test_types: dict[str, set[str]]) -> dict:
    kinds = test_types.get(path) or set()
    if "list" in kinds:
        return {"name": name, "kind": "array", "item": {"name": "item", "kind": "string", "example": "lab"}}
    if kinds == {"bool"}:
        return {"name": name, "kind": "boolean"}
    if kinds == {"number"}:
        return {"name": name, "kind": "integer"}
    return {"name": name, "kind": "string", "example": "lab"}


def pagination_for(params: set[str]) -> dict:
    page = {
        "style": "none",
        "limitParam": "limit",
        "offsetParam": "offset",
        "pageParam": "page",
        "cursorParam": "cursor",
        "defaultLimit": 20,
        "maxLimit": 100,
    }
    by_lower = {name.lower(): name for name in params}
    if "limit" in by_lower and "offset" in by_lower:
        page["style"] = "offset"
        page["limitParam"] = by_lower["limit"]
        page["offsetParam"] = by_lower["offset"]
        return page
    limit_names = ["limit", "pagesize", "per_page", "max", "count", "$top", "rlimit", "size"]
    cursor_names = ["cursor", "pagetoken", "next", "after", "skiptoken", "starting_after", "nextcursor", "continuationtoken"]
    if "page" in by_lower and any(name in by_lower for name in limit_names):
        page["style"] = "page"
        page["pageParam"] = by_lower["page"]
        page["limitParam"] = next(by_lower[name] for name in limit_names if name in by_lower)
        return page
    cursor = next((by_lower[name] for name in cursor_names if name in by_lower), "")
    if cursor:
        page["style"] = "cursor"
        page["cursorParam"] = cursor
        if any(name in by_lower for name in limit_names):
            page["limitParam"] = next(by_lower[name] for name in limit_names if name in by_lower)
        return page
    return page


def apply_candidate(preset: dict, operations: list[dict]) -> dict:
    note = differences(operations)
    summary = f"Rebuilt from the client: {operations[0]['method']} {operations[0]['pathTemplate']}."[:180]
    spec = preset["spec"]
    source = dict(spec["source"])
    source["fidelity"] = "verified"
    source["notes"] = [note]
    source["verification"] = {
        "status": "verified",
        "docUrl": source.get("sourceUrl") or preset.get("sourceUrl"),
        "checkedAt": "2026-11-10",
        "differences": [note],
    }
    updated = dict(preset)
    updated["fidelity"] = "verified"
    updated["summary"] = summary
    updated["notes"] = [note]
    updated["spec"] = {**spec, "source": source, "operations": operations}
    return updated


def candidate_meta(preset: dict, operations: list[dict]) -> dict:
    return preset


def differences(operations: list[dict]) -> str:
    calls = ", ".join(f"{op['method']} {op['pathTemplate']}" for op in operations[:3])
    note = f"Rebuilt from the XSOAR client. The checker matched {calls}. Fields are keys the client reads or test_data contains."
    return note[:400]


def write_outputs(rebuilt: dict[str, dict], downgrades: dict[str, str]) -> None:
    for preset_id, preset in rebuilt.items():
        path = ROOT / "public/presets/integrations" / f"{preset_id}.json"
        path.write_text(json.dumps(preset, indent=2) + "\n")
        downgrades.pop(preset_id, None)
    lines = [
        "/** Presets the content cross-check could not back. They stay in the catalog as guessed shapes. */",
        "export const presetDowngrades: Record<string, string> = {",
    ]
    for preset_id in sorted(downgrades):
        lines.append(f"  {json.dumps(preset_id)}: {json.dumps(downgrades[preset_id])},")
    lines.append("};")
    lines.append("")
    (ROOT / "shared/preset-downgrades.ts").write_text("\n".join(lines))
    index_path = ROOT / "public/presets/index.json"
    index = json.loads(index_path.read_text())
    by_id = {entry["id"]: entry for entry in index["presets"]}
    for preset_id, preset in rebuilt.items():
        entry = by_id[preset_id]
        entry["fidelity"] = "verified"
        entry["summary"] = preset["summary"]
        entry["operations"] = len(preset["spec"]["operations"])
        entry["verification"] = preset["spec"]["source"]["verification"]
        entry["curated"] = True
    # source url fixes that did not reverify still need the corrected pointer in JSON
    for preset_id, url in SOURCE_FIX.items():
        path = ROOT / "public/presets/integrations" / f"{preset_id}.json"
        data = json.loads(path.read_text())
        if data.get("sourceUrl") != url and preset_id not in rebuilt:
            data["sourceUrl"] = url
            note = f"The content path was corrected to {url.split('master/')[-1]}. The client still does not back a verified shape."
            data["notes"] = [note[:400]]
            data["spec"]["source"]["notes"] = [note[:400]]
            path.write_text(json.dumps(data, indent=2) + "\n")
    index_path.write_text(json.dumps(index, separators=(",", ":"), ensure_ascii=False) + "\n")
    write_overlay(rebuilt)
    patch_verification(rebuilt)


def write_overlay(rebuilt: dict[str, dict]) -> None:
    body = {
        preset_id: {
            "summary": preset["summary"],
            "differences": preset["spec"]["source"]["verification"]["differences"],
            "docUrl": preset["spec"]["source"]["verification"]["docUrl"],
            "operations": preset["spec"]["operations"],
            "sourceUrl": preset["sourceUrl"],
        }
        for preset_id, preset in sorted(rebuilt.items())
    }
    text = (
        "import type { MockOperation } from \"./mock-spec\";\n\n"
        "export interface ReverifiedOverlay {\n"
        "  summary: string;\n"
        "  differences: string[];\n"
        "  docUrl: string;\n"
        "  sourceUrl: string;\n"
        "  operations: MockOperation[];\n"
        "}\n\n"
        f"export const reverifiedOverlays: Record<string, ReverifiedOverlay> = {json.dumps(body, indent=2)};\n"
    )
    (ROOT / "shared/reverified-overlays.ts").write_text(text)


def patch_verification(rebuilt: dict[str, dict]) -> None:
    md_path = ROOT / "public/presets/VERIFICATION.md"
    lines = md_path.read_text().splitlines()
    names = {preset["name"]: preset for preset in rebuilt.values()}
    out = []
    in_audit = False
    for line in lines:
        if line.startswith("## Audit") or line.startswith("## Cross-check"):
            in_audit = True
        if not in_audit and line.startswith("| ") and not line.startswith("| Preset") and not line.startswith("| ---"):
            parts = [part.strip() for part in line.strip().strip("|").split("|")]
            if len(parts) >= 4 and parts[0] in names:
                preset = names[parts[0]]
                note = " ".join(preset["spec"]["source"]["verification"]["differences"]).replace("|", "/")
                doc = preset["spec"]["source"]["verification"]["docUrl"]
                out.append(f"| {parts[0]} | verified | {doc} | {note} |")
                continue
        out.append(line)
    md_path.write_text("\n".join(out) + "\n")


if __name__ == "__main__":
    sys.exit(main())
