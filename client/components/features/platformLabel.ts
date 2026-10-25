type Translate = (key: string, params?: Record<string, string | number>) => string

/**
 * Display name for a platform id. The id stays the value sent to the API; this
 * is only the label a person reads (e.g. 'tiktok' → "TikTok").
 */
export function platformLabel(t: Translate, platform: string): string {
  switch (platform) {
    case 'tiktok': return t('creatorTools.platforms.tiktok')
    case 'instagram': return t('creatorTools.platforms.instagram')
    case 'youtube': return t('creatorTools.platforms.youtube')
    case 'twitter': return t('creatorTools.platforms.twitter')
    case 'linkedin': return t('creatorTools.platforms.linkedin')
    case 'facebook': return t('creatorTools.platforms.facebook')
    default: return platform
  }
}
