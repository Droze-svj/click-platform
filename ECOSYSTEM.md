# Click ecosystem guide

Single reference for how the project is wired: env, scripts, health, and daily workflows.

---

## Quick commands

| Goal | Command |
|------|--------|
| Validate env then start dev | `npm run dev:check` |
| Validate env only | `npm run validate:env` |
| Full ecosystem check (env + build + health) | `npm run ecosystem:check` |
| Ping API health | `npm run health` |
| Start dev (server + client) | `npm run dev` |
| Build for production | `npm run build` |
| Assign roadmap work | `npm run assign` |

---

## Architecture at a glance

```
┌─────────────────────────────────────────────────────────────────┐
│  Client (Next.js 14, port 3010)                                 │
│  • Dashboard, Video Editor, OAuth flows, API calls via lib/api   │
└───────────────────────────────┬─────────────────────────────────┘
                                │ API_URL (e.g. http://localhost:5001)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Server (Express, port 5001)                                     │
│  • REST API, auth (JWT), OAuth callbacks, jobs, health          │
└───────────────────────────────┬─────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
   MongoDB                  Redis (opt)            Supabase (opt)
   (primary DB)              (workers/cache)        (some routes)
```

- **Required:** MongoDB (`MONGODB_URI`), JWT (`JWT_SECRET`), OpenAI (`OPENAI_API_KEY`).
- **Optional:** Redis, Supabase, AWS S3, Sentry, OAuth credentials (Twitter, LinkedIn, etc.). See `.env.example` and `scripts/validate-env.js`.

---

## Environment

- **Files:** `.env` (main), `.env.local` (overrides, gitignored), `.env.example` (template).
- **Validation:** `npm run validate:env` — checks required vars and reports optional (Sentry, AWS, OAuth).
- **Guides:** `OAUTH_SETUP_GUIDE.md`, `PHASE_0_FIX_GUIDE.md`, `NEXT_STEPS.md`.

---

## Scripts index

### Development & build
- `npm run dev` — server + client (concurrently).
- `npm run dev:check` — validate env, then run `dev`.
- `npm run dev:server` / `npm run dev:client` — run one side.
- `npm run build` — Prisma generate + Next.js build.

### Verification & health
- `npm run validate:env` — env validation (see above).
- `npm run ecosystem:check` — env + client build + optional health ping.
- `npm run health` — `curl` API health (expects server on port 5001).
- `npm run verify:phase0` — Phase 0 (MongoDB/Redis) checks.
- `npm run verify:oauth` — OAuth config checks.

### Roadmap & assignments
- `npm run assign` — pick a roadmap item and get an assignment.
- `npm run roadmap` — open `ROADMAP_STATUS.md`.

### Tests
- `npm run test` — Jest.
- `npm run test:e2e` — Playwright.
- `npm run test:critical` — critical E2E flows.

### Deployment & ops
- `npm run deploy:production`, `deploy:build`, `deploy:migrate`, etc.
- `npm run validate:production` / `verify:production:env` — production env checks.

See **package.json** `scripts` for the full list.

---

## Health endpoints

| Endpoint | Purpose |
|----------|--------|
| `GET /api/health` | Main health (status, uptime, DB/Redis if configured). |
| `GET /health` | Same as above (convenience). |
| `GET /api/health/uptime` | Uptime only. |
| `GET /api/oauth/health` | OAuth connectivity. |

Use `npm run health` to hit `http://127.0.0.1:5001/api/health`. The ecosystem check pings the **local** server at `http://127.0.0.1:${PORT}/api/health` (so it never hits production when `API_URL` is set). Override with `HEALTH_CHECK_URL` in `.env` if needed.

---

## Troubleshooting

1. **Env / startup:** Run `npm run validate:env` and fix any missing/placeholder required vars.
2. **Build fails:** Run `npm run ecosystem:check` to see if env + build pass; check client/.babelrc if SWC was disabled for the editor.
3. **API unreachable from client:** Ensure `API_URL` (or Next.js rewrite target) points at the server (e.g. `http://localhost:5001`).
4. **Phase 0 (DB/Redis):** Follow `PHASE_0_FIX_GUIDE.md` and run `npm run verify:phase0`.
5. **OAuth:** Use `OAUTH_SETUP_GUIDE.md` and `npm run verify:oauth`.

---

## Related docs

- **ROADMAP_STATUS.md** — What’s next; run `npm run assign` to pick work.
- **README.md** — Quick start and high-level overview.
- **.cursorrules** — Cursor AI conventions for this repo.
