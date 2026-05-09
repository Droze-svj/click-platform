/**
 * Per-platform "safe zones" — UI chrome each platform paints over uploaded
 * video. Overlays placed inside these zones get clipped by captions, profile
 * UI, progress bars, or right-rail engagement buttons.
 *
 * Insets are expressed in percent of frame dimensions.
 */
export interface SafeZoneInsets {
  top: number
  right: number
  bottom: number
  left: number
}

export type PlatformId = 'tiktok' | 'instagram-reels' | 'instagram-feed' | 'instagram-portrait' | 'youtube-shorts' | 'youtube-landscape' | 'x' | 'linkedin' | 'generic'

export type AspectRatio = '9:16' | '1:1' | '16:9' | '4:5' | '2.39:1' | '4:3'

export interface PlatformSpec {
  id: PlatformId
  label: string
  aspectRatio: AspectRatio
  /** Frame dimensions for the platform's canonical render */
  width: number
  height: number
  /** Where overlays must avoid */
  safeZone: SafeZoneInsets
  /** Where captions are typically placed (sub-region of safeZone). */
  captionSafe: SafeZoneInsets
}

const TIKTOK: PlatformSpec = {
  id: 'tiktok',
  label: 'TikTok',
  aspectRatio: '9:16',
  width: 1080,
  height: 1920,
  // TikTok bottom UI: caption + handle + sound; right rail: avatar/like/comment/share/spinner.
  safeZone: { top: 8, right: 14, bottom: 22, left: 4 },
  captionSafe: { top: 60, right: 14, bottom: 22, left: 4 },
}

const INSTAGRAM_REELS: PlatformSpec = {
  id: 'instagram-reels',
  label: 'Instagram Reels',
  aspectRatio: '9:16',
  width: 1080,
  height: 1920,
  // Reels: bottom username + caption + audio; right-rail interaction column.
  safeZone: { top: 8, right: 14, bottom: 24, left: 4 },
  captionSafe: { top: 62, right: 14, bottom: 24, left: 4 },
}

const INSTAGRAM_FEED: PlatformSpec = {
  id: 'instagram-feed',
  label: 'Instagram Feed (Square)',
  aspectRatio: '1:1',
  width: 1080,
  height: 1080,
  safeZone: { top: 6, right: 6, bottom: 12, left: 6 },
  captionSafe: { top: 70, right: 6, bottom: 12, left: 6 },
}

const INSTAGRAM_PORTRAIT: PlatformSpec = {
  id: 'instagram-portrait',
  label: 'Instagram Portrait',
  aspectRatio: '4:5',
  width: 1080,
  height: 1350,
  safeZone: { top: 6, right: 6, bottom: 14, left: 6 },
  captionSafe: { top: 65, right: 6, bottom: 14, left: 6 },
}

const YOUTUBE_SHORTS: PlatformSpec = {
  id: 'youtube-shorts',
  label: 'YouTube Shorts',
  aspectRatio: '9:16',
  width: 1080,
  height: 1920,
  // YT Shorts: bottom title + handle; right-rail controls (smaller than TikTok).
  safeZone: { top: 8, right: 12, bottom: 20, left: 4 },
  captionSafe: { top: 62, right: 12, bottom: 20, left: 4 },
}

const YOUTUBE_LANDSCAPE: PlatformSpec = {
  id: 'youtube-landscape',
  label: 'YouTube Landscape',
  aspectRatio: '16:9',
  width: 1920,
  height: 1080,
  // Bottom progress bar / chrome only when player is hovered; keep small inset.
  safeZone: { top: 4, right: 4, bottom: 8, left: 4 },
  captionSafe: { top: 70, right: 6, bottom: 8, left: 6 },
}

const X_PLATFORM: PlatformSpec = {
  id: 'x',
  label: 'X / Twitter',
  aspectRatio: '16:9',
  width: 1920,
  height: 1080,
  safeZone: { top: 4, right: 4, bottom: 8, left: 4 },
  captionSafe: { top: 70, right: 6, bottom: 8, left: 6 },
}

const LINKEDIN: PlatformSpec = {
  id: 'linkedin',
  label: 'LinkedIn',
  aspectRatio: '1:1',
  width: 1080,
  height: 1080,
  safeZone: { top: 6, right: 6, bottom: 10, left: 6 },
  captionSafe: { top: 70, right: 6, bottom: 10, left: 6 },
}

const GENERIC_LANDSCAPE: PlatformSpec = {
  id: 'generic',
  label: 'Generic Landscape',
  aspectRatio: '16:9',
  width: 1920,
  height: 1080,
  safeZone: { top: 0, right: 0, bottom: 0, left: 0 },
  captionSafe: { top: 75, right: 4, bottom: 6, left: 4 },
}

export const PLATFORM_SPECS: Record<PlatformId, PlatformSpec> = {
  tiktok: TIKTOK,
  'instagram-reels': INSTAGRAM_REELS,
  'instagram-feed': INSTAGRAM_FEED,
  'instagram-portrait': INSTAGRAM_PORTRAIT,
  'youtube-shorts': YOUTUBE_SHORTS,
  'youtube-landscape': YOUTUBE_LANDSCAPE,
  x: X_PLATFORM,
  linkedin: LINKEDIN,
  generic: GENERIC_LANDSCAPE,
}

/** All platforms that share an aspect ratio (used to find the strictest safe zone). */
export function platformsForAspect(aspectRatio: AspectRatio): PlatformSpec[] {
  return Object.values(PLATFORM_SPECS).filter((p) => p.aspectRatio === aspectRatio)
}

/**
 * Strictest safe zone for an aspect ratio (max insets across all platforms
 * targeting that ratio). Use when you want overlays to be visible everywhere.
 */
export function strictestSafeZone(aspectRatio: AspectRatio): SafeZoneInsets {
  const platforms = platformsForAspect(aspectRatio)
  if (platforms.length === 0) {
    return { top: 0, right: 0, bottom: 0, left: 0 }
  }
  return platforms.reduce(
    (acc, p) => ({
      top: Math.max(acc.top, p.safeZone.top),
      right: Math.max(acc.right, p.safeZone.right),
      bottom: Math.max(acc.bottom, p.safeZone.bottom),
      left: Math.max(acc.left, p.safeZone.left),
    }),
    { top: 0, right: 0, bottom: 0, left: 0 }
  )
}
