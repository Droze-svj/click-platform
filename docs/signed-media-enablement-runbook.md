# Runbook — enable `REQUIRE_SIGNED_MEDIA` (gate private `/uploads`)

**Status:** READY to enable on staging, then prod. This is a **config + verify**
task — the code is in place. Do the staging verify before flipping prod.

## What's already built (verified)

- `/uploads` is served by `express.static`, fronted by
  [`server/middleware/requireSignedMedia.js`](../server/middleware/requireSignedMedia.js):
  with the flag ON, every `/uploads/<path>` must carry a valid `?exp&sig` minted
  by [`server/utils/mediaUrlSigner.js`](../server/utils/mediaUrlSigner.js) (HMAC,
  24h TTL) — else **403**. A `PUBLIC_MEDIA_PREFIXES` allowlist bypasses the check
  for truly-public assets. Regression-tested (`tests/services/requireSignedMedia.test.js`).
- The API signs the media URLs it returns (`signMediaUrl`/`signMediaUrls`) across
  `video.js`, `content.js`, `assets.js`, `music*.js`, etc.
- The client renders whatever (signed) URL the API hands it. `client/utils/url.ts`
  `getAssetUrl()` is **signature-safe**: a full URL passes through unchanged; a
  relative path is host-prefixed with its query string preserved.
- Only ONE client site builds a raw `/uploads` URL: `AssetLibrary.tsx:178`'s
  last-resort music fallback (`/uploads/music/<filename>`), used only when the API
  returned no signed URL for a track — i.e. legacy/public catalog music.

## Prerequisites

- `MEDIA_URL_SECRET` set on the server (same value across replicas — it's the HMAC key).
- Decide which prefixes are genuinely PUBLIC (no auth needed) vs PRIVATE:
  - **Private (must be signed):** `videos/`, `users/`, `user-music/`, `exports/`, processed renders, ingested video.
  - **Public (allowlist):** `fonts/` (default), and — if the music *catalog* is public — `music/`, plus `thumbnails/` if thumbnails are intentionally public.

## Enable (staging first)

1. Set on staging:
   ```
   REQUIRE_SIGNED_MEDIA=true
   PUBLIC_MEDIA_PREFIXES=fonts/,music/,thumbnails/   # tune to your public set
   MEDIA_URL_SECRET=<the prod-like secret>
   ```
2. Deploy staging. **Verify on the running app:**
   - Editor preview plays the source video (signed URL renders).
   - Asset library thumbnails + previews load.
   - Music picker plays catalog tracks (covered by `music/` allowlist) AND any
     private user-music (must come back signed from the API).
   - A direct `GET /uploads/videos/<x>.mp4` with NO `?sig` → **403**.
   - A `GET /api/health/signed-media` reports enabled.
   - Watch logs for `Forbidden: media URL is unsigned` — each one is a media path
     the client loaded WITHOUT a signed URL → fix that response to sign, or add the
     prefix to the allowlist if it's genuinely public.
3. Soak staging (click through editor, library, scheduling, exports). Zero unsigned-403s on legitimate media = good.

## Cut over to prod

- Set the same three env vars on prod, deploy, repeat the smoke checks.
- Keep `REQUIRE_SIGNED_MEDIA` easy to toggle off (it's a single env var) as the rollback — flipping it back to unset/`false` restores today's behavior instantly with no data change.

## Residual to clean up (optional, low-risk)

- `AssetLibrary.tsx:178` raw `/uploads/music/<filename>` fallback: harmless if
  `music/` is in `PUBLIC_MEDIA_PREFIXES`. If music is PRIVATE, ensure the music
  API always returns a signed `file.url` (so the fallback never triggers) and then
  drop the raw fallback.
