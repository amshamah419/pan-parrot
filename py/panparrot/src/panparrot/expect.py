"""Check captured catch-URL calls against a local expectation file."""

from __future__ import annotations


def check_expectations(logs: list[dict], expectations: list[dict]) -> list[dict]:
    results = []
    for raw in expectations:
        if not isinstance(raw, dict):
            results.append({"pass": False, "error": "Each expectation must be an object"})
            continue
        method = str(raw.get("method") or "").upper()
        path = str(raw.get("path") or "")
        if not method or not path.startswith("/"):
            results.append({"pass": False, "method": method, "path": path, "error": "method and a /path are required"})
            continue
        query = {str(key): str(value) for key, value in (raw.get("query") or {}).items()} if isinstance(raw.get("query"), dict) else {}
        body_includes = raw.get("bodyIncludes")
        status = raw.get("status")
        minimum = raw.get("min")
        maximum = raw.get("max")
        if minimum is None:
            minimum = 0 if maximum == 0 else 1
        found = [
            log
            for log in logs
            if _matches(log, method, path, query, status, body_includes)
        ]
        ok = len(found) >= int(minimum) and (maximum is None or len(found) <= int(maximum))
        results.append(
            {
                "pass": ok,
                "method": method,
                "path": path,
                "expectedMin": int(minimum),
                "expectedMax": None if maximum is None else int(maximum),
                "found": len(found),
            }
        )
    return results


def load_expectations(value) -> list[dict]:
    if isinstance(value, list):
        return value
    if isinstance(value, dict) and isinstance(value.get("calls"), list):
        return value["calls"]
    raise ValueError("Expectations must be a list or {\"calls\": [...]}")


def _matches(log: dict, method: str, path: str, query: dict, status, body_includes) -> bool:
    if str(log.get("method") or "").upper() != method:
        return False
    if not _path_matches(str(log.get("path") or ""), path):
        return False
    if status is not None and int(log.get("status") or 0) != int(status):
        return False
    seen = {str(key): str(value) for key, value in (log.get("query") or {}).items()}
    for key, value in query.items():
        if seen.get(key) != value:
            return False
    if body_includes is not None and str(body_includes) not in str(log.get("body") or ""):
        return False
    return True


def _path_matches(stored: str, expected: str) -> bool:
    stored = _clean(stored)
    expected = _clean(expected)
    return stored == expected or stored.endswith(expected)


def _clean(path: str) -> str:
    path = path.split("?", 1)[0]
    if not path.startswith("/"):
        path = "/" + path
    if len(path) > 1:
        path = path.rstrip("/")
    return path or "/"
