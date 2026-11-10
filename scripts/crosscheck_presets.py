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

    def copy(self) -> "Val":
        return Val(
            self.text,
            self.path,
            self.dynamic,
            self.hole,
            None if self.items is None else dict(self.items),
            self.dyn_keys,
            None if self.seq is None else list(self.seq),
            None if self.alts is None else list(self.alts),
        )


@dataclass
class HttpCall:
    method: str
    paths: list[str]
    params: set[str]
    params_dynamic: bool
    func: str
    boto3: bool = False
    keys: set[str] = field(default_factory=set)
    nav: set[str] = field(default_factory=set)


@dataclass
class Func:
    name: str
    node: ast.AST
    qual: str
    cls: str
    reads: set[str] = field(default_factory=set)
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
        if data.get("fidelity") != "verified":
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
    if not any(folder.glob("*.py")):
        folder = sibling_client(folder, preset["id"]) or folder
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
    if not any(folder.glob("*.py")):
        folder = sibling_client(folder, preset["id"]) or folder
    modules = load_modules(folder, content)
    if not modules:
        return result(preset, "unparseable", ["unparseable: no Python client parsed"])
    calls = [call for mod in modules for call in module_calls(mod)]
    test_paths, test_types = load_test_data(folder)
    if not calls and not test_paths:
        return result(preset, "unparseable", ["unparseable: no HTTP calls and no test_data"])
    findings: list[str] = []
    if not calls:
        findings.append("unparseable: client built requests without a readable method and path")
        return result(preset, "unparseable", findings)
    for operation in preset["spec"]["operations"]:
        findings.extend(check_operation(operation, calls, test_paths, test_types))
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


def sibling_client(folder: Path, preset_id: str) -> Path | None:
    parent = folder.parent
    if not parent.is_dir():
        return None
    wanted = folder.name.lower().replace("_", "-")
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
        if module_calls(mod):
            continue
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
    seed_module(mod, tree)
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
        )
        for row in rows
    ]


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


def run_func(mod: Mod, func: Func, bound: dict[str, Val], depth: int) -> None:
    env = dict(mod.env)
    env.update(bound)
    apply_signature(func.node, env)
    env.update(bound)
    walk_body(func.node.body, env, mod, func, depth)  # type: ignore[attr-defined]


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
            visit_calls(stmt.value, env, mod, func, depth)
            note_request_object(stmt.value, env, mod, func)
        return
    if isinstance(stmt, ast.If):
        walk_body(stmt.body, env, mod, func, depth)
        walk_body(stmt.orelse, env, mod, func, depth)
        return
    if isinstance(stmt, (ast.For, ast.AsyncFor)):
        iter_val = eval_expr(stmt.iter, env, mod, func.cls)
        remember_reads(stmt.iter, env, func, depth)
        if isinstance(stmt.target, ast.Name):
            env[stmt.target.id] = iter_val
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


def remember_reads(node: ast.expr, env: dict[str, Val], func: Func, depth: bool) -> None:
    if depth:
        for path in read_paths(node, env):
            if path:
                func.reads.add(path)


def visit_calls(node: ast.expr, env: dict[str, Val], mod: Mod, func: Func, depth: bool) -> Val:
    for child in ast.walk(node):
        if isinstance(child, ast.Call) and child is not node:
            handle_call(child, env, mod, func, depth)
    remember_reads(node, env, func, depth)
    if isinstance(node, ast.Call):
        return handle_call(node, env, mod, func, depth)
    return eval_expr(node, env, mod, func.cls)


def handle_call(call: ast.Call, env: dict[str, Val], mod: Mod, func: Func, depth: bool) -> Val:
    name = call_name(call)
    if name:
        func.calls.append((name, call))
    remember_reads(call, env, func, depth)
    if isinstance(call.func, ast.Attribute):
        owner = eval_expr(call.func.value, env, mod, func.cls)
        if owner.text.startswith("boto3:"):
            store_call(
                mod,
                {
                    "method": "POST",
                    "paths": ["/"],
                    "params": [],
                    "dynamic": True,
                    "func": func.qual,
                    "boto3": True,
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
        return Val(dynamic=True, path="")
    if depth > 0 and len(mod.stack) < 12:
        if name and name in mod.class_attrs:
            init = mod.funcs.get(f"{name}.__init__")
            if init and init.qual != func.qual and init.qual not in mod.stack:
                mod.stack.append(init.qual)
                run_func(mod, init, bind_args(init, call, env, mod, name), depth - 1)
                mod.stack.pop()
        if name and name not in {"urljoin", "assign_params", "format"}:
            for target in resolve_funcs(mod, name, func.cls)[:4]:
                if target.qual == func.qual or target.qual in mod.stack:
                    continue
                mod.stack.append(target.qual)
                run_func(mod, target, bind_args(target, call, env, mod, func.cls), depth - 1)
                mod.stack.pop()
    return eval_call_value(call, env, mod, func.cls)


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
        text = f"{left.text}{right.text}"
        path = path_of(text) if text.startswith("http") else (text if "/" in text else "")
        return Val(text=text, path=path, dynamic=left.dynamic and right.dynamic and not text)
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
            return owner.items[key].copy()
        if key and owner.path:
            return Val(path=dot(owner.path, key), text=key)
        return Val(dynamic=True)
    if isinstance(node, ast.IfExp):
        return eval_expr(node.body, env, mod, cls)
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
            return Val(dynamic=True, hole="{" + key + "}", text="{" + key + "}")
        return Val(dynamic=True)
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
        found = google_endpoint(call)
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
    ("users", "messages", "attachments", "get"): ("GET", "/gmail/v1/users/{userId}/messages/{messageId}/attachments/{id}"),
    ("users", "getProfile"): ("GET", "/gmail/v1/users/{userId}/profile"),
}
DIRECTORY_METHODS = {
    ("users", "list"): ("GET", "/admin/directory/v1/users"),
    ("users", "get"): ("GET", "/admin/directory/v1/users/{userKey}"),
    ("users", "update"): ("PUT", "/admin/directory/v1/users/{userKey}"),
}


def google_endpoint(call: ast.Call) -> tuple[str, str] | None:
    if not isinstance(call.func, ast.Attribute):
        return None
    if call.func.attr not in {"execute", "list"}:
        return None
    attrs = chain_attrs(call)
    if attrs and attrs[-1] in {"execute", "list"} and call.func.attr == "execute":
        attrs = attrs[:-1]
    key = tuple(attrs)
    # organizations().sources().findings().list()
    # https://cloud.google.com/security-command-center/docs/reference/rest/v1/organizations.sources.findings/list
    if key == ("organizations", "sources", "findings", "list"):
        return ("GET", "/v1/organizations/{organization}/sources/{source}/findings")
    if "messages" in key or "getProfile" in key:
        return GMAIL_METHODS.get(key)
    return DIRECTORY_METHODS.get(key)


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
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "get" and node.args:
        key = literal_str(node.args[0])
        if key:
            return dot(prefix_of(node.func.value, env, ""), key)
    return fallback


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


def check_operation(operation: dict, calls: list[HttpCall], test_paths: set[str], test_types: dict[str, str]) -> list[str]:
    method = str(operation.get("method", "")).upper()
    preset_path = norm_path(str(operation.get("pathTemplate", "/")))
    matched = [call for call in calls if call.method == method and any(paths_match(preset_path, path) for path in call.paths)]
    findings = []
    label = f"{method} {preset_path}"
    if not matched:
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
    if operation.get("envelope", {}).get("type") not in SKIP_FIELD_ENVELOPES and not all(call.boto3 for call in matched):
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
    test_types: dict[str, str],
) -> list[str]:
    preset_paths = preset_field_paths(operation)
    if not preset_paths:
        return []
    client_paths: set[str] = set()
    nav_paths: set[str] = set()
    for call in calls:
        client_paths |= call.keys
        nav_paths |= call.nav
    allowed = set(client_paths) | set(test_paths)
    findings = []
    preset_roots = children(preset_paths, ())
    allowed_roots = children(allowed, ())
    if preset_roots and allowed_roots and not (preset_roots & allowed_roots):
        findings.append(
            f"field: {label} root keys {sorted(preset_roots)} are not read by the client or present in test_data {sorted(list(allowed_roots)[:8])}."
        )
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
        if not seen:
            continue
        if kind == "list" and "list" not in seen:
            findings.append(f"type: {label} {path} is a list but test_data has {sorted(seen)}.")
        elif kind == "string" and seen == {"list"}:
            findings.append(f"type: {label} {path} is a string but test_data has a list.")
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
                "        return self.http_request('GET', f'/siem/clicks/{clicks_type}', params={'interval': 'PT1H'})",
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
                "        return requests.request('GET', full)",
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
    print("self-test ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
