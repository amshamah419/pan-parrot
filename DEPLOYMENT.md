# Deploying PAN Parrot on Netlify

This is the only supported deploy path. Docker, Kubernetes, nginx, and `deploy.sh` are not maintained.

PAN Parrot is an unofficial personal tool. Put that in the site name if you want, and do not place it behind a Palo Alto Networks domain that would make it look official.

## 1. Accounts you need

1. **Netlify** — the site, the functions, and Netlify Database (managed Postgres). You do not create a separate Neon account. Installing `@netlify/database` provisions the database on deploy, and you can also turn it on under the site's database settings before the first deploy.
2. **Resend** — sends the sign-in codes. A Resend account, an API key, and a domain you control with Resend's DNS records. The onboarding sender (`@resend.dev`) can only mail your own inbox, so it is not enough for other `@paloaltonetworks.com` addresses.
3. **GitHub** — connect this repo to the Netlify site. Netlify applies database migrations from `netlify/database/migrations` during the deploy. You do not run them against production yourself.

## 2. Connect the repo

In the Netlify UI:

1. **Add new project → Import an existing project** and choose this GitHub repository.
2. Confirm the settings Netlify reads from `netlify.toml`:
   - Build command: `npm run build:client`
   - Publish directory: `dist/spa`
   - Node: 22 (`NODE_VERSION` in `netlify.toml`)
   - Functions directory: `netlify/functions`
3. Do not add a custom build that runs `prisma migrate` or `drizzle-kit migrate`. Hosted schema changes ship as SQL files in `netlify/database/migrations` and Netlify applies them.

The functions declare their own routes (`/api/*` and `/catch/*`). A daily scheduled function deletes expired captures, sessions, and rate-limit rows. Per-endpoint caps and age limits also run when a request is captured, so the database stays bounded even if a scheduled run is skipped. Scheduled functions run on published production deploys.

## 3. Turn on Netlify Database

1. Open the site → **Database** (Netlify Database, the current managed Postgres — not the retired "Netlify DB" extension).
2. Enable it if the first deploy has not already created it because `@netlify/database` is installed.
3. Leave `NETLIFY_DB_URL` alone. The platform injects it. Do not copy it into `DATABASE_URL`.

Preview deploys get a database branch forked from production. Merging to the production branch applies any new migration files.

## 4. Environment variables

Site configuration → Environment variables. Set these for production (and for deploy previews if you want previews to send real email — usually you should not):

| Variable | Required | Value |
| --- | --- | --- |
| `SESSION_SECRET` | yes | `openssl rand -base64 32` — at least 32 characters. This signs session cookies. |
| `ADMIN_EMAILS` | yes | `ashamah@paloaltonetworks.com` (comma-separated if you add more). Promoted to admin the next time that person signs in. |
| `SITE_URL` | yes | The public origin, no path, for example `https://your-site.netlify.app`. Used in emails and endpoint URLs. |
| `RESEND_API_KEY` | yes | From the Resend dashboard. |
| `EMAIL_FROM` | yes | A sender on the domain you verified in Resend, for example `PAN Parrot <noreply@your-domain>`. |
| `REQUEST_RETENTION_DAYS` | no | Default `14`. |
| `MAX_REQUESTS_PER_ENDPOINT` | no | Default `200`. |
| `MAX_BODY_BYTES` | no | Default `262144` (256 KB). Hard ceiling 1 MB. |

Do **not** set:

- `AUTH_DEV_EXPOSE_CODE` — that returns sign-in codes in the HTTP response. The server ignores it when `NODE_ENV=production`, and Netlify sets that, but do not set the variable anyway.
- `DATABASE_URL` — production uses the Netlify Database adapter.
- Any admin password. There isn't one.

Netlify also provides `URL` and `DEPLOY_PRIME_URL`. The API allows those origins in addition to `SITE_URL`, so deploy previews can call their own API. `EXTRA_ORIGINS` is an optional comma-separated list if you add a custom domain before `SITE_URL` is updated.

## 5. Resend

1. Create a Resend account and an API key.
2. Add the domain you will send from and create the DNS records Resend shows you.
3. Put the API key in `RESEND_API_KEY` and the full from-address in `EMAIL_FROM`.
4. Send yourself a test code from the live site after the first deploy.

The message is plain text. It contains an 8-digit code and a link. The link opens `/login` and waits for a button click so mail-gateway prefetchers do not consume the sign-in.

## 6. First sign-in

1. Deploy, then open the site.
2. Request a code for `ashamah@paloaltonetworks.com` (or whatever you put in `ADMIN_EMAILS`).
3. Enter the code. That account is the admin.
4. Create an endpoint and send a request to the `/catch/...` URL it shows.

If you set `ADMIN_EMAILS` after you already signed in, sign out and sign in again. The role is applied at sign-in, not on a timer.

## 7. Local checks before you push

```bash
npm test
npm run typecheck
npm run build
```

For a local Postgres instead of Netlify's embedded database:

```bash
# DATABASE_URL=postgresql://localhost:5432/panparrot in .env
npm run db:migrate:local
AUTH_DEV_EXPOSE_CODE=true npm run dev
```

`npm run db:migrate` (`netlify database migrations apply`) is only for the local Netlify database. It refuses to be a way to migrate production. Production migrations happen when Netlify deploys the commit.

Schema changes: edit `db/schema.ts`, run `npm run db:generate`, commit the new files under `netlify/database/migrations`, and deploy. Do not edit a migration that has already shipped. Add another one.

## 8. Mock response ceiling

Generated mocks run inside the catch function. Netlify allows a synchronous function 60 seconds and a 6 MB buffered response. PAN Parrot keeps a page at or below 500 records and 2 MB, and will not delay a chaos latency longer than 5 seconds. A caller that needs thousands of unique records pages with `limit` and `offset`. The virtual catalog stops at 20,000 records unless an endless-cursor glitch is turned on; that glitch keeps issuing offsets until the rate limit answers with 429. Default catch limits are 300 requests per minute per IP and 600 per endpoint (`RATE_CATCH_IP_MAX`, `RATE_CATCH_ENDPOINT_MAX`).

Preset JSON is static files under `public/presets/`, served by the CDN. It is not imported by the function.

## 9. What "good" looks like after deploy

- `https://<site>/api/ping` returns `{"ok":true,"database":"up"}`.
- A non-PAN email is rejected by `POST /api/auth/request`.
- A PAN email receives a code, and only then can create an endpoint.
- `POST /catch/<path>` stores the request and, if you configured one, returns the mock.
- The yellow banner on every page says this is an unofficial personal tool.
- `robots.txt` disallows the whole site.
