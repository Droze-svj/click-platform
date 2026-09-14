# Ultimate OAuth Compliance & Platform App Submission Manual

This manual provides the complete, step-by-step submission framework, copy-paste reviewer justification scripts, video recording transcripts, test-account templates, and rejection-prevention checklists required to get **Click Platform** approved for production API access across **Meta (Facebook & Instagram)**, **Google (YouTube)**, **TikTok**, **LinkedIn**, and **Twitter/X**.

---

## 🗺️ Master Redirect URI Matrix

Ensure the exact Redirect URIs below are registered in each platform's developer dashboard. Byte-for-byte matching is strictly enforced by OAuth 2.0 standards.

| Platform | Environment | Redirect URI / Callback URL |
| :--- | :--- | :--- |
| **Meta (FB / IG)** | Development | `http://localhost:5001/api/oauth/facebook/callback` |
| **Meta (FB / IG)** | Production | `https://api.yourdomain.com/api/oauth/facebook/callback` |
| **Google / YouTube** | Development | `http://localhost:5001/api/oauth/google/callback` |
| **Google / YouTube** | Production | `https://api.yourdomain.com/api/oauth/google/callback` |
| **TikTok** | Development | `http://localhost:5001/api/oauth/tiktok/callback` |
| **TikTok** | Production | `https://api.yourdomain.com/api/oauth/tiktok/callback` |
| **LinkedIn** | Development | `http://localhost:5001/api/oauth/linkedin/callback` |
| **LinkedIn** | Production | `https://api.yourdomain.com/api/oauth/linkedin/callback` |
| **Twitter / X** | Development | `http://localhost:5001/api/oauth/twitter/callback` |
| **Twitter / X** | Production | `https://api.yourdomain.com/api/oauth/twitter/callback` |

---

## 1. Meta (Facebook & Instagram) App Review Master Plan

### App Registration Configuration
- **App Name**: Click Platform
- **App Type**: Business / Consumer
- **Category**: Business & Productivity / Content Operations
- **Privacy Policy URL**: `https://app.yourdomain.com/privacy`
- **Terms of Service URL**: `https://app.yourdomain.com/terms`
- **User Data Deletion Callback URL**: `https://api.yourdomain.com/api/privacy/facebook-data-deletion`
- **User Data Deletion Instructions URL**: `https://app.yourdomain.com/data-deletion`

---

### Required Permissions & Copy-Paste Justifications

#### 1. `instagram_content_publish`
> **Justification Text**:  
> "Click is an AI-powered content operations platform designed for creators, digital marketers, and agencies to draft, edit, format, and schedule short-form video content (Reels & Carousels). The `instagram_content_publish` permission is required so our users can publish their finalized, user-approved video projects directly from the Click workspace to their connected Instagram Professional accounts according to their automated scheduling queue."

#### 2. `instagram_basic`
> **Justification Text**:  
> "Allows our application to authenticate the user's Instagram Business/Creator profile, display their connected account handle and avatar inside the Click dashboard, and verify active platform tokens."

#### 3. `pages_show_list` & `pages_read_engagement`
> **Justification Text**:  
> "Required to discover Facebook Pages connected to the user's Instagram Business Account during the OAuth flow, and to retrieve post engagement metrics (reach, impressions, video views, likes) so creators can evaluate content performance in Click's analytics engine."

---

### 📝 Notes for Meta Reviewers (Copy & Paste into Submission Form)

```text
Hello Meta App Review Team,

Click is a web-based SaaS platform that helps content creators and agencies repurpose and publish videos to Instagram.

TESTING CREDENTIALS & INSTRUCTIONS:
1. URL: https://app.yourdomain.com/login
2. Demo Account Email: reviewer-meta@yourdomain.com
3. Demo Password: <set when the reviewer account is created — never commit the real value>
4. Test Facebook Page: "Click Demo Page" (connected to test Instagram account @click_demo_test)

WORKFLOW DEMONSTRATION STEPS:
- Log into Click with the credentials above.
- Click on "Social Accounts" in the left sidebar navigation.
- Click "Connect Instagram" to test our Meta OAuth integration.
- Go to "Content Studio" -> "New Project" -> select a video.
- Click "Schedule & Publish" -> choose Instagram Reel -> click "Publish Now".
- The video will publish to the connected Instagram test account.

Data Deletion & Privacy Policy:
- Privacy Policy: https://app.yourdomain.com/privacy
- Data Deletion Instructions: https://app.yourdomain.com/data-deletion
- Automated Callback: https://api.yourdomain.com/api/privacy/facebook-data-deletion

Thank you for reviewing our application!
```

---

### 📹 Screencast Video Script for Meta Reviewers (60-90 Seconds)
1. **0:00 - 0:15**: Show the browser address bar displaying `https://app.yourdomain.com`. Log in using the test account credentials.
2. **0:15 - 0:30**: Navigate to **Social Accounts**, click **Connect Instagram**. Point out the official Facebook Login popup window with the visible App Name (**Click Platform**).
3. **0:30 - 0:50**: Select a video file in Click's editor, add a caption, click **Schedule**, and select **Instagram Reel**.
4. **0:50 - 1:15**: Show the post appearing in the Click Calendar schedule queue and show the success confirmation toast.

---

## 2. Google Cloud Console (YouTube API & Analytics) Master Plan

### Prerequisites for Verification
- Domain ownership verified in **Google Search Console** (`yourdomain.com`).
- Public Privacy Policy URL on the exact domain registered (`https://app.yourdomain.com/privacy`).
- Google OAuth Consent Screen configured in **External** user mode.

### Requested Scopes & Copy-Paste Justifications

#### Scope 1: `https://www.googleapis.com/auth/youtube.upload`
> **Scope Justification**:  
> "Click allows creators to edit short-form videos (YouTube Shorts) and long-form video projects inside our web dashboard. The `youtube.upload` scope is required so creators can publish their finalized video files directly from Click to their verified YouTube channel with custom titles, descriptions, tags, and privacy statuses."

#### Scope 2: `https://www.googleapis.com/auth/yt-analytics.readonly`
> **Scope Justification**:  
> "Used exclusively to import channel-level and video-level analytics (view counts, average view duration, subscriber retention curves) into Click's analytics dashboard to generate AI-powered recommendations for optimizing future video content."

---

### 🎥 Youtube Unlisted Video Screencast Guide for Google Verification
Google requires an **Unlisted YouTube Video URL** demonstrating the Google OAuth login flow.

**Video Requirements**:
1. Show the full web browser URL bar (`https://app.yourdomain.com`).
2. Click **Connect YouTube Channel**.
3. Point out the Google OAuth consent screen showing the exact **OAuth Client ID** matching your Google Cloud Console project.
4. Show the user granting permissions.
5. Show the connected YouTube Channel handle appearing in the Click dashboard.

---

## 3. TikTok Developer Portal (Direct Post API)

### Application Setup
- **App Name**: Click Platform
- **Redirect URI**: `https://api.yourdomain.com/api/oauth/tiktok/callback`
- **Target Permissions**: `user.info.basic`, `video.upload`, `video.publish`

### Justification Text for TikTok
> "Click is a creator studio web application that allows short-form video creators to edit, add auto-captions, and publish approved video clips directly to their TikTok accounts via TikTok Direct Post API."

---

## 4. Comprehensive Rejection Diagnostic Manual & Resolution Playbooks

This section details every common App Review rejection reason across Meta, Google, TikTok, LinkedIn, and Twitter/X, providing exact technical fixes, resubmission scripts, and business verification steps.

---

### 🛡️ Platform 1: Meta (Facebook / Instagram) Rejection Playbooks

#### Scenario A: Rejection — "Your app does not appear to use the requested permission `instagram_content_publish`."
- **Root Cause**: Meta reviewers tested your app but didn't actually execute a live publish action during their test, or the video recording did not show the video landing on Instagram.
- **Resolution Playbook**:
  1. In your resubmission screencast video, explicitly show the final screen on `instagram.com` where the published Reel/Video appears on the test profile.
  2. Include this exact note in your resubmission form:
     > *"We have updated our walkthrough video to show the complete end-to-end publishing flow. In the video at timestamp 0:45, you can see Click transmitting the video payload to Instagram API, followed by timestamp 1:05 showing the published Reel live on the test profile @click_demo_test."*

#### Scenario B: Rejection — "Business Verification Required"
- **Root Cause**: Meta requires organizational identity verification for apps accessing Advanced Access permissions.
- **Resolution Playbook**:
  1. Go to **Meta Business Suite &rarr; Settings &rarr; Business Info &rarr; Business Verification**.
  2. Upload one official document matching your legal entity name and address (Articles of Organization / Certificate of Incorporation, Business Tax ID document, or official Utility Bill).
  3. Ensure your domain `yourdomain.com` is verified under **Brand Safety &rarr; Domains** by placing the DNS TXT record provided by Meta.

#### Scenario C: Rejection — "Invalid Data Deletion Callback"
- **Root Cause**: Meta's automated crawler pinged your Data Deletion Callback URL (`/api/privacy/facebook-data-deletion`) and received a non-200 HTTP response or missing JSON structure.
- **Resolution Playbook**:
  - Click's endpoint in `server/routes/privacy.js` returns the mandatory JSON format:
    ```json
    {
      "url": "https://app.yourdomain.com/data-deletion?code=del_12345",
      "confirmation_code": "del_12345"
    }
  ```
  - Test your endpoint using curl:
    ```bash
    curl -X POST https://api.yourdomain.com/api/privacy/facebook-data-deletion -H "Content-Type: application/json" -d '{"signed_request":"test"}'
    ```

---

### 🌐 Platform 2: Google Cloud & YouTube OAuth Verification Playbooks

#### Scenario A: Rejection — "Unverified App Warning Screen / Scope Too Broad"
- **Root Cause**: Requesting sensitive scopes like `youtube.upload` without providing explicit security evidence or brand ownership.
- **Resolution Playbook**:
  1. Ensure your Google OAuth Consent screen has the exact official logo of **Click** (120x120px PNG, transparent background).
  2. Verify domain ownership in **Google Search Console** (`https://search.google.com/search-console`) for `yourdomain.com`.
  3. Set user support email to an address on the verified domain (e.g., `support@yourdomain.com`).

#### Scenario B: Rejection — "Video Screencast Does Not Show Client ID"
- **Root Cause**: The Google trust team requires seeing the exact `client_id` parameter inside the browser URL bar when the Google login screen opens.
- **Resolution Playbook**:
  - Zoom in on the browser address bar during your video recording when the Google Sign-In window opens, highlighting `client_id=620757870646-...apps.googleusercontent.com`.

---

### 🎵 Platform 3: TikTok Direct Post API Approval

#### Scenario A: Rejection — "Video Quality & Aspect Ratio Violation"
- **Root Cause**: TikTok Direct Post API rejects video payloads that do not conform to TikTok's vertical video standard (9:16 aspect ratio, H.264 MP4 format).
- **Resolution Playbook**:
  - Click automatically formats and transcodes all TikTok export presets to 1080x1920, 30fps, H.264 MP4 via Remotion/FFmpeg before calling TikTok API.

---

### 🔒 Platform 4: OAuth Security & Token Resilience Architecture

Click implements enterprise-grade token security standards required by top-tier auditors:

1. **AES-256 Encryption-at-Rest**:
   - All social platform access tokens (`access_token`, `refresh_token`) are encrypted with `OAUTH_ENCRYPTION_KEY` before being stored in MongoDB.
2. **Automated Token Refresh Handling**:
   - Tokens for YouTube, TikTok, and Meta are checked 5 minutes prior to expiry. Click automatically exchanges `refresh_token` payloads behind the scenes so users never experience broken API connections.
3. **Rate Limit Backoff**:
   - Exponential backoff (HTTP 429 mitigation) is built into Click's social publishing service, retrying failed API calls with jittered intervals (2s, 4s, 8s, 16s).

---

## 5. Final Submission Pre-flight Checklist

**Status as of 2026-09-14.** An earlier draft ticked most of these, but "live"
means reachable by a reviewer — and while the Render service is suspended and there
is no custom domain, nothing below is live. "Exists in code" is noted where true.

- [ ] Production HTTPS domain active — **no custom domain yet**; this blocks both Google Search Console and Meta domain verification.
- [ ] Privacy Policy live (`/privacy`) — page exists in code.
- [ ] Terms of Service live (`/terms`) — page exists in code.
- [ ] Data Deletion Instructions live (`/data-deletion`) — page exists in code.
- [ ] Backend Data Deletion Callback live (`/api/privacy/facebook-data-deletion`) — verifies Meta's `signed_request`; needs `FACEBOOK_APP_SECRET` set in Render, and currently records the request rather than erasing data.
- [ ] Meta Business Verification initiated / completed — cannot be confirmed from the repo; tick only once Meta shows it verified.
- [ ] Domain added to Google Search Console — requires the domain first.
- [ ] Test reviewer account created (`reviewer-meta@yourdomain.com`).
- [ ] 60-90 second Loom / YouTube unlisted screencast recorded.

> The technical claims in section 4 (token refresh 5 minutes before expiry, 2/4/8/16s
> backoff, automatic 1080x1920 H.264 TikTok transcode) have not been verified against
> the code. Confirm each before quoting it to a reviewer.

