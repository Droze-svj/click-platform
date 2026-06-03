# Deployment Workflows

## How production deploys actually happen

Click's production deploys are handled by **managed platform integrations**, not
by GitHub Actions:

- **Backend → Render** (primary). Render auto-deploys on push to `main` via its
  native GitHub integration (configured from `render.yaml`). No workflow needed.
- **Frontend → Vercel**. Vercel auto-deploys on push to `main` and creates
  preview deployments for PRs via its native GitHub integration. No workflow needed.

The GitHub Actions deploy workflows below are **opt-in fallbacks** for a
self-managed server / alternate target. They are **manual-trigger only**
(`workflow_dispatch`, run from the Actions tab) and **abort cleanly** if the
required secrets aren't set — so they never fail on every push the way they did
before, and they never deploy by accident.

> Previously these ran on every push to `main` and failed at startup (invalid
> YAML) or mid-run (missing secrets). They are now valid, manual, and guarded.

## Workflows and their required secrets

Set secrets under **Settings → Secrets and variables → Actions**, or with the
GitHub CLI: `gh secret set NAME` (paste the value when prompted).

### `Fly Deploy` (fly-deploy.yml) — secondary target
- `FLY_API_TOKEN`

### `Production Deployment` (production-deploy.yml) — self-hosted SSH + PM2 + nginx
- `PRODUCTION_HOST`, `PRODUCTION_USER`, `PRODUCTION_SSH_KEY`, `PRODUCTION_PORT`
- `PRODUCTION_URL`
- `JWT_SECRET`, `MONGODB_URI`, `REDIS_URL`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
- `SLACK_WEBHOOK_URL` (optional — deploy notifications)

### `Deploy to Production` (deploy-production.yml) — Docker→GHCR + self-hosted SSH
- `SSH_PRIVATE_KEY`, `SSH_USER`, `SSH_HOST`, `PRODUCTION_DOMAIN`
- `TEST_MONGODB_URI` (for the pre-deploy test job)
- `SLACK_WEBHOOK_URL` (optional)

The GHCR image push uses the built-in `GITHUB_TOKEN` (no secret needed).

## To re-enable automatic deploys for a fallback workflow

Only do this if you actually run that target and have set its secrets. Add a
`push` trigger back to the workflow's `on:` block, e.g.:

```yaml
on:
  workflow_dispatch:
  push:
    branches: [ main ]
```

Until then, run them on demand from the **Actions** tab → select the workflow →
**Run workflow**.
