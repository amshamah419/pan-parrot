# Go live

PAN Parrot ships on Netlify. This is the checklist for the first production site. The repo already contains the build settings, functions, and database migrations. The steps below are the ones that happen in Netlify and Resend accounts.

Do not put the site on a `paloaltonetworks.com` hostname. Use a `netlify.app` name or a domain you control personally. The product is an unofficial tool. The threat model and the controls that ship with the app are in [SECURITY.md](SECURITY.md).

## What you do

1. Create a Netlify project from this GitHub repo, production branch `main`.
2. Let the first deploy create Netlify Database. Confirm the deploy log applied `netlify/database/migrations`.
3. Generate `SESSION_SECRET` and set the production environment variables below.
4. Verify a domain in Resend, create a sending API key, and set `EMAIL_FROM` on that domain.
5. Trigger a new deploy so the functions see the variables.
6. Run `npm run smoke -- https://<site>` from this repo.
7. Sign in as the address in `ADMIN_EMAILS`, open `/admin`, and confirm Signals says the database is up and sign-in email is configured.
8. Create one mock and send one request to its catch URL.

Leave `AUTH_DEV_EXPOSE_CODE` and `DATABASE_URL` unset on Netlify.

## 1. Create the site

In Netlify: **Add new project → Import an existing project**. Choose GitHub and `amshamah419/pan-parrot`. Production branch: `main`.

Netlify reads `netlify.toml`. Confirm these and do not replace them with a different build:

| Setting | Value |
| --- | --- |
| Build command | `npm run build:client` |
| Publish directory | `dist/spa` |
| Node | 22 (`NODE_VERSION` in `netlify.toml`) |
| Functions | `netlify/functions` (routes are declared on the functions: `/api/*` and `/catch/*`) |

The SPA fallback in `netlify.toml` is last on purpose so `/api` and `/catch` are not rewritten to `index.html`.

Connect Git. A manual `netlify deploy --prod` from a laptop is not the production path. The daily cleanup and the 15-minute push job run as scheduled functions on a published production deploy.

CLI equivalent, after `npx netlify login` and from a clean checkout of `main`:

```bash
npx netlify init
```

Accept the `netlify.toml` build when the CLI asks. Then use the Git connection for later deploys.

## 2. Netlify Database

`@netlify/database` is already a dependency. The first production deploy provisions Netlify Database (the current managed Postgres, not the retired Netlify DB extension and not a separate Neon account).

After that deploy:

1. Open the project → **Database**. It should be enabled. If the page says it is off, enable it and trigger another deploy.
2. Open the deploy log and confirm the migration files under `netlify/database/migrations` were applied. You do not run them yourself against production.
3. Leave `NETLIFY_DB_URL` alone. Netlify injects it. Do not copy it into `DATABASE_URL`.

Preview deploys get a database branch forked from production. Schema changes belong in a new SQL file in `netlify/database/migrations`. Do not edit a migration that has already deployed. `npm run db:migrate` and `npm run db:migrate:local` apply files to a local database only.

## 3. Environment variables

Generate the session secret on your machine. It must be at least 32 characters. The app refuses to sign a session with anything shorter.

```bash
openssl rand -base64 32
```

Set variables for the **production** context. In the UI that is Project → **Project configuration** → **Environment variables**. On the CLI, from a linked checkout:

```bash
npx netlify env:set SESSION_SECRET "$(openssl rand -base64 32)" --context production --secret
npx netlify env:set ADMIN_EMAILS "ashamah@paloaltonetworks.com" --context production
npx netlify env:set SITE_URL "https://<site>.netlify.app" --context production
npx netlify env:set RESEND_API_KEY "re_..." --context production --secret
npx netlify env:set EMAIL_FROM "PAN Parrot <noreply@your-domain>" --context production
```

`SITE_URL` is the public origin with no path and no trailing slash. Catch URLs and the sign-in email use it.

| Variable | Required | Notes |
| --- | --- | --- |
| `SESSION_SECRET` | yes | Output of `openssl rand -base64 32`. Signs the session cookie and encrypts dummy mock secrets. |
| `ADMIN_EMAILS` | yes | Comma-separated `@paloaltonetworks.com` addresses. Promoted to admin the next time that person signs in. Start with `ashamah@paloaltonetworks.com`. |
| `SITE_URL` | yes | Production origin, for example `https://<site>.netlify.app`. |
| `RESEND_API_KEY` | yes | Sending key from Resend. |
| `EMAIL_FROM` | yes | An address on the domain you verified in Resend. |
| `REQUEST_RETENTION_DAYS` | no | Default 14. Allowed range 1–90. |
| `MAX_REQUESTS_PER_ENDPOINT` | no | Default 200. Allowed range 1–5000. |
| `MAX_BODY_BYTES` | no | Default 262144 (256 KB). Hard ceiling 1 MB. Catch request bodies larger than this are rejected. |
| `MAX_REQUESTS_PER_USER` | no | Default 1000. Oldest captured calls across that person's mocks are deleted past this count. |
| `MAX_STORED_BODY_CHARS` | no | Default 16384. Captured bodies are shortened to this many characters before they are stored. |
| `EXTRA_ORIGINS` | no | Comma-separated extra browser origins if you add a custom domain before `SITE_URL` is updated. |

Optional rate-limit overrides, all integers: `RATE_AUTH_IP_MAX` (20 per 15 minutes), `RATE_AUTH_EMAIL_MAX` (5 per 15 minutes), `RATE_AUTH_VERIFY_IP_MAX` (10 per 15 minutes), `RATE_AUTH_VERIFY_EMAIL_MAX` (10 per 15 minutes), `RATE_API_USER_MAX` (180 per minute), `RATE_CATCH_IP_MAX` (300 per minute), `RATE_CATCH_ENDPOINT_MAX` (600 per minute), `RATE_CATCH_USER_MAX` (1200 per minute, across every mock that person owns), `RATE_PING_MAX` (60 per minute). Plus-addressed mail (`name+tag@paloaltonetworks.com`) counts as `name@paloaltonetworks.com` for these quotas and for the account.

Do not set these on Netlify:

- `AUTH_DEV_EXPOSE_CODE` — returns sign-in codes in the HTTP response. The server ignores it when `NODE_ENV` is production, and Netlify sets that, but leave the variable unset anyway.
- `DATABASE_URL` — production uses the Netlify Database adapter.
- `ADMIN_PASSWORD` — password login was removed.

Keep `RESEND_API_KEY`, `EMAIL_FROM`, and `SESSION_SECRET` on the production context. A deploy preview without them cannot send mail, which is what you want.

Changing a variable does not affect the deploy that is already live. Trigger a new deploy (Deploys → **Trigger deploy** → **Deploy project**) after the values are saved.

Netlify also provides `URL` and `DEPLOY_PRIME_URL`. The API allows those origins in addition to `SITE_URL`.

## 4. Resend

Sign-in codes go out through Resend. The app calls `https://api.resend.com/emails` with `RESEND_API_KEY`.

1. Create a Resend account at [resend.com](https://resend.com).
2. **Domains → Add domain**. Use a domain you control. Do not use `paloaltonetworks.com`.
3. Add every DNS record Resend shows for that domain. The hostnames and values are unique to the domain, so copy them from the Resend domain page (they are DKIM and SPF records). Wait until that page says **Verified**.
4. **API Keys → Create API key**. Sending access is enough. Copy the `re_...` value once into `RESEND_API_KEY`.
5. Set `EMAIL_FROM` to an address on the verified domain, including the display name: `PAN Parrot <noreply@your-domain>`.

The address `onboarding@resend.dev` only delivers to the inbox on the Resend account. It will not deliver codes to other `@paloaltonetworks.com` addresses. Do not use it for this site.

The message is plain text: an 8-digit code and a link. The link opens `/login` and waits for a button click so a mail gateway that prefetches links does not consume the code. Codes expire in 10 minutes. Five wrong attempts invalidate the code.

If sign-in returns 503 with "Email sending is not configured", one of the two variables is missing on that deploy. If it returns 502, Resend rejected the message: the function log line is `Email provider rejected the sign-in message` plus the HTTP status, and the API key is not written to the log. The usual cause is a domain that is not verified yet, or an `EMAIL_FROM` host that does not match it.

## 5. Smoke test

From a checkout of the commit you deployed:

```bash
npm run smoke -- https://<site>.netlify.app
```

That checks, without a session:

- `GET /api/health` and `GET /api/ping` return `{"ok":true,"database":"up"}` with `nosniff`, `X-Frame-Options: DENY`, a CSP that sets `frame-ancestors 'none'`, `Cache-Control: no-store`, and HSTS on an `https` origin
- `/` contains the unofficial-tool notice and `noindex`
- `/robots.txt` contains `Disallow: /`
- `POST /api/auth/request` with a non-PAN email returns 400
- `GET /api/endpoints` returns 401
- `GET /catch/missing-smoke-path` returns 404

To also create a mock, call it, and delete it, mint a personal token on the dashboard (it is shown once) and run:

```bash
PAN_PARROT_TOKEN='pp_...' npm run smoke -- https://<site>.netlify.app
```

The token is a Bearer credential. Do not commit it. Do not pass it as a shell history note you would paste into a ticket.

Then sign in through the browser as the admin address and open `/admin`. **Signals** should show the database up, sign-in email configured, the session secret set, and sign-in codes in API responses off.

## 6. Secrets that were in git history

These values are in the ancestry of `main` (from the initial commit through the files that later replaced them). They are starter defaults from the old VM-shaped app. No Resend key and no generated Netlify `SESSION_SECRET` were committed.

| What | Where it appeared | What to do |
| --- | --- | --- |
| `VITE_PUBLIC_BUILDER_KEY` | Initial `.env` (`7fc5051`). A Builder.io public key from the starter template. | The app does not call Builder. If that Builder account is still yours, revoke the key there. |
| `SESSION_SECRET=your-super-secret-session-key-here` | Old `.env.production` and the early Kubernetes manifest. 34 characters, so the current app would accept it. | Do not set this on Netlify. Generate a new secret with `openssl rand -base64 32`. If any old container is still running with the placeholder, stop it. |
| `ADMIN_PASSWORD=admin2024!` | Old `.env.production`, the seed script, and the early Kubernetes manifest. | Password login was removed. This string cannot sign in. Do not reuse it for anything else. Stop any old container that still has it. |
| Local Postgres password | `docker-compose.yml` and a `DATABASE_URL` aimed at `localhost`. The password was a change-me value for a laptop database. | Nothing to rotate on Netlify. The compose file is unsupported. |

**Do not rewrite git history.** A rewrite would change every commit on `main`, break every clone, and leave the old objects reachable from the existing pull-request branches until those refs were deleted and GitHub purged them. The useful action is to keep the live `SESSION_SECRET` and `RESEND_API_KEY` only in Netlify, and to avoid the strings above.

Rotating the live session secret later signs everyone out and makes already-sealed dummy mock secrets unreadable. Plan that as a maintenance window: export any mock you still need, set the new secret, redeploy, and recreate dummy credentials. Rotating the Resend key is a new API key in Resend, then `netlify env:set`, then a redeploy. Old personal API tokens stay valid across a Resend rotation. They are hashes in the database, not derived from `SESSION_SECRET`.

## 7. Backup and retention

Captured calls are disposable. The app deletes them after 14 days (`REQUEST_RETENTION_DAYS`) and keeps at most 200 per mock (`MAX_REQUESTS_PER_ENDPOINT`). The same caps run when a call is captured, and a scheduled function (`netlify/functions/cleanup.ts`, `@daily`) repeats the delete for idle mocks, expired sessions, expired sign-in codes, and rate-limit rows older than a day. The function log line is `maintenance deleted_requests=<n>`. Scheduled functions run on the published production deploy.

There is no second backup vendor and no scheduled dump. Netlify Database is the only copy of accounts, mock specs, shares, and the audit log. A deploy preview's database branch is a fork taken when the preview was built. It is not a backup, and edits made in the preview UI do not flow back to production.

Before you delete the Netlify project, export any mock you want to keep (studio → **Export pytest**, or `npm run parrot -- export <id>`). That zip is a pytest fixture, not a full database restore. Treat mock specs you have not exported as gone if the database is gone.

Do not connect to production with `NETLIFY_DB_URL` to take an ad-hoc dump or to change schema. Schema changes ship as migration files and the deploy applies them.

## 8. Monitoring, without a new service

Three places, and nothing else:

1. **Netlify function logs** (Project → Logs → Functions). Search for `health check failed`, `request failed`, `Email provider rejected the sign-in message`, and `maintenance deleted_requests=`. The push schedule logs from `netlify/functions/push-schedule.ts` every 15 minutes on production.
2. **`GET /api/health`** (and `/api/ping`, the same check). It runs `select 1` and returns 200 or 503. It does not require a session and does not say whether email is configured. It is rate limited (`RATE_PING_MAX`, 60 per minute per IP).
3. **Admin → Signals** (`GET /api/admin/signals`, admin session only). Database up or down, whether Resend is configured, whether the session secret meets the length check, whether dev codes are exposed, retention numbers, and counts of accounts, mocks, captures, and audit events.

A failed health check is the page you curl after a deploy. There is no pager integration. If you want a human to notice an outage, run the smoke script after each production deploy and look at Signals when you sign in.

## 9. Abuse limits

These are the defaults. Overrides are the environment variables in section 3, clamped to the ranges there.

| Limit | Default |
| --- | --- |
| Sign-in requests per IP | 20 / 15 min |
| Sign-in requests per email | 5 / 15 min |
| Sign-in verify per IP | 10 / 15 min |
| Sign-in verify per email | 10 / 15 min |
| Wrong codes before the challenge is burned | 5 |
| Code lifetime | 10 minutes |
| Authenticated API calls per user | 180 / minute |
| Catch calls per IP | 300 / minute |
| Catch calls per mock | 600 / minute |
| Health checks per IP | 60 / minute |
| Mocks per user | 20 |
| Captured calls kept per mock | 200 |
| Capture retention | 14 days |
| Stored capture body | 256 KB (ceiling 1 MB) |
| Normal mock page | 500 records and 2 MB |
| Opt-in NDJSON or file download | 6 MB |
| Mock delay | 5 seconds |
| Shares on one mock | 20 |
| Spec versions kept | 15 |
| Audit events kept | 400 |
| Personal tokens per user | 5 |
| Session lifetime | 7 days |

Catch URLs are public. The limits above are what stops a flood. Sharing a mock does not put a password on `/catch/...`.

## 10. Security review checklist

Tick these against the deploy, not against a laptop running `AUTH_DEV_EXPOSE_CODE`.

- [ ] Sign-in accepts only `something@paloaltonetworks.com` after Unicode normalization. A subdomain, a trailing dot, and a lookalike domain are rejected. Smoke covers a `gmail.com` address.
- [ ] `pp_session` is `HttpOnly`, `SameSite=Lax`, `Secure` on HTTPS, and `Path=/api`. A response on `/catch` does not receive that cookie. The mock-session cookie `pp-mock` is the only `Set-Cookie` a catch response may keep, and it is `HttpOnly` with `Path=/catch`.
- [ ] Static pages send the CSP in `netlify.toml` (`script-src 'self'`, no `unsafe-eval`, `frame-ancestors 'none'`), plus `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, `X-Robots-Tag`, and HSTS. API and catch responses send their own CSP (`default-src 'none'`; catch adds `sandbox`).
- [ ] `robots.txt` is `Disallow: /` and the HTML meta robots tag is `noindex`.
- [ ] Record and push fetch only public `https` URLs on port 443. Private, loopback, link-local, and metadata hosts are rejected, including after DNS lookup. Push does not follow redirects. A recorded redirect is checked again and does not receive credential headers on a host change.
- [ ] The rate limits in section 9 are the ones in the function logs' 429s, and you have not raised them on the production environment without a reason.
- [ ] `npm audit --omit=dev` reports no high or critical advisories. Zod 4.6.7 or newer is what cleared GHSA-mrhx-c7xc-m3w5. Request JSON is still capped (96 KB for API bodies, 512 KB for a spec) before it is parsed. Dev-dependency findings are outside this check.
- [ ] `/admin` is limited to `ADMIN_EMAILS`. Signals, purge, deactivate, and role changes return 403 for everyone else.
- [ ] Dummy mock secrets and the push signing secret are sealed with `SESSION_SECRET` (`enc:v1` AES-GCM). The push secret is not returned to the browser after it is saved. Personal tokens are stored as SHA-256 and shown once.
- [ ] The yellow banner and the sign-in email both say this is an unofficial personal tool. Do not send real secrets or customer data.

## If sign-in fails

| What you see | What it means |
| --- | --- |
| 400 on an address | The address is not exactly `@paloaltonetworks.com`. |
| 503 "Email sending is not configured" | `RESEND_API_KEY` or `EMAIL_FROM` was missing when this deploy was built. Set both and redeploy. |
| 502 "Could not send the sign-in email" | Resend rejected it. Check the domain is Verified and `EMAIL_FROM` uses that domain. |
| 500 and the log says `SESSION_SECRET must be at least 32 characters` | Set a new secret and redeploy. |
| You are signed in but `/admin` says you are not an admin | `ADMIN_EMAILS` was set after that session. Sign out and sign in again. |
