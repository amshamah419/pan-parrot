# PAN Parrot for content developers

Unofficial personal tool. It is not a Palo Alto Networks product and it does not run inside corporate infrastructure. Do not send secrets, credentials, customer data, or production traffic.

Sign-in is an 8-digit code emailed to a `@paloaltonetworks.com` address. There is no password.

## First minute

1. Sign in, then choose **Mock an integration**. Start with **Akamai WAF SIEM**, or paste one JSON sample.
2. Copy the catch URL on the next screen. It looks like `https://<site>/catch/<path>`.
3. Paste that URL into the XSOAR integration's server field. Send one call. It shows up in the request log on the dashboard.

The studio also shows a "try" URL with the path the integration will append, such as `/siem/v1/configs/{configId}`.

If the mock came from a preset or an integration YAML, the same screen lists the XSOAR instance fields: the server parameter (the catch URL), the dummy credential in that integration's own parameter name, Trust any certificate, Use system proxy, and fetch. Copy one field or download the instance JSON. The JSON is the `{ brand, data: [{ name, value }] }` object XSOAR imports. Leave Fetch incidents off until a manual command shows up in the log.

## What you can point at a catch URL

- A verified preset follows a public vendor reference. The badge says so. Most catalog presets are a **guessed shape** built from the integration's sample, README, or YAML. Treat a guessed shape as a starting point and edit it.
- Paste an OpenAPI 3, Swagger 2, Postman collection, WSDL, or XSOAR integration YAML. A YAML becomes one operation per command, at most 12.
- The **Match** tab picks an operation by method, path, query, headers, and a small JSONPath or XPath.
- The **Flow** tab can save records, play a sequence, or reveal one time window per poll. Those stay off until you turn them on.
- The **Auth** tab checks dummy credentials (API key, basic, bearer, OAuth2, AWS SigV4, Digest, HS256 JWT, WS-Security, NTLM, and a few vendor formats). OAuth2 can return `expires_in` and a `refresh_token`. Use dummy values. Mutual TLS is not available.
- Pagination sits next to the operation. Offset/limit, page number, cursor/next token, Link header, and an Akamai offset line all walk the virtual record count. On the Chaos tab, Fetch backoff returns 429 with `Retry-After` and `X-RateLimit-*` after N calls in a window, so a fetch-incidents loop can practice backing off.
- The **Push** tab can POST generated events to a public `https` webhook. The signing secret is stored encrypted and is not shown again.

A normal page stops at 500 records and 2 MB. Streamed NDJSON and file downloads stop at 6 MB. Ask for the next page with the preset's `limit` and offset or cursor.

## Share a mock

The catch URL itself is open to anyone who has the link. Sharing changes who can open the studio:

- The owner can add up to 20 `@paloaltonetworks.com` addresses as view or edit, and can publish the mock to the shared catalog.
- A published mock can be opened read-only and cloned by anyone signed in. Clone makes your own copy. The push signing secret is not copied.
- Each save keeps the previous spec. **Revert** restores one of the last 15.

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
