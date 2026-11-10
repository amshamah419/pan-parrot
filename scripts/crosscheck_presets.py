#!/usr/bin/env python3
"""Cross-check verified presets against demisto/content clients.

For each verified preset the script parses the integration Python (and one
imported ApiModule). It depths up to three client-method hops, so a command that
calls ``generic_request`` still reaches the ``requests`` call inside the next
helper. Auth, login, and logout calls stay in the call list, and the data-call
picker skips them. ``_http_request`` joins with CommonServerPython.urljoin, which
keeps the base path and only strips one leading slash. A file that imports
``urljoin`` from ``urllib.parse`` uses the stdlib rule instead, and an absolute
suffix replaces the base path. That is the Proofpoint-style quirk: which
urljoin is in scope changes the path.

The report status for a preset is match, mismatch, or unparseable.

A top-level response key is in scope only when the matched call's own function
chain reads it, or when that command's test data contains it. Keys read only by
other commands are out of scope. A key the command iterates, or that test data
stores as a list, has to be an array.
"""

from __future__ import annotations

import ast
import json
import re
import sys
import urllib.parse
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAX_HOP = 3
VERBS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"}
SINK_ATTRS = {"_http_request", "generic_http_request", "http_request", "request"}
NAV_KEYS = {
    "next",
    "nextcursor",
    "next_cursor",
    "nextpagetoken",
    "nextlink",
    "cursor",
    "pagetoken",
    "snapshot",
    "continuationtoken",
    "nexttoken",
    "after",
    "offset",
}
PAGING_STYLES = {"offset", "cursor", "page", "link", "header"}
SKIP_FIELD_ENVELOPES = {"xml", "aws-query", "graphql", "soap", "splunk-export", "ndjson"}
STATE_OR_SECRET_ROOTS = {
    "authorization",
    "appauth",
    "boxappsettings",
    "clientid",
    "clientsecret",
    "jwt",
    "password",
    "apikey",
    "api_key",
    "last_fetch_time",
    "last_fetch_pid",
    "last_audit_time",
    "last_event_time",
    "access_token",
    "refresh_token",
    "id_token",
    "token_expiration",
}
READ_IGNORE = re.compile(
    r"arg|param|config|header|setting|secret|credential|proxy|token|demisto|kwargs|options",
    re.I,
)


@dataclass
class Val:
    text: str = ""
    path: str = ""
    dynamic: bool = False
    hole: str = ""
    items: dict[str, "Val"] | None = None
    dyn_keys: bool = False
    seq: list["Val"] | None = None
    alts: list["Val"] | None = None
    boto3: bool = False
    action: str = ""
    chain: tuple[str, ...] | None = None
    response: bool = False

    def copy(self) -> "Val":
        copied = Val(
            self.text,
            self.path,
            self.dynamic,
            self.hole,
            None if self.items is None else dict(self.items),
            self.dyn_keys,
            None if self.seq is None else list(self.seq),
            None if self.alts is None else list(self.alts),
        )
        copied.boto3 = self.boto3
        copied.action = self.action
        copied.chain = self.chain
        copied.response = self.response
        return copied


@dataclass
class HttpCall:
    method: str
    paths: list[str]
    params: set[str]
    params_dynamic: bool
    func: str
    boto3: bool = False
    action: str = ""
    keys: set[str] = field(default_factory=set)
    nav: set[str] = field(default_factory=set)
    local_keys: set[str] = field(default_factory=set)
    chain_keys: set[str] = field(default_factory=set)
    chain_lists: set[str] = field(default_factory=set)
    response_keys: set[str] = field(default_factory=set)
    stack: list[str] = field(default_factory=list)


@dataclass
class Func:
    name: str
    node: ast.AST
    qual: str
    cls: str
    reads: set[str] = field(default_factory=set)
    lists: set[str] = field(default_factory=set)
    response_reads: set[str] = field(default_factory=set)
    calls: list[tuple[str, ast.Call]] = field(default_factory=list)


@dataclass
class Mod:
    path: Path
    style: str
    funcs: dict[str, Func]
    by_short: dict[str, list[Func]]
    class_attrs: dict[str, dict[str, Val]]
    base_paths: list[str]
    env: dict[str, Val]
    sdks: set[str] = field(default_factory=set)
    stack: list[str] = field(default_factory=list)
    yml_defaults: dict[str, str] = field(default_factory=dict)
    enum_routes: list[str] = field(default_factory=list)
    response_calls: set[int] = field(default_factory=set)
    chain_cache: dict[tuple[str, ...], tuple[set[str], set[str], set[str]]] = field(default_factory=dict)


def main() -> int:
    args = sys.argv[1:]
    if "--self-test" in args:
        return self_test()
    content = Path("/tmp/content")
    strict = False
    allow_path = ROOT / "scripts" / "crosscheck-allowlist.json"
    report_path: Path | None = None
    json_path: Path | None = None
    propose_path: Path | None = None
    only: set[str] = set()
    i = 0
    while i < len(args):
        arg = args[i]
        if arg == "--content":
            content = Path(args[i + 1])
            i += 2
            continue
        if arg == "--strict":
            strict = True
            i += 1
            continue
        if arg == "--allowlist":
            allow_path = Path(args[i + 1])
            i += 2
            continue
        if arg == "--report":
            report_path = Path(args[i + 1])
            i += 2
            continue
        if arg == "--json":
            json_path = Path(args[i + 1])
            i += 2
            continue
        if arg == "--propose":
            propose_path = Path(args[i + 1])
            i += 2
            continue
        if arg == "--id":
            only.add(args[i + 1])
            i += 2
            continue
        sys.stderr.write(f"unknown argument {arg}\n")
        return 2
    presets = load_verified(ROOT / "public" / "presets" / "integrations", only)
    allow = load_allowlist(allow_path)
    if propose_path:
        proposals = []
        for preset in presets:
            proposals.extend(propose_preset(preset, content))
        propose_path.write_text(json.dumps(proposals, indent=2) + "\n")
        print(f"proposed {len(proposals)}")
        return 0
    results = [check_preset(preset, content) for preset in presets]
    summary = summarize(results, allow)
    text = render(results, summary)
    if json_path:
        payload = {"summary": summary, "presets": results}
        json_path.write_text(json.dumps(payload, indent=2) + "\n")
    if report_path:
        report_path.write_text(text)
    sys.stdout.write(text)
    if not strict:
        return 0
    bad = [
        row
        for row in results
        if row["status"] != "match" and row["id"] not in allow
    ]
    return 1 if bad else 0


def load_allowlist(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    data = json.loads(path.read_text())
    out: dict[str, str] = {}
    for preset_id, reason in data.get("exceptions", {}).items():
        if isinstance(reason, str) and reason.strip():
            out[preset_id] = reason.strip()
    return out


def load_verified(directory: Path, only: set[str]) -> list[dict]:
    rows = []
    for path in sorted(directory.glob("*.json")):
        data = json.loads(path.read_text())
        if data.get("fidelity") not in {"verified", "approximate", "vendor"}:
            continue
        if only and data.get("id") not in only:
            continue
        rows.append(data)
    return rows


def client_calls(preset: dict, content: Path) -> list[HttpCall]:
    source = preset.get("sourceUrl") or ""
    rel = content_rel(source)
    if not rel:
        return []
    folder = content / rel
    if not folder.is_dir():
        return []
    folder = client_folder(folder, preset["id"])
    return [call for mod in load_modules(folder, content) for call in module_calls(mod)]


def propose_preset(preset: dict, content: Path) -> list[dict]:
    calls = client_calls(preset, content)
    if not calls:
        return []
    rows = []
    for operation in preset["spec"]["operations"]:
        method = str(operation.get("method", "")).upper()
        current = norm_path(str(operation.get("pathTemplate", "/")))
        if any(call.method == method and any(paths_match(current, path) for path in call.paths) for call in calls):
            continue
        proposed = replacement_for(current, calls, method)
        if not proposed:
            continue
        rows.append(
            {
                "id": preset["id"],
                "operation": operation.get("id", ""),
                "method": method,
                "path": current,
                "proposed": proposed,
            }
        )
    return rows


def check_preset(preset: dict, content: Path) -> dict:
    source = preset.get("sourceUrl") or ""
    rel = content_rel(source)
    if not rel:
        return result(preset, "unparseable", ["no-source: sourceUrl is not a demisto/content path"])
    folder = content / rel
    if not folder.is_dir():
        return result(preset, "unparseable", [f"no-source: {rel} is not in the content checkout"])
    folder = client_folder(folder, preset["id"])
    modules = load_modules(folder, content)
    if not modules:
        return result(preset, "unparseable", ["unparseable: no Python client parsed"])
    calls = [call for mod in modules for call in module_calls(mod)]
    test_paths, _test_types = load_test_data(folder)
    if not calls and not test_paths:
        return result(preset, "unparseable", ["unparseable: no HTTP calls and no test_data"])
    findings: list[str] = []
    if not calls:
        findings.append("unparseable: client built requests without a readable method and path")
        return result(preset, "unparseable", findings)
    fixtures = [command_fixtures(item) for item in fixture_folders(folder, modules)]
    for operation in preset["spec"]["operations"]:
        # A copied vendor example includes fields the client never reads. Approximate operations still do.
        findings.extend(
            check_operation(
                operation,
                calls,
                fixtures,
                skip_fields=bool(operation.get("fixture")),
                source_text=folder_source(folder),
            )
        )
    status = "mismatch" if findings else "match"
    return result(preset, status, findings, len(calls))


def result(preset: dict, status: str, findings: list[str], calls: int = 0) -> dict:
    return {
        "id": preset["id"],
        "name": preset["name"],
        "status": status,
        "calls": calls,
        "findings": findings,
    }


def client_folder(folder: Path, preset_id: str) -> Path:
    """Use the integration directory when sourceUrl points at the pack root."""
    if any(folder.glob("*.py")):
        return folder
    nested = folder / "Integrations"
    if nested.is_dir():
        found = search_children(nested, preset_id, "")
        if found:
            return found
    return sibling_client(folder, preset_id) or folder


def sibling_client(folder: Path, preset_id: str) -> Path | None:
    wanted = folder.name.lower().replace("_", "-")
    return search_children(folder.parent, preset_id, wanted)


def search_children(parent: Path, preset_id: str, wanted: str) -> Path | None:
    if not parent.is_dir():
        return None
    best: tuple[int, Path] | None = None
    for candidate in parent.iterdir():
        if not candidate.is_dir() or not any(candidate.glob("*.py")):
            continue
        slug = candidate.name.lower().replace("_", "-")
        score = 0
        if slug == wanted:
            score = 100
        elif preset_id.lower().endswith(slug):
            score = 80
        elif slug.replace("-", "") and slug.replace("-", "") in preset_id.lower().replace("-", ""):
            score = 60
        elif wanted and wanted in slug:
            score = 40
        if score and (best is None or score > best[0]):
            best = (score, candidate)
    return best[1] if best else None


def content_rel(url: str) -> str:
    match = re.search(r"github\.com/demisto/content/(?:tree|blob)/[^/]+/(.+?)/?$", url)
    return match.group(1) if match else ""


def load_modules(folder: Path, content: Path) -> list[Mod]:
    files = [
        path
        for path in sorted(folder.glob("*.py"))
        if not path.name.endswith("_test.py") and not path.name.startswith("test_")
    ]
    modules = []
    seen: set[Path] = set()
    for path in files:
        mod = parse_file(path)
        if not mod:
            continue
        modules.append(mod)
        seen.add(path.resolve())
        for imported in api_modules(mod, content):
            if imported.resolve() in seen:
                continue
            extra = parse_file(imported)
            if extra:
                modules.append(extra)
                seen.add(imported.resolve())
    return modules


def api_modules(mod: Mod, content: Path) -> list[Path]:
    found = []
    try:
        tree = ast.parse(mod.path.read_text(encoding="utf-8", errors="replace"))
    except SyntaxError:
        return found
    for node in ast.walk(tree):
        if not isinstance(node, ast.ImportFrom) or not node.module:
            continue
        if not node.module.endswith("ApiModule"):
            continue
        candidate = content / "Packs" / "ApiModules" / "Scripts" / node.module / f"{node.module}.py"
        if candidate.is_file():
            found.append(candidate)
    return found


def parse_file(path: Path) -> Mod | None:
    try:
        source = path.read_text(encoding="utf-8", errors="replace")
        tree = ast.parse(source)
    except SyntaxError:
        return None
    funcs: dict[str, Func] = {}
    by_short: dict[str, list[Func]] = {}
    class_attrs: dict[str, dict[str, Val]] = {}
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            add_func(funcs, by_short, node.name, "", node)
        elif isinstance(node, ast.ClassDef):
            class_attrs[node.name] = {}
            for item in node.body:
                if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    add_func(funcs, by_short, item.name, node.name, item)
    mod = Mod(path, urljoin_style(tree), funcs, by_short, class_attrs, [], {})
    if "splunklib" in source:
        mod.sdks.add("splunk")
    if "slack_sdk" in source:
        mod.sdks.add("slack")
    if "googleapiclient" in source or "google.auth" in source or "google.oauth2" in source:
        mod.sdks.add("google")
    if "elasticsearch" in source:
        mod.sdks.add("elastic")
    if "greynoise" in source:
        mod.sdks.add("greynoise")
    if "laceworksdk" in source:
        mod.sdks.add("lacework")
    mod.yml_defaults = load_yml_defaults(path)
    mod.enum_routes = enum_path_pairs(tree)
    seed_module(mod, tree)
    seed_class_constants(mod, tree)
    inits = [func for func in funcs.values() if func.name == "__init__"]
    for func in inits:
        run_func(mod, func, {}, MAX_HOP)
    main = funcs.get("main")
    if main:
        run_func(mod, main, {}, MAX_HOP)
    for func in funcs.values():
        if func.name == "__init__" or func.qual == "main":
            continue
        run_func(mod, func, {}, MAX_HOP)
    return mod


def add_func(funcs: dict[str, Func], by_short: dict[str, list[Func]], name: str, cls: str, node: ast.AST) -> None:
    qual = f"{cls}.{name}" if cls else name
    func = Func(name, node, qual, cls)
    funcs[qual] = func
    by_short.setdefault(name, []).append(func)


def urljoin_style(tree: ast.AST) -> str:
    style = "xsoar"
    for node in getattr(tree, "body", []):
        if not isinstance(node, ast.ImportFrom):
            continue
        names = {alias.name for alias in node.names}
        if node.module == "urllib.parse" and ("urljoin" in names or "*" in names):
            style = "stdlib"
        elif node.module == "CommonServerPython":
            style = "xsoar"
    return style


def seed_class_constants(mod: Mod, tree: ast.AST) -> None:
    """Class-level string constants are the values ``self.NAME`` has before ``__init__``."""
    for node in tree.body:
        if not isinstance(node, ast.ClassDef):
            continue
        bucket = mod.class_attrs.setdefault(node.name, {})
        for item in node.body:
            targets: list[ast.Name] = []
            value_node = None
            if isinstance(item, ast.Assign):
                targets = [target for target in item.targets if isinstance(target, ast.Name)]
                value_node = item.value
            elif isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name) and item.value:
                targets = [item.target]
                value_node = item.value
            if not targets or value_node is None:
                continue
            value = eval_expr(value_node, mod.env, mod, node.name)
            if not value.text or "{" in value.text or value.dynamic:
                continue
            for target in targets:
                bucket.setdefault(target.id, value)


def seed_module(mod: Mod, tree: ast.AST) -> None:
    for node in tree.body:
        if isinstance(node, ast.Assign):
            value = eval_expr(node.value, mod.env, mod, "")
            for target in node.targets:
                if isinstance(target, ast.Name):
                    mod.env[target.id] = value
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name) and node.value:
            mod.env[node.target.id] = eval_expr(node.value, mod.env, mod, "")


def module_calls(mod: Mod) -> list[HttpCall]:
    calls: list[HttpCall] = []
    # Calls are attached during run_func via mod.env sentinel list.
    raw = mod.env.get("__calls__")
    if raw and raw.items and "__list__" in raw.items:
        blob = raw.items["__list__"].text
        if blob:
            calls = decode_calls(blob)
    all_reads: set[str] = set()
    for func in mod.funcs.values():
        all_reads |= func.reads
    for call in calls:
        binder = mod.funcs.get(call.func)
        scope = set(all_reads)
        if binder:
            scope |= binder.reads
        call.keys = scope
        call.nav = set(all_reads)
        call.local_keys = set(binder.reads) if binder else set()
        quals = scope_stack(call.stack) or ((call.func,) if call.func else tuple())
        call.chain_keys, call.chain_lists, call.response_keys = chain_for(mod, quals)
    return calls


def decode_calls(blob: str) -> list[HttpCall]:
    rows = json.loads(blob)
    return [
        HttpCall(
            method=row["method"],
            paths=row["paths"],
            params=set(row["params"]),
            params_dynamic=row["dynamic"],
            func=row["func"],
            boto3=row.get("boto3", False),
            action=str(row.get("action") or ""),
            stack=list(row.get("stack") or [row["func"]]),
        )
        for row in rows
    ]


def scope_stack(stack: list[str]) -> tuple[str, ...]:
    """Drop the dispatcher. main() walks every branch, so its reads are the whole module."""
    kept = [qual for qual in stack if qual.split(".")[-1] not in {"main", "test_module"}]
    if kept:
        return tuple(kept)
    return tuple(stack[-1:]) if stack else tuple()


def unique_callees(mod: Mod, func: Func) -> list[Func]:
    found: list[Func] = []
    seen: set[str] = set()
    for name, _call in func.calls:
        targets = resolve_funcs(mod, name, func.cls)
        if len(targets) != 1:
            continue
        target = targets[0]
        if target.qual in seen or target.qual == func.qual or target.name in {"main", "test_module"}:
            continue
        seen.add(target.qual)
        found.append(target)
    return found


def is_http_helper(func: Func) -> bool:
    """Shared request wrappers. Their token handling is not the command's response body."""
    name = func.name.lower()
    if name in {
        "http_request",
        "_http_request",
        "generic_http_request",
        "_apicall",
        "sendrequestinsession",
        "request",
        "get_token",
        "getnewtoken",
        "_get_token",
        "get_access_token",
    }:
        return True
    return name.endswith("_api_call") or name.endswith("api_call")


def chain_for(mod: Mod, quals: tuple[str, ...]) -> tuple[set[str], set[str], set[str]]:
    """Reads for one call site: the command on its stack, then the parsers that command calls.

    A shared HTTP helper is not part of the body. Two commands that both call ``http_request``
    keep separate response keys. When the helper itself is the only reader, its reads stay.
    """
    cached = mod.chain_cache.get(quals)
    if cached is not None:
        return cached
    frames = [mod.funcs[qual] for qual in quals if qual in mod.funcs]
    focused = [item for item in frames if not is_http_helper(item)] or frames
    reads: set[str] = set()
    lists: set[str] = set()
    response: set[str] = set()
    seen: set[str] = set()
    frontier = focused
    for _ in range(4):
        nxt: list[Func] = []
        for item in frontier:
            if item.qual in seen:
                continue
            seen.add(item.qual)
            reads |= item.reads
            lists |= item.lists
            response |= item.response_reads
            for callee in unique_callees(mod, item):
                if is_http_helper(callee):
                    continue
                nxt.append(callee)
        frontier = nxt
    result = (reads, lists, response)
    mod.chain_cache[quals] = result
    return result


def callers_of(mod: Mod, func: Func) -> list[Func]:
    found = []
    for other in mod.funcs.values():
        for name, _call in other.calls:
            if func in resolve_funcs(mod, name, other.cls):
                found.append(other)
                break
    return found


def resolve_funcs(mod: Mod, name: str, cls: str) -> list[Func]:
    if cls:
        qual = mod.funcs.get(f"{cls}.{name}")
        if qual:
            return [qual]
    if name in mod.funcs:
        return [mod.funcs[name]]
    return list(mod.by_short.get(name, []))


def resolve_call_targets(mod: Mod, call: ast.Call, func: Func) -> list[Func]:
    """Prefer ``client.method`` over a module command that reuses the method's name."""
    name = call_name(call)
    if not name:
        return []
    if isinstance(call.func, ast.Attribute) and isinstance(call.func.value, ast.Name):
        owner = call.func.value.id
        if owner in {"self", "cls"} and func.cls:
            found = mod.funcs.get(f"{func.cls}.{name}")
            if found:
                return [found]
        if owner in {"client", "self"}:
            methods = [item for item in mod.by_short.get(name, []) if item.cls]
            if len(methods) == 1:
                return methods
    return resolve_funcs(mod, name, func.cls)


def run_func(mod: Mod, func: Func, bound: dict[str, Val], depth: int) -> bool:
    if func.qual in mod.stack:
        return False
    mod.stack.append(func.qual)
    env = dict(mod.env)
    env.update(bound)
    apply_signature(func.node, env)
    env.update(bound)
    previous = env.get("__returns_response__")
    env["__returns_response__"] = Val()
    try:
        walk_body(func.node.body, env, mod, func, depth)  # type: ignore[attr-defined]
        return bool(env["__returns_response__"].response)
    finally:
        if previous is None:
            env.pop("__returns_response__", None)
        else:
            env["__returns_response__"] = previous
        mod.stack.pop()


def apply_signature(node: ast.AST, env: dict[str, Val]) -> None:
    args = getattr(node, "args", None)
    if not args:
        return
    names = [arg.arg for arg in args.args]
    defaults = list(args.defaults)
    start = len(names) - len(defaults)
    for offset, default in enumerate(defaults):
        name = names[start + offset]
        if name not in env:
            env[name] = eval_expr(default, env, None, "")


def walk_body(body: list[ast.stmt], env: dict[str, Val], mod: Mod, func: Func, depth: int) -> None:
    for stmt in body:
        walk_stmt(stmt, env, mod, func, depth)


def walk_stmt(stmt: ast.stmt, env: dict[str, Val], mod: Mod, func: Func, depth: int) -> None:
    if isinstance(stmt, (ast.FunctionDef, ast.AsyncFunctionDef)):
        walk_body(stmt.body, env, mod, func, depth)
        return
    if isinstance(stmt, ast.ClassDef):
        return
    if isinstance(stmt, ast.Match):
        for case in stmt.cases:
            walk_body(case.body, env, mod, func, depth)
        return
    if isinstance(stmt, ast.Assign):
        value = visit_calls(stmt.value, env, mod, func, depth)
        for target in stmt.targets:
            assign(target, value, env, mod, func)
        return
    if isinstance(stmt, ast.AnnAssign):
        if stmt.value:
            assign(stmt.target, visit_calls(stmt.value, env, mod, func, depth), env, mod, func)
        return
    if isinstance(stmt, ast.Expr):
        visit_calls(stmt.value, env, mod, func, depth)
        return
    if isinstance(stmt, ast.Return):
        if stmt.value:
            value = visit_calls(stmt.value, env, mod, func, depth)
            if value.response:
                env["__returns_response__"] = Val(response=True)
            note_request_object(stmt.value, env, mod, func)
        return
    if isinstance(stmt, ast.If):
        visit_calls(stmt.test, env, mod, func, depth)
        walk_body(stmt.body, env, mod, func, depth)
        walk_body(stmt.orelse, env, mod, func, depth)
        return
    if isinstance(stmt, (ast.For, ast.AsyncFor)):
        iter_val = eval_expr(stmt.iter, env, mod, func.cls)
        remember_reads(stmt.iter, env, mod, func, depth)
        paths = [path for path in read_paths(stmt.iter, env) if path]
        if not paths and isinstance(stmt.iter, ast.Name) and stmt.iter.id in env and env[stmt.iter.id].path:
            paths = [env[stmt.iter.id].path]
        if depth:
            for path in paths:
                func.lists.add(path)
        if isinstance(stmt.target, ast.Name):
            bound = iter_val.copy()
            if iter_val.response or response_expression(stmt.iter, env, mod):
                bound.response = True
                if len(paths) == 1:
                    bound.path = paths[0]
            env[stmt.target.id] = bound
        elif isinstance(stmt.target, ast.Tuple) and iter_val.dyn_keys:
            mark_dyn_items(env)
        if iter_items_loop(stmt):
            mark_dyn_items(env)
        walk_body(stmt.body, env, mod, func, depth)
        walk_body(stmt.orelse, env, mod, func, depth)
        return
    if isinstance(stmt, (ast.With, ast.AsyncWith)):
        for item in stmt.items:
            visit_calls(item.context_expr, env, mod, func, depth)
        walk_body(stmt.body, env, mod, func, depth)
        return
    if isinstance(stmt, ast.While):
        walk_body(stmt.body, env, mod, func, depth)
        return
    if isinstance(stmt, ast.Try):
        walk_body(stmt.body, env, mod, func, depth)
        for handler in stmt.handlers:
            walk_body(handler.body, env, mod, func, depth)
        walk_body(stmt.orelse, env, mod, func, depth)
        walk_body(stmt.finalbody, env, mod, func, depth)
        return
    if isinstance(stmt, (ast.Raise, ast.Delete, ast.Assert, ast.Pass, ast.Break, ast.Continue, ast.Global, ast.Nonlocal)):
        return


def iter_items_loop(stmt: ast.For | ast.AsyncFor) -> bool:
    call = stmt.iter
    if not isinstance(call, ast.Call) or not isinstance(call.func, ast.Attribute):
        return False
    return call.func.attr == "items"


def mark_dyn_items(env: dict[str, Val]) -> None:
    for val in env.values():
        if val.items is not None:
            val.dyn_keys = True


def assign(target: ast.expr, value: Val, env: dict[str, Val], mod: Mod, func: Func) -> None:
    if isinstance(target, ast.Name):
        previous = env.get(target.id)
        if previous and (previous.text or previous.path) and (value.text or value.path) and (previous.text or previous.path) != (value.text or value.path):
            value = value.copy()
            value.alts = [*(previous.alts or [previous]), value.copy()]
        env[target.id] = value
        return
    if isinstance(target, ast.Attribute) and isinstance(target.value, ast.Name) and target.value.id == "self":
        mod.class_attrs.setdefault(func.cls, {})[target.attr] = value
        if target.attr in {"base_url", "_base_url", "server", "url"} and value.path:
            add_base(mod, value.path)
        return
    if isinstance(target, ast.Subscript) and isinstance(target.value, ast.Name):
        owner = env.get(target.value.id)
        key = literal_str(target.slice)
        if owner and owner.items is not None and key:
            owner.items[key] = value


def note_call(node: ast.expr, func: Func) -> None:
    if isinstance(node, ast.Call):
        name = call_name(node)
        if name:
            func.calls.append((name, node))


def remember_reads(node: ast.expr, env: dict[str, Val], mod: Mod, func: Func, depth: bool) -> None:
    if not depth:
        return
    paths = [path for path in read_paths(node, env) if path]
    for path in paths:
        func.reads.add(path)
    if response_expression(node, env, mod):
        if paths:
            func.response_reads.update(paths)
        for path in indexed_lists(node, env):
            func.lists.add(path)
            func.response_reads.add(path)
    for path in default_list_paths(node, env):
        func.lists.add(path)


def default_list_paths(node: ast.expr, env: dict[str, Val]) -> list[str]:
    """response.get('value', []) is a list even when the code never indexes it."""
    found: list[str] = []
    for current in ast.walk(node):
        if not isinstance(current, ast.Call) or not isinstance(current.func, ast.Attribute):
            continue
        if current.func.attr != "get" or len(current.args) < 2 or not isinstance(current.args[1], ast.List):
            continue
        found.extend(path for path in read_paths(current, env) if path)
    return found


def numeric_index(node: ast.expr) -> bool:
    return isinstance(node, ast.Constant) and isinstance(node.value, int)


def key_sequences(node: ast.expr, env: dict[str, Val]) -> list[list[str]]:
    """Alternative key paths passed to dict_safe_get, including both sides of a conditional."""
    if isinstance(node, ast.List):
        keys = [elt.value for elt in node.elts if isinstance(elt, ast.Constant) and isinstance(elt.value, str)]
        return [keys] if keys else []
    if isinstance(node, ast.Constant) and isinstance(node.value, str) and node.value:
        return [node.value.split(".")]
    if isinstance(node, ast.IfExp):
        return key_sequences(node.body, env) + key_sequences(node.orelse, env)
    if isinstance(node, ast.Name) and node.id in env:
        value = env[node.id]
        options = value.alts or [value]
        found = []
        for option in options:
            keys = [item.text for item in (option.seq or []) if item.text]
            if keys:
                found.append(keys)
        return found
    return []


def note_safe_get(call: ast.Call, env: dict[str, Val], mod: Mod, func: Func) -> None:
    """dict_safe_get(response, ['clicksBlocked']) is a read, same as response.get."""
    name = call_name(call)
    demisto_get = (
        isinstance(call.func, ast.Attribute)
        and call.func.attr == "get"
        and isinstance(call.func.value, ast.Name)
        and call.func.value.id == "demisto"
    )
    if name != "dict_safe_get" and not demisto_get:
        return
    if len(call.args) < 2:
        return
    owner = call.args[0]
    if not (response_expression(owner, env, mod) or tracked(owner, env)):
        return
    prefix = ""
    if isinstance(owner, ast.Name) and owner.id in env and env[owner.id].path:
        prefix = env[owner.id].path
    responded = response_expression(owner, env, mod)
    for keys in key_sequences(call.args[1], env):
        path = prefix
        for key in keys:
            path = dot(path, key) if path else key
        if not path:
            continue
        func.reads.add(path)
        if responded:
            func.response_reads.add(path)


def note_extend_lists(call: ast.Call, env: dict[str, Val], func: Func) -> None:
    """outputs.extend(dict_safe_get(response, ['clicksBlocked'])) means that key is a list."""
    if call_name(call) != "extend" or not call.args or not isinstance(call.args[0], ast.Call):
        return
    inner = call.args[0]
    if call_name(inner) == "dict_safe_get" and len(inner.args) >= 2:
        prefix = ""
        owner = inner.args[0]
        if isinstance(owner, ast.Name) and owner.id in env and env[owner.id].path:
            prefix = env[owner.id].path
        for keys in key_sequences(inner.args[1], env):
            path = prefix
            for key in keys:
                path = dot(path, key) if path else key
            if path:
                func.lists.add(path)
        return
    if isinstance(inner.func, ast.Attribute) and inner.func.attr == "get":
        for path in read_paths(inner, env):
            if path:
                func.lists.add(path)


def response_expression(node: ast.expr, env: dict[str, Val], mod: Mod) -> bool:
    if isinstance(node, ast.BoolOp):
        return any(response_expression(value, env, mod) for value in node.values)
    if isinstance(node, ast.IfExp):
        return response_expression(node.body, env, mod) or response_expression(node.orelse, env, mod)
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr in {"get", "json", "pop"}:
        return response_expression(node.func.value, env, mod) or id(node) in mod.response_calls
    if isinstance(node, ast.Subscript):
        return response_expression(node.value, env, mod)
    if isinstance(node, ast.Attribute) and node.attr == "json":
        return response_expression(node.value, env, mod)
    if isinstance(node, ast.Name):
        value = env.get(node.id)
        return bool(value and value.response)
    if isinstance(node, ast.Call):
        return id(node) in mod.response_calls
    return False


def visit_calls(node: ast.expr, env: dict[str, Val], mod: Mod, func: Func, depth: bool) -> Val:
    for child in ast.walk(node):
        if isinstance(child, ast.Call) and child is not node:
            handle_call(child, env, mod, func, depth)
    remember_reads(node, env, mod, func, depth)
    if isinstance(node, ast.Call):
        return handle_call(node, env, mod, func, depth)
    return eval_expr(node, env, mod, func.cls)


def handle_call(call: ast.Call, env: dict[str, Val], mod: Mod, func: Func, depth: bool) -> Val:
    name = call_name(call)
    if name:
        func.calls.append((name, call))
    remember_reads(call, env, mod, func, depth)
    note_safe_get(call, env, mod, func)
    note_extend_lists(call, env, func)
    if isinstance(call.func, ast.Attribute):
        owner = eval_expr(call.func.value, env, mod, func.cls)
        if owner.text.startswith("boto3:"):
            attr = call.func.attr
            skipped = {
                "get_paginator",
                "get_waiter",
                "can_paginate",
                "generate_presigned_url",
                "get_available_regions",
                "close",
            }
            action = ""
            if attr not in skipped and not attr.startswith("_"):
                action = "".join(part[:1].upper() + part[1:] for part in attr.split("_") if part)
            store_call(
                mod,
                {
                    "method": "POST",
                    "paths": ["/"],
                    "params": [],
                    "dynamic": True,
                    "func": func.qual,
                    "boto3": True,
                    "action": action,
                },
            )
            return owner
    if emit_sdk(call, env, mod, func):
        return Val(dynamic=True)
    if is_super_init(call):
        remember_base(call, env, mod, func)
        return Val(dynamic=True)
    if any(keyword.arg in {"base_url", "_base_url"} for keyword in call.keywords):
        remember_base(call, env, mod, func)
    if is_sink(call, mod, func) and not local_wrapper(call, mod, func):
        emit_sink(call, env, mod, func)
        value = Val(dynamic=True, path="", response=True)
        mod.response_calls.add(id(call))
        return value
    returned = False
    receiver_response = (
        isinstance(call.func, ast.Attribute)
        and isinstance(call.func.value, ast.Call)
        and id(call.func.value) in mod.response_calls
    )
    if depth > 0 and len(mod.stack) < 12:
        if name and name in mod.class_attrs:
            init = mod.funcs.get(f"{name}.__init__")
            if init and init.qual != func.qual and init.qual not in mod.stack:
                run_func(mod, init, bind_args(init, call, env, mod, name), depth - 1)
        if name and name not in {"urljoin", "assign_params", "format"}:
            for target in resolve_call_targets(mod, call, func)[:4]:
                if target.qual == func.qual or target.qual in mod.stack:
                    continue
                returned = run_func(mod, target, bind_args(target, call, env, mod, func.cls), depth - 1) or returned
    value = eval_call_value(call, env, mod, func.cls)
    if (returned or receiver_response) and not value.response:
        value = value.copy()
        value.response = True
    chain = discovery_chain(call)
    if chain:
        value.chain = chain
    if value.response:
        mod.response_calls.add(id(call))
    return value


def is_super_call(call: ast.Call) -> bool:
    func = call.func
    return (
        isinstance(func, ast.Attribute)
        and isinstance(func.value, ast.Call)
        and isinstance(func.value.func, ast.Name)
        and func.value.func.id == "super"
    )


def local_wrapper(call: ast.Call, mod: Mod, func: Func) -> bool:
    if is_super_call(call):
        return False
    # self/client.http_request is this integration's wrapper and must be followed.
    # ms_client.http_request and BaseClient._http_request already carry the URL.
    if isinstance(call.func, ast.Attribute):
        owner = call.func.value
        if not isinstance(owner, ast.Name) or owner.id not in {"self", "cls", "client"}:
            return False
    name = call_name(call)
    if name not in {"http_request", "_http_request"}:
        return False
    return bool(resolve_funcs(mod, name, func.cls))


def is_sink(call: ast.Call, mod: Mod, func: Func) -> bool:
    if not isinstance(call.func, ast.Attribute):
        return call_name(call) == "generic_http_request"
    attr = call.func.attr
    if attr in {"_http_request", "generic_http_request"}:
        return True
    if attr == "http_request":
        return not local_wrapper(call, mod, func)
    if attr == "request":
        owner = owner_name(call.func.value)
        names = {keyword.arg for keyword in call.keywords}
        return owner in {"requests", "session", "http_client", "_session"} or "url" in names or "full_url" in names
    if attr == "_apiCall":
        return True
    if attr in {"get", "post", "put", "patch", "delete"}:
        owner = owner_name(call.func.value)
        return owner in {"requests", "session"}
    return False


def remember_base(call: ast.Call, env: dict[str, Val], mod: Mod, func: Func) -> None:
    values: list[Val] = []
    if call.args:
        values.append(eval_expr(call.args[0], env, mod, func.cls))
    expanded = expand_keywords(call, env, mod, func.cls)
    for name in ("base_url", "_base_url"):
        if name in expanded:
            values.append(expanded[name])
    kwargs = env.get("kwargs")
    if kwargs and kwargs.items:
        for name in ("base_url", "_base_url"):
            if name in kwargs.items:
                values.append(kwargs.items[name])
    for value in values:
        mod.class_attrs.setdefault(func.cls, {})["_base_url"] = value
        if value.path:
            add_base(mod, value.path)


def is_super_init(call: ast.Call) -> bool:
    func = call.func
    if isinstance(func, ast.Attribute) and func.attr == "__init__" and isinstance(func.value, ast.Call):
        inner = func.value.func
        return isinstance(inner, ast.Name) and inner.id == "super"
    return False


def emit_sink(call: ast.Call, env: dict[str, Val], mod: Mod, func: Func) -> None:
    method, paths, params, dynamic = sink_facts(call, env, mod, func)
    paths = [path for path in paths if concrete_path(Val(path=path))]
    if not paths and method in VERBS and mod.enum_routes:
        paths = list(mod.enum_routes)
    if method not in VERBS or not paths:
        return
    paths = [path for path in paths if static_segment(path)]
    paths = with_base_aliases(paths)
    paths = [path for path in paths if static_segment(path)]
    if not paths:
        return
    row = {
        "method": method,
        "paths": sorted(set(paths)),
        "params": sorted(params),
        "dynamic": dynamic,
        "func": func.qual,
        "boto3": False,
    }
    store_call(mod, row)


def store_call(mod: Mod, row: dict) -> None:
    row = dict(row)
    qual = str(row.get("func") or "")
    if not row.get("stack"):
        stack = list(mod.stack)
        if qual and (not stack or stack[-1] != qual):
            stack.append(qual)
        row["stack"] = stack
    current = mod.env.get("__calls__")
    rows = []
    if current and current.items and "__list__" in current.items and current.items["__list__"].text:
        rows = json.loads(current.items["__list__"].text)
    rows.append(row)
    blob = Val(text="", items={"__list__": Val(text=json.dumps(rows))})
    mod.env["__calls__"] = blob


def sink_facts(call: ast.Call, env: dict[str, Val], mod: Mod, func: Func) -> tuple[str, list[str], set[str], bool]:
    keywords = expand_keywords(call, env, mod, func.cls)
    method = ""
    attr = call.func.attr if isinstance(call.func, ast.Attribute) else ""
    if attr in {"get", "post", "put", "patch", "delete"}:
        method = attr.upper()
    positional = positional_vals(call, env, mod, func.cls)
    method_val = keywords.get("method")
    if method_val and method_val.text.upper() in VERBS:
        method = method_val.text.upper()
    elif positional:
        if positional[0].text.upper() in VERBS:
            method = positional[0].text.upper()
    params, dynamic = param_keys(keywords.get("params") or keywords.get("query_params"))
    owner = owner_name(call.func.value) if isinstance(call.func, ast.Attribute) else ""
    if attr in {"get", "post", "put", "patch", "delete"} or attr == "request":
        url = keywords.get("url") or url_argument(call, env, mod, func.cls, attr)
        if url and (url.path or url.text or url.alts):
            paths: list[str] = []
            for option in url.alts or [url]:
                raw = option.path or option.text
                if raw.startswith("http"):
                    raw = path_of(raw)
                if raw:
                    paths.append(norm_path(raw))
            return method, paths, params, dynamic
        return method, [], params, dynamic
    full = keywords.get("full_url")
    if full and (full.path or full.text.startswith("http")):
        raw = full.path or path_of(full.text)
        return method, [norm_path(raw)], params, dynamic
    suffix = keywords.get("url_suffix") or keywords.get("url") or keywords.get("path")
    if suffix is None and len(positional) >= 2 and attr in {"_http_request", "http_request", "generic_http_request"}:
        suffix = positional[1]
    if suffix is None and positional and attr == "http_request" and positional[0].text.upper() not in VERBS:
        suffix = positional[0]
    if suffix is None and len(positional) >= 2 and attr == "request":
        suffix = positional[1]
    if suffix is None:
        return method, [], params, dynamic
    paths: list[str] = []
    for option in suffix.alts or [suffix]:
        paths.extend(join_suffix(option, keywords.get("server_url"), mod))
    return method, paths, params, dynamic


def positional_vals(call: ast.Call, env: dict[str, Val], mod: Mod, cls: str) -> list[Val]:
    values: list[Val] = []
    for arg in call.args:
        if isinstance(arg, ast.Starred):
            packed = eval_expr(arg.value, env, mod, cls)
            if packed.seq:
                values.extend(packed.seq)
            continue
        values.append(eval_expr(arg, env, mod, cls))
    return values


def url_argument(call: ast.Call, env: dict[str, Val], mod: Mod, cls: str, attr: str) -> Val | None:
    if attr == "request":
        if len(call.args) >= 2:
            return eval_expr(call.args[1], env, mod, cls)
        return None
    if call.args:
        return eval_expr(call.args[0], env, mod, cls)
    return None


BASE_HOLE = re.compile(r"^(api_url|url|server_url|server|base_url|base|host|endpoint|serverport)$", re.I)


def with_base_aliases(paths: list[str]) -> list[str]:
    """Keep a copy of the path with a server variable removed.

    Clients prepend ``{API_URL}``, ``:{serverPort}``, or a glued ``{url}api/...``
    because the instance URL already includes the host. The route the preset
    mocks is the remainder.
    """
    aliases = list(paths)
    for path in paths:
        normed = norm_path(path)
        parts = segments(normed)
        if parts and base_hole(parts[0]) and len(parts) > 1:
            aliases.append("/" + "/".join(parts[1:]))
        glued = re.match(r"^/\{([A-Za-z0-9_]+)\}([^/{].+)$", normed)
        if glued and BASE_HOLE.match(glued.group(1)):
            aliases.append(norm_path("/" + glued.group(2)))
    return sorted(set(aliases))


def base_hole(segment: str) -> bool:
    bare = segment[1:] if segment.startswith(":") else segment
    if not (bare.startswith("{") and bare.endswith("}")):
        return False
    return bool(BASE_HOLE.match(bare[1:-1]))


def join_suffix(suffix: Val, server: Val | None, mod: Mod) -> list[str]:
    raw = suffix.path or suffix.text
    if not raw:
        return []
    if raw.startswith("http://") or raw.startswith("https://"):
        return [norm_path(path_of(raw))]
    bases = list(mod.base_paths)
    if server and server.path:
        bases.append(server.path)
    bare = norm_path(raw if raw.startswith("/") else "/" + raw)
    if not bases:
        return [bare]
    joined = [bare]
    for base in bases:
        if mod.style == "stdlib" and (raw.startswith("/") or (suffix.path or "").startswith("/")):
            joined.append(bare)
        else:
            joined.append(xsoar_join_paths(base, raw))
    return joined


def expand_keywords(call: ast.Call, env: dict[str, Val], mod: Mod, cls: str) -> dict[str, Val]:
    out: dict[str, Val] = {}
    for keyword in call.keywords:
        if keyword.arg is None:
            val = eval_expr(keyword.value, env, mod, cls)
            if val.items:
                out.update(val.items)
            continue
        out[keyword.arg] = eval_expr(keyword.value, env, mod, cls)
    return out


def param_keys(val: Val | None) -> tuple[set[str], bool]:
    if not val:
        return set(), False
    keys = set(val.items or {})
    return keys, bool(val.dyn_keys)


def bind_args(func: Func, call: ast.Call, env: dict[str, Val], mod: Mod, cls: str) -> dict[str, Val]:
    args = getattr(func.node, "args", None)
    bound: dict[str, Val] = {}
    if not args:
        return bound
    names = [arg.arg for arg in args.args]
    if names and names[0] in {"self", "cls"}:
        names = names[1:]
    for name, node in zip(names, call.args):
        bound[name] = eval_expr(node, env, mod, cls)
    vararg = args.vararg.arg if args.vararg else ""
    kwname = args.kwarg.arg if args.kwarg else "kwargs"
    extra: dict[str, Val] = {}
    for keyword in call.keywords:
        val = eval_expr(keyword.value, env, mod, cls)
        if keyword.arg is None and val.items:
            extra.update(val.items)
            continue
        if keyword.arg in names:
            bound[keyword.arg] = val
        else:
            extra[keyword.arg] = val
    # An empty **kwargs still has to exist so kwargs.get("method", "post") can see the default.
    if args.kwarg:
        bound[kwname] = Val(items=extra)
    elif extra:
        bound[kwname] = Val(items=extra)
    if vararg:
        extra_pos = call.args[len(names) :]
        bound[vararg] = Val(seq=[eval_expr(arg, env, mod, cls) for arg in extra_pos if not isinstance(arg, ast.Starred)])
    return bound


def add_base(mod: Mod, path: str) -> None:
    normed = norm_path(path)
    if normed and normed not in mod.base_paths and static_segment(normed):
        mod.base_paths.append(normed)


def enum_path_pairs(tree: ast.AST) -> list[str]:
    """Join an enum tuple's API base and endpoint, such as ('/api/now/', 'table/sys_audit')."""
    routes: list[str] = []
    for node in ast.walk(tree):
        value = node.value if isinstance(node, ast.Assign) else None
        if not isinstance(value, ast.Tuple):
            continue
        texts = [elt.value for elt in value.elts if isinstance(elt, ast.Constant) and isinstance(elt.value, str)]
        for left, right in zip(texts, texts[1:]):
            if not left.startswith("/") or not right or right.startswith("/") or " " in right or right.startswith("last_"):
                continue
            joined = norm_path(left.rstrip("/") + "/" + right.lstrip("/"))
            if static_segment(joined) and joined not in routes:
                routes.append(joined)
    return routes


def concrete_path(val: Val) -> str:
    raw = val.path or ""
    if not raw or raw.lower() in {"/none", "/null"}:
        return ""
    if any(part.lower() in {"none", "null"} for part in raw.split("/")):
        return ""
    return raw


def concat_hole(val: Val, node: ast.expr) -> str:
    if val.hole:
        return val.hole
    if isinstance(node, ast.Name):
        return "{" + node.id + "}"
    if isinstance(node, ast.Subscript):
        key = literal_str(node.slice)
        if key:
            return "{" + key + "}"
    if isinstance(node, ast.Attribute):
        return "{" + node.attr + "}"
    return ""


def concat_text(left: Val, left_node: ast.expr, right: Val, right_node: ast.expr) -> str:
    """Keep a parameter between two literals. An empty base URL stays dropped."""
    if left.text and not right.text:
        return left.text + concat_hole(right, right_node)
    if right.text and not left.text:
        return right.text
    if not left.text and not right.text:
        return concat_hole(left, left_node) + concat_hole(right, right_node)
    return left.text + right.text


def eval_expr(node: ast.expr | None, env: dict[str, Val] | None, mod: Mod | None, cls: str) -> Val:
    env = env or {}
    if node is None:
        return Val(dynamic=True)
    if isinstance(node, ast.Constant):
        if isinstance(node.value, str):
            return Val(text=node.value, path=path_of(node.value) if node.value.startswith("http") else (node.value if node.value.startswith("/") else ""))
        return Val(text=str(node.value))
    if isinstance(node, ast.Name):
        if node.id in env:
            return env[node.id].copy()
        return Val(dynamic=True, hole="{" + node.id + "}", text="{" + node.id + "}")
    if isinstance(node, ast.Attribute):
        azure = azure_endpoint(node)
        if azure:
            return Val(text=azure, path=path_of(azure))
        if isinstance(node.value, ast.Name) and node.value.id == "Method" and node.attr.upper() in VERBS:
            return Val(text=node.attr.upper())
        if isinstance(node.value, ast.Name) and node.value.id == "self" and mod is not None:
            found = mod.class_attrs.get(cls, {}).get(node.attr)
            if found:
                return found.copy()
            return Val(dynamic=True, hole="{" + node.attr + "}", text="{" + node.attr + "}")
        if mod is not None and node.attr == "endpoint":
            owner = eval_expr(node.value, env, mod, cls)
            alts = endpoint_literals(mod, node.attr, owner.text)
            if alts:
                return Val(text=alts[0].text, path=alts[0].path, alts=alts if len(alts) > 1 else None)
        if mod is not None and isinstance(node.value, ast.Name) and node.value.id[:1].isupper():
            member = enum_member(mod, node.value.id, node.attr)
            if member:
                return Val(text=member)
        return Val(dynamic=True)
    if isinstance(node, ast.JoinedStr):
        parts = []
        path_parts = []
        for part in node.values:
            if isinstance(part, ast.Constant):
                parts.append(str(part.value))
                path_parts.append(str(part.value))
            elif isinstance(part, ast.FormattedValue):
                ev = eval_expr(part.value, env, mod, cls)
                # A leading ? is a query string. norm_path drops it, which keeps
                # the path that was verified before odata was appended.
                concrete = bool(ev.text) and "{" not in ev.text and not ev.dynamic
                if not ev.text:
                    if isinstance(part.value, ast.Constant):
                        continue
                    if isinstance(part.value, ast.Name):
                        hole = "{" + part.value.id + "}"
                    elif isinstance(part.value, ast.Attribute):
                        hole = "{" + part.value.attr + "}"
                    else:
                        hole = ev.hole or "{expr}"
                    parts.append(hole)
                    path_parts.append(hole)
                    continue
                if ev.text.startswith("?") or concrete or ev.text.startswith("http") or ev.text.startswith("/"):
                    parts.append(ev.text)
                    path_parts.append(ev.path or ev.text)
                elif ev.hole:
                    parts.append(ev.hole)
                    path_parts.append(ev.hole)
                elif isinstance(part.value, ast.Name):
                    hole = "{" + part.value.id + "}"
                    parts.append(hole)
                    path_parts.append(hole)
                elif isinstance(part.value, ast.Attribute):
                    hole = "{" + part.value.attr + "}"
                    parts.append(hole)
                    path_parts.append(hole)
                else:
                    parts.append("{expr}")
                    path_parts.append("{expr}")
            else:
                parts.append("{expr}")
                path_parts.append("{expr}")
        text = "".join(parts)
        path = text if text.startswith("/") or text.startswith("http") else ""
        if text.startswith("http"):
            path = path_of(text)
        return Val(text=text, path=path or (text if text.startswith("/") else ""), dynamic=False)
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        left = eval_expr(node.left, env, mod, cls)
        right = eval_expr(node.right, env, mod, cls)
        texts: list[str] = []
        for one in left.alts or [left]:
            for two in right.alts or [right]:
                for item in (f"{one.text}{two.text}", concat_text(one, node.left, two, node.right)):
                    if item and item not in texts and ("/" in item or item.startswith("http")):
                        texts.append(item)
                    if len(texts) >= 8:
                        break
        text = next((item for item in texts if "{" in item), texts[-1] if texts else "")
        path = path_of(text) if text.startswith("http") else (text if "/" in text else "")
        alts = None
        if len(texts) > 1:
            alts = [
                Val(text=item, path=path_of(item) if item.startswith("http") else (item if "/" in item else ""))
                for item in texts
            ]
        return Val(text=text, path=path, dynamic=left.dynamic and right.dynamic and not text, alts=alts)
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Mod):
        return percent_format(node, env, mod, cls)
    if isinstance(node, ast.Call):
        return eval_call_value(node, env, mod, cls)
    if isinstance(node, ast.Dict):
        items: dict[str, Val] = {}
        for key, value in zip(node.keys, node.values):
            if key is None or value is None:
                continue
            name = literal_str(key)
            if name:
                items[name] = eval_expr(value, env, mod, cls)
        return Val(items=items)
    if isinstance(node, ast.Subscript):
        owner = eval_expr(node.value, env, mod, cls)
        key = literal_str(node.slice)
        if owner.items is not None and key and key in owner.items:
            found = owner.items[key].copy()
            if owner.response:
                found.response = True
            return found
        if owner.response:
            return Val(dynamic=True, response=True, path=dot(owner.path, key) if key else owner.path, text=key)
        if key and owner.path:
            return Val(path=dot(owner.path, key), text=key)
        return Val(dynamic=True)
    if isinstance(node, ast.List):
        seq = [Val(text=elt.value) for elt in node.elts if isinstance(elt, ast.Constant) and isinstance(elt.value, str)]
        return Val(seq=seq)
    if isinstance(node, ast.BoolOp):
        values = [eval_expr(value, env, mod, cls) for value in node.values]
        chosen = next((value for value in values if value.response), None)
        if chosen is not None:
            return chosen.copy()
        return Val(dynamic=True)
    if isinstance(node, ast.IfExp):
        body = eval_expr(node.body, env, mod, cls)
        orelse = eval_expr(node.orelse, env, mod, cls)
        # full_url if full_url else urljoin(base, suffix): an empty full_url keeps the suffix.
        if concrete_path(orelse) and not concrete_path(body):
            chosen = orelse
        else:
            chosen = body if body.text or body.path or body.alts else orelse
        if not chosen.response and (body.response or orelse.response):
            chosen = chosen.copy()
            chosen.response = True
            if not chosen.path and not chosen.text:
                chosen.path = body.path if body.response else orelse.path
        if body.seq or orelse.seq:
            chosen = chosen.copy()
            chosen.alts = [item for item in (body, orelse) if item.seq]
            if not chosen.seq and chosen.alts:
                chosen.seq = list(chosen.alts[0].seq or [])
        return chosen
    return Val(dynamic=True)


def eval_call_value(node: ast.Call, env: dict[str, Val], mod: Mod | None, cls: str) -> Val:
    func = node.func
    if isinstance(func, ast.Name) and func.id == "urljoin" and len(node.args) >= 2 and mod is not None:
        return apply_urljoin(eval_expr(node.args[0], env, mod, cls), eval_expr(node.args[1], env, mod, cls), mod.style)
    if isinstance(func, ast.Attribute) and func.attr == "urljoin" and len(node.args) >= 1 and mod is not None:
        return apply_urljoin(eval_expr(func.value, env, mod, cls), eval_expr(node.args[0], env, mod, cls), "stdlib")
    if isinstance(func, ast.Name) and func.id in {"assign_params", "remove_empty_elements"} and node.args:
        inner = eval_expr(node.args[0], env, mod, cls)
        if inner.items is not None:
            return inner
    if isinstance(func, ast.Name) and func.id == "assign_params":
        items = {}
        for keyword in node.keywords:
            if keyword.arg and keyword.arg != "keys_to_ignore":
                items[keyword.arg] = eval_expr(keyword.value, env, mod, cls)
        return Val(items=items)
    if isinstance(func, ast.Attribute) and func.attr == "client" and node.args:
        service = literal_str(node.args[0])
        if service and owner_name(func.value) in {"boto3", "session"}:
            return Val(text="boto3:" + service)
    if isinstance(func, ast.Attribute) and func.attr == "_construct_url" and len(node.args) >= 4:
        path_val = eval_expr(node.args[3], env, mod, cls)
        suffix = path_val.path or path_val.text or path_val.hole
        if suffix and not suffix.startswith("/"):
            suffix = "/" + suffix
        return Val(text=suffix, path=norm_path(suffix) if suffix.startswith("/") else suffix)
    if isinstance(func, ast.Attribute) and func.attr == "format":
        return apply_format(eval_expr(func.value, env, mod, cls), node, env, mod, cls)
    if isinstance(func, ast.Attribute) and func.attr in {"removesuffix", "rstrip", "strip"}:
        return eval_expr(func.value, env, mod, cls)
    if isinstance(func, ast.Attribute) and func.attr == "get":
        owner = eval_expr(func.value, env, mod, cls)
        key = literal_str(node.args[0]) if node.args else ""
        if owner.items is not None and key and key in owner.items:
            return owner.items[key].copy()
        # kwargs.get("method", "post") is the verb when the caller did not pass one.
        if owner.items is not None and key and len(node.args) >= 2:
            return eval_expr(node.args[1], env, mod, cls)
        if key and mod is not None and is_demisto_params(func.value) and key in mod.yml_defaults:
            default = mod.yml_defaults[key]
            return Val(text=default, path=path_of(default) if default.startswith("http") else "")
        if key:
            path = dot(owner.path, key) if owner.response else ""
            return Val(dynamic=True, hole="{" + key + "}", text="{" + key + "}", response=owner.response, path=path)
        return Val(dynamic=True, response=owner.response)
    if isinstance(func, ast.Attribute) and func.attr == "json" and node.args == []:
        return eval_expr(func.value, env, mod, cls)
    return Val(dynamic=True)


def percent_format(node: ast.BinOp, env: dict[str, Val] | None, mod: Mod | None, cls: str) -> Val:
    """Turn ``"table/%s" % name`` and ``"%(path)s" % values`` into a path template.

    The conversion specifiers become ``{name}`` holes so they match preset path params.
    """
    left = eval_expr(node.left, env, mod, cls)
    text = left.text or left.path
    holes: list[str] = []
    if isinstance(node.right, ast.Tuple):
        for elt in node.right.elts:
            holes.append(hole_from(eval_expr(elt, env, mod, cls), elt))
    elif isinstance(node.right, ast.Name):
        holes.append("{" + node.right.id + "}")
    elif isinstance(node.right, ast.Dict):
        mapping = {}
        for key, value in zip(node.right.keys, node.right.values):
            if key is None or value is None:
                continue
            name = literal_str(key)
            if name:
                mapping[name] = hole_from(eval_expr(value, env, mod, cls), value)
        text = re.sub(r"%\(([^)]+)\)[-+0-9.]*[sdifr]", lambda match: mapping.get(match.group(1), "{arg}"), text)
    if holes:
        for hole in holes:
            text = re.sub(r"%[-+0-9.]*[sdifr]", hole, text, count=1)
    path = path_of(text) if text.startswith("http") else (text if text.startswith("/") or "/" in text else "")
    return Val(text=text, path=norm_path(path) if path.startswith("/") else path)


def apply_format(base: Val, node: ast.Call, env: dict[str, Val] | None, mod: Mod | None, cls: str) -> Val:
    """Replace ``{}`` holes from ``url.format(region)`` and leave the path."""
    text = base.text or base.path
    for arg in node.args:
        text = text.replace("{}", hole_from(eval_expr(arg, env, mod, cls), arg), 1)
    path = path_of(text) if text.startswith("http") else (text if "/" in text else "")
    return Val(text=text, path=norm_path(path) if path.startswith("/") else path)


def hole_from(value: Val, node: ast.expr) -> str:
    if value.text and "{" not in value.text:
        return value.text
    if value.hole:
        return value.hole
    if isinstance(node, ast.Name):
        return "{" + node.id + "}"
    if isinstance(node, ast.Attribute):
        return "{" + node.attr + "}"
    if value.text:
        return value.text
    return "{arg}"


def emit_sdk(call: ast.Call, env: dict[str, Val], mod: Mod, func: Func) -> bool:
    """Map SDK calls onto the REST endpoints those libraries send.

    Splunk: splunklib JobCollection.create/oneshot and Job.results
    (https://github.com/splunk/splunk-sdk-python/blob/master/splunklib/client.py).
    Slack: slack_sdk WebClient posts to https://slack.com/api/{family.method},
    with GET for the read methods that pass http_verb=\"GET\"
    (https://github.com/slackapi/python-slack-sdk/blob/main/slack_sdk/web/client.py).
    Google: googleapiclient discovery chains such as users().messages().list().execute()
    (https://developers.google.com/gmail/api/reference/rest/v1/users.messages/list and
    https://developers.google.com/admin-sdk/directory/reference/rest/v1/users/list).
    """
    found: tuple[str, str] | None = None
    if "splunk" in mod.sdks:
        found = splunk_endpoint(call)
    if found is None and "slack" in mod.sdks:
        found = slack_endpoint(call, env, mod, func.cls)
    if found is None and "google" in mod.sdks:
        found = google_endpoint(call, env)
    if found is None and "elastic" in mod.sdks:
        found = elastic_endpoint(call)
    if found is None and "greynoise" in mod.sdks:
        found = greynoise_endpoint(call, mod)
    if found is None and "lacework" in mod.sdks:
        found = lacework_endpoint(call)
    if found is None:
        return False
    method, path = found
    store_call(
        mod,
        {"method": method, "paths": [path], "params": [], "dynamic": False, "func": func.qual, "boto3": False},
    )
    return True


def splunk_endpoint(call: ast.Call) -> tuple[str, str] | None:
    func = call.func
    if not isinstance(func, ast.Attribute):
        return None
    if func.attr in {"create", "oneshot"} and isinstance(func.value, ast.Attribute) and func.value.attr == "jobs":
        if func.attr == "oneshot":
            return ("POST", "/services/search/jobs/oneshot")
        return ("POST", "/services/search/jobs")
    if func.attr == "results":
        return ("GET", "/services/search/jobs/{sid}/results")
    return None


SLACK_GET = {
    "conversations_history",
    "conversations_list",
    "conversations_replies",
    "conversations_info",
    "users_info",
    "users_list",
    "users_lookupByEmail",
    "files_info",
}


def slack_endpoint(call: ast.Call, env: dict[str, Val], mod: Mod, cls: str) -> tuple[str, str] | None:
    name = call_name(call)
    if name in {"api_call", "send_slack_request_sync"}:
        explicit = slack_explicit_method(call, env, mod, cls)
        if explicit:
            return explicit
    func = call.func
    if not isinstance(func, ast.Attribute):
        return None
    if func.attr.startswith("_") or func.attr in {"api_call", "session"}:
        return None
    owner = func.value.id if isinstance(func.value, ast.Name) else ""
    if owner not in {"CLIENT", "USER_CLIENT", "ASYNC_CLIENT", "client"}:
        return None
    head, _, tail = func.attr.partition("_")
    if head not in {"chat", "conversations", "users", "files", "auth", "reactions", "views", "pins"}:
        return None
    api = f"{head}.{tail}" if tail else head
    method = "GET" if func.attr in SLACK_GET else "POST"
    return (method, f"/api/{api}")


def slack_explicit_method(call: ast.Call, env: dict[str, Val], mod: Mod, cls: str) -> tuple[str, str] | None:
    """send_slack_request_sync(client, \"conversations.history\", http_verb=\"GET\") and api_call(method)."""
    verb = "POST"
    method_name = ""
    for keyword in call.keywords:
        if keyword.arg == "http_verb":
            text = literal_str(keyword.value) or eval_expr(keyword.value, env, mod, cls).text
            if text:
                verb = text.upper()
        if keyword.arg == "method":
            method_name = literal_str(keyword.value) or eval_expr(keyword.value, env, mod, cls).text
    if call_name(call) == "send_slack_request_sync" and len(call.args) >= 2:
        method_name = literal_str(call.args[1]) or eval_expr(call.args[1], env, mod, cls).text
    if call_name(call) == "api_call" and call.args and not method_name:
        method_name = literal_str(call.args[0]) or eval_expr(call.args[0], env, mod, cls).text
    if not method_name or " " in method_name or method_name.startswith("{"):
        return None
    return (verb, "/api/" + method_name.lstrip("/"))


GMAIL_METHODS = {
    ("users", "messages", "list"): ("GET", "/gmail/v1/users/{userId}/messages"),
    ("users", "messages", "get"): ("GET", "/gmail/v1/users/{userId}/messages/{id}"),
    ("users", "messages", "send"): ("POST", "/gmail/v1/users/{userId}/messages/send"),
    ("users", "messages", "attachments", "get"): ("GET", "/gmail/v1/users/{userId}/messages/{messageId}/attachments/{id}"),
    ("users", "getProfile"): ("GET", "/gmail/v1/users/{userId}/profile"),
}
DIRECTORY_METHODS = {
    ("users", "list"): ("GET", "/admin/directory/v1/users"),
    ("users", "get"): ("GET", "/admin/directory/v1/users/{userKey}"),
    ("users", "update"): ("PUT", "/admin/directory/v1/users/{userKey}"),
}
# https://cloud.google.com/compute/docs/reference/rest/v1/instances/list
COMPUTE_METHODS = {
    ("instances", "list"): ("GET", "/compute/v1/projects/{project}/zones/{zone}/instances"),
    ("instances", "get"): ("GET", "/compute/v1/projects/{project}/zones/{zone}/instances/{instance}"),
    ("instances", "insert"): ("POST", "/compute/v1/projects/{project}/zones/{zone}/instances"),
}
# https://cloud.google.com/resource-manager/docs/reference/rest/v3/tagBindings/list
# https://cloud.google.com/iam/docs/reference/rest/v1/projects.serviceAccounts/list
IAM_METHODS = {
    ("tagBindings", "list"): ("GET", "/v3/tagBindings"),
    ("tagValues", "get"): ("GET", "/v3/{name}"),
    ("tagKeys", "get"): ("GET", "/v3/{name}"),
    ("projects", "serviceAccounts", "list"): ("GET", "/v1/projects/{project}/serviceAccounts"),
    ("projects", "serviceAccounts", "get"): ("GET", "/v1/{name}"),
}


def google_endpoint(call: ast.Call, env: dict[str, Val] | None = None) -> tuple[str, str] | None:
    if not isinstance(call.func, ast.Attribute):
        return None
    if call.func.attr not in {"execute", "list", "get", "insert"}:
        return None
    attrs = chain_attrs(call)
    if attrs and attrs[-1] == "execute" and call.func.attr == "execute":
        attrs = attrs[:-1]
    if (not attrs or attrs == ["execute"]) and env is not None and isinstance(call.func.value, ast.Name):
        stored = env.get(call.func.value.id)
        if stored and stored.chain:
            attrs = list(stored.chain)
    key = tuple(attrs)
    # organizations().sources().findings().list()
    # https://cloud.google.com/security-command-center/docs/reference/rest/v1/organizations.sources.findings/list
    if key == ("organizations", "sources", "findings", "list"):
        return ("GET", "/v1/organizations/{organization}/sources/{source}/findings")
    if "messages" in key or "getProfile" in key:
        return GMAIL_METHODS.get(key)
    if "instances" in key:
        return COMPUTE_METHODS.get(key)
    if "tagBindings" in key or "serviceAccounts" in key or "tagValues" in key or "tagKeys" in key:
        return IAM_METHODS.get(key)
    return DIRECTORY_METHODS.get(key)


def discovery_chain(call: ast.Call) -> tuple[str, ...] | None:
    """Remember service.instances().list() so a later request.execute() still has the route."""
    if not isinstance(call.func, ast.Attribute) or call.func.attr == "execute":
        return None
    attrs = chain_attrs(call)
    if len(attrs) < 2:
        return None
    return tuple(attrs)


def elastic_endpoint(call: ast.Call) -> tuple[str, str] | None:
    """elasticsearch.Elasticsearch.search sends POST /{index}/_search.

    https://www.elastic.co/guide/en/elasticsearch/reference/current/search-search.html
    """
    func = call.func
    if not isinstance(func, ast.Attribute) or func.attr != "search":
        return None
    if isinstance(func.value, ast.Attribute) and func.value.attr == "eql":
        return ("POST", "/{index}/_eql/search")
    return ("POST", "/{index}/_search")


def greynoise_endpoint(call: ast.Call, mod: Mod) -> tuple[str, str] | None:
    """GreyNoise.ip is the v2 noise-context route. The community integration uses v3.

    https://docs.greynoise.io/reference/get_v2-noise-context-ip
    https://docs.greynoise.io/reference/get_v3-community-ip
    """
    func = call.func
    if not isinstance(func, ast.Attribute) or func.attr != "ip":
        return None
    if "GreyNoise_Community" in str(mod.path):
        return ("GET", "/v3/community/{ip}")
    return ("GET", "/v2/noise/context/{ip}")


def lacework_endpoint(call: ast.Call) -> tuple[str, str] | None:
    """laceworksdk alerts.get is GET /api/v2/Alerts.

    https://docs.lacework.net/api/v2/docs/#tag/Alerts
    """
    func = call.func
    if (
        isinstance(func, ast.Attribute)
        and func.attr == "get"
        and isinstance(func.value, ast.Attribute)
        and func.value.attr == "alerts"
    ):
        return ("GET", "/api/v2/Alerts")
    return None


def azure_endpoint(node: ast.Attribute) -> str:
    """Worldwide cloud endpoints from MicrosoftApiModule.AZURE_WORLDWIDE_CLOUD.

    Packs/ApiModules/Scripts/MicrosoftApiModule/MicrosoftApiModule.py
    """
    chain: list[str] = []
    current: ast.AST | None = node
    while isinstance(current, ast.Attribute):
        chain.append(current.attr)
        current = current.value
    if not chain:
        return ""
    endpoints = {
        "log_analytics_resource_id": "https://api.loganalytics.io",
        "resource_manager": "https://management.azure.com",
        "active_directory": "https://login.microsoftonline.com",
        "microsoft_graph_resource_id": "https://graph.microsoft.com",
    }
    return endpoints.get(chain[0], "")


def is_demisto_params(node: ast.AST) -> bool:
    return isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "params"


def load_yml_defaults(py_path: Path) -> dict[str, str]:
    defaults: dict[str, str] = {}
    for yml in py_path.parent.glob("*.yml"):
        pending = ""
        for line in yml.read_text(encoding="utf-8", errors="replace").splitlines():
            value = re.search(r"defaultvalue:\s*(.+)", line)
            if value:
                pending = value.group(1).strip().strip("'\"")
                continue
            name = re.search(r"(?:^|\s)name:\s*([A-Za-z0-9_]+)", line)
            if name and pending:
                defaults[name.group(1)] = pending
                pending = ""
    return defaults


def chain_attrs(node: ast.AST) -> list[str]:
    attrs: list[str] = []
    current: ast.AST | None = node
    while isinstance(current, ast.Call) and isinstance(current.func, ast.Attribute):
        attrs.append(current.func.attr)
        current = current.func.value
    attrs.reverse()
    return attrs


def note_request_object(node: ast.expr, env: dict[str, Val], mod: Mod, func: Func) -> None:
    """Mimecast's collector returns a request dict that IntegrationHTTPRequest sends."""
    if not func.name.startswith("get_req_object"):
        return
    value = env.get(node.id) if isinstance(node, ast.Name) else eval_expr(node, env, mod, func.cls)
    if not value or not value.items:
        return
    method = value.items.get("method")
    url = value.items.get("url")
    if not method or not url or method.text.upper() not in VERBS:
        return
    raw = url.path or url.text
    if raw.startswith("http"):
        raw = path_of(raw)
    path = norm_path(raw) if raw else ""
    if not path or not static_segment(path):
        return
    store_call(
        mod,
        {
            "method": method.text.upper(),
            "paths": [path],
            "params": [],
            "dynamic": False,
            "func": func.qual,
            "boto3": False,
        },
    )


def endpoint_literals(mod: Mod, name: str, owner: str = "") -> list[Val]:
    """String paths returned by a property such as Mimecast EventTypes.endpoint.

    When the owner is an enum value (``siem``), only that entry is returned so a
    GET call is not also recorded against the audit route.
    """
    found: list[Val] = []
    seen: set[str] = set()
    for func in mod.by_short.get(name, []):
        for node in ast.walk(func.node):
            if not isinstance(node, ast.Dict):
                continue
            pairs = list(zip(node.keys, node.values))
            if owner and not owner.startswith("{"):
                matched = [
                    (key, value)
                    for key, value in pairs
                    if isinstance(key, ast.Constant) and key.value == owner
                ]
                if matched:
                    pairs = matched
            for _key, value in pairs:
                if isinstance(value, ast.Constant) and isinstance(value.value, str) and value.value.startswith("/"):
                    path = norm_path(value.value)
                    if path not in seen:
                        seen.add(path)
                        found.append(Val(text=value.value, path=path))
    return found


def enum_member(mod: Mod, class_name: str, attr: str) -> str:
    cached = getattr(enum_member, "_cache", None)
    if cached is None:
        cached = {}
        setattr(enum_member, "_cache", cached)
    key = (str(mod.path), class_name, attr)
    if key in cached:
        return cached[key]
    found = ""
    try:
        tree = ast.parse(mod.path.read_text(encoding="utf-8", errors="replace"))
    except SyntaxError:
        cached[key] = ""
        return ""
    for item in getattr(tree, "body", []):
        if not isinstance(item, ast.ClassDef) or item.name != class_name:
            continue
        for stmt in item.body:
            target = None
            value = None
            if isinstance(stmt, ast.Assign) and stmt.targets:
                target = stmt.targets[0]
                value = stmt.value
            elif isinstance(stmt, ast.AnnAssign):
                target = stmt.target
                value = stmt.value
            if (
                isinstance(target, ast.Name)
                and target.id == attr
                and isinstance(value, ast.Constant)
                and isinstance(value.value, str)
            ):
                found = value.value
                break
    cached[key] = found
    return found


def apply_urljoin(base: Val, suffix: Val, style: str) -> Val:
    if suffix.alts:
        joined = [apply_urljoin(base, alt, style) for alt in suffix.alts]
        first = joined[0]
        return Val(text=first.text, path=first.path, dynamic=first.dynamic, alts=joined)
    suf = suffix.path or suffix.text or suffix.hole
    if not suf and suffix.dynamic:
        return Val(dynamic=True)
    if suf.startswith("http://") or suf.startswith("https://"):
        return Val(text=suf, path=path_of(suf))
    if style == "stdlib" and suf.startswith("/"):
        return Val(text=suf, path=norm_path(suf))
    base_path = base.path or (path_of(base.text) if base.text.startswith("http") else (base.text if base.text.startswith("/") else ""))
    if not base_path:
        if suf.startswith("/"):
            return Val(text=suf, path=norm_path(suf), dynamic=base.dynamic)
        hole = suf if suf.startswith("{") else suf
        path = "/" + hole if hole else ""
        return Val(text=path, path=norm_path(path) if path else "", dynamic=base.dynamic)
    return Val(path=xsoar_join_paths(base_path, suf), text=xsoar_join_paths(base_path, suf))


def xsoar_join_paths(base: str, suffix: str) -> str:
    base_path = base if base.startswith("/") else "/" + base
    if not base_path.endswith("/"):
        base_path += "/"
    suf = suffix[1:] if suffix.startswith("/") else suffix
    return norm_path(base_path + suf)


def path_of(url: str) -> str:
    if not url:
        return ""
    if url.startswith("/"):
        return norm_path(url.split("?", 1)[0])
    parsed = urllib.parse.urlparse(url)
    if not parsed.scheme:
        return ""
    return norm_path(parsed.path or "/")


def norm_path(path: str) -> str:
    path = path.split("?", 1)[0]
    path = re.sub(r"/{2,}", "/", path)
    if not path.startswith("/"):
        path = "/" + path
    if len(path) > 1:
        path = path.rstrip("/")
    return path


def literal_str(node: ast.expr) -> str:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return ""


def call_name(call: ast.Call) -> str:
    func = call.func
    if isinstance(func, ast.Name):
        return func.id
    if isinstance(func, ast.Attribute):
        return func.attr
    return ""


def owner_name(node: ast.expr) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    return ""


def static_segment(path: str) -> bool:
    for segment in segments(path):
        if not (segment.startswith("{") and segment.endswith("}")):
            return True
    return False


def segments(path: str) -> list[str]:
    return [part for part in norm_path(path).split("/") if part]


def dot(prefix: str, key: str) -> str:
    return f"{prefix}.{key}" if prefix else key


def read_paths(node: ast.expr, env: dict[str, Val]) -> list[str]:
    found: list[str] = []

    def walk(current: ast.expr, prefix: str) -> None:
        if isinstance(current, ast.Call) and isinstance(current.func, ast.Attribute) and current.func.attr == "get":
            key = literal_str(current.args[0]) if current.args else ""
            owner = current.func.value
            if key and tracked(owner, env):
                path = dot(prefix_of(owner, env, prefix), key)
                found.append(path)
                return
        if isinstance(current, ast.Subscript):
            key = literal_str(current.slice)
            if key and tracked(current.value, env):
                path = dot(prefix_of(current.value, env, prefix), key)
                found.append(path)
                return
        if isinstance(current, ast.Attribute) and current.attr == "get":
            return
        for child in ast.iter_child_nodes(current):
            if isinstance(child, ast.expr):
                walk(child, prefix)

    walk(node, "")
    return found


def tracked(node: ast.expr, env: dict[str, Val]) -> bool:
    if isinstance(node, ast.Name):
        if node.id in {"args", "params", "demisto", "self", "kwargs", "headers", "query", "query_params"}:
            return False
        if READ_IGNORE.search(node.id) and node.id not in env:
            return False
        return True
    if isinstance(node, ast.Call) or isinstance(node, ast.Subscript) or isinstance(node, ast.Attribute):
        return True
    return False


def prefix_of(node: ast.expr, env: dict[str, Val], fallback: str) -> str:
    if isinstance(node, ast.Name) and node.id in env and env[node.id].path:
        return env[node.id].path
    if isinstance(node, ast.Subscript):
        key = literal_str(node.slice)
        if key:
            return dot(prefix_of(node.value, env, ""), key)
        # response["value"][0] still names the list the index came from.
        return prefix_of(node.value, env, fallback)
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "get" and node.args:
        key = literal_str(node.args[0])
        if key:
            return dot(prefix_of(node.func.value, env, ""), key)
    return fallback


def indexed_lists(node: ast.expr, env: dict[str, Val]) -> list[str]:
    found: list[str] = []

    def walk(current: ast.expr) -> None:
        if isinstance(current, ast.Subscript):
            if numeric_index(current.slice):
                path = prefix_of(current.value, env, "")
                if path:
                    found.append(path)
            walk(current.value)
            return
        if isinstance(current, ast.Call) and isinstance(current.func, ast.Attribute) and current.func.attr in {"get", "json", "pop"}:
            walk(current.func.value)
            return
        if isinstance(current, ast.Attribute) and current.attr == "json":
            walk(current.value)
            return
        if isinstance(current, ast.BoolOp):
            for value in current.values:
                walk(value)
            return
        for child in ast.iter_child_nodes(current):
            if isinstance(child, ast.expr):
                walk(child)

    walk(node)
    return found


def load_test_data(folder: Path) -> tuple[set[str], dict[str, set[str]]]:
    paths: set[str] = set()
    types: dict[str, set[str]] = {}
    files = sorted(folder.glob("test_data/**/*.json"))[:40]
    files += sorted(folder.glob("test_data/*.json"))[:40]
    seen: set[Path] = set()
    for path in files:
        if path in seen or path.stat().st_size > 250_000:
            continue
        seen.add(path)
        try:
            data = json.loads(path.read_text(encoding="utf-8", errors="replace"))
        except json.JSONDecodeError:
            continue
        walk_json(data, "", paths, types, 0)
    return paths, types


def walk_json(data: object, prefix: str, paths: set[str], types: dict[str, set[str]], depth: int) -> None:
    if depth > 5:
        return
    if isinstance(data, dict):
        if prefix:
            types.setdefault(prefix, set()).add("dict")
        for key, value in data.items():
            if not isinstance(key, str) or not re.match(r"^[A-Za-z0-9_.:@$-]{1,80}$", key):
                continue
            path = dot(prefix, key)
            paths.add(path)
            types.setdefault(path, set()).add(json_type(value))
            walk_json(value, path, paths, types, depth + 1)
        return
    if isinstance(data, list):
        if prefix:
            types.setdefault(prefix, set()).add("list")
            paths.add(prefix)
        for item in data[:5]:
            walk_json(item, prefix, paths, types, depth + 1)


def json_type(value: object) -> str:
    if isinstance(value, list):
        return "list"
    if isinstance(value, dict):
        return "dict"
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return "number"
    return "string"


_FIXTURE_CACHE: dict[str, dict[str, tuple[set[str], dict[str, set[str]]]]] = {}
_JSON_CACHE: dict[str, tuple[set[str], dict[str, set[str]]]] = {}
_GENERIC_FIXTURES = {
    "data",
    "items",
    "value",
    "values",
    "result",
    "results",
    "response",
    "output",
    "outputs",
    "content",
    "contents",
    "body",
    "raw",
    "mock",
    "expected",
    "input",
    "inputs",
}


def fixture_folders(folder: Path, modules: list[Mod]) -> list[Path]:
    found = [folder]
    seen = {folder.resolve()}
    for mod in modules:
        parent = mod.path.parent
        resolved = parent.resolve()
        if resolved in seen:
            continue
        seen.add(resolved)
        found.append(parent)
    return found


def unwrap_fixture(data: object) -> object:
    if isinstance(data, dict) and "Contents" in data and any(key in data for key in ("Type", "HumanReadable", "EntryContext")):
        return data["Contents"]
    return data


def walked_json(path: Path) -> tuple[set[str], dict[str, set[str]]]:
    key = str(path)
    cached = _JSON_CACHE.get(key)
    if cached is not None:
        return cached
    paths: set[str] = set()
    types: dict[str, set[str]] = {}
    try:
        if path.stat().st_size > 250_000:
            result = (paths, types)
            _JSON_CACHE[key] = result
            return result
        data = unwrap_fixture(json.loads(path.read_text(encoding="utf-8", errors="replace")))
    except (OSError, json.JSONDecodeError):
        result = (paths, types)
        _JSON_CACHE[key] = result
        return result
    walk_json(data, "", paths, types, 0)
    result = (paths, types)
    _JSON_CACHE[key] = result
    return result


def usable_fixture(path: Path) -> bool:
    stem = path.stem.lower()
    if stem.startswith("expected") or "input" in stem:
        return False
    return True


def name_tokens(text: str) -> set[str]:
    tokens: set[str] = set()
    for part in re.split(r"[^A-Za-z0-9]+", text):
        for piece in re.findall(r"[A-Z]?[a-z0-9]+|[A-Z]+(?![a-z])", part):
            token = piece.lower()
            if len(token) >= 5:
                tokens.add(token)
    return tokens


def referenced_names(node: ast.AST) -> set[str]:
    names: set[str] = set()
    for child in ast.walk(node):
        if isinstance(child, ast.Name):
            names.add(child.id)
        elif isinstance(child, ast.Attribute):
            names.add(child.attr)
    return names


def json_literals(node: ast.AST, folder: Path, by_stem: dict[str, Path]) -> list[Path]:
    found: list[Path] = []
    for child in ast.walk(node):
        if not isinstance(child, ast.Constant) or not isinstance(child.value, str):
            continue
        text = child.value.replace("\\", "/")
        if not text.endswith(".json"):
            continue
        base = text.split("/")[-1]
        stem = base[:-5]
        path = by_stem.get(stem)
        if path is None:
            candidate = folder / "test_data" / base
            if candidate.is_file() and usable_fixture(candidate):
                path = candidate
        if path is not None and path not in found:
            found.append(path)
    return found


def command_fixtures(folder: Path) -> dict[str, tuple[set[str], dict[str, set[str]]]]:
    """Map a command or client method name to the test_data JSON that command loads."""
    if not folder.exists():
        return {}
    key = str(folder.resolve())
    cached = _FIXTURE_CACHE.get(key)
    if cached is not None:
        return cached
    files_for: dict[str, list[Path]] = {}

    def add(name: str, path: Path) -> None:
        if not name or name.startswith("test_") or len(name) < 4:
            return
        bucket = files_for.setdefault(name, [])
        if path not in bucket:
            bucket.append(path)

    json_files = [path for path in sorted(folder.glob("test_data/**/*.json")) if usable_fixture(path)]
    by_stem = {path.stem: path for path in json_files}
    for stem, path in by_stem.items():
        if len(stem) >= 5 and stem.lower() not in _GENERIC_FIXTURES:
            add(stem, path)
            if not stem.endswith("_command"):
                add(f"{stem}_command", path)
    tests = sorted(folder.glob("*_test.py")) + sorted(folder.glob("test_*.py")) + sorted(folder.glob("*_test/**/*.py"))
    seen_tests: set[Path] = set()
    for test_path in tests:
        if test_path in seen_tests:
            continue
        seen_tests.add(test_path)
        try:
            if test_path.stat().st_size > 1_500_000:
                continue
            tree = ast.parse(test_path.read_text(encoding="utf-8", errors="replace"))
        except (OSError, SyntaxError):
            continue
        for node in ast.walk(tree):
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) or not node.name.startswith("test_"):
                continue
            referenced = referenced_names(node)
            literals = json_literals(node, folder, by_stem)
            commands = sorted(name for name in referenced if name.endswith("_command"))
            if len(commands) == 1:
                for path in literals:
                    add(commands[0], path)
            elif commands:
                for name in commands:
                    tokens = name_tokens(name)
                    for path in literals:
                        if tokens & name_tokens(path.stem):
                            add(name, path)
            else:
                stripped = node.name[5:]
                tokens = name_tokens(stripped)
                for path in literals:
                    if path.stem in {stripped, stripped.removesuffix("_command")} or tokens & name_tokens(path.stem):
                        add(stripped, path)
                for name in referenced:
                    if name.startswith("test"):
                        continue
                    tokens = name_tokens(name)
                    for path in literals:
                        if tokens & name_tokens(path.stem):
                            add(name, path)
    index: dict[str, tuple[set[str], dict[str, set[str]]]] = {}
    for name, paths in files_for.items():
        merged: set[str] = set()
        kinds: dict[str, set[str]] = {}
        for path in paths:
            got_paths, got_types = walked_json(path)
            merged |= got_paths
            for item, values in got_types.items():
                kinds.setdefault(item, set()).update(values)
        index[name] = (merged, kinds)
    _FIXTURE_CACHE[key] = index
    return index


def fixture_scope(
    calls: list[HttpCall],
    fixtures: list[dict[str, tuple[set[str], dict[str, set[str]]]]],
) -> tuple[set[str], dict[str, set[str]]]:
    paths: set[str] = set()
    types: dict[str, set[str]] = {}
    seen: set[str] = set()
    for call in calls:
        quals = scope_stack(call.stack) or ((call.func,) if call.func else tuple())
        for qual in quals:
            name = qual.split(".")[-1]
            if name in seen:
                continue
            seen.add(name)
            for index in fixtures:
                got = index.get(name)
                if not got:
                    continue
                paths |= got[0]
                for key, values in got[1].items():
                    types.setdefault(key, set()).update(values)
    return paths, types


def folder_source(folder: Path) -> str:
    parts = []
    for path in sorted(folder.glob("*.py")):
        if path.name.endswith("_test.py") or path.name.startswith("test_"):
            continue
        parts.append(path.read_text(errors="replace"))
    return "\n".join(parts)


def operation_action(operation: dict) -> str:
    action = str(operation.get("awsAction") or "")
    if action:
        return action
    query = operation.get("queryMatch") or {}
    if isinstance(query, dict) and query.get("Action"):
        return str(query["Action"])
    headers = operation.get("headerMatch") or {}
    if isinstance(headers, dict):
        for key, value in headers.items():
            if str(key).lower() == "x-amz-target" and isinstance(value, str) and "." in value:
                return value.rsplit(".", 1)[-1]
    return ""


def snake_action(action: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", action).lower()


def action_mentioned(action: str, source_text: str) -> bool:
    """True when the integration calls this boto3 method, including CreateIPSet vs create_ip_set."""
    snake_name = snake_action(action)
    if snake_name in source_text:
        return True
    target = snake_name.replace("_", "")
    if len(target) < 6:
        return False
    return any(token.replace("_", "").lower() == target for token in re.findall(r"[A-Za-z_][A-Za-z0-9_]{5,}", source_text))


def check_operation(
    operation: dict,
    calls: list[HttpCall],
    fixtures: list[dict[str, tuple[set[str], dict[str, set[str]]]]],
    skip_fields: bool = False,
    source_text: str = "",
) -> list[str]:
    method = str(operation.get("method", "")).upper()
    preset_path = norm_path(str(operation.get("pathTemplate", "/")))
    matched = [call for call in calls if call.method == method and any(paths_match(preset_path, path) for path in call.paths)]
    findings = []
    label = f"{method} {preset_path}"
    action = operation_action(operation)
    if action:
        by_action = [call for call in calls if call.boto3 and call.action == action]
        if by_action:
            matched = by_action
        elif not matched and action_mentioned(action, source_text):
            # boto3 method call. The wire path comes from the AWS action, not a REST url_suffix.
            return []
    if not matched:
        query = operation.get("queryMatch") or {}
        headers = operation.get("headerMatch") or {}
        guessed_shape = (
            not action
            and not operation.get("fixture")
            and not query
            and not headers
            and ("boto3" in source_text or "aws_session" in source_text)
        )
        if guessed_shape:
            return []
        same = [call for call in calls if call.method == method]
        pool = same or calls
        hint, score = best_aligned(preset_path, pool)
        findings.append(f"path: {label} is not a client call. Closest: {hint or 'none'} ({score}).")
        return findings
    if not paging_ok(operation, matched):
        client_params = sorted({key for call in matched for key in call.params})
        style = operation.get("pagination", {}).get("style", "none")
        findings.append(
            f"paging: {label} says {style} {paging_names(operation)} but the client sends {client_params or 'no paging params'}."
        )
    if (
        not skip_fields
        and operation.get("envelope", {}).get("type") not in SKIP_FIELD_ENVELOPES
        and not all(call.boto3 for call in matched)
    ):
        test_paths, test_types = fixture_scope(matched, fixtures)
        findings.extend(field_findings(label, operation, matched, test_paths, test_types))
    return findings


def paths_match(preset: str, client: str) -> bool:
    if norm_path(preset) == norm_path(client):
        return True
    left, right = segments(preset), segments(client)
    if len(left) != len(right) or not left:
        return False
    return all(segment_match(one, two) for one, two in zip(left, right))


def segment_match(left: str, right: str) -> bool:
    if left == right:
        return True
    if "{" not in left and "{" not in right:
        return False
    return bool(re.fullmatch(segment_regex(left), right) or re.fullmatch(segment_regex(right), left))


def segment_regex(text: str) -> str:
    parts = re.split(r"(\{[^}]+\})", text)
    pattern = ""
    for part in parts:
        if part.startswith("{") and part.endswith("}"):
            pattern += ".+"
        else:
            pattern += re.escape(part)
    return pattern


def best_aligned(preset: str, calls: list[HttpCall]) -> tuple[str, int]:
    best = ""
    score = -1
    for call in calls:
        for path in call.paths:
            if re.search(r"oauth|/token|login|logout|whoami|authorize", path, re.I):
                continue
            current = suffix_score(preset, path)
            if current > score:
                score = current
                best = path
    return best, max(score, 0)


def suffix_score(preset: str, client: str) -> int:
    score = 0
    for one, two in zip(reversed(segments(preset)), reversed(segments(client))):
        if "{" in one or "{" in two:
            continue
        if one == two:
            score += 1
            continue
        break
    return score


def true_suffix(preset: str, client: str) -> bool:
    left, right = segments(preset), segments(client)
    if not left or not right:
        return False
    short, long = (left, right) if len(left) <= len(right) else (right, left)
    if len(short) < 2:
        return False
    tail = long[-len(short) :]
    for one, two in zip(short, tail):
        if "{" in one or "{" in two:
            continue
        if one != two:
            return False
    return True


def concretize(preset: str, client: str) -> str:
    ps, cs = segments(preset), segments(client)
    offset = len(cs) - len(ps)
    parts = []
    for index, client_segment in enumerate(cs):
        preset_index = index - offset
        preset_segment = ps[preset_index] if 0 <= preset_index < len(ps) else ""
        if preset_segment and "{" not in preset_segment and "{" in client_segment:
            parts.append(preset_segment)
        else:
            parts.append(client_segment)
    return "/" + "/".join(parts)


def usable_path(path: str) -> bool:
    if not path or path == "/":
        return False
    if ":{" in path or "{odata" in path or "{end_" in path or "{url}" in path or "{server}" in path:
        return False
    return static_segment(path)


def replacement_for(preset_path: str, calls: list[HttpCall], method: str) -> str | None:
    best = ""
    score = 1
    ambiguous = False
    for call in calls:
        if call.method != method:
            continue
        for path in call.paths:
            if not usable_path(path) or not true_suffix(preset_path, path):
                continue
            current = suffix_score(preset_path, path)
            if current < 2:
                continue
            if current > score:
                score = current
                best = path
                ambiguous = False
            elif current == score and path != best:
                ambiguous = True
    if not best or ambiguous:
        return None
    proposed = concretize(preset_path, best)
    if not usable_path(proposed) or norm_path(proposed) == norm_path(preset_path):
        return None
    return proposed


def closest(preset: str, paths: list[str]) -> str:
    best = ""
    score = -1
    want = segments(preset)
    for path in paths:
        have = segments(path)
        overlap = len(set(want) & {part for part in have if "{" not in part})
        if overlap > score:
            score = overlap
            best = path
    return best


def paging_names(operation: dict) -> str:
    page = operation.get("pagination") or {}
    style = page.get("style")
    if style == "offset":
        return f"limit={page.get('limitParam')} offset={page.get('offsetParam')}"
    if style == "cursor":
        return f"cursor={page.get('cursorParam')} limit={page.get('limitParam')}"
    if style == "page":
        return f"page={page.get('pageParam')} limit={page.get('limitParam')}"
    if style == "link":
        return f"cursor={page.get('cursorParam')}"
    if style == "header":
        return f"header={page.get('headerName')}"
    return "none"


def paging_ok(operation: dict, calls: list[HttpCall]) -> bool:
    page = operation.get("pagination") or {}
    style = page.get("style", "none")
    if style not in PAGING_STYLES:
        return True
    known = [call for call in calls if not call.params_dynamic]
    if not known:
        return True
    keys: set[str] = set()
    for call in known:
        keys |= call.params
    if not keys:
        return True
    lowered = {str(key).lower() for key in keys}
    tokens = {"cursor", "pagetoken", "next", "after", "skiptoken", "starting_after", "page", "nextcursor", "continuationtoken", "offset"}
    if style == "offset":
        limit = str(page.get("limitParam") or "").lower()
        if limit in lowered:
            return True
        limit_names = {"limit", "pagesize", "per_page", "max", "count", "$top", "rlimit", "size"}
        return not (lowered & limit_names)
    if style == "cursor":
        cursor = str(page.get("cursorParam") or "").lower()
        if cursor in lowered:
            return True
        if lowered & tokens:
            return False
        return not (lowered & {"limit", "pagesize", "per_page", "max", "count", "$top", "rlimit", "size"})
    if style == "page":
        page_name = str(page.get("pageParam") or "").lower()
        if page_name in lowered:
            return True
        return "page" not in lowered
    if style == "link":
        cursor = str(page.get("cursorParam") or "").lower()
        return cursor in lowered or str(page.get("limitParam") or "").lower() in lowered or not (lowered & tokens)
    if style == "header":
        return True
    return True


def field_findings(
    label: str,
    operation: dict,
    calls: list[HttpCall],
    test_paths: set[str],
    test_types: dict[str, set[str]],
) -> list[str]:
    preset_paths = preset_field_paths(operation)
    if not preset_paths:
        return []
    chain: set[str] = set()
    chain_lists: set[str] = set()
    for call in calls:
        chain |= call.chain_keys
        chain_lists |= call.chain_lists
    scope = set(chain) | set(test_paths)
    findings = []
    preset_roots = children(preset_paths, ())
    scope_roots = children(scope, ())
    extra = sorted(preset_roots - scope_roots)
    if extra:
        findings.append(
            f"field: {label} root keys {extra[:8]} are not read by this call or present in test_data."
        )
    local_roots = {name.lower() for name in children(chain, ())}
    junk = sorted(name for name in preset_roots if name.lower() in STATE_OR_SECRET_ROOTS and name.lower() not in local_roots)
    if junk:
        findings.append(
            f"field: {label} includes {junk}, which are credentials or fetch state rather than this call's response."
        )
    nav_paths = {path for path in chain if "." in path and path.split(".")[-1].lower() in NAV_KEYS}
    for path in nav_paths:
        last = path.split(".")[-1].lower()
        if "." not in path or last not in NAV_KEYS:
            continue
        parent = path.rsplit(".", 1)[0]
        if parent not in preset_paths and parent.split(".")[0] not in preset_roots:
            continue
        if path in preset_paths or any(item.startswith(path + ".") for item in preset_paths):
            continue
        findings.append(f"nesting: {label} does not include {path}, which the client reads.")
        break
    for path, kind in preset_kinds(operation).items():
        seen = test_types.get(path) or set()
        listed = "list" in seen or path in chain_lists
        if listed and kind != "list":
            findings.append(f"type: {label} {path} is a {kind} but the command reads a list.")
            continue
        if kind == "list" and path in chain_lists:
            continue
        if not seen:
            continue
        if kind == "list" and "list" not in seen:
            findings.append(f"type: {label} {path} is a list but test_data has {sorted(seen)}.")
        elif kind == "bool" and "bool" not in seen and seen != {"string"}:
            findings.append(f"type: {label} {path} is a boolean but test_data has {sorted(seen)}.")
    return findings[:4]


def children(paths: set[str], prefix: tuple[str, ...]) -> set[str]:
    found = set()
    for path in paths:
        parts = path.split(".")
        if tuple(parts[: len(prefix)]) == prefix and len(parts) > len(prefix):
            found.add(parts[len(prefix)])
    return found


def preset_field_paths(operation: dict) -> set[str]:
    envelope = operation.get("envelope") or {}
    kind = envelope.get("type")
    record = operation.get("record") or {}
    paths: set[str] = set()
    if kind in SKIP_FIELD_ENVELOPES:
        return paths
    if kind == "array":
        collect_fields(record, "", paths)
        return paths
    if kind == "wrapped":
        key = str(envelope.get("arrayKey") or "data")
        paths.add(key)
        collect_fields(record, key, paths)
        return paths
    if kind == "azure":
        paths.add("value")
        collect_fields(record, "value", paths)
        return paths
    if kind == "odata":
        paths.add("value")
        collect_fields(record, "value", paths)
        return paths
    if kind == "falcon":
        paths.add("resources")
        collect_fields(record, "resources", paths)
        return paths
    if kind == "token-page":
        key = str(envelope.get("arrayKey") or "items")
        paths.add(key)
        collect_fields(record, key, paths)
        return paths
    if kind == "slack":
        paths.update({"ok", "messages"})
        collect_fields(record, "messages", paths)
        return paths
    collect_fields(record, "", paths)
    return paths


def collect_fields(field: dict, prefix: str, paths: set[str]) -> None:
    if field.get("kind") == "object":
        for child in field.get("children") or []:
            name = str(child.get("name") or "")
            if not name:
                continue
            path = dot(prefix, name)
            paths.add(path)
            if child.get("kind") in {"object", "array"}:
                collect_fields(child if child.get("kind") == "object" else child.get("item") or {}, path, paths)
        return
    if field.get("kind") == "array":
        collect_fields(field.get("item") or {}, prefix, paths)


def preset_kinds(operation: dict) -> dict[str, str]:
    kinds: dict[str, str] = {}
    envelope = operation.get("envelope") or {}

    def walk(field: dict, prefix: str) -> None:
        kind = field.get("kind")
        if kind == "object":
            for child in field.get("children") or []:
                path = dot(prefix, str(child.get("name")))
                mapped = kind_of(child)
                if mapped:
                    kinds[path] = mapped
                walk(child, path)
        elif kind == "array":
            if prefix:
                kinds[prefix] = "list"
            walk(field.get("item") or {}, prefix)

    record = operation.get("record") or {}
    root = ""
    if envelope.get("type") == "wrapped":
        root = str(envelope.get("arrayKey") or "data")
        kinds[root] = "list"
    elif envelope.get("type") in {"azure", "odata"}:
        root = "value"
        kinds[root] = "list"
    elif envelope.get("type") == "falcon":
        root = "resources"
        kinds[root] = "list"
    elif envelope.get("type") == "token-page":
        root = str(envelope.get("arrayKey") or "items")
        kinds[root] = "list"
    walk(record, root)
    return kinds


def kind_of(field: dict) -> str:
    kind = field.get("kind")
    if kind == "array":
        return "list"
    if kind == "boolean":
        return "bool"
    if kind in {"integer", "number"}:
        return "number"
    if kind == "object":
        return "dict"
    if kind in {"string", "const", "enum", "id", "uuid", "timestamp", "ip", "email"}:
        if field.get("kind") == "const" and isinstance(field.get("constValue"), list):
            return "list"
        return "string"
    return ""


def summarize(results: list[dict], allow: dict[str, str]) -> dict[str, int]:
    counts = {"checked": len(results), "match": 0, "mismatch": 0, "unparseable": 0, "allowlisted": 0}
    for row in results:
        counts[row["status"]] = counts.get(row["status"], 0) + 1
        if row["status"] != "match" and row["id"] in allow:
            counts["allowlisted"] += 1
    return counts


def render(results: list[dict], summary: dict[str, int]) -> str:
    lines = [
        "# Preset cross-check",
        "",
        f"Checked {summary['checked']}. Match {summary['match']}. Mismatch {summary['mismatch']}. Unparseable {summary['unparseable']}. Allowlisted {summary['allowlisted']}.",
        "",
        "| Preset | Status | Findings |",
        "| --- | --- | --- |",
    ]
    for row in results:
        findings = " ".join(row["findings"]).replace("|", "/") or "—"
        lines.append(f"| {row['name']} | {row['status']} | {findings} |")
    lines.append("")
    return "\n".join(lines)


def lab_preset(pack: str, operation: dict) -> dict:
    return {
        "id": "lab-lab",
        "name": "Lab",
        "fidelity": "verified",
        "sourceUrl": f"https://github.com/demisto/content/tree/master/Packs/{pack}/Integrations/Lab",
        "spec": {"operations": [operation]},
    }


def self_test() -> int:
    import tempfile

    root = Path(tempfile.mkdtemp())
    content = root / "content"

    def write(pack: str, source: str) -> None:
        folder = content / "Packs" / pack / "Integrations" / "Lab"
        folder.mkdir(parents=True)
        (folder / "Lab.py").write_text(source)

    write(
        "Tap",
        "\n".join(
            [
                "from CommonServerPython import *",
                "class Client(BaseClient):",
                "    def __init__(self, base_url, api_version):",
                "        self.base_url = base_url",
                "        self.api_version = api_version",
                "    def http_request(self, method, url_suffix, params=None):",
                "        full = urljoin(urljoin(self.base_url, self.api_version), url_suffix)",
                "        return requests.request(method, full, params=params)",
                "    def clicks(self, clicks_type):",
                "        response = self.http_request('GET', f'/siem/clicks/{clicks_type}', params={'interval': 'PT1H'})",
                "        return response.get('clicksBlocked')",
            ]
        ),
    )
    click = {
        "method": "GET",
        "pathTemplate": "/v2/siem/clicks/blocked",
        "envelope": {"type": "object"},
        "pagination": {"style": "none", "limitParam": "limit", "offsetParam": "offset", "pageParam": "page", "cursorParam": "cursor"},
        "record": {"name": "body", "kind": "object", "children": [{"name": "clicksBlocked", "kind": "array", "item": {"name": "click", "kind": "object", "children": []}}]},
    }
    row = check_preset(lab_preset("Tap", click), content)
    assert row["status"] == "match", row
    dropped = lab_preset("Tap", dict(click, pathTemplate="/siem/clicks/blocked"))
    dropped_row = check_preset(dropped, content)
    assert dropped_row["status"] == "mismatch" and any(item.startswith("path:") for item in dropped_row["findings"]), dropped_row

    write(
        "Agent",
        "\n".join(
            [
                "from CommonServerPython import *",
                "class Client(BaseClient):",
                "    def __init__(self, base_url):",
                "        super().__init__(base_url)",
                "    def threats(self):",
                "        response = self._http_request(method='GET', url_suffix='threats', params={'limit': 50})",
                "        return response.get('data')",
                "def main():",
                "    base_url = urljoin(server, f'/web/api/v{api_version}/')",
                "    Client(base_url=base_url)",
            ]
        ),
    )
    threat = {
        "method": "GET",
        "pathTemplate": "/web/api/v2.1/threats",
        "envelope": {"type": "wrapped", "arrayKey": "threats"},
        "pagination": {"style": "cursor", "limitParam": "limit", "offsetParam": "offset", "pageParam": "page", "cursorParam": "cursor"},
        "record": {"name": "row", "kind": "object", "children": [{"name": "id", "kind": "id"}]},
    }
    threat_row = check_preset(lab_preset("Agent", threat), content)
    assert threat_row["status"] == "mismatch", threat_row
    kinds = {item.split(":", 1)[0] for item in threat_row["findings"]}
    assert "paging" in kinds and ("field" in kinds or "nesting" in kinds), threat_row

    write(
        "Std",
        "\n".join(
            [
                "from CommonServerPython import *",
                "from urllib.parse import urljoin",
                "class Client:",
                "    def fetch(self):",
                "        full = urljoin(urljoin(self.base_url, self.api_version), '/siem/clicks/blocked')",
                "        response = requests.request('GET', full)",
                "        return response.get('clicksBlocked')",
            ]
        ),
    )
    std_op = dict(click, pathTemplate="/siem/clicks/blocked")
    std_row = check_preset(lab_preset("Std", std_op), content)
    assert std_row["status"] == "match", std_row
    kept = check_preset(lab_preset("Std", click), content)
    assert kept["status"] == "mismatch", kept

    write(
        "Wrapped",
        "\n".join(
            [
                "from CommonServerPython import *",
                "class Client(BaseClient):",
                "    def _call(self, url_suffix, **kwargs):",
                "        method = kwargs.get('method', 'post')",
                "        request_kwargs = {'method': method, 'url_suffix': url_suffix}",
                "        return self._http_request(**request_kwargs)",
                "    def search(self):",
                "        return self._call(url_suffix='/v2/lists/search')",
            ]
        ),
    )
    wrapped = {
        "method": "POST",
        "pathTemplate": "/v2/lists/search",
        "envelope": {"type": "object"},
        "pagination": {"style": "none", "limitParam": "limit", "offsetParam": "offset", "pageParam": "page", "cursorParam": "cursor"},
        "record": {"name": "body", "kind": "object", "children": []},
    }
    wrapped_row = check_preset(lab_preset("Wrapped", wrapped), content)
    assert wrapped_row["status"] == "match", wrapped_row

    write(
        "Host",
        "\n".join(
            [
                "from CommonServerPython import *",
                "API_URL = demisto.params().get('API_URL')",
                "def http_request(method, url):",
                "    return requests.request(method, url)",
                "def lookup(ip):",
                "    return http_request('GET', API_URL + '/shodan/host/' + ip)",
                "def incidents():",
                "    return http_request('GET', demisto.params().get('url') + 'api/incidents')",
            ]
        ),
    )
    host = {
        "method": "GET",
        "pathTemplate": "/shodan/host/{ip}",
        "envelope": {"type": "object"},
        "pagination": {"style": "none", "limitParam": "limit", "offsetParam": "offset", "pageParam": "page", "cursorParam": "cursor"},
        "record": {"name": "body", "kind": "object", "children": []},
    }
    host_row = check_preset(lab_preset("Host", host), content)
    assert host_row["status"] == "match", host_row
    glued = dict(host, pathTemplate="/api/incidents")
    glued_row = check_preset(lab_preset("Host", glued), content)
    assert glued_row["status"] == "match", glued_row

    write(
        "Match",
        "\n".join(
            [
                "from googleapiclient.discovery import build",
                "def execute_gmail_action(service, action):",
                "    match action:",
                "        case 'list':",
                "            return service.users().messages().list().execute()",
                "def list_instances():",
                "    request = get_compute().instances().list(project='p', zone='z')",
                "    return request.execute()",
            ]
        ),
    )
    listed = {
        "method": "GET",
        "pathTemplate": "/gmail/v1/users/{userId}/messages",
        "envelope": {"type": "object"},
        "pagination": {"style": "none", "limitParam": "limit", "offsetParam": "offset", "pageParam": "page", "cursorParam": "cursor"},
        "record": {"name": "body", "kind": "object", "children": []},
    }
    match_row = check_preset(lab_preset("Match", listed), content)
    assert match_row["status"] == "match", match_row
    compute = dict(listed, pathTemplate="/compute/v1/projects/{project}/zones/{zone}/instances")
    compute_row = check_preset(lab_preset("Match", compute), content)
    assert compute_row["status"] == "match", compute_row

    write(
        "Prefix",
        "\n".join(
            [
                "import requests",
                "class Client:",
                "    URI_PREFIX = '/services/data/v39.0/'",
                "    def send(self, method, uri):",
                "        return requests.request(method, f'{self.URI_PREFIX}{uri}')",
                "    def cases(self):",
                "        return self.send('GET', 'sobjects/Case')",
            ]
        ),
    )
    prefix = dict(listed, pathTemplate="/services/data/v39.0/sobjects/Case")
    prefix_row = check_preset(lab_preset("Prefix", prefix), content)
    assert prefix_row["status"] == "match", prefix_row

    write(
        "Dispatch",
        "\n".join(
            [
                "import requests",
                "class Client:",
                "    def http_request(self, method, url_suffix):",
                "        return requests.request(method, 'https://example.test' + url_suffix)",
                "    def events(self):",
                "        response = self.http_request('GET', '/events')",
                "        rows = response.get('entries') or []",
                "        for item in rows:",
                "            item.get('event_id')",
                "        return rows",
                "    def users(self):",
                "        response = self.http_request('GET', '/users')",
                "        return response.get('login')",
                "def main():",
                "    client = Client()",
                "    client.events()",
                "    client.users()",
            ]
        ),
    )
    events = {
        "method": "GET",
        "pathTemplate": "/events",
        "envelope": {"type": "object"},
        "pagination": {"style": "none", "limitParam": "limit", "offsetParam": "offset", "pageParam": "page", "cursorParam": "cursor"},
        "record": {
            "name": "body",
            "kind": "object",
            "children": [
                {
                    "name": "entries",
                    "kind": "array",
                    "item": {"name": "item", "kind": "object", "children": [{"name": "event_id", "kind": "string", "example": "lab"}]},
                }
            ],
        },
    }
    events_row = check_preset(lab_preset("Dispatch", events), content)
    assert events_row["status"] == "match", events_row
    leaked = {
        "method": "GET",
        "pathTemplate": "/events",
        "envelope": {"type": "object"},
        "pagination": {"style": "none", "limitParam": "limit", "offsetParam": "offset", "pageParam": "page", "cursorParam": "cursor"},
        "record": {
            "name": "body",
            "kind": "object",
            "children": [
                {"name": "entries", "kind": "array", "item": {"name": "item", "kind": "object", "children": []}},
                {"name": "login", "kind": "string", "example": "lab"},
            ],
        },
    }
    leaked_row = check_preset(lab_preset("Dispatch", leaked), content)
    assert leaked_row["status"] == "mismatch" and any(item.startswith("field:") for item in leaked_row["findings"]), leaked_row
    scalar = dict(events)
    scalar["record"] = {
        "name": "body",
        "kind": "object",
        "children": [{"name": "entries", "kind": "string", "example": "lab"}],
    }
    scalar_row = check_preset(lab_preset("Dispatch", scalar), content)
    assert scalar_row["status"] == "mismatch" and any(item.startswith("type:") for item in scalar_row["findings"]), scalar_row
    folder = content / "Packs" / "Dispatch" / "Integrations" / "Lab"
    (folder / "test_data").mkdir()
    (folder / "test_data" / "users.json").write_text('{"login": "ada", "role": "admin"}')
    (folder / "Lab_test.py").write_text(
        "\n".join(
            [
                "def test_users():",
                "    raw = open('test_data/users.json').read()",
                "    return users()",
            ]
        )
    )
    # The events command does not load users.json, so role stays out of scope.
    role = dict(leaked)
    role["record"] = {
        "name": "body",
        "kind": "object",
        "children": [
            {"name": "entries", "kind": "array", "item": {"name": "item", "kind": "object", "children": []}},
            {"name": "role", "kind": "string", "example": "lab"},
        ],
    }
    role_row = check_preset(lab_preset("Dispatch", role), content)
    assert role_row["status"] == "mismatch" and any("role" in item for item in role_row["findings"]), role_row

    write(
        "Search",
        "\n".join(
            [
                "import requests",
                "class Client:",
                "    def http_request(self, method, url_suffix):",
                "        return requests.request(method, 'https://example.test' + url_suffix)",
                "    def search(self):",
                "        response = self.http_request('POST', '/search/query')",
                "        if response['value'][0]['hitsContainers'][0]['total'] > 0:",
                "            for hit in response['value'][0]['hitsContainers'][0]['hits']:",
                "                hit['resource']['name']",
            ]
        ),
    )
    search = {
        "method": "POST",
        "pathTemplate": "/search/query",
        "envelope": {"type": "object"},
        "pagination": {"style": "none", "limitParam": "limit", "offsetParam": "offset", "pageParam": "page", "cursorParam": "cursor"},
        "record": {
            "name": "body",
            "kind": "object",
            "children": [
                {
                    "name": "value",
                    "kind": "array",
                    "item": {
                        "name": "item",
                        "kind": "object",
                        "children": [
                            {
                                "name": "hitsContainers",
                                "kind": "array",
                                "item": {
                                    "name": "item",
                                    "kind": "object",
                                    "children": [
                                        {"name": "total", "kind": "integer", "example": 1},
                                        {
                                            "name": "hits",
                                            "kind": "array",
                                            "item": {
                                                "name": "item",
                                                "kind": "object",
                                                "children": [
                                                    {
                                                        "name": "resource",
                                                        "kind": "object",
                                                        "children": [{"name": "name", "kind": "string", "example": "lab"}],
                                                    }
                                                ],
                                            },
                                        },
                                    ],
                                },
                            }
                        ],
                    },
                }
            ],
        },
    }
    search_row = check_preset(lab_preset("Search", search), content)
    assert search_row["status"] == "match", search_row
    flat = dict(search)
    flat["record"] = {
        "name": "body",
        "kind": "object",
        "children": [{"name": "hits", "kind": "array", "item": {"name": "item", "kind": "object", "children": []}}],
    }
    flat_row = check_preset(lab_preset("Search", flat), content)
    assert flat_row["status"] == "mismatch", flat_row

    write(
        "Safe",
        "\n".join(
            [
                "import requests",
                "class Client:",
                "    def http_request(self, method, url_suffix):",
                "        return requests.request(method, 'https://example.test' + url_suffix)",
                "    def get_clicks(self, clicks_type):",
                "        return self.http_request('GET', '/siem/clicks/' + clicks_type)",
                "def get_clicks_command(client, clicks_type):",
                "    raw = client.get_clicks(clicks_type)",
                "    clicks_path = ['clicksBlocked'] if clicks_type == 'blocked' else ['clicksPermitted']",
                "    return dict_safe_get(raw, clicks_path)",
            ]
        ),
    )
    safe = {
        "method": "GET",
        "pathTemplate": "/siem/clicks/blocked",
        "envelope": {"type": "object"},
        "pagination": {"style": "none", "limitParam": "limit", "offsetParam": "offset", "pageParam": "page", "cursorParam": "cursor"},
        "record": {
            "name": "body",
            "kind": "object",
            "children": [
                {"name": "clicksBlocked", "kind": "string", "example": "lab"},
                {"name": "clicksPermitted", "kind": "string", "example": "lab"},
            ],
        },
    }
    safe_row = check_preset(lab_preset("Safe", safe), content)
    assert safe_row["status"] == "match", safe_row
    print("self-test ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
