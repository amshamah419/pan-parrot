# PAN Parrot

Personal HTTP webhook catcher for people with a verified `@paloaltonetworks.com` email. It is an unofficial tool maintained by one person on the public internet. It is not a Palo Alto Networks product, and it is not running inside corporate infrastructure.

Do not send secrets, credentials, customer data, or production traffic to it.

## What it does

- Sign in with a one-time code emailed to a `@paloaltonetworks.com` address
- Create catch URLs under `/catch/<path>`
- Inspect the requests those URLs receive (the dashboard polls every few seconds)
- Reply with one mock response per endpoint

Captured requests are deleted after 14 days (change `REQUEST_RETENTION_DAYS`) and each endpoint keeps at most 200 of them (`MAX_REQUESTS_PER_ENDPOINT`). Request bodies over 256 KB are rejected.

## Stack

- React 18, Vite, Tailwind, React Router
- Hono API, deployed as Netlify Functions
- Netlify Database (managed Postgres) via Drizzle
- Resend for sign-in email

Docker, Kubernetes, and the old Express-on-a-VM path are not supported. See the notice at the top of `Dockerfile`, `docker-compose.yml`, `k8s/deployment.yaml`, `nginx.conf`, and `deploy.sh`.

## Local development

```bash
npm install
cp .env.example .env
# Put a 32+ character SESSION_SECRET in .env
# For local sign-in without Resend, also set AUTH_DEV_EXPOSE_CODE=true
# Point DATABASE_URL at a local Postgres and apply migrations:
npm run db:migrate:local
npm run dev
```

`npm run dev` serves the SPA and the API together on port 8080, using `DATABASE_URL`. Do not set `AUTH_DEV_EXPOSE_CODE` anywhere except your own machine. Production does not use that variable or `DATABASE_URL`; Netlify injects `NETLIFY_DB_URL` and the app uses the Netlify Database driver.

`netlify dev` can run the same functions against Netlify's local database once the Netlify CLI is logged in. This repo does not enable `@netlify/vite-plugin`: that plugin starts a Deno edge runtime and exits `npm run dev` when the runtime is not available. The deployed site does not need it. The functions in `netlify/functions` are what Netlify runs.

```bash
npm test
npm run typecheck
npm run build
```

## Mocking an integration

From the dashboard, choose **Mock an integration**. Search for **Akamai WAF SIEM** (or Okta, CrowdStrike, Defender, and hundreds of other packs inferred from [demisto/content](https://github.com/demisto/content)), paste a sample JSON payload, or import an OpenAPI 3, Swagger 2, or Postman collection (paste, file, or https URL).

Put the catch URL into the integration's server field. Akamai WAF SIEM then calls `{catch URL}/siem/v1/configs/{configId}`. The response is newline-delimited events plus an offset trailer, which is what that pack parses. Shape and chaos are edited visually; the same screen has a JSON mode. The request log shows what the integration sent and a preview of what was returned, including which chaos effects fired.

A single response is capped at 500 records and 2 MB. Larger pulls use `limit` and `offset` (or the preset's cursor). Up to 20,000 unique records are available that way. Netlify's synchronous function limit is 60 seconds and 6 MB buffered, which is why the mock stays under those caps instead of emitting one giant body. Catch traffic is rate limited (300 requests/minute per IP, 600 per endpoint by default) so a paged load test fits and an open-internet flood does not.

Regenerate the XSOAR catalog with `npm run presets:import -- --content /path/to/demisto/content`. See `public/presets/COVERAGE.md` and `public/presets/ATTRIBUTION.md`.

Total coverage: 952 of 3300 commands from vendor docs, 412 approximate, 1936 missing. That is the sum across 129 integrations whose presets record command coverage. Presets without command coverage are not in this total. The same line is on the admin Health page.

## Auth model

There are no passwords. `POST /api/auth/request` emails an 8-digit code and a confirm link. The link only loads a page; sign-in finishes with `POST /api/auth/verify`. The session cookie is `HttpOnly`, `SameSite=Lax`, `Secure` in production, and scoped to `/api` so a mock response on `/catch/*` cannot use it.

Addresses are accepted only when the domain is exactly `paloaltonetworks.com` after Unicode normalization. Subdomains, trailing dots, and lookalike domains are rejected on the server.

`ADMIN_EMAILS` (comma-separated) is promoted to admin on the next successful sign-in. The initial admin is whoever you put there — set `ashamah@paloaltonetworks.com` and do not hardcode it.

## Deploy

Netlify is the only supported host. Follow [docs/GO_LIVE.md](docs/GO_LIVE.md). Content developers start with [docs/USER_GUIDE.md](docs/USER_GUIDE.md).

```bash
npm run smoke -- https://<your-site>
```
