import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from panparrot import __version__
from panparrot.config import load_credentials, save_credentials
from panparrot.expect import check_expectations, load_expectations
from panparrot.xsiam import configure_instance


class FailedAssertions(Exception):
    def __init__(self, payload: dict):
        self.payload = payload


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    as_json = "--json" in args
    args = [arg for arg in args if arg != "--json"]
    try:
        payload = dispatch(args)
        if as_json:
            print(json.dumps({"ok": True, **payload}, default=str))
        elif payload.get("text"):
            print(payload["text"])
        elif payload:
            print(json.dumps(payload, default=str))
        return 0
    except FailedAssertions as error:
        payload = error.payload
        if as_json:
            print(json.dumps({"ok": False, **payload}, default=str))
        else:
            print(payload.get("text") or "Assertions failed", file=sys.stderr)
        return 1
    except SystemExit as error:
        message = str(error)
        if as_json:
            print(json.dumps({"ok": False, "error": message}))
        elif message:
            print(message, file=sys.stderr)
        return 1
    except Exception as error:
        message = str(error) or "Command failed"
        if as_json:
            print(json.dumps({"ok": False, "error": message}))
        else:
            print(message, file=sys.stderr)
        return 1


def dispatch(args: list[str]) -> dict:
    if not args or args[0] in {"-h", "--help", "help"}:
        return {"text": HELP}
    if args[0] == "login":
        return login(args[1:])
    if args[0] == "version":
        return installed_version()
    if args[0] == "presets":
        return presets(args[1:])
    if args[0] == "mock" and len(args) > 1 and args[1] == "from-integration":
        return from_integration(args[2:])
    if args[0] == "mock" and len(args) > 1 and args[1] == "fetch":
        return mock_fetch(args[2:])
    if args[0] == "mock" and len(args) > 1 and args[1] == "state":
        return mock_state(args[2:])
    if args[0] == "mock" and len(args) > 1 and args[1] == "scenario":
        return mock_scenario(args[2:])
    if args[0] == "mocks":
        return mocks(args[1:])
    if args[0] == "assert":
        return assertions(args[1:])
    if args[0] == "instance-config":
        return {"instanceConfig": api("GET", "/api/v1/mocks/" + quote(flag(args[1:], "--mock")) + "/instance-config")}
    if args[0] == "xsiam" and len(args) > 1 and args[1] == "configure-instance":
        return xsiam(args[2:])
    raise SystemExit("Unknown command\n" + HELP)


def installed_version() -> dict:
    local = __version__
    try:
        creds = load_credentials()
    except SystemExit:
        return {
            "version": local,
            "latest": None,
            "update": None,
            "text": f"panparrot {local}\nRun panparrot login to check for an update.",
        }
    try:
        remote = api("GET", "/api/v1/cli")
    except SystemExit:
        return {
            "version": local,
            "latest": None,
            "update": None,
            "text": f"panparrot {local}\nCould not check for an update.",
        }
    latest = str(remote.get("version") or "")
    filename = str(remote.get("filename") or "")
    newer = bool(latest) and version_key(latest) > version_key(local)
    host = str(creds.get("url") or "").split("://", 1)[-1]
    install = f'pipx install --force "https://<token>@{host}/api/v1/cli/{filename}"' if filename else ""
    if newer:
        text = f"panparrot {local}\n{latest} is available.\n{install}"
    else:
        text = f"panparrot {local}\nThis is the current release."
    return {
        "version": local,
        "latest": latest,
        "update": newer,
        "filename": filename or None,
        "install": install if newer else None,
        "text": text,
    }


def version_key(value: str) -> tuple:
    parts = []
    for part in value.split("."):
        if not part.isdigit():
            break
        parts.append(int(part))
    return tuple(parts)


def login(args: list[str]) -> dict:
    url = flag(args, "--url")
    token = flag(args, "--token")
    if not url or not token or not token.startswith("pp_"):
        raise SystemExit("login needs --url and --token pp_...")
    where = save_credentials(url, token)
    return {"url": url.rstrip("/"), "stored": where}


def presets(args: list[str]) -> dict:
    query = optional(args, "--q") or ""
    path = "/api/v1/presets"
    if query:
        path += "?" + urllib.parse.urlencode({"q": query})
    rows = api("GET", path).get("presets", [])
    lines = []
    for row in rows:
        coverage = row.get("commandCoverage") or {}
        detail = row.get("fidelity") or ""
        if coverage.get("total"):
            detail += (
                f"  {coverage.get('vendor')} vendor, {coverage.get('approximate')} approximate, "
                f"{coverage.get('missing')} missing of {coverage.get('total')}"
            )
        lines.append(f"{row.get('id')}  {detail}".rstrip())
    return {"presets": rows, "text": "\n".join(lines) if lines else "No presets matched."}


CLIENT_MAX = 200_000


def from_integration(args: list[str]) -> dict:
    yml = Path(args[0] if args and not args[0].startswith("-") else flag(args, "--yaml"))
    if not yml.is_file():
        raise SystemExit(f"Integration YAML not found: {yml}")
    python = integration_python(yml, optional(args, "--python"))
    client = python.read_text(errors="replace")
    if len(client) > CLIENT_MAX:
        raise SystemExit("Python client is too large")
    body = mock_body_from(yml, optional(args, "--test-data"), client)
    created = api("POST", "/api/v1/mocks", body)
    mock_id = str(created.get("id") or "")
    if not mock_id:
        raise SystemExit("PAN Parrot did not return a mock id")
    config = api("GET", "/api/v1/mocks/" + quote(mock_id) + "/instance-config")
    routes = created.get("routes") or []
    lines = [str(created.get("url") or ""), ""]
    for route in routes:
        if route.get("method") and route.get("path"):
            lines.append(f"{route.get('command')}  {route.get('method')} {route.get('path')}  {route.get('pathFrom')}")
    lines.append("")
    for param in config.get("params") or []:
        lines.append(f"{param.get('name')} = {param.get('value')}")
    return {
        "mock": {key: created.get(key) for key in ("id", "name", "url", "integrationId", "version", "created")},
        "routes": routes,
        "instanceConfig": config,
        "warnings": created.get("warnings") or [],
        "text": "\n".join(lines).strip(),
    }


def mock_fetch(args: list[str]) -> dict:
    mock_id = flag(args, "--mock")
    body: dict = {"fetch": fetch_patch(args)}
    if "--reset" in args:
        body["reset"] = True
    saved = api("PUT", "/api/v1/mocks/" + quote(mock_id), body)
    fetch = saved.get("fetch") or {}
    if fetch.get("enabled"):
        dedup = "on" if fetch.get("dedup") else "off"
        text = (
            "Fetch is on.\n"
            f"Poll with ?{fetch.get('sinceParam')}=<time> or ?{fetch.get('firstFetchParam')}=<time>.\n"
            f"Each poll reveals {fetch.get('windowSeconds')} seconds and {fetch.get('perPoll')} records. Dedup is {dedup}."
        )
    else:
        text = "Fetch is off."
    if saved.get("reset"):
        text += "\nSaved calls were cleared."
    return {"id": saved.get("id"), "url": saved.get("url"), "fetch": fetch, "reset": bool(saved.get("reset")), "text": text}


def mock_state(args: list[str]) -> dict:
    mock_id = flag(args, "--mock")
    body: dict = {"state": state_patch(args)}
    if "--reset" in args:
        body["reset"] = True
    saved = api("PUT", "/api/v1/mocks/" + quote(mock_id), body)
    state = saved.get("state") or {}
    if state.get("enabled"):
        text = (
            "Saved records are on.\n"
            f"POST stores a record. GET, PUT, and DELETE use the {state.get('idField')} field."
        )
    else:
        text = "Saved records are off."
    if saved.get("reset"):
        text += "\nSaved calls were cleared."
    return {"id": saved.get("id"), "url": saved.get("url"), "state": state, "reset": bool(saved.get("reset")), "text": text}


def mock_scenario(args: list[str]) -> dict:
    mock_id = flag(args, "--mock")
    body: dict = {"scenario": scenario_patch(args)}
    if "--reset" in args:
        body["reset"] = True
    saved = api("PUT", "/api/v1/mocks/" + quote(mock_id), body)
    scenario = saved.get("scenario") or {}
    steps = scenario.get("steps") or []
    if scenario.get("enabled"):
        repeat = "the sequence starts again" if scenario.get("repeat") == "loop" else "the last response repeats"
        text = f"Call sequence is on. {len(steps)} steps, then {repeat}."
    else:
        text = "Call sequence is off."
    if saved.get("reset"):
        text += "\nSaved calls were cleared."
    return {"id": saved.get("id"), "url": saved.get("url"), "scenario": scenario, "reset": bool(saved.get("reset")), "text": text}


def scenario_patch(args: list[str]) -> dict:
    patch: dict = {"enabled": "--off" not in args}
    if "--loop" in args and "--last" in args:
        raise SystemExit("Use --loop or --last, not both")
    if "--loop" in args:
        patch["repeat"] = "loop"
    elif "--last" in args:
        patch["repeat"] = "last"
    file_name = optional(args, "--file")
    raw_steps = repeated(args, "--step")
    if file_name and raw_steps:
        raise SystemExit("Use --file or --step, not both")
    if file_name:
        try:
            loaded = json.loads(Path(file_name).read_text())
        except (OSError, json.JSONDecodeError) as error:
            raise SystemExit(f"Could not read scenario steps: {error}") from error
        if not isinstance(loaded, list):
            raise SystemExit("Scenario file must be a list of steps")
        patch["steps"] = loaded
    elif raw_steps:
        patch["steps"] = [parse_step(value) for value in raw_steps]
    return patch


def parse_step(value: str) -> dict:
    if len(value) >= 3 and value[:3].isdigit() and (len(value) == 3 or value[3] == ":"):
        status = int(value[:3])
        if status < 100 or status > 599:
            raise SystemExit("Step status must be from 100 to 599")
        step: dict = {"status": status}
        body = value[4:] if len(value) > 3 else ""
        if body:
            if len(body) > 8_000:
                raise SystemExit("Step body is too large")
            step["body"] = body
        return step
    raise SystemExit('Step must look like 202 or 200:{"job":"done"}')


def repeated(args: list[str], name: str) -> list[str]:
    values = []
    index = 0
    while index < len(args):
        if args[index] == name:
            if index + 1 >= len(args):
                raise SystemExit(f"Missing value for {name}")
            values.append(args[index + 1])
            index += 2
            continue
        index += 1
    return values


def state_patch(args: list[str]) -> dict:
    patch: dict = {"enabled": "--off" not in args}
    field = optional(args, "--id-field")
    if field is not None:
        patch["idField"] = fetch_name("--id-field", field)
    return patch


def fetch_patch(args: list[str]) -> dict:
    patch: dict = {"enabled": "--off" not in args}
    since = optional(args, "--since")
    first = optional(args, "--first-fetch")
    field = optional(args, "--time-field")
    if since is not None:
        patch["sinceParam"] = fetch_name("--since", since)
    if first is not None:
        patch["firstFetchParam"] = fetch_name("--first-fetch", first)
    if field is not None:
        patch["timeField"] = fetch_name("--time-field", field)
    window = bounded(args, "--window", 1, 86_400)
    per_poll = bounded(args, "--per-poll", 1, 50)
    if window is not None:
        patch["windowSeconds"] = window
    if per_poll is not None:
        patch["perPoll"] = per_poll
    if "--no-dedup" in args:
        patch["dedup"] = False
    return patch


def fetch_name(flag_name: str, value: str) -> str:
    if not value or len(value) > 40 or any(ch for ch in value if ch not in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_$.-"):
        raise SystemExit(f"{flag_name} must be a short name")
    return value


def bounded(args: list[str], name: str, low: int, high: int) -> int | None:
    raw = optional(args, name)
    if raw is None:
        return None
    if not raw.isdigit() or int(raw) < low or int(raw) > high:
        raise SystemExit(f"{name} must be an integer from {low} to {high}")
    return int(raw)


def integration_python(yml: Path, override: str | None) -> Path:
    if override:
        path = Path(override)
        if not path.is_file():
            raise SystemExit(f"Python client not found: {override}")
        return path
    sibling = yml.with_suffix(".py")
    if sibling.is_file():
        return sibling
    candidates = [
        path
        for path in sorted(yml.parent.glob("*.py"))
        if path.is_file() and "test" not in path.name.lower() and not path.name.startswith("_")
    ]
    if len(candidates) == 1:
        return candidates[0]
    if not candidates:
        raise SystemExit(f"No Python client next to {yml.name}. Pass --python.")
    raise SystemExit("More than one Python file next to the YAML. Pass --python.")


def mock_body_from(yml: Path, test_data: str | None, client: str | None) -> dict:
    body: dict = {"yaml": yml.read_text()}
    if client:
        body["clientSource"] = client
    folder = Path(test_data) if test_data else yml.parent / "test_data"
    if folder.is_dir():
        files = []
        for path in sorted(folder.glob("*")):
            if path.is_file() and len(files) < 20 and path.stat().st_size <= 100_000:
                files.append({"name": path.name, "text": path.read_text(errors="replace")})
        if files:
            body["testData"] = files
    return body


def mocks(args: list[str]) -> dict:
    if not args or args[0] == "list":
        return {"mocks": api("GET", "/api/v1/mocks").get("mocks", [])}
    if args[0] == "create":
        return {"mock": api("POST", "/api/v1/mocks", mock_body(args[1:]))}
    if args[0] == "push":
        body = mock_body(args[1:])
        mock_id = optional(args[1:], "--mock")
        if mock_id:
            return {"mock": api("PUT", "/api/v1/mocks/" + quote(mock_id), body)}
        return {"mock": api("POST", "/api/v1/mocks", body)}
    if args[0] == "logs":
        mock_id = flag(args[1:], "--mock")
        return api("GET", "/api/v1/mocks/" + quote(mock_id) + "/logs")
    raise SystemExit("Unknown mocks command\n" + HELP)


def assertions(args: list[str]) -> dict:
    mock_id = flag(args, "--mock")
    expectations = expectation_list(args)
    logs = api("GET", "/api/v1/mocks/" + quote(mock_id) + "/logs?limit=200").get("logs", [])
    results = check_expectations(logs, expectations)
    passed = all(row.get("pass") for row in results) and bool(results)
    lines = []
    for row in results:
        mark = "PASS" if row.get("pass") else "FAIL"
        if row.get("error"):
            lines.append(f"{mark} {row['error']}")
            continue
        lines.append(
            f"{mark} {row.get('method')} {row.get('path')} expected {row.get('expectedMin')}, found {row.get('found')}"
        )
    payload = {"assertions": results, "passed": passed, "text": "\n".join(lines) or "No assertions"}
    if not passed:
        raise FailedAssertions(payload)
    return payload


def expectation_list(args: list[str]) -> list[dict]:
    file_name = optional(args, "--file")
    if file_name:
        try:
            return load_expectations(json.loads(Path(file_name).read_text()))
        except (OSError, ValueError, json.JSONDecodeError) as error:
            raise SystemExit(f"Could not read expectations: {error}") from error
    method = flag(args, "--method")
    path = flag(args, "--path")
    one: dict = {"method": method, "path": path}
    query = optional(args, "--query")
    if query:
        if "=" not in query:
            raise SystemExit("--query must be name=value")
        name, value = query.split("=", 1)
        one["query"] = {name: value}
    return [one]


def xsiam(args: list[str]) -> dict:
    mock_id = flag(args, "--mock")
    integration = flag(args, "--integration")
    instance = flag(args, "--instance-name")
    config = api("GET", "/api/v1/mocks/" + quote(mock_id) + "/instance-config")
    result = configure_instance(config, integration, instance, "--dry-run" in args)
    return {"xsiam": result}


def mock_body(args: list[str]) -> dict:
    spec = optional(args, "--spec")
    yml = optional(args, "--from-yml")
    if spec:
        return {"mockSpec": json.loads(Path(spec).read_text())}
    if not yml:
        raise SystemExit("mocks create and push need --from-yml or --spec")
    python = optional(args, "--python")
    client = None
    if python:
        source = Path(python)
        if not source.is_file():
            raise SystemExit(f"Python client not found: {python}")
        client = source.read_text(errors="replace")
        if len(client) > CLIENT_MAX:
            raise SystemExit("Python client is too large")
    return mock_body_from(Path(yml), optional(args, "--test-data"), client)


def api(method: str, path: str, body: dict | None = None) -> dict:
    creds = load_credentials()
    data = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(
        creds["url"] + path,
        data=data,
        method=method,
        headers={
            "Authorization": "Bearer " + creds["token"],
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            text = response.read().decode()
            parsed = json.loads(text) if text else {}
            parsed["_status"] = response.status
            return parsed
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors="replace")[:500]
        raise SystemExit(f"PAN Parrot {method} {path} failed ({error.code}): {detail}") from error


def flag(args: list[str], name: str) -> str:
    value = optional(args, name)
    if not value:
        raise SystemExit(f"Missing {name}")
    return value


def optional(args: list[str], name: str) -> str | None:
    if name not in args:
        return None
    index = args.index(name)
    if index + 1 >= len(args):
        raise SystemExit(f"Missing value for {name}")
    return args[index + 1]


def quote(value: str) -> str:
    return urllib.parse.quote(value, safe="")


HELP = """panparrot [--json] <command>

  version
  login --url https://your-site --token pp_...
  presets [--q text]
  mock from-integration <integration.yml> [--python file] [--test-data dir]
  mock fetch --mock <id> [--since name] [--first-fetch name] [--time-field name] [--window seconds] [--per-poll n] [--no-dedup] [--reset] [--off]
  mock state --mock <id> [--id-field name] [--reset] [--off]
  mock scenario --mock <id> [--step 202] [--step 200:{"job":"done"}] [--file steps.json] [--loop|--last] [--reset] [--off]
  mocks list
  mocks create --from-yml Integration.yml [--python file] [--test-data dir]
  mocks create --from-yml Integration.yml [--test-data dir]
  mocks push --from-yml Integration.yml [--test-data dir]
  mocks push --mock <id> --spec mock.json
  mocks logs --mock <id>
  assert --mock <id> --file expectations.json
  assert --mock <id> --method GET --path /hello [--query name=value]
  instance-config --mock <id>
  xsiam configure-instance --mock <id> --integration <id> --instance-name <n> [--dry-run]

--json prints one JSON object on stdout. XSIAM credentials stay in
DEMISTO_BASE_URL, DEMISTO_API_KEY, and XSIAM_AUTH_ID and are not sent to PAN Parrot.
"""
