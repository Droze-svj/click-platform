# Render free tier — keeping the service awake

## Problem

A Render **free** instance spins down after 15 minutes without traffic. The first
request after that takes 30–60 seconds, which is long enough for OAuth callbacks to
time out.

A paid instance (Starter, $7/month) never spins down. If you are on one, you don't need
any of this.

## ⚠️ Ping `/api/health/light` — never `/api/health`

| Endpoint | What it does | Safe for a keep-alive? |
|---|---|---|
| `/api/health/light` | Returns 200 if the process is up. Touches no database and no external service. | ✅ **Use this** |
| `/api/health` | Deep readiness check: MongoDB, Redis, Supabase, Gemini configuration | ⚠️ Works, but does needless work every few minutes |
| `/api/health/ai?live=1` | Makes a **real AI request** | ❌ **Never** — each ping spends AI quota |

An earlier version of this guide told you to ping `/api/health` every 5 minutes.
Back then, that endpoint made a real Gemini request whenever its cache expired:
**288 AI requests a day from the keep-alive alone**. On Gemini's free tier of 20
requests a day, AI features broke for real users within about 100 minutes and stayed
broken for the rest of the day. `/api/health` no longer calls the model unless you add
`?live=1`, but a keep-alive should still use `/api/health/light`.

## Option 1 — UptimeRobot (free)

1. Sign up at https://uptimerobot.com/
2. Add a monitor:
   - **Type:** HTTP(s)
   - **URL:** `https://click-platform-1.onrender.com/api/health/light`
   - **Interval:** 5 minutes
3. Save.

## Option 2 — cron-job.org (free)

1. Sign up at https://cron-job.org/
2. Create a job:
   - **URL:** `https://click-platform-1.onrender.com/api/health/light`
   - **Schedule:** every 5 minutes

## Option 3 — upgrade to Starter

In the Render dashboard, upgrade the service to **Starter** ($7/month). It stays on
permanently and needs no pinger.

## Checking real AI on purpose

To confirm Gemini actually answers, rather than just being configured, run this by
hand. Each run spends one AI request:

```bash
curl "https://click-platform-1.onrender.com/api/health/ai?live=1"
```
