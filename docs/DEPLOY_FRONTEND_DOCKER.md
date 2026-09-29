# Frontend Docker build and deploy sequencing

Covers `Frontend/Dockerfile`, `Frontend/.dockerignore`, `Frontend/.env.example`
and `Frontend/scripts/smoke-test.sh`, and how a frontend release orders itself
against `backend/services/upgradeCoordinator.js`.

## Quick reference

```bash
# from Frontend/
npm run docker:build          # docker build -t gatedelay-frontend:local .
npm run docker:smoke          # boots the image and checks /, /audit, /api/ping
```

With real configuration:

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.gatedelay.example/api \
  --build-arg NEXT_PUBLIC_BACKEND_URL=https://api.gatedelay.example \
  --build-arg NEXT_PUBLIC_PROJECT_ID=... \
  --build-arg NEXT_PUBLIC_CLIENT_KEY=... \
  --build-arg NEXT_PUBLIC_APP_ID=... \
  -t gatedelay-frontend:"$GIT_SHA" Frontend
```

## Secrets

**No secret may be passed to this build.** Every configurable value is
`NEXT_PUBLIC_*`, and Next.js inlines those into the client bundle at build time —
they ship to every visitor and are readable in devtools. They are configuration,
not credentials.

- Required keys and what each one does: `Frontend/.env.example`, the only `.env*`
  file in `Frontend/` that git tracks (`.gitignore` excludes the rest and then
  re-includes the example with `!.env.example`).
- Real secrets — `JWT_SECRET`, `PRIVATE_KEY`, `MONGODB_URI`, provider API keys —
  belong to the backend and are documented in `Backend/.env.example`. They are
  read server-side only and must never be mirrored into a `NEXT_PUBLIC_` name.
- `.dockerignore` excludes `.env` and `.env.*` from the build context, so a
  developer's local `.env.local` cannot be baked into an image by accident.
- Because these values are baked in, **an image is environment-specific.** You
  cannot repoint a staging image at production with container env vars; build a
  new image. Tag by commit SHA so a rollback is an unambiguous tag.

## Where the frontend sits in the deploy sequence

`backend/services/upgradeCoordinator.js` drives backend upgrades through a Bull
queue (`system-upgrades`, on `REDIS_URL`) and walks its services **in order**:

```
database → contracts → api → indexer
```

`_runUpgrade` upgrades one service at a time, recording each into
`completedServices`. The frontend is deliberately **not** one of those services:
it is a static artefact built against an API contract, not a migrated component.
That gives it a fixed position either side of the coordinator run:

| Phase | Action | Why |
|---|---|---|
| Before | Build and push the image, do not route to it | The build is the slow, failure-prone step; get it done before anything mutates |
| During | Coordinator runs `database → contracts → api → indexer` | Old frontend keeps serving against the old API |
| After `completed` | Shift traffic to the new image | `NEXT_PUBLIC_API_URL` is baked, so the bundle must meet the API it was built for |
| On failure | Roll the frontend back **first**, then let the coordinator roll back | The frontend is the only tier already serving users |

Poll the coordinator rather than guessing at timings:

```js
const coordinator = require('./backend/services/upgradeCoordinator');

const upgrade = coordinator.createUpgrade({ version: process.env.GIT_SHA });
await coordinator.startUpgrade(upgrade.id);

// coordinator.getProgress(id) -> { status, progress, currentService, failedServices, error }
// Cut frontend traffic over only once status === 'completed'.
```

`coordinator.getStatus(id)` returns the same record plus the scheduling fields;
`coordinator.scheduleUpgrade(id, when)` queues it for a maintenance window and
rejects a time in the past.

## Retry

The build and the release retry differently, and it matters which one failed.

**Image build.** Safe to retry as-is — it has no side effects. Layers are cached
on `package-lock.json`, so a retry after a transient registry error resumes at
the failed step. `npm ci` failing on a lockfile mismatch is *not* transient:
regenerate the lockfile rather than retrying.

**Smoke test.** `scripts/smoke-test.sh` polls `/api/ping` for `BOOT_TIMEOUT`
seconds (default 60) before declaring failure, and bails immediately if the
container has already exited — so a slow start is absorbed and a crash is not
retried pointlessly. Raise `BOOT_TIMEOUT` on a cold host; do not loop the script.

**Coordinator services.** Bull retries the queued job per its own job options.
A service that fails hard triggers `_attemptRollback` through the queue's
`failed` handler; retrying the same upgrade id afterwards will throw
(`Upgrade already …`). Create a new upgrade for a second attempt.

## Rollback

The frontend rolls back by re-pointing at the previous image tag. There is no
migration to unwind, which is why it goes first:

```bash
# 1. Frontend — immediate, no state involved.
docker service update --image gatedelay-frontend:$PREVIOUS_SHA gatedelay_frontend
#   or: kubectl rollout undo deployment/gatedelay-frontend

# 2. Confirm the restored image really serves.
Frontend/scripts/smoke-test.sh gatedelay-frontend:$PREVIOUS_SHA 3100

# 3. Then unwind the backend.
node -e "require('./backend/services/upgradeCoordinator').rollbackUpgrade('$UPGRADE_ID')"
```

`rollbackUpgrade` calls `_attemptRollback`, which walks `completedServices` in
**reverse** and calls `_rollbackService` for each, then reports:

- `rolled_back` — every service was unwound;
- `partial_rollback` — at least one did not, with the reason in `upgrade.error`.

Treat `partial_rollback` as a stop-and-page condition, not a retry: the tiers are
now at mixed versions.

### Known gap

In `upgradeCoordinator.js`, only the `database` rollback handler does real work
(it calls `migrationService.rollback` for the last completed migration). The
`contracts`, `api` and `indexer` handlers are empty functions, so a
`rolled_back` status for those tiers means "nothing was attempted", not
"restored". Until they are implemented, plan on redeploying the previous backend
build by hand and keep the frontend on its previous tag until you have confirmed
the API version it expects is the one actually serving.

## What the smoke test checks

`scripts/smoke-test.sh` boots the image and asserts, in order:

1. the server answers `/api/ping` within `BOOT_TIMEOUT` (default 60s), failing
   fast if the container has already exited;
2. `/api/ping` returns `"ok":true` — a well-formed body, not just a 200, so we
   know Next.js is executing route handlers;
3. `/` and `/audit` return 200 **and** carry the root layout's `<body>` class,
   which Next's own error document would not;
4. `/api/market-audit?limit=1` returns either 200 (backend reachable) or a JSON
   `error` body (no backend configured). Both prove the proxy handler ran; a
   non-JSON body or a hang fails the deploy.

### Why there is no page-text assertion

`app/components/ParticleClientWrapper.tsx` loads the wallet provider with
`dynamic(..., { ssr: false })`, and that wrapper sits above `{children}` in
`app/layout.tsx`. The consequence is easy to miss: **no page body is
server-rendered for any route** — the served HTML is the shell plus scripts, and
all content appears only after hydration. Grepping the response for page text
would fail on every route, including `/`.

That is worth revisiting (it costs first paint and leaves crawlers with an empty
document), but it is a deliberate guard against SSR crashes when the wallet env
vars are absent, so changing it is its own piece of work. Until then, rendered
content is asserted in the vitest suite (`npm test`, including
`app/audit/page.test.tsx`) and the container smoke test covers what only a
running server can show.

## Verification performed

Built and smoke-tested locally with Docker on `node:22-alpine`, `next build`
producing `.next/standalone` (`output: "standalone"` in `next.config.ts`).
Resulting image: ~84MB content size.

```
npm run docker:build
npm run docker:smoke
#   /api/ping -> ok:true
#   / -> 200, layout rendered
#   /audit -> 200, layout rendered
#   /api/market-audit -> 500 with JSON error (no backend configured; handler ran)
#   SMOKE PASS
```
