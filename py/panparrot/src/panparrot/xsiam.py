"""Create or update an XSIAM integration instance the way demisto-sdk does.

demisto-sdk's XsoarClient.create_integration_instance PUTs /settings/integration.
On XSIAM and XSOAR 8 the demisto-py client prefixes that path with /xsoar when
XSIAM_AUTH_ID is set. This module never sends those credentials to PAN Parrot.
"""

from __future__ import annotations

import copy
import json
import os
import urllib.error
import urllib.parse
import urllib.request


def xsiam_env() -> dict:
    base = os.environ.get("DEMISTO_BASE_URL", "").rstrip("/")
    key = os.environ.get("DEMISTO_API_KEY", "")
    auth_id = os.environ.get("XSIAM_AUTH_ID", "")
    missing = [name for name, value in (
        ("DEMISTO_BASE_URL", base),
        ("DEMISTO_API_KEY", key),
        ("XSIAM_AUTH_ID", auth_id),
    ) if not value]
    if missing:
        raise SystemExit("Set " + ", ".join(missing) + " in the environment. They stay on this machine.")
    root = base if base.endswith("/xsoar") else base + "/xsoar"
    return {"root": root, "key": key, "auth_id": auth_id}


def xsiam_request(env: dict, method: str, path: str, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(
        env["root"] + path,
        data=data,
        method=method,
        headers={
            "Authorization": env["key"],
            "x-xdr-auth-id": env["auth_id"],
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            text = response.read().decode()
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors="replace")[:500]
        raise SystemExit(f"XSIAM {method} {path} failed ({error.code}): {detail}") from error
    return json.loads(text) if text else {}


def values_from_config(config: dict) -> dict:
    values = {}
    for param in config.get("params") or []:
        values[param["name"]] = param.get("value")
    return values


def build_instance_body(metadata: dict, values: dict, instance_name: str) -> dict:
    """Same fields as demisto_sdk XsoarClient.create_integration_instance."""
    body = {
        "brand": metadata["name"],
        "category": metadata.get("category") or "",
        "canSample": True,
        "configuration": metadata,
        "data": [],
        "enabled": "true",
        "engine": "",
        "id": "",
        "isIntegrationScript": True,
        "name": instance_name,
        "passwordProtected": False,
        "version": 0,
        "incomingMapperId": metadata.get("defaultMapperIn") or "",
        "mappingId": metadata.get("defaultClassifier") or "",
        "outgoingMapperId": metadata.get("defaultMapperOut") or "",
    }
    for raw in metadata.get("configuration") or []:
        param = copy.deepcopy(raw)
        name = param.get("name")
        display = param.get("display")
        if name in values or display in values:
            key = name if name in values else display
            raw_value = values[key]
            if key in {"credentials", "creds_apikey"} and isinstance(raw_value, dict):
                param["value"] = {
                    "credential": "",
                    "identifier": raw_value.get("identifier", ""),
                    "password": raw_value.get("password", ""),
                    "passwordChanged": False,
                }
            else:
                param["value"] = raw_value
            param["hasvalue"] = True
        elif param.get("defaultValue"):
            param["value"] = param["defaultValue"]
        body["data"].append(param)
    return body


def configure_instance(config: dict, integration_id: str, instance_name: str, dry_run: bool) -> dict:
    env = xsiam_env()
    found = xsiam_request(env, "POST", "/settings/integration/search", {})
    metadata = None
    for item in found.get("configurations") or []:
        if item.get("id") == integration_id:
            metadata = item
            break
    if metadata is None:
        raise SystemExit(f"XSIAM has no installed integration id {integration_id}")
    existing = next((item for item in found.get("instances") or [] if item.get("name") == instance_name), None)
    payload = build_instance_body(metadata, values_from_config(config), instance_name)
    result = {
        "method": "PUT",
        "url": env["root"] + "/settings/integration",
        "body": payload,
        "replaces": existing.get("id") if existing else None,
    }
    if dry_run:
        result["dryRun"] = True
        return result
    if existing and existing.get("id"):
        xsiam_request(env, "DELETE", "/settings/integration/" + urllib.parse.quote(str(existing["id"]), safe=""))
    created = xsiam_request(env, "PUT", "/settings/integration", payload)
    return {"dryRun": False, "replaced": bool(existing), "response": created}
