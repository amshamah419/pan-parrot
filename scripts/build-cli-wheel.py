#!/usr/bin/env python3
"""Write server/cli-release.json from the panparrot package.

The wheel is the installable CLI. It is served by the site to a signed-in
user or a personal token. It is not published to public PyPI.
"""

from __future__ import annotations

import base64
import hashlib
import io
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "py" / "panparrot" / "src" / "panparrot"
OUT = ROOT / "server" / "cli-release.json"


def version() -> str:
    init = (PACKAGE / "__init__.py").read_text()
    project = (ROOT / "py" / "panparrot" / "pyproject.toml").read_text()
    packaged = re.search(r'__version__\s*=\s*"([^"]+)"', init)
    declared = re.search(r'(?m)^version\s*=\s*"([^"]+)"', project)
    if not packaged or not declared or packaged.group(1) != declared.group(1):
        raise SystemExit("pyproject version and panparrot.__version__ must match")
    if not re.fullmatch(r"\d+\.\d+\.\d+", packaged.group(1)):
        raise SystemExit("CLI version must be major.minor.patch")
    return packaged.group(1)


def wheel_bytes(release: str) -> bytes:
    dist = f"panparrot-{release}.dist-info"
    files: dict[str, bytes] = {}
    for path in sorted(PACKAGE.glob("*.py")):
        files[f"panparrot/{path.name}"] = path.read_bytes()
    files[f"{dist}/METADATA"] = (
        "Metadata-Version: 2.1\n"
        "Name: panparrot\n"
        f"Version: {release}\n"
        "Summary: Create PAN Parrot mocks and configure an XSIAM integration instance.\n"
        "Requires-Python: >=3.11\n"
    ).encode()
    files[f"{dist}/WHEEL"] = (
        "Wheel-Version: 1.0\n"
        "Generator: panparrot\n"
        "Root-Is-Purelib: true\n"
        "Tag: py3-none-any\n"
    ).encode()
    files[f"{dist}/entry_points.txt"] = (
        "[console_scripts]\n"
        "panparrot = panparrot.cli:main\n"
    ).encode()
    record = []
    for name in sorted(files):
        digest = base64.urlsafe_b64encode(hashlib.sha256(files[name]).digest()).rstrip(b"=").decode()
        record.append(f"{name},sha256={digest},{len(files[name])}")
    record.append(f"{dist}/RECORD,,")
    files[f"{dist}/RECORD"] = ("\n".join(record) + "\n").encode()

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name in sorted(files):
            info = zipfile.ZipInfo(name)
            info.date_time = (1980, 1, 1, 0, 0, 0)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, files[name])
    return buffer.getvalue()


def main() -> None:
    release = version()
    raw = wheel_bytes(release)
    filename = f"panparrot-{release}-py3-none-any.whl"
    payload = {
        "version": release,
        "filename": filename,
        "sha256": hashlib.sha256(raw).hexdigest(),
        "requiresPython": ">=3.11",
        "wheel": base64.b64encode(raw).decode(),
    }
    OUT.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"{filename} {payload['sha256']}")


if __name__ == "__main__":
    main()
