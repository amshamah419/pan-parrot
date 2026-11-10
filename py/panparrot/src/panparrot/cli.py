import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from panparrot.config import load_credentials, save_credentials
from panparrot.xsiam import configure_instance


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
    if args[0] == "mocks":
        return mocks(args[1:])
    if args[0] == "instance-config":
        return {"instanceConfig": api("GET", "/api/v1/mocks/" + quote(flag(args[1:], "--mock")) + "/instance-config")}
    if args[0] == "xsiam" and len(args) > 1 and args[1] == "configure-instance":
        return xsiam(args[2:])
    raise SystemExit("Unknown command\n" + HELP)


def login(args: list[str]) -> dict:
    url = flag(args, "--url")
    token = flag(args, "--token")
    if not url or not token or not token.startswith("pp_"):
        raise SystemExit("login needs --url and --token pp_...")
    where = save_credentials(url, token)
    return {"url": url.rstrip("/"), "stored": where}


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
    text = Path(yml).read_text()
    body: dict = {"yaml": text}
    folder = optional(args, "--test-data")
    if folder:
        files = []
        for path in sorted(Path(folder).glob("*")):
            if path.is_file() and len(files) < 20 and path.stat().st_size <= 100_000:
                files.append({"name": path.name, "text": path.read_text(errors="replace")})
        body["testData"] = files
    return body


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

  login --url https://your-site --token pp_...
  mocks list
  mocks create --from-yml Integration.yml [--test-data dir]
  mocks push --from-yml Integration.yml [--test-data dir]
  mocks push --mock <id> --spec mock.json
  mocks logs --mock <id>
  instance-config --mock <id>
  xsiam configure-instance --mock <id> --integration <id> --instance-name <n> [--dry-run]

--json prints one JSON object on stdout. XSIAM credentials stay in
DEMISTO_BASE_URL, DEMISTO_API_KEY, and XSIAM_AUTH_ID and are not sent to PAN Parrot.
"""
