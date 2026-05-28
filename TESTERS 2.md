# Click — Tester Quickstart

Welcome. You've been invited to try Click before it goes live. This page is the only thing you need.

## Log in

Use any of these accounts at <http://localhost:3010/login> (or wherever the dashboard is hosted):

| Persona | Email | Password | Niche |
|---|---|---|---|
| Sarah Chen | `sarah@click.test` | `TestPass123!` | health |
| Marcus Rodriguez | `marcus@click.test` | `TestPass123!` | finance |
| Emma Wallace | `emma@click.test` | `TestPass123!` | education |
| Alex Kim | `alex@click.test` | `TestPass123!` | technology |
| Jordan Blake | `jordan@click.test` | `TestPass123!` | entertainment |

All five accounts are on the Pro plan (no paywalls), have a few sample clips already in their library, and have the social-vault UI showing "Connected" for a couple of platforms each.

Prefer to register your own account? Go to <http://localhost:3010/register>. Email verification is auto-handled in this environment — you won't be asked to click a link.

## 5-minute happy path

1. **Log in** with one of the accounts above (or your own).
2. **Visit `/dashboard`** — you should see Click's quick-action cards. Click "Neural Video Studio" or any other card to confirm the navigation works.
3. **Upload a video**: `/dashboard/video` → pick any short MP4 (anything under 30 seconds is fine).
4. **Run Forge**: `/dashboard/forge` (or the Forge button on the video editor) → "Make it great" / Auto-edit. Wait ~30 seconds.
5. **Publish the AI-edited clip** to TikTok (or Reels / Shorts) from the clip hub.
6. **Visit `/dashboard/click-learning`** — Click will show what it just learned about your style (preset, hook, caption flavor, publish time).

If steps 1–6 work without anything looking broken, you've validated the core paid feature chain.

## What to look for and what to ignore

**Worth reporting (please tell me):**

- A page that 404s, 500s, or shows a blank white screen
- A button that looks like it should do something but does nothing
- Copy that reads weird, sounds robotic, or has typos
- A loading spinner that never finishes
- Any moment where you thought "this feels broken"

**Not bugs — known and intentional limits:**

- Social posts queue but don't actually publish to real TikTok/Reels/Shorts/X/LinkedIn accounts in this environment (no OAuth credentials wired). You'll see them in the scheduler but they won't show up on your real social.
- The mobile video editor shows a "Desktop recommended" banner — the timeline UI isn't built for phones yet.
- Some dashboard pages are still English-only even when you switch language (translation rollout is in progress).
- Browser console may show errors from extensions you have installed (anything mentioning `chrome-extension://` or `background.js` is not from Click).

## Troubleshooting

**"setTokens is not a function" or any "module export X" error on login:**
Hard-refresh your browser: `⌘ + Shift + R` on Mac, `Ctrl + Shift + R` on Windows/Linux. Next.js sometimes caches a stale JS bundle.

**Login says "Invalid credentials":**
Double-check the password is exactly `TestPass123!` (case-sensitive, exclamation mark at the end). If you registered your own account, double-check the email.

**Page loaded but you can't see your videos:**
Make sure you're using the same account that uploaded them. The seed users start with 3 sample Content records each but no clip outputs — Forge produces those.

**Dashboard says "Verify your email":**
Shouldn't happen in this environment, but if it does, tell me — the `AUTO_VERIFY_EMAIL` env flag isn't set correctly.

## How to send feedback

Just reply to whoever invited you (likely Dario / `dariovuma@gmail.com`). Screenshot what broke + one sentence of context is plenty. Don't worry about being polite — the more candid the better, since this is exactly what testing is for.

Thanks for testing Click.
