# PAN Parrot for a coding agent

A coding agent can create the mock, read the instance fields, and configure XSIAM without opening the studio. XSIAM credentials never go to PAN Parrot. XSIAM has to be able to reach the catch URL on panparrot.com.

## End-to-end recipe

Follow this block in order. Do not add steps. Do not send `DEMISTO_BASE_URL`, `DEMISTO_API_KEY`, or `XSIAM_AUTH_ID` to PAN Parrot.

```
You are testing the XSOAR integration in this directory against PAN Parrot. Do these steps in order. Stop at the first failure and show the command and its output. Do not invent a token, a tenant URL, or an API path. Do not write secrets into the repo. Do not install panparrot from git. The repository is private and the package is not on public PyPI.

1. Ask the user for the PAN Parrot site URL and a personal API token. The token starts with pp_ and needs scopes mocks:read and mocks:write. Do not invent one. Do not put that token in a pipx URL. On the dashboard API tokens page, copy the install command. That command uses a separate cli:download token that lasts 1 hour and can only download the wheel. Run that command, then panparrot version. Stop if it does not print a version.

2. Run:
   panparrot --json login --url <the URL they gave> --token <the token they gave>
   Stop if ok is not true.

3. Find the integration YAML in this directory, the file that contains commonfields.id. Run:
   panparrot --json coverage <that file>
   Then:
   panparrot --json mock from-integration <that file>
   Keep mock.id, mock.url, and routes from the JSON. Each route has command, method, and path. The output also lists vendor, approximate, or missing for each command. Stop if ok is not true.

4. Run, with that mock id:
   panparrot --json mock fetch --mock <mock.id> --reset
   panparrot --json mock state --mock <mock.id> --reset
   panparrot --json mock scenario --mock <mock.id> --step 202 --step 200:{"job":"done"} --loop --reset
   Use scenario when a command polls: the first call is accepted, the next call is done, then it repeats. Skip this command when the integration does not poll.
   Stop if either ok is not true. Fetch answers since and first_fetch polls with one time window each. State stores a POST and serves that copy on GET, PUT, and DELETE. Leave the XSOAR Fetch incidents checkbox off.

5. Check that DEMISTO_BASE_URL, DEMISTO_API_KEY, and XSIAM_AUTH_ID are already exported. If one is missing, stop and ask the user to export it. Do not print the API key. Do not pass those values to panparrot.

6. Read commonfields.id from the YAML. That is the integration id. Run:
   panparrot --json xsiam configure-instance --mock <mock.id> --integration <integration id> --instance-name panparrot-lab --dry-run
   Show the user the payload. Wait until they say yes. Then run the same command without --dry-run. Stop if ok is not true. The tenant must be able to reach mock.url.

7. Run the integration commands on the tenant. Set ROOT to DEMISTO_BASE_URL with any trailing slash removed. If ROOT does not end with /xsoar, append /xsoar. Send the API key only to that host.

   curl -sS -w '\nHTTP_STATUS:%{http_code}\n' -X POST "$ROOT/incident" \
     -H "Authorization: $DEMISTO_API_KEY" \
     -H "x-xdr-auth-id: $XSIAM_AUTH_ID" \
     -H "Accept: application/json" \
     -H "Content-Type: application/json" \
     --data '{"type":"Unclassified","name":"panparrot-lab","createInvestigation":true}'

   Stop unless the status line is HTTP_STATUS:200. Keep the incident id. If the JSON is a list, use the first id. If the status is 404, stop and show the body. Do not try another path.

   For each command under script.commands, run:
   curl -sS -w '\nHTTP_STATUS:%{http_code}\n' -X POST "$ROOT/entry/execute/sync" \
     -H "Authorization: $DEMISTO_API_KEY" \
     -H "x-xdr-auth-id: $XSIAM_AUTH_ID" \
     -H "Accept: application/json" \
     -H "Content-Type: application/json" \
     --data '{"investigationId":"<incident id>","data":"!<command name>"}'

   Append each required argument as a space and name=value inside data. Use the argument defaultvalue from the YAML when it has one, otherwise the string test. If the route path contains {id} and an earlier command in this run returned an id, pass that id in the argument that fills the path. Stop unless the status line is HTTP_STATUS:200. If any entry has Type 4, stop and show that entry. If the status is 404, stop and show the body. Do not try another path.

8. Write expectations.json in this directory. Do not commit it. One object per route from step 3:
   {"method":"<route.method>","path":"<route.path>","min":1}
   If the path contains {id}, replace {id} with the id used in step 7. Then run:
   panparrot --json assert --mock <mock.id> --file expectations.json
   If ok is false, show the assertions array and stop. Do not change the mock or the integration to hide a miss.
```

## Token

On the dashboard, name the token, set the expiry (default 90 days, maximum 365), and choose `mocks:read` and `mocks:write`. The secret is shown once and stored as a SHA-256 hash. A disabled @paloaltonetworks.com user cannot use it. Admins can see and revoke every token.

`/api/v1/*` is a quiet 404 without a live credential. API calls use `Authorization: Bearer pp_…` with `mocks:read` or `mocks:write`. The install URL uses a separate `cli:download` token as HTTP Basic. That scope can download `/api/v1/cli` and nothing else. A signed-in browser session can also download the wheel. A missing or rejected credential is the same plain `404 Not found`, including `/api/v1/openapi.json`. A download token that calls a mock route is `403`.

## CLI

The package is not on public PyPI, and the git repo is private. The dashboard API tokens page mints a `cli:download` token that lasts 1 hour and puts it in:

```bash
pipx install "https://<download token>@<your-site>/api/v1/cli/panparrot-0.1.0-py3-none-any.whl"
```

That token can only download the wheel. It cannot read or change mocks. Do not paste a `mocks:read` / `mocks:write` token into the URL. `panparrot version` uses the login token to check for a newer wheel and does not print either token.

```bash
panparrot version
panparrot --json login --url https://<site> --token pp_...
panparrot --json presets --q github
panparrot --json coverage Integrations/GitHub/GitHub.yml
panparrot --json mock from-integration Integrations/HelloWorld/HelloWorld.yml
panparrot --json mock fetch --mock <id> --window 300 --per-poll 3 --reset
panparrot --json mock state --mock <id> --reset
panparrot --json mock scenario --mock <id> --step 202 --step 200:{"job":"done"} --loop --reset
panparrot --json assert --mock <id> --method GET --path /hello --query since=2020-01-01T00:00:00Z
panparrot --json mocks list
panparrot --json mocks create --from-yml Integrations/HelloWorld/HelloWorld.yml --test-data Integrations/HelloWorld/test_data
panparrot --json mocks push --from-yml Integrations/HelloWorld/HelloWorld.yml
panparrot --json mocks logs --mock <id>
panparrot --json instance-config --mock <id>
panparrot --json xsiam configure-instance --mock <id> --integration HelloWorld --instance-name lab --dry-run
```

Every command accepts `--json` and prints one object on stdout. `login` stores the token in the OS keyring when that library is installed, and otherwise in `~/.config/panparrot/credentials.json` mode `0600`.

## REST

`GET /api/v1/openapi.json` is the OpenAPI 3 document.

| Method | Path | Scope |
| --- | --- | --- |
| GET | `/api/v1/presets?q=` | mocks:read | Returns `commandCoverage` (`vendor`, `approximate`, `missing`, `total`) when that preset has been scored. |
| GET | `/api/v1/mocks` | mocks:read |
| POST | `/api/v1/mocks` | mocks:write |
| GET | `/api/v1/mocks/{id}` | mocks:read |
| PUT | `/api/v1/mocks/{id}` | mocks:write |
| DELETE | `/api/v1/mocks/{id}` | mocks:write |
| GET | `/api/v1/mocks/{id}/logs` | mocks:read |
| GET | `/api/v1/mocks/{id}/instance-config` | mocks:read |

`PUT /api/v1/mocks/{id}` accepts `{fetch}` or `{state}` by itself and leaves the routes in place. `reset: true` on that body clears the saved cursor and records. `POST /api/v1/mocks` takes one of `preset`, `openapi`, `yaml` (plus optional `testData` and `clientSource`), or `mockSpec`. `clientSource` is the integration Python, used only to read HTTP paths. It is not executed and is not stored. `integrationId` and `version` upsert that pair. Bodies are limited to the spec size cap (512 KB). `instance-config` returns `baseUrl` and the YAML parameter names, types, and values, including the catch URL, `insecure`, and `proxy`.

## XSIAM

`xsiam configure-instance` reads the instance config from PAN Parrot, then calls the same endpoint demisto-sdk uses: `PUT /xsoar/settings/integration` after `POST /xsoar/settings/integration/search`. The module configuration is the installed integration on the tenant. Parameter values from PAN Parrot are written onto that configuration by name. An instance with the same name is deleted and created again, which is what `XsoarClient.create_integration_instance` does. `--dry-run` prints that payload and does not change the tenant.

Required environment variables, same as demisto-sdk:

```bash
export DEMISTO_BASE_URL=https://api-<tenant>.xdr.<region>.paloaltonetworks.com
export DEMISTO_API_KEY=<standard key with Instance Administrator>
export XSIAM_AUTH_ID=<auth id>
```

The API key is sent only to `DEMISTO_BASE_URL`, with header `x-xdr-auth-id`. It is not included in the PAN Parrot request.
