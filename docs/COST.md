# Database cost

Netlify Database bills for compute time. A compute endpoint that never suspends costs about its size in GB, times 24, times the days it stays up. 1 GB left on for 31 days is about 744 GB-hours. Preview branches each have their own endpoint.

PAN Parrot is idle most of the time. These guardrails exist so an idle site does not keep Postgres awake.

## What the app does

- Deploy previews and branch deploys do not open the database. `CONTEXT=deploy-preview` and `CONTEXT=branch-deploy` return 404 from the API and catch functions before a connection is made. Production is unchanged.
- The edge gate does not query the database. Scanner paths, bad crawlers, and `/catch/<id>` values that cannot be a mock id are a plain 404 at the edge.
- `GET /api/health` and `GET /api/ping` do not query the database. They return `{ "ok": true, "database": "idle" }`. The admin Health page, which requires a signed-in admin, is the database check.
- There is no 15-minute push job and no daily cleanup job. Both used to open the database on a timer. Push now still sends when you click Push now.
- Hosted queries use the Neon HTTP driver. The app does not keep a connection pool. A pool holds a socket open, and an open socket stops autosuspend.
- CI uses a local Postgres. It does not use `NETLIFY_DB_URL`.

Signing in, using a mock, and calling a real catch URL still open the database. That is the work the site is for. After the requests stop, compute can suspend.

## What Andrew must do in the Netlify UI

The app cannot delete databases that already exist, and it cannot change the team's compute limit.

1. Open the team usage page and filter by site. The 7,491 database credits are a team total unless that filter is on. skillfoundry.dev is not in this repo. If that site has its own Netlify Database, its compute is in the same team number. This repository cannot see that split.
2. For the PAN Parrot site, open **Project configuration → Build & deploy → Continuous deployment → Branches and deploy contexts**. Set **Deploy Previews** to none, and turn off **Branch deploys**. Each preview deploy creates a database branch.
3. Open the site's **Database → Branches**. Delete every branch that is not production. Closed pull requests do not always remove the branch, and a leftover branch can keep a compute endpoint.
4. Open **Database → Compute** (or the Neon compute settings Netlify links to). Turn on scale to zero / autosuspend. Five minutes of idle is enough. Set the minimum compute to zero or the smallest size, and set a small maximum. Do not pin a minimum above zero. A pinned minimum is what a full month of GB-hours looks like.
5. Repeat steps 2–4 for skillfoundry.dev if that project also has a database. Pausing the whole team does not delete branches. When you unpause, a pinned minimum or a leftover branch starts billing again.
