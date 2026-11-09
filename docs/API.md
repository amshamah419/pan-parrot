# PAN Parrot API

Personal tokens and the commands a content developer uses. Sign in on the site, create a token on the dashboard, and pass it as `Authorization: Bearer pp_...`. The token is shown once. The server stores only a SHA-256 hash.

Creating, listing, and revoking tokens requires the browser session. A token cannot mint another token.

## Tokens

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/tokens` | session | Body `{ "name": "laptop" }`. Response includes `token` once. |
| GET | `/api/tokens` | session | Active tokens: name, prefix, created, last used. |
| DELETE | `/api/tokens/:id` | session | Revoke. |

At most 5 active tokens per user.

## Mocks

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/endpoints` | session or token | List your mocks. |
| POST | `/api/endpoints` | session or token | Body `{ "name", "customPath?", "mockSpec?" }`. |
| GET | `/api/endpoints/:id` | session or token | One mock, including its spec. |
| PUT | `/api/endpoints/:id/spec` | session or token | Body `{ "mockSpec" }`. |
| DELETE | `/api/endpoints/:id` | session or token | Delete the mock. |
| POST | `/api/specs/import` | session or token | Body `{ "text" }` or `{ "url" }`. OpenAPI, Swagger, Postman, WSDL, XML, or an XSOAR integration YAML. |
| GET | `/api/endpoints/:id/export` | session or token | JSON files `test_pan_parrot.py` and `test_data.json`. `?format=zip` downloads both. |

An integration YAML is recognized by `script.commands`. Each command becomes one operation. The path is `/command-name` unless the command description contains `METHOD /path`. Commands without outputs echo their argument names. The result is a shape, not a vendor-verified mock. At most 12 commands are imported.

The pytest file registers those samples with `requests_mock` and does not call the catch URL. Dummy credentials configured on the mock are not copied into the export.

## CLI

```bash
npm run parrot -- login --url https://your-site --token pp_...
npm run parrot -- mocks
npm run parrot -- create --name "Hello" --yaml HelloWorld.yml
npm run parrot -- create --name "GitHub" --preset github-github
npm run parrot -- export <endpoint-id> --out ./tests
```

`login` writes `~/.config/pan-parrot/credentials.json` mode `0600`. `PAN_PARROT_URL` and `PAN_PARROT_TOKEN` override that file. The token is not printed again.
