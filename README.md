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

## Auth model

There are no passwords. `POST /api/auth/request` emails an 8-digit code and a confirm link. The link only loads a page; sign-in finishes with `POST /api/auth/verify`. The session cookie is `HttpOnly`, `SameSite=Lax`, `Secure` in production, and scoped to `/api` so a mock response on `/catch/*` cannot use it.

Addresses are accepted only when the domain is exactly `paloaltonetworks.com` after Unicode normalization. Subdomains, trailing dots, and lookalike domains are rejected on the server.

`ADMIN_EMAILS` (comma-separated) is promoted to admin on the next successful sign-in. The initial admin is whoever you put there — set `ashamah@paloaltonetworks.com` and do not hardcode it.

## Deploy

Netlify is the only supported host. Follow [DEPLOYMENT.md](DEPLOYMENT.md).
