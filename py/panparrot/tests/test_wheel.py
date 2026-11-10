"""The committed wheel is the package a colleague installs."""

import base64
import hashlib
import importlib.util
import json
import os
import subprocess
import sys
import zipfile
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
RELEASE = ROOT / "server" / "cli-release.json"


def builder():
    spec = importlib.util.spec_from_file_location("build_cli_wheel", ROOT / "scripts" / "build-cli-wheel.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_committed_wheel_matches_the_package_source():
    committed = json.loads(RELEASE.read_text())
    raw = base64.b64decode(committed["wheel"])
    assert hashlib.sha256(raw).hexdigest() == committed["sha256"]
    assert committed["filename"] == f"panparrot-{committed['version']}-py3-none-any.whl"
    fresh = builder().wheel_bytes(committed["version"])
    assert zip_members(fresh) == zip_members(raw)


def test_wheel_installs_and_prints_its_version(tmp_path):
    committed = json.loads(RELEASE.read_text())
    wheel = tmp_path / committed["filename"]
    wheel.write_bytes(base64.b64decode(committed["wheel"]))
    target = tmp_path / "lib"
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "--disable-pip-version-check", "--no-deps", "--target", str(target), str(wheel)],
        stdout=subprocess.DEVNULL,
    )
    env = {**os.environ, "PYTHONPATH": str(target), "PANPARROT_CONFIG": str(tmp_path / "missing.json")}
    env.pop("PANPARROT_URL", None)
    env.pop("PANPARROT_TOKEN", None)
    out = subprocess.check_output([sys.executable, "-c", "from panparrot.cli import main; raise SystemExit(main(['version']))"], env=env, text=True)
    assert f"panparrot {committed['version']}" in out
    assert "login" in out


def zip_members(raw: bytes) -> dict[str, bytes]:
    with zipfile.ZipFile(BytesIO(raw)) as archive:
        return {info.filename: archive.read(info.filename) for info in archive.infolist()}
