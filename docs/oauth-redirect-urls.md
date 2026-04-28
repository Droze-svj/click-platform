# OAuth callback URLs to register per provider

For each provider, paste the **Callback URL** column into the matching field in their developer console. Replace `${APP_URL}` with your actual deployed origin (e.g. `https://click.app` or `https://click-platform-xxx.onrender.com`).

> Meta / Facebook / Instagram are intentionally **not in this list** — handled separately.

## The four providers Click ships OAuth for today

| Provider | Dev console | Callback URL to register |
|---|---|---|
| **TikTok** | <https://developers.tiktok.com/apps> | `${APP_URL}/api/oauth/tiktok/callback` |
| **YouTube** (Google Cloud) | <https://console.cloud.google.com/apis/credentials> | `${APP_URL}/api/oauth/youtube/callback` |
| **X / Twitter** | <https://developer.twitter.com/en/portal/projects> | `${APP_URL}/api/oauth/twitter/callback` |
| **LinkedIn** | <https://www.linkedin.com/developers/apps> | `${APP_URL}/api/oauth/linkedin/callback` |

All four paths are confirmed in [server/routes/oauth.js](../server/routes/oauth.js). Each provider's service file (`server/services/{twitter,youtube,tiktok,linkedin}OAuthService.js`) constructs its `redirectUri` as `${API_URL || BACKEND_URL}/api/oauth/<provider>/callback`. **`API_URL` and `APP_URL` should resolve to the same origin** for the OAuth round-trip to land back on the right host.

## Per-provider notes

### TikTok

- Requires **HTTPS** in production (no `http://` callbacks).
- Domain must be **verified** in the developer portal before TikTok will accept the callback.
- Scopes Click requests: `user.info.basic,video.list,video.upload`.
- App must be approved by TikTok before going beyond sandbox; sandbox is fine for testing the OAuth flow itself.

### YouTube (Google Cloud OAuth client)

- Add the callback under **Authorized redirect URIs** for the OAuth 2.0 Client ID.
- Add `${APP_URL}` (no path) under **Authorized JavaScript origins**.
- The OAuth consent screen needs to be **published** if you go beyond `youtube.readonly`. Click also needs `youtube.upload`, which requires Google's verification (1–6 weeks).
- For the `youtube` scope (full account access), Google may also require a security audit.

### X / Twitter

- Use **OAuth 2.0** (not 1.0a). Click's `twitterOAuthService.js` is OAuth 2.0 with PKCE.
- Add the callback URL under the project's **User authentication settings → Callback URI / Redirect URL**.
- Set **Type of App** to "Web App, Automated App or Bot" + tick "Read and write" if you want posting to work (default is read-only).
- The free tier of the X API has rate limits that will cap auto-posting; budget accordingly.

### LinkedIn

- Add the callback under **Auth → Authorized redirect URLs for your app**.
- For posting, you'll need the **Marketing Developer Platform** scope `w_member_social`. That requires a separate access request to LinkedIn.
- The default `r_liteprofile` + `r_emailaddress` scopes are auto-approved and good enough for connection without posting.

## Verification

After registering each callback URL:

1. From the Click app, hit `${APP_URL}/api/oauth/<provider>/connect`.
2. You should be redirected to the provider's OAuth screen.
3. Approve.
4. You should land back on `${APP_URL}/api/oauth/<provider>/callback?code=...` and from there be bounced to the dashboard.

If you instead see a "redirect_uri mismatch" error from the provider, the URL you pasted in their dev console doesn't byte-for-byte match what Click sends. Common causes:

- Trailing slash on one side and not the other.
- `http://` vs `https://`.
- Different host (e.g. callback says `click.app`, provider has `www.click.app`).

Fix the dev-console value and retry — Click side is consistent per [server/routes/oauth.js](../server/routes/oauth.js).
