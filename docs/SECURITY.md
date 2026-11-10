# Security model

PAN Parrot is an unofficial tool on the public internet. A catch URL is a secret only in the sense that the path is unguessable. Anyone who has the path can call it. The signed-in app is limited to `@paloaltonetworks.com` mailboxes.

This page is the threat model and the controls that match it. It is not a promise that the site is safe for customer data. Do not send secrets, credentials, customer data, or production traffic.

## Who we are defending against

- Someone on the internet who finds the site and tries to sign in, spam the mailer, or guess a code.
- A page on another site that tries to use a signed-in browser (CSRF) or to frame the app.
- A catch URL used as a phishing or script page on this domain.
- A signed-in person, or a public catch URL, trying to fill the database.
- A stolen session cookie, a lookalike email address, or a log line that contains a code or a credential.

We are not defending against a person who already controls the Netlify account, the database, or `SESSION_SECRET`.

## Sign-in

The address must be exactly `paloaltonetworks.com` after Unicode NFKC normalization. Subdomains, a trailing dot, a second `@`, punycode, and non-ASCII characters are rejected. A Cyrillic letter that looks like an ASCII letter does not pass, because it is still not ASCII after normalization.

`name+tag@paloaltonetworks.com` is stored and rate-limited as `name@paloaltonetworks.com`. Tags cannot create extra accounts or extra email quota.

Requesting a code returns the same message whether or not the address exists, is allowed to sign in, or is on the invite list. A non-PAN address, and a new address when invite-only is on, does not get a code and does not create an account. An invite link is `/login?invite=...` on that same public page. Accepting it sets the gate cookie. A bad invite token returns the same "Invalid or expired code" as a bad sign-in code. Checking a code is limited per IP and per mailbox (default 10 per 15 minutes) and to 5 tries against the current code. Failed checks add a strike. Five strikes lock that IP for 15 minutes, ten for an hour, and twenty for a day. A locked IP gets 429 on the next request. A locked mailbox is not told that it is locked. The code is 8 digits, stored as a salted MAC, and deleted when it expires, when the tries run out, or when a session is created. The comparison does not stop early.

Optional Turnstile or hCaptcha is off until `CAPTCHA_PROVIDER`, `CAPTCHA_SITE_KEY`, and `CAPTCHA_SECRET_KEY` are set. See `docs/GO_LIVE.md`.

The code is not written to logs. In local development, `AUTH_DEV_EXPOSE_CODE=true` puts the code in the HTTP response. That switch is ignored when `NODE_ENV` is production.

## Session

The session cookie is `HttpOnly`, `SameSite=Lax`, and `Path=/api`. A second cookie, `pp_gate`, uses `Path=/` so the edge can refuse the app bundle to a browser that has not signed in. `Secure` is set when the public site URL is `https` or `NODE_ENV` is production. Both cookies and the database row expire after 7 days. A person has at most 5 sessions. Logout deletes the row and clears both cookies.

A state-changing `/api` request is rejected when `Origin` is present and is not this site, and when `Sec-Fetch-Site` is `cross-site`. `SameSite=Lax` also keeps the cookie off cross-site form posts. API tokens (`Authorization: Bearer pp_...`) are not cookies, so a page on another site cannot attach them.

## Browser headers

API and catch responses send `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `X-Robots-Tag: noindex, nofollow, noarchive`, and a Content-Security-Policy with `frame-ancestors 'none'`. Catch responses also set `sandbox`. `Strict-Transport-Security` is sent when the site is HTTPS, without `preload`. Responses drop `X-Powered-By` and `Server`. The static site in `netlify.toml` sends the same family of headers, with a CSP that allows the app's own scripts and inline styles. `robots.txt` disallows the whole site. Scanner paths such as `/.env`, `/.git`, `/wp-admin`, and `*.php` are a generic 404 at the CDN and again at the edge. Known scanner user agents are refused the same way, except on `/catch`, so an integration client is not blocked for its user agent.

## Catch URLs

Catch URLs do not use the session cookie. A generated path is 16 random bytes (128 bits), encoded as base64url. A custom path can be shorter, so a mock can require a lock token (`x-pan-parrot-lock` or `?lock=`) and an optional IPv4 allowlist. A locked mock that is called without them returns the same generic 404 as a path that does not exist, and that 404 does not write a captured call. Admins can make new mocks locked by default. The response is the mock body, which a caller can set. `text/html`, XHTML, and SVG are served with `Content-Disposition: attachment` so a browser downloads them instead of rendering a page on this origin. The sandbox policy stays on those responses as well. Mock responses cannot set cookies, framing headers, or a CSP of their own.

Request bodies are capped (`MAX_BODY_BYTES`, default 256 KB). API JSON is capped at 96 KB and a spec import at 512 KB. A single mock body is capped at 64 KB.

Each mock keeps a bounded number of captured calls (`MAX_REQUESTS_PER_ENDPOINT`, default 200) for `REQUEST_RETENTION_DAYS` (default 14). Each person is also capped across all of their mocks (`MAX_REQUESTS_PER_USER`, default 1000). Stored bodies are shortened to `MAX_STORED_BODY_CHARS` (default 16 KB). Catch traffic is limited per IP, per mock, and per owner (`RATE_CATCH_USER_MAX`, default 1200 per minute). Each person can own at most 20 mocks.

Authorization headers, cookies, and header names that look like tokens are stored as `[redacted]`.

## Admin

`/api/admin/*` requires a signed-in admin. Admins come from `ADMIN_EMAILS` the next time that address signs in. A non-admin receives 403. A missing session receives 401. If `ADMIN_IP_ALLOWLIST` is set, an admin request from any other address is a generic 404.

## What this does not do

- Mutual TLS. Netlify functions cannot ask for a client certificate.
- A private catch URL by default. The path is unguessable, and a lock token or IP allowlist is optional.
- A guarantee about data a caller chooses to POST. The caps and redaction limit how much is kept and what is shown back.
