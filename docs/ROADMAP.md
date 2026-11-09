# PAN Parrot roadmap

Prioritized backlog for making PAN Parrot the tool an XSOAR or XSIAM content developer reaches for. Each pull request updates the status column.

Status: **done**, **in progress**, **todo**.

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| 1 | Coverage for integrations without sample JSON | todo | About 819 packs were skipped because they had no sample body. Derive a preset from the YAML (commands, context paths, arguments), the Python client's HTTP calls, and the README. Fix the 14 importer failures. Keep growing the Verified set with the same doc-check record used in `public/presets/VERIFICATION.md`. |
| 2 | Stateful and scenario mocks | done | Saved records (create, then GET/PUT/DELETE), an ordered call sequence, and fetch-over-time (`since` / `first_fetch`, one window per poll, dedup). Studio tab: Flow. Runtime state is capped at 200 records and 2,000 seen ids. |
| 3 | Request matching rules | todo | Path, method, a few query keys, and SOAPAction already select an operation. Still missing: match on headers and on a JSONPath or XPath in the body, with a simple rule list in the studio. |
| 4 | Record and replay | todo | Proxy one call to a URL the user supplies, with the existing SSRF checks, and save the response as the mock. Scrub secrets and obvious PII before storage. Do not store or log the credential used for that one call. |
| 5 | Developer workflow | todo | Personal API tokens and a documented REST API for creating mocks. Export a mock as pytest plus `requests_mock` fixtures and `test_data` JSON. A small CLI that matches how demisto-sdk is used. Build a mock from an integration YAML directly. |
| 6 | Outbound / push mode | todo | PAN Parrot sends events to a webhook or long-running listener (Generic Webhook, XSIAM HTTP collector), including a burst for a load test. The target URL must pass the same SSRF checks. |
| 7 | Remaining auth | todo | AWS SigV4 and WS-Security are not implemented. Mimecast's request signature is format-only. EdgeGrid signatures are checked. Mutual TLS cannot be terminated in a Netlify function; document that in the go-live notes rather than pretending to support it. |
| 8 | Large responses | todo | Pages and zip downloads stay at 500 records and 2 MB. Streaming toward Netlify's streamed response limit is not implemented. Document the ceiling next to the feature when it lands. |
| 9 | Collaboration and enterprise polish | todo | Share a mock with other `@paloaltonetworks.com` users, teams, version history, import/export, an audit log, an admin usage view, abuse controls, accessibility, dark mode, first-run onboarding, and per-integration "paste this into XSOAR" instructions. |
| 10 | Ops readiness | todo | Error monitoring hooks, a health check, backup and retention notes, Playwright in CI, a recorded load-test result, and `docs/GO_LIVE.md` with the exact Netlify, Netlify DB, Resend, env var, secret rotation, and smoke-test steps. |

## Defaults chosen without waiting

- Fetch simulation reveals one time window per poll, starting after the `since` or `first_fetch` query value. The default window is 5 minutes and the default batch is 3 records. Replaying the same `since` returns an empty page when dedup is on.
- Saved records and sequences are off until the Flow tab turns them on, so existing mocks stay stateless.
- A sequence step replaces the status and, when the body box is filled in, the body. After the last step, that last response repeats. Looping is stored on the spec but not exposed in the first version of the form.
