# Connecting TikTok, YouTube, Facebook and Instagram

Click already has a developer app on each platform. The credentials work, and they are the ones in `.env.production`. Before creators can connect their accounts, each app needs its settings below. Production address: `https://click-platform-1.onrender.com`.

You need your own login to each platform's developer console for these steps. Nothing here can be done for you from the code.

## Render (done from the code side)

Click reads these on Render:

| Variable | Value |
|---|---|
| `API_URL` | `https://click-platform-1.onrender.com` |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | from `.env.production` |
| `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` | from `.env.production` (the YouTube card and the Google analytics card both use this client) |
| `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | from `.env.production` (Facebook and Instagram both use this app) |

Leave these unset: `GOOGLE_CLIENT_*`, `INSTAGRAM_CLIENT_*`, every `*_CALLBACK_URL` / `*_REDIRECT_URI`, and `OAUTH_SERVER_SIDE_EXCHANGE`.

## TikTok: developers.tiktok.com → Manage apps

The current app is a **sandbox** app: its key starts with `sb`.

1. **Login Kit → Redirect URI:** add `https://click-platform-1.onrender.com/api/oauth/tiktok/callback`.
2. **Products:** make sure **Login Kit**, **Content Posting API** (with *Direct Post* turned on) and **Display API** are added. Display API is what allows reading a video's views.
3. **Scopes:** `user.info.basic`, `video.upload`, `video.publish`, `video.list`.
4. **Sandbox → Target users:** add your own TikTok account. In sandbox mode only these accounts can connect.
5. **To let any creator connect:** create or submit the production app for review. TikTok asks for:
   - the app icon, a description and the category;
   - website `https://click-platform-1.onrender.com`;
   - terms `https://click-platform-1.onrender.com/terms` and privacy `https://click-platform-1.onrender.com/privacy`;
   - a short screen recording of connecting and posting.
6. **Public posts need a second audit.** Until the Content Posting API audit passes, TikTok only accepts posts visible to the creator alone ("Only me"), and Click posts that way. When the audit passes, set `TIKTOK_APP_AUDITED=true` on Render.

## YouTube and Google: console.cloud.google.com

Use the OAuth client whose ID starts with `620757870646-`. Both production callback URLs are currently **not registered** on it (checked against Google on 2026-11-14).

1. **APIs & Services → Credentials →** that OAuth client → **Authorized redirect URIs**, add both:
   - `https://click-platform-1.onrender.com/api/oauth/youtube/callback`
   - `https://click-platform-1.onrender.com/api/oauth/google/callback`
2. **APIs & Services → Library:** enable **YouTube Data API v3**, **YouTube Analytics API** and **Google Search Console API**.
3. **OAuth consent screen (Google Auth Platform → Branding):**
   - app name *Click*;
   - homepage `https://click-platform-1.onrender.com`;
   - privacy `…/privacy`, terms `…/terms`.
4. **Data access:** add the scopes `youtube.upload`, `youtube.readonly`, `yt-analytics.readonly`, `webmasters.readonly`, `userinfo.email` and `userinfo.profile`.
5. **Audience:** while the app is in *Testing*, add yourself (and any testers) as test users. In Testing mode Google ends a connection after 7 days, so creators have to reconnect weekly until the app is verified.
6. **Verification for public use:** the YouTube scopes are "sensitive", so publishing the app requires Google verification:
   - a domain you own, verified in Search Console. `onrender.com` cannot be verified by you, so this needs a custom domain first;
   - a demo video.

   Separately, YouTube locks videos uploaded through an unaudited API project to **private**. To post public videos, and to upload more than about 6 videos a day on the default quota, request a YouTube API audit or quota extension.

## Facebook and Instagram: developers.facebook.com → My Apps → "Click platform" (app ID 979428195038200)

One Meta app covers both. Instagram connects **through Facebook Login**: the old Instagram Basic Display API was shut down by Meta in December 2024. Each creator needs an Instagram **Business or Creator** account linked to a **Facebook Page** they manage.

1. **App settings → Basic.** These are all empty today:
   - App domains: `click-platform-1.onrender.com`
   - Privacy Policy URL: `https://click-platform-1.onrender.com/privacy`
   - Terms of Service URL: `https://click-platform-1.onrender.com/terms`
   - User data deletion → Data deletion callback URL: `https://click-platform-1.onrender.com/api/privacy/facebook-data-deletion`
   - Category and app icon
   - Add Platform → Website: `https://click-platform-1.onrender.com`
2. **Facebook Login → Settings → Valid OAuth Redirect URIs**, add both:
   - `https://click-platform-1.onrender.com/api/oauth/facebook/callback`
   - `https://click-platform-1.onrender.com/api/oauth/instagram/callback`
3. **Permissions (Use cases / App Review → Permissions and features):**
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `read_insights`
   - `business_management`
   - `instagram_basic`
   - `instagram_content_publish`
   - `instagram_manage_insights`
4. **While the app is in Development mode**, only people with a role on the app (App roles → Roles) can connect. You're an admin, so you can test now.
5. **To let any creator connect:**
   - complete **Business Verification**;
   - request **Advanced Access** for the permissions above in App Review, with a screen recording of connecting and posting;
   - switch the app to **Live**.

If the Facebook login dialog shows "Invalid Scopes", the app was created as a *Business* app that uses Login for Business configurations. Tell the developer which permissions it lists.

## How to check it works

After the settings above, sign in to Click as yourself:
1. Open **Connected accounts** and connect each platform.
2. Each one should return to that page with "connected".

If one comes back with an error, the message after `?error=` in the address bar is the platform's own reason. The most common is `redirect_uri_mismatch`, which means step 1 of that platform is missing.
