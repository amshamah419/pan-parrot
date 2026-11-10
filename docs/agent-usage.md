# PAN Parrot for a coding agent

A coding agent can create the mock, read the instance fields, and configure XSIAM without opening the studio. XSIAM credentials never go to PAN Parrot. XSIAM has to be able to reach the catch URL on panparrot.com.

## Copy-paste prompt

```
You are configuring a PAN Parrot mock for the integration in this directory.

1. Ask the user for a PAN Parrot personal API token (scopes mocks:read and mocks:write, shown once on the dashboard). Do not invent one.
2. panparrot --json login --url https://<panparrot-site> --token pp_...
3. panparrot --json mocks create --from-yml <Integration>.yml --test-data <test_data dir>
   Repeat the same command to update that integration id and version. It upserts.
4. panparrot --json instance-config --mock <id>
   Put baseUrl in the integration URL parameter. Use the returned param names and values. They come from the integration YAML.
5. The user exports DEMISTO_BASE_URL, DEMISTO_API_KEY, and XSIAM_AUTH_ID in the shell. Do not send those values to PAN Parrot, and do not write them into the repo.
6. panparrot --json xsiam configure-instance --mock <id> --integration <integration id> --instance-name <n> --dry-run
7. Show the payload. After the user agrees, run the same command without --dry-run.
   XSIAM must be able to reach the catch URL.
```

## Token

On the dashboard, name the token, set the expiry (default 90 days, maximum 365), and choose `mocks:read` and `mocks:write`. The secret is shown once and stored as a SHA-256 hash. A disabled @paloaltonetworks.com user cannot use it. Admins can see and revoke every token.

`/api/v1/*` answers only when `Authorization: Bearer pp_…` is a live token. Anything else is the same plain `404 Not found` a stranger gets, including `/api/v1/openapi.json`.

## CLI

Install from this repo, no PyPI publish:

```bash
pipx install "git+https://github.com/amshamah419/pan-parrot.git#subdirectory=py/panparrot"
```

```bash
panparrot --json login --url https://<site> --token pp_...
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
| GET | `/api/v1/presets?q=` | mocks:read |
| GET | `/api/v1/mocks` | mocks:read |
| POST | `/api/v1/mocks` | mocks:write |
| GET | `/api/v1/mocks/{id}` | mocks:read |
| PUT | `/api/v1/mocks/{id}` | mocks:write |
| DELETE | `/api/v1/mocks/{id}` | mocks:write |
| GET | `/api/v1/mocks/{id}/logs` | mocks:read |
| GET | `/api/v1/mocks/{id}/instance-config` | mocks:read |

`POST /api/v1/mocks` takes one of `preset`, `openapi`, `yaml` (plus optional `testData`), or `mockSpec`. `integrationId` and `version` upsert that pair. Bodies are limited to the spec size cap (512 KB). `instance-config` returns `baseUrl` and the YAML parameter names, types, and values, including the catch URL, `insecure`, and `proxy`.

## XSIAM

`xsiam configure-instance` reads the instance config from PAN Parrot, then calls the same endpoint demisto-sdk uses: `PUT /xsoar/settings/integration` after `POST /xsoar/settings/integration/search`. The module configuration is the installed integration on the tenant. Parameter values from PAN Parrot are written onto that configuration by name. An instance with the same name is deleted and created again, which is what `XsoarClient.create_integration_instance` does. `--dry-run` prints that payload and does not change the tenant.

Required environment variables, same as demisto-sdk:

```bash
export DEMISTO_BASE_URL=https://api-<tenant>.xdr.<region>.paloaltonetworks.com
export DEMISTO_API_KEY=<standard key with Instance Administrator>
export XSIAM_AUTH_ID=<auth id>
```

The API key is sent only to `DEMISTO_BASE_URL`, with header `x-xdr-auth-id`. It is not included in the PAN Parrot request.
