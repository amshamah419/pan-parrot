# PAN Parrot for content developers

Unofficial personal tool. It is not a Palo Alto Networks product and it does not run inside corporate infrastructure. Do not send secrets, credentials, customer data, or production traffic.

Sign-in is an 8-digit code emailed to a `@paloaltonetworks.com` address. There is no password. Someone who is not signed in only sees that page. The catalog, docs, and app code are not sent until the sign-in cookie is valid.

A generated catch path is 128 random bits. On the mock page, **Lock this catch URL** adds a token. Callers then send `x-pan-parrot-lock` or `?lock=`. Without it, the catch URL answers `404 Not found`, the same as a path that does not exist. Admins can turn on **New mocks are locked** so every new mock starts that way. The token is shown once. **Email me on the first call** is off until you turn it on. That note names the mock and does not include the request.

## First minute

1. Sign in, then choose **Mock an integration**. Start with **Akamai WAF SIEM**, or paste one JSON sample.
2. Copy the catch URL on the next screen. It looks like `https://<site>/catch/<path>`.
3. Paste that URL into the XSOAR integration's server field. Send one call. It shows up in the request log on the dashboard.

The studio also shows a "try" URL with the path the integration will append, such as `/siem/v1/configs/{configId}`.

## XSIAM samples

The **XSIAM** link on the dashboard lists dataset samples taken from demisto/content. Each field name is a key in that pack's modeling-rule schema. A value is copied from the pack's `test_data` only when the file already has that key. If the test data has none of the keys, the sample is empty and the field is marked "not in test_data". The correlation section quotes the pack's correlation-rule YAML, including its XQL. Download sample writes that JSON. It is not a live XSIAM tenant.

## Request log

The dashboard lists calls that hit your catch URLs.

- Search matches method, status, path, headers, and body. The filters under it narrow one of those at a time.
- **Copy as cURL** and **Copy as Python** leave out headers stored as `[redacted]`.
- **Replay** sends that captured call to a public `https` URL. Localhost, private addresses, and ports other than 443 are rejected, the same checks used by Push. Redacted headers are not sent.
- Check two calls and choose **Compare two calls** for a side-by-side diff.
- Press `?` for the shortcut list. The color theme control on the notice follows your system setting until you pick Light or Dark. That choice stays in this browser. `t` cycles System, Light, and Dark.

If the mock came from a preset or an integration YAML, the same screen lists the XSOAR instance fields: the server parameter (the catch URL), the dummy credential in that integration's own parameter name, Trust any certificate, Use system proxy, and fetch. Copy one field or download the instance JSON. The JSON is the `{ brand, data: [{ name, value }] }` object XSOAR imports. Leave Fetch incidents off until a manual command shows up in the log.

## Integrations in progress

Use **Mock an integration → In progress** while a pack is still being written.

1. Paste the integration `.yml`, or enter a demisto/content path such as `Packs/HelloWorld/Integrations/HelloWorld`. The path is read from the public `demisto/content` repository. It is not a general URL.
2. Optionally add `test_data/*.json` files, or paste the Python client. A file whose name matches the command (`hello-world.json`, `hello_world.json`) becomes that command's response. A `mock_response` or XSOAR `Contents` wrapper is unwrapped first. Files larger than 8 KB still set the field shape, and the mock generates values instead of returning the raw file.
3. Commands without test data use the YAML `outputs` context paths. Commands with neither outputs nor arguments are listed and do not get an operation.
4. The path is the HTTP call in that command's Python function when it can be found, including one hop from `client.method()` to the client method. Otherwise a `METHOD /path` in the command description is used. Otherwise the path is `/command-name`. On the mock page, **Command coverage** lets you type a different method and path. That mapping is what the catch URL matches.
5. The same section has **Download instance JSON**. That download was already on the mock page for presets and YAML imports. It is the `{ brand, data: [{ name, value }] }` object XSOAR imports, with the catch URL in the server field and dummy credentials. Save the mock before you rely on a later edit.

The coverage line counts how many commands have a mock, how many use test_data, and how many are guessed. A command with no shape stays in the table as "no mock".

## Admin

`ashamah@paloaltonetworks.com` is always an admin. Other admins are the addresses in `ADMIN_EMAILS`, plus anyone an admin promotes on the People tab. That promotion is stored in the database. The founding address cannot be demoted, suspended, or deleted.

Open **Admin Panel** on the dashboard. The page has five tabs.

- **Health** shows whether the API, database, email, and catch handler are up, using the same database check as `GET /api/health`. It also shows catch-traffic latency, error rate, and 4xx/5xx counts for the last 24 hours and 7 days, rate-limit hits, sign-in attempts, failures, and lockouts, storage against the capture and mock quotas, the busiest mocks and people, recent server errors, and the app version and commit. These numbers are rows in this database. There is no paid monitoring service.
- **People** searches accounts. You can promote or demote an admin, suspend or unsuspend someone (that signs them out and blocks their catch URLs), revoke their sessions or personal tokens, purge captured calls, or delete the account and its data.
- **Mocks** searches every mock. Disable blocks the catch URL. Purge requests deletes captured calls and leaves the mock.
- **Invites** sends a Resend email with a 7-day link to the public sign-in page for one or more `@paloaltonetworks.com` addresses. Non-PAN addresses are rejected the same way sign-up rejects them. An invite is pending, accepted, or expired, and can be resent or revoked. **Require an invite for new sign-ups** is off until an admin turns it on. When it is on, a new address that was not invited gets the same "check your email" message and no code. Existing accounts, and the founding admin, can still sign in.
- **Audit** lists admin actions along with shares, saves, and purges.

## What you can point at a catch URL

- A verified preset follows a public vendor reference. The badge says so. Most catalog presets are a **guessed shape** built from the integration's sample, README, or YAML. Treat a guessed shape as a starting point and edit it.
- Paste an OpenAPI 3, Swagger 2, Postman collection, WSDL, or XSOAR integration YAML. A YAML becomes one operation per command, at most 12.
- The **Match** tab picks an operation by method, path, query, headers, and a JSONPath or XPath. JSONPath can use `[*]`, `..name`, and one `[?(@.field=="value")]`. XPath can use `[2]`, `[@attr="value"]`, and `[text()="value"]`. Filters and predicates do not run scripts.
- The **Flow** tab can save records, play a sequence, or reveal one time window per poll. Those stay off until you turn them on.
- The **Auth** tab checks dummy credentials (API key, basic, bearer, OAuth2, AWS SigV4, Digest, HS256 JWT, WS-Security, NTLM, and a few vendor formats). OAuth2 can return `expires_in` and a `refresh_token`. Use dummy values. Mutual TLS is not available.
- AWS STS and SQS fetch presets answer the query protocol. Point the boto3 client `endpoint_url` at the catch URL. `AssumeRole` returns temporary credentials (`ASIADUMMYEXAMPLE0001`, the dummy secret, and `dummy-session-token`). Use those for `GetCallerIdentity`, then for SQS `ReceiveMessage` and `DeleteMessage`. Current boto3 SQS speaks JSON (`X-Amz-Target AmazonSQS.ReceiveMessage`). The same preset still returns query XML when the body is `Action=ReceiveMessage`. Signature checks are off until **Auth → AWS SigV4 → Check the signature**. A bad signature is `403` with `SignatureDoesNotMatch` XML. The dummy key is sealed when the mock is saved. STS checks service `sts` and SQS checks service `sqs`. One catch URL that answers both needs `"anyService": true` on that SigV4 block.
- Pagination sits next to the operation. Offset/limit, page number, cursor/next token, Link header, and an Akamai offset line all walk the virtual record count. On the Chaos tab, Fetch backoff returns 429 with `Retry-After` and `X-RateLimit-*` after N calls in a window, so a fetch-incidents loop can practice backing off. Virtual records is how many unique records the catalog holds. One HTTP response still stops at 500.
- Under the catch URL, Chaos and load test, Auth, Flow, Push, Export fixtures, and Share jump to that section.
- A GraphQL schema pasted on the API spec tab, or toggled on the Shape tab, answers POST /graphql from the selection set. Use first and after to page a connection. The Match tab can require an operation name. The chaos switch GraphQL error in the body returns data null and an errors array.
- The **Push** tab can POST generated events to a public `https` webhook. The signing secret is stored encrypted and is not shown again.

A normal page stops at 500 records and 2 MB. Streamed NDJSON and file downloads stop at 6 MB. Ask for the next page with the preset's `limit` and offset or cursor.

## Share a mock

The catch URL itself is open to anyone who has the link. Sharing changes who can open the studio:

- The owner can add up to 20 `@paloaltonetworks.com` addresses as view or edit, and can publish the mock to the shared catalog.
- A published mock can be opened read-only and cloned by anyone signed in. Clone makes your own copy. The push signing secret is not copied.
- Each save keeps the previous spec. The list says what **Revert** would change before you click it. Revert restores one of the last 15.

## CLI

Create a personal token on the dashboard. It is shown once. The server stores a hash.

```bash
npm run parrot -- login --url https://<site> --token pp_...
npm run parrot -- mocks
npm run parrot -- create --name "Hello" --yaml HelloWorld.yml
npm run parrot -- create --name "GitHub" --preset github-github
npm run parrot -- export <endpoint-id> --out ./tests
```

`login` writes `~/.config/pan-parrot/credentials.json` mode `0600`. The pytest export uses `requests_mock` and does not call the live catch URL. Dummy credentials are not copied into the export.

**Export test_data** writes `test_data/*.json` files whose contents are the raw HTTP body, plus a README with the `util_load_json` snippet. Sequence steps that have a body are separate files. **Fixtures from captured calls** does the same from response previews of calls that already hit the catch URL. The shape diff lists fields the preset expects and the pasted JSON does not, and the reverse.

More routes are in [API.md](API.md). Deploy steps are in [GO_LIVE.md](GO_LIVE.md).
