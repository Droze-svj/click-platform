# Security Hardening — Rounds 8–18

**Date:** 2026-06 · **Status:** ✅ all merged to `main` & pushed · **Scope:** server API, services, socket layer, client media handling

A systematic adversarial audit (two fan-out waves over 11 subsystem clusters; every finding verified in code before fixing) and remediation of the live route/service surface. **~70 findings closed across 11 rounds.** Each round: branch → fix → `node --check` + eslint + full jest suite + boot/`/api/health` → `--no-ff` merge → push.

**Totals:** 68 files changed, +1482/−303 · 6 new security test suites (`signedMedia`, `approvalAuthz`, `chunkedUpload`, `escapeRegex`, `commentsAccess`, `globalMediaSigner`) · full suite 562 passing.

## Rounds

| # | Merge | Area | Highlights |
|---|---|---|---|
| 8 | `7a84358b` | Media signing | Signed-capability `/uploads` URLs in API responses (music/content/video/assets) |
| 9 | `2416f172` | Media (client) | Frontend consumes signed `file.url`; SW cache key strips `exp/sig` |
| 10 | `bd40250a` | Multi-tenant | **Keystone:** `requireWorkspaceAccess` read `req.params.workspaceId` but routes use `:agencyWorkspaceId`/`:clientWorkspaceId` → fell through to attacker-controlled `?workspaceId=` (cross-tenant read/write across agency/client surface). Also approval-advance authz. |
| 11 | `62007bb3` | Auth bypass | **`vector-memory` mock-auth** (shared `test_user_v6` → full cross-user R/W/D); **`push` API zero-auth** (subscription hijack, arbitrary push, broadcast spam); collab privilege-escalation; **chunked-upload arbitrary file overwrite** (`.env`/`check.sh`); integrations mass-assign→SSRF; recycling IDORs |
| 12 | `20da4de6` | Medium IDOR | Approval-read leaks + unscoped approval list; revenue/health-alert IDORs; library-item counter IDOR; search **ReDoS** (`utils/escapeRegex`) |
| 13 | `4dd083a8` | Analytics/ops | Admin-gate **global model-version config** (any user could roll back the live LLM) + slow-query monitor; **job-queue IDOR**; report-builder/report-enhanced cross-tenant IDORs + share-link mint; post-analytics IDORs |
| 14 | `5f0a20b2` | Video/AI | **Viral one-click IDOR + paid-LLM cost** on any video; **`advanced.js` SSRF** (attacker `videoUrl`); frame-leak via waveform/filmstrip; creative/agentic/neural/adapt/transcription IDOR+SSRF (centralized on `guardOwnership` + `assertPublicUrl`) |
| 15 | `4d7ccaf2` | Marketing | Calendar cross-tenant IDOR (reschedule/views/events); playbook version/analytics IDOR; support-ticket status IDOR |
| 16 | `36854354` | Comments | Team-membership + post-inheritance access model (`utils/resourceAccess`); closed generic-comment cross-team leak + inline-comment IDOR |
| 17 | `6ae76454` | Follow-ups | Team-scoped + membership-gated `join:comments` socket room; survey-response workspace gate |
| 18 | `dc3dcf5a` | Media (final) | **Global `/api` response signer** — no route can emit an unsigned `/uploads` URL; makes the signed-media flag safe to flip. E2E-verified. |

## Headline fixes (Critical/High)

- **Cross-tenant isolation keystone** (R10) — one wrong field name had silently disabled workspace authorization across the entire agency/client feature set; independently flagged by 3 audit agents.
- **Two unauthenticated-access bypasses** (R11) — `vector-memory` ran every request as a single shared mock user; the `push` API had no auth on any route.
- **Two video CRITICALs** (R14) — IDOR that read/mutated any user's video *and* billed paid LLM calls to them; SSRF fetching attacker URLs (cloud-metadata reachable).
- **Arbitrary file overwrite** (R11) — chunked-upload assembly wrote to a client-supplied path (`.env`, `check.sh`).
- **Global LLM-config tamper** (R13) — any user could roll back / hijack the platform-wide model version.

## Verified clean (no action)

Billing core (Whop-webhook-only), OAuth flows, mounted admin routes, monitoring/infra (already admin-gated), gamification/engagement (no self-grant). The entire `music-*` route family is **unmounted dead code** (latent bugs documented, not live).

## Required actions (operational — no code)

1. **Flip signed-media on.** Set `MEDIA_URL_SECRET` (32+ random bytes, identical across all instances) with `REQUIRE_SIGNED_MEDIA` still off; then set `REQUIRE_SIGNED_MEDIA=true` in **staging** → smoke-test media surfaces → **prod**. Instant rollback (flip back); no migration. Checklist: [`private-media-access-plan.md`](./private-media-access-plan.md).
2. **Rotate secrets** as part of that deploy: `JWT_SECRET` and the new dedicated `MEDIA_URL_SECRET`.

## Open / deferred

- `music-*` latent bugs — only relevant **if** those (currently unmounted) routers are ever wired in.
- Inline-comment `internal:true` visibility — a portal-side filter, only needed **if** a client-portal route ever consumes inline comments (none does today).
