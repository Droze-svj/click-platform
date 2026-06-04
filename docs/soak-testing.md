# Soak / Load Testing Runbook

Tooling: [Artillery](https://www.artillery.io/) (`artillery` devDependency).
Profile: `tests/soak/soak.yml` · Launcher: `scripts/run-soak.sh`.

## Quick validation (~15 min)
```bash
./scripts/run-soak.sh https://sovereign-platform.onrender.com 900 5
```

## The 48-hour staging soak
Run against **staging** (never production), from a stable host (or `tmux`/`nohup`
so it survives disconnects):
```bash
nohup ./scripts/run-soak.sh https://staging-host 172800 5 > soak-48h.log 2>&1 &
```
`172800` = 48h. Start at a low arrival rate (3–5 rps) and only raise it if the
service stays healthy.

## What to watch (pass/fail signals)
- **`/api/health`** on the target — the deep readiness probe. It returns **503**
  the moment a required dependency (Mongo/Redis/Supabase) degrades. Any sustained
  503s = fail. (`/api/health/c2pa`, `/api/health/light` are also available.)
- **Artillery `ensure` gates** (in `soak.yml`): p95 latency < 2s and zero HTTP 500s.
  The run exits non-zero if breached.
- **Sentry** — any new error types / spikes during the window.
- **Host** — memory must be flat, not monotonically climbing (the temp-file
  sweeper + queue retention should keep disk/memory bounded); watch CPU and
  event-loop lag.
- **Auto-rollback** — Render's `healthCheckPath: /api/health` means a deploy that
  fails health during/after the soak is automatically held back.

## After the run
```bash
npx artillery report soak-report-<timestamp>.json   # HTML summary
```
Compare latency/error trends against `baseline-report.json` (see
`scripts/establish-baselines.js` / `scripts/performance-regression-check.js`).

## Scope / customizing
Add authenticated, write-heavy scenarios to `soak.yml` (login → create → poll)
to exercise the queue + DB under sustained load; keep them pointed at staging
data only.
