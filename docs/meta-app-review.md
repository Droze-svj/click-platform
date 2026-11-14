# Meta App Review: Click

Everything needed to submit the Meta app **"Click platform"** (ID 979428195038200) for App Review. The quoted text blocks are written for Meta's reviewers: paste them as they are. Do the settings in [social-apps-setup.md](social-apps-setup.md) first.

## 1. Before you submit (checklist)

- [ ] **App settings → Basic:**
  - App domains `click-platform-1.onrender.com`
  - Privacy Policy URL `https://click-platform-1.onrender.com/privacy`
  - Terms URL `https://click-platform-1.onrender.com/terms`
  - Data deletion callback `https://click-platform-1.onrender.com/api/privacy/facebook-data-deletion`
  - Category *Business and pages* (or *Utility & productivity*)
  - App icon 1024×1024
  - Contact email
- [ ] **Add platform → Website:** `https://click-platform-1.onrender.com`
- [ ] **Facebook Login → Settings → Valid OAuth Redirect URIs:**
  - `https://click-platform-1.onrender.com/api/oauth/facebook/callback`
  - `https://click-platform-1.onrender.com/api/oauth/instagram/callback`
- [ ] **Business Verification** completed: Settings → Business verification, using your business documents.
- [ ] **A Facebook Page you manage, linked to an Instagram Business or Creator account.** You need it to record the screencast. Create a test Page if you don't want to use a real one.
- [ ] **Screencast recorded** (section 4). Make sure Click is in English: use the globe icon in the dashboard's top bar, or on the login page.
- [ ] **Reviewer login** to paste into "Test credentials": the email and password from the file you were given (not stored in this repository).

## 2. App description (App Review → "Tell us about your app")

> Click is a video editor and publishing tool for short-form creators and small businesses (https://click-platform-1.onrender.com). A creator uploads a video, Click edits it (cuts, captions, format for each platform) and the creator publishes it to their own Facebook Page and Instagram professional account. Click then shows the creator how each post performed (views, reach, likes, comments, shares, saves) and uses those results to suggest better hooks, captions and posting times for their next videos.
>
> Click only posts content the creator has chosen to publish, only to Pages and Instagram accounts the creator manages and selected in the Facebook Login dialog. Click does not post automatically on its own, does not read other people's content, and does not sell or share Platform Data. Creators can disconnect at any time on the Connect Accounts page, which deletes the stored tokens.

## 3. Permissions: "How will your app use this permission?"

Request **Advanced Access** for each. All of them use the same screencast (section 4); the timestamps show where each one appears.

### pages_show_list
> After the creator connects Facebook, Click lists the Facebook Pages they manage on the Connect Accounts page (Publish → Connect Accounts → Facebook card, "Your Facebook Pages") so they can choose which Page Click publishes their videos to. We only read the Page name and ID. Screencast 0:40–1:00.

### pages_manage_posts
> When the creator clicks "Broadcast Now" in Click's video editor with Facebook selected, Click publishes their edited video to the Facebook Page they chose, as a Page video with the caption they wrote. Posts are only created by an explicit action of the creator. Screencast 1:30–2:10.

### pages_read_engagement
> Click reads the engagement of the posts it published for the creator (reactions, comments, shares) and shows them on the creator's Analytics page (Grow → Analytics) next to each published video, so the creator can see which videos worked. It also reads the Page's name and ID to confirm where a video was posted. Screencast 2:30–3:00.

### read_insights
> Click reads the insights (impressions, reach, clicks) of the Page posts it published for the creator and shows them on the Analytics page next to each video. Click compares each video with the creator's own typical results to suggest what to make next. We do not read insights of posts Click did not publish. Screencast 2:30–3:00.

### business_management
> Many creators manage their Facebook Page through a Meta Business portfolio. Without this permission, Pages owned by a business portfolio do not appear in the list of Pages returned to Click, and the creator cannot select their Page for publishing. Click uses it only to list the Pages (and their linked Instagram accounts) that the creator selected in the login dialog; it does not create, modify or manage any business assets. Screencast 0:20–1:00 (the Page from a business portfolio appears in the list).

### instagram_basic
> After the creator connects Instagram (through Facebook Login), Click reads the username and profile picture of the Instagram professional account linked to their Page and shows it on the Connect Accounts page, so the creator can see which account Click will publish to. Screencast 1:00–1:20.

### instagram_content_publish
> When the creator clicks "Broadcast Now" in Click's video editor with Instagram selected, Click publishes their edited video to their Instagram professional account as a Reel, with the caption they wrote. Posts are only created by an explicit action of the creator. Screencast 1:30–2:10.

### instagram_manage_insights
> Click reads the insights (views, reach, saves, shares) of the Reels it published for the creator and shows them on the Analytics page next to each video, so the creator can see which videos worked and Click can suggest better hooks and posting times for the next one. We do not read insights of media Click did not publish. Screencast 2:30–3:00.

### public_profile
> Click shows the name of the connected Facebook account on the Connect Accounts page so the creator can see which account is connected.

## 4. Screencast (one recording, about 3–4 minutes)

Record at 1080p or higher, with the browser address bar visible. Add short captions or narrate in English. Meta rejects videos that skip the login dialog or don't show each permission being used.

| Time | Show |
|---|---|
| 0:00 | `https://click-platform-1.onrender.com/login`. Sign in to Click. |
| 0:10 | Sidebar → **Publish → Connect Accounts**. Click **Connect** on the **Facebook** card. |
| 0:20 | Facebook Login dialog: show the app name, choose the Page (and the business portfolio if you have one), and show the permissions screen. Continue. |
| 0:40 | Back in Click: the Facebook card shows your name and **Your Facebook Pages**. Click **Post here** on a Page to make it the default (pages_show_list). |
| 1:00 | **Connect** on the **Instagram** card. Same Facebook dialog; select the Page linked to the Instagram account. Back in Click, the Instagram card shows the username and picture (instagram_basic). |
| 1:20 | Sidebar → **Studio → Video Editor**. Upload a short video (the sample: `https://click-platform-1.onrender.com/review/sample-clip.mp4`). |
| 1:30 | Open **Export**, click **Render**, wait until it finishes. Under **Publish**, select **Instagram Reels** and **Facebook Page**, then click **Broadcast Now**. |
| 1:50 | Show the success message. Open Instagram and the Facebook Page in another tab: show the new Reel and the Page video (instagram_content_publish, pages_manage_posts). |
| 2:30 | Back in Click: sidebar → **Grow → Analytics**, click **Refresh**. Show the two posts with their views and engagement (read_insights, pages_read_engagement, instagram_manage_insights). It can take a few minutes after posting for Meta to report numbers; record this part once they show. |
| 3:00 | Publish → Connect Accounts → disconnect Facebook, to show creators can remove access. |

## 5. Instructions for the reviewer ("Step-by-step instructions" field)

> 1. Go to https://click-platform-1.onrender.com/login and sign in with the test credentials provided.
> 2. In the left sidebar open Publish → Connect Accounts. Click Connect on the Facebook card and log in with a Facebook account that manages a Facebook Page (a Page linked to an Instagram Business or Creator account lets you also test Instagram). Select the Page in the dialog.
> 3. The Facebook card now lists your Pages under "Your Facebook Pages"; choose the Page to post to with "Post here".
> 4. Click Connect on the Instagram card and select the same Page; the Instagram card shows the linked Instagram account.
> 5. Open Studio → Video Editor and upload any short MP4. A sample is available at https://click-platform-1.onrender.com/review/sample-clip.mp4: download it, then drag it into the editor.
> 6. Open Export, click Render and wait for it to finish. Under Publish, select Instagram Reels and Facebook Page, then click Broadcast Now. The video is posted as a Reel and as a Page video.
> 7. Open Grow → Analytics and click Refresh to see the posts' views, reach and engagement once Meta reports them (usually within minutes).

## 6. Data handling questions (Data Use Checkup / Data Protection Assessment)

Answer for your own business. These are the facts about how Click works, to base the answers on:

- **What Platform Data Click stores:**
  - access tokens (user, Page), stored encrypted with AES-256-GCM;
  - Page IDs and names, and Instagram account ID, username and profile picture URL;
  - the IDs of posts Click published;
  - the metrics of those posts.
- **Processors / service providers with access:**
  - Render Services, Inc.: hosting, United States;
  - MongoDB, Inc. (Atlas): database, United States;
  - Functional Software, Inc. (Sentry): error reports, EU. Tokens, content and IP addresses are scrubbed before they are sent.
- **Purpose:** only publishing the creator's own content at their request, and showing them their own post performance. No advertising, no sale or sharing with other users, no AI model training.
- **Retention and deletion:**
  - disconnecting an account deletes its tokens;
  - deleting the Click account deletes all stored Platform Data;
  - Meta's data deletion callback is implemented at `/api/privacy/facebook-data-deletion`, and the privacy policy explains how to request deletion.
- **Security:**
  - HTTPS with HSTS everywhere;
  - tokens are encrypted at rest;
  - the database is encrypted at rest by the provider;
  - production access is limited to the owner.
- **Requests from public authorities:** describe your own policy, for example that you review each request for legal validity, challenge unlawful ones, and disclose the minimum required.

## 7. After approval

1. Switch the app from **Development** to **Live** (top of the App Dashboard).
2. Connect your own accounts on the live site and publish a test video to confirm.
3. Any Facebook user can then connect, provided they manage a Page (and, for Instagram, a linked professional account).
