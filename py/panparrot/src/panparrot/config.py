import json
import os
from pathlib import Path


def config_path() -> Path:
    override = os.environ.get("PANPARROT_CONFIG")
    if override:
        return Path(override)
    return Path.home() / ".config" / "panparrot" / "credentials.json"


def load_credentials() -> dict:
    url = os.environ.get("PANPARROT_URL")
    token = os.environ.get("PANPARROT_TOKEN")
    stored: dict = {}
    path = config_path()
    if path.is_file():
        stored = json.loads(path.read_text())
    if not url or not token:
        url = url or _keyring_url(stored.get("url"))
        token = token or _keyring_token(stored.get("url") or url)
    url = url or stored.get("url")
    token = token or stored.get("token")
    if not url or not token:
        raise SystemExit("Run panparrot login, or set PANPARROT_URL and PANPARROT_TOKEN")
    return {"url": str(url).rstrip("/"), "token": token}


def save_credentials(url: str, token: str) -> str:
    origin = url.rstrip("/")
    if _keyring_save(origin, token):
        _write_file({"url": origin, "token": ""})
        return "keyring"
    _write_file({"url": origin, "token": token})
    return "file"


def _write_file(payload: dict) -> None:
    path = config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload))
    os.chmod(path, 0o600)


def _keyring_save(url: str, token: str) -> bool:
    try:
        import keyring
    except Exception:
        return False
    try:
        keyring.set_password("panparrot", url, token)
        return True
    except Exception:
        return False


def _keyring_token(url: str | None) -> str | None:
    if not url:
        return None
    try:
        import keyring
    except Exception:
        return None
    try:
        return keyring.get_password("panparrot", url)
    except Exception:
        return None


def _keyring_url(url: str | None) -> str | None:
    return url
