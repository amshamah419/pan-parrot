# Deploying PAN Parrot

Netlify is the only supported host. The exact steps — site creation, Netlify Database, environment variables, Resend domain verification, the smoke test, secret rotation, and backup — are in [docs/GO_LIVE.md](docs/GO_LIVE.md).

Docker, Kubernetes, nginx, and `deploy.sh` are not maintained. Do not place the site on a `paloaltonetworks.com` hostname.

After a production deploy:

```bash
npm run smoke -- https://<your-site>
```

`GET /api/health` returns `{"ok":true,"database":"up"}` when the database answers.
