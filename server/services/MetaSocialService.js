const axios = require('axios');
const logger = require('../utils/logger');
const { assertPublicUrl } = require('../utils/urlGuard');

const GRAPH_TIMEOUT_MS = 20000;

const { GRAPH_BASE } = require('../utils/metaGraph');
const { publicMediaUrl } = require('../utils/publicMediaUrl');

const VIDEO_RE = /\.(mp4|mov|m4v|webm)(\?|$)/i;

function captionOf(contentData) {
  const { title, description } = contentData || {};
  return [description || title || ''].join('').slice(0, 2200);
}

class MetaSocialService {
  /**
   * Instagram (scheduler path). `auth` is getSocialCredentials(userId,
   * 'instagram'): the Page access token + { igUserId, pageId } metadata stored
   * when the creator connected Instagram through Facebook Login. This used to
   * read an `igUserId` that was never stored and always posted `image_url`,
   * so no scheduled Instagram post could succeed.
   */
  static async postToInstagram(auth, contentData) {
    const igUserId = auth?.igUserId || auth?.metadata?.igUserId || null;
    if (!igUserId || !auth?.accessToken) {
      throw new Error('Instagram account not connected. Connect Instagram (through Facebook) again.');
    }
    const mediaUrl = publicMediaUrl(contentData?.mediaUrl);
    if (!mediaUrl) throw new Error('Instagram posts need a video or image');
    // SSRF defense-in-depth: Meta fetches the URL server-side.
    await assertPublicUrl(mediaUrl);

    const { publishInstagramMedia } = require('./instagramOAuthService');
    const result = await publishInstagramMedia({
      igBusinessId: igUserId,
      pageAccessToken: auth.accessToken,
      mediaUrl,
      caption: captionOf(contentData),
      options: { coverUrl: contentData?.thumbnailUrl ? publicMediaUrl(contentData.thumbnailUrl) : undefined },
    });
    logger.info('[Instagram] Post successful', { id: result.id });
    return { id: result.id, url: result.url || null };
  }

  /**
   * Facebook Page (scheduler path). `auth` is getSocialCredentials(userId,
   * 'facebook'), which carries the creator's Pages with decrypted page tokens.
   * Meta only lets apps publish to Pages, authenticated with the Page token.
   */
  static async postToFacebookPage(auth, contentData) {
    const pages = Array.isArray(auth?.pages) ? auth.pages.filter((p) => p && p.id && p.accessToken) : [];
    const wanted = auth?.pageId || contentData?.pageId || null;
    const page = wanted
      ? pages.find((p) => p.id === String(wanted))
      : (pages.find((p) => auth?.defaultPageId && p.id === String(auth.defaultPageId)) || pages[0]);
    if (!page) {
      throw new Error('No Facebook Page connected. Facebook only allows apps to post to Pages: reconnect Facebook and select a Page you manage.');
    }

    const message = captionOf(contentData);
    const mediaUrl = contentData?.mediaUrl ? publicMediaUrl(contentData.mediaUrl) : null;
    if (mediaUrl) await assertPublicUrl(mediaUrl); // SSRF defense-in-depth
    logger.info('[Facebook] Posting to page', { pageId: page.id });

    try {
      let endpoint;
      let params;
      if (mediaUrl && VIDEO_RE.test(mediaUrl)) {
        endpoint = `/${page.id}/videos`;
        params = { file_url: mediaUrl, description: message, title: contentData?.title || undefined, access_token: page.accessToken };
      } else if (mediaUrl) {
        endpoint = `/${page.id}/photos`;
        params = { url: mediaUrl, caption: message, access_token: page.accessToken };
      } else {
        endpoint = `/${page.id}/feed`;
        params = { message, access_token: page.accessToken };
      }
      const res = await axios.post(`${GRAPH_BASE}${endpoint}`, null, {
        params,
        timeout: mediaUrl && VIDEO_RE.test(mediaUrl) ? 120000 : GRAPH_TIMEOUT_MS,
      });
      return { id: res.data.id, url: `https://www.facebook.com/${res.data.post_id || res.data.id}` };
    } catch (error) {
      logger.error('[Facebook] Post failed', { error: error.response?.data?.error?.message || error.message });
      throw error;
    }
  }

  /**
   * Delete an Instagram/Facebook post. Called by socialMediaService's delete
   * switch (the A/B auto-killer). Automatic deletion isn't wired yet, so we
   * report this HONESTLY (no fake success) instead of crashing the caller with
   * "deletePost is not a function". Mirrors the TikTok deletePost contract.
   */
  static async deletePost(_auth, postId) {
    logger.info('[Meta] delete requested — automatic deletion not wired', { postId });
    return {
      success: false,
      platform: 'meta',
      unsupported: true,
      postId: postId || null,
      message: 'Automatic deletion is not wired for Instagram/Facebook yet. Remove the post manually in the app.',
    };
  }
}

module.exports = MetaSocialService;
