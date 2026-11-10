import json
import os

from panparrot.cli import main
from panparrot.xsiam import build_instance_body


def test_login_writes_a_private_file(tmp_path, monkeypatch, capsys):
    config = tmp_path / "credentials.json"
    monkeypatch.setenv("PANPARROT_CONFIG", str(config))
    monkeypatch.setattr("panparrot.config._keyring_save", lambda url, token: False)
    code = main(["--json", "login", "--url", "https://panparrot.example", "--token", "pp_testtoken"])
    assert code == 0
    body = json.loads(capsys.readouterr().out)
    assert body["ok"] is True
    assert body["stored"] == "file"
    assert oct(config.stat().st_mode & 0o777) == "0o600"
    saved = json.loads(config.read_text())
    assert saved["token"] == "pp_testtoken"


def test_mocks_list_uses_the_bearer_token(tmp_path, monkeypatch, capsys):
    config = tmp_path / "credentials.json"
    config.write_text(json.dumps({"url": "https://panparrot.example", "token": "pp_abc"}))
    os.chmod(config, 0o600)
    monkeypatch.setenv("PANPARROT_CONFIG", str(config))
    seen = {}

    class Response:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self):
            return b'{"mocks":[{"id":"m1","name":"Hello"}]}'

    def urlopen(request, timeout=0):
        seen["url"] = request.full_url
        seen["authorization"] = request.get_header("Authorization")
        seen["demisto"] = request.get_header("X-xdr-auth-id")
        return Response()

    monkeypatch.setattr("panparrot.cli.urllib.request.urlopen", urlopen)
    code = main(["--json", "mocks", "list"])
    assert code == 0
    assert seen["url"] == "https://panparrot.example/api/v1/mocks"
    assert seen["authorization"] == "Bearer pp_abc"
    assert seen["demisto"] is None
    assert json.loads(capsys.readouterr().out)["mocks"][0]["id"] == "m1"


def test_presets_search_sends_the_query(tmp_path, monkeypatch, capsys):
    config = tmp_path / "credentials.json"
    config.write_text(json.dumps({"url": "https://panparrot.example", "token": "pp_abc"}))
    os.chmod(config, 0o600)
    monkeypatch.setenv("PANPARROT_CONFIG", str(config))
    seen = {}

    class Response:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self):
            return b'{"presets":[{"id":"github-github","fidelity":"vendor","commandCoverage":{"vendor":33,"approximate":0,"missing":64,"total":97}}]}'

    def urlopen(request, timeout=0):
        seen["url"] = request.full_url
        seen["authorization"] = request.get_header("Authorization")
        return Response()

    monkeypatch.setattr("panparrot.cli.urllib.request.urlopen", urlopen)
    code = main(["presets", "--q", "git hub"])
    assert code == 0
    assert seen["url"] == "https://panparrot.example/api/v1/presets?q=git+hub"
    assert seen["authorization"] == "Bearer pp_abc"
    text = capsys.readouterr().out
    assert "github-github" in text
    assert "33 vendor" in text


def test_from_integration_sends_the_python_and_reads_instance_params(tmp_path, monkeypatch, capsys):
    folder = tmp_path / "HelloWorld"
    folder.mkdir()
    (folder / "HelloWorld.yml").write_text("name: HelloWorld\n")
    (folder / "HelloWorld.py").write_text("def hello_world_command():\n    return client._http_request('GET', '/hello')\n")
    (folder / "test_data").mkdir()
    (folder / "test_data" / "hello_world.json").write_text('{"Message": "hi"}')
    config = tmp_path / "credentials.json"
    config.write_text(json.dumps({"url": "https://panparrot.example", "token": "pp_abc"}))
    os.chmod(config, 0o600)
    monkeypatch.setenv("PANPARROT_CONFIG", str(config))
    seen = []

    class Response:
        status = 200

        def __init__(self, payload):
            self.payload = payload

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self):
            return json.dumps(self.payload).encode()

    def urlopen(request, timeout=0):
        body = json.loads(request.data.decode()) if request.data else None
        seen.append((request.full_url, body))
        if request.full_url.endswith("/instance-config"):
            return Response({"baseUrl": "https://panparrot.example/catch/abc", "params": [{"name": "url", "value": "https://panparrot.example/catch/abc"}]})
        return Response({
            "id": "m1",
            "name": "Hello World",
            "url": "https://panparrot.example/catch/abc",
            "created": True,
            "routes": [{"command": "hello-world", "method": "GET", "path": "/hello", "pathFrom": "client"}],
            "warnings": [],
        })

    monkeypatch.setattr("panparrot.cli.urllib.request.urlopen", urlopen)
    code = main(["--json", "mock", "from-integration", str(folder / "HelloWorld.yml")])
    assert code == 0
    posted = seen[0][1]
    assert posted["yaml"].startswith("name: HelloWorld")
    assert "clientSource" in posted and "/hello" in posted["clientSource"]
    assert posted["testData"][0]["name"] == "hello_world.json"
    assert seen[1][0] == "https://panparrot.example/api/v1/mocks/m1/instance-config"
    body = json.loads(capsys.readouterr().out)
    assert body["routes"][0]["path"] == "/hello"
    assert body["instanceConfig"]["params"][0]["value"].endswith("/catch/abc")


def test_dry_run_builds_the_demisto_sdk_payload(monkeypatch, capsys, tmp_path):
    config = tmp_path / "credentials.json"
    config.write_text(json.dumps({"url": "https://panparrot.example", "token": "pp_abc"}))
    monkeypatch.setenv("PANPARROT_CONFIG", str(config))
    monkeypatch.setenv("DEMISTO_BASE_URL", "https://tenant.example")
    monkeypatch.setenv("DEMISTO_API_KEY", "xsiam-secret")
    monkeypatch.setenv("XSIAM_AUTH_ID", "42")
    calls = []

    class Response:
        status = 200

        def __init__(self, payload):
            self.payload = payload

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self):
            return json.dumps(self.payload).encode()

    def urlopen(request, timeout=0):
        kind = "parrot" if "panparrot.example" in request.full_url else "xsiam"
        calls.append((kind, request.full_url, request.get_header("Authorization"), request.get_header("X-xdr-auth-id")))
        if kind == "parrot":
            return Response({"baseUrl": "https://panparrot.example/catch/abc", "params": [{"name": "url", "value": "https://panparrot.example/catch/abc"}]})
        return Response({
            "configurations": [{
                "id": "HelloWorld",
                "name": "HelloWorld",
                "category": "Utilities",
                "configuration": [{"name": "url", "display": "Server URL", "defaultValue": ""}],
            }],
            "instances": [],
        })

    monkeypatch.setattr("urllib.request.urlopen", urlopen)
    code = main([
        "--json", "xsiam", "configure-instance",
        "--mock", "m1", "--integration", "HelloWorld", "--instance-name", "lab", "--dry-run",
    ])
    assert code == 0
    body = json.loads(capsys.readouterr().out)
    assert body["xsiam"]["dryRun"] is True
    assert body["xsiam"]["url"] == "https://tenant.example/xsoar/settings/integration"
    assert body["xsiam"]["body"]["brand"] == "HelloWorld"
    assert body["xsiam"]["body"]["name"] == "lab"
    assert body["xsiam"]["body"]["enabled"] == "true"
    assert body["xsiam"]["body"]["isIntegrationScript"] is True
    url_param = body["xsiam"]["body"]["data"][0]
    assert url_param["value"] == "https://panparrot.example/catch/abc"
    assert url_param["hasvalue"] is True
    parrot = [item for item in calls if item[0] == "parrot"]
    xsiam = [item for item in calls if item[0] == "xsiam"]
    assert parrot and "xsiam-secret" not in str(parrot[0][2])
    assert parrot[0][3] is None
    assert xsiam and xsiam[0][1].endswith("/settings/integration/search")
    assert xsiam[0][2] == "xsiam-secret"
    assert not any(item[1].endswith("/settings/integration") for item in xsiam)


def test_payload_matches_the_sdk_credential_shape():
    metadata = {
        "name": "HelloWorld",
        "category": "Utilities",
        "configuration": [{"name": "credentials", "display": "API Key"}],
    }
    body = build_instance_body(metadata, {"credentials": {"identifier": "lab", "password": "dummy"}}, "lab")
    assert body["data"][0]["value"] == {
        "credential": "",
        "identifier": "lab",
        "password": "dummy",
        "passwordChanged": False,
    }
    assert body["version"] == 0
    assert body["mappingId"] == ""
