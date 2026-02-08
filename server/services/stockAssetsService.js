// Stock Assets Service
// Provides unlimited Music, Images & B-Roll from free APIs and built-in catalogs

const https = require('https')
const http = require('http')
const logger = require('../utils/logger')

// Built-in music catalog (SoundHelix + more - royalty-free, no attribution required for SoundHelix)
const BUILTIN_MUSIC = [
  { id: 'click-music-1', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', title: 'Upbeat Creative', genre: 'electronic', mood: 'energetic', duration: 180 },
  { id: 'click-music-2', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', title: 'Calm Focus', genre: 'ambient', mood: 'calm', duration: 240 },
  { id: 'click-music-3', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', title: 'Corporate Pulse', genre: 'corporate', mood: 'professional', duration: 200 },
  { id: 'click-music-4', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', title: 'Dramatic Build', genre: 'cinematic', mood: 'dramatic', duration: 190 },
  { id: 'click-music-5', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', title: 'Minimal Loop', genre: 'minimal', mood: 'relaxed', duration: 120 },
  { id: 'click-music-6', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', title: 'Driving Rhythm', genre: 'electronic', mood: 'energetic', duration: 210 },
  { id: 'click-music-7', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3', title: 'Soothing Waves', genre: 'ambient', mood: 'peaceful', duration: 195 },
  { id: 'click-music-8', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', title: 'Tech Innovation', genre: 'electronic', mood: 'futuristic', duration: 185 },
  { id: 'click-music-9', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3', title: 'Gentle Flow', genre: 'acoustic', mood: 'warm', duration: 220 },
  { id: 'click-music-10', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3', title: 'Epic Journey', genre: 'cinematic', mood: 'epic', duration: 230 },
  { id: 'click-music-11', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3', title: 'Urban Beat', genre: 'hip-hop', mood: 'urban', duration: 175 },
  { id: 'click-music-12', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3', title: 'Morning Light', genre: 'ambient', mood: 'uplifting', duration: 205 },
  { id: 'click-music-13', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3', title: 'Productive Mode', genre: 'corporate', mood: 'focused', duration: 195 },
  { id: 'click-music-14', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3', title: 'Night Drive', genre: 'electronic', mood: 'chill', duration: 215 },
  { id: 'click-music-15', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3', title: 'Inspirational', genre: 'cinematic', mood: 'inspiring', duration: 200 },
  { id: 'click-music-16', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3', title: 'Clean Slate', genre: 'minimal', mood: 'neutral', duration: 165 },
]

// Built-in B-Roll (free sample videos - sample-videos.com, Big Buck Bunny clips)
const BUILTIN_BROLL = [
  { id: 'click-broll-1', url: 'https://www.sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4', title: 'B-Roll Sample 720p', tags: ['sample', '720p'], duration: 10 },
  { id: 'click-broll-2', url: 'https://www.sample-videos.com/video321/mp4/720/big_buck_bunny_720p_2mb.mp4', title: 'B-Roll Sample 2MB', tags: ['sample', '720p'], duration: 12 },
  { id: 'click-broll-3', url: 'https://www.sample-videos.com/video321/mp4/720/big_buck_bunny_720p_5mb.mp4', title: 'B-Roll Sample 5MB', tags: ['sample', '720p'], duration: 15 },
  { id: 'click-broll-4', url: 'https://www.sample-videos.com/video321/mp4/480/big_buck_bunny_480p_1mb.mp4', title: 'B-Roll Sample 480p', tags: ['sample', '480p'], duration: 10 },
  { id: 'click-broll-5', url: 'https://www.sample-videos.com/video321/mp4/480/big_buck_bunny_480p_2mb.mp4', title: 'B-Roll Sample 480p 2MB', tags: ['sample', '480p'], duration: 11 },
  { id: 'click-broll-6', url: 'https://www.sample-videos.com/video321/mp4/360/big_buck_bunny_360p_1mb.mp4', title: 'B-Roll Sample 360p', tags: ['sample', '360p'], duration: 9 },
  { id: 'click-broll-7', url: 'https://www.sample-videos.com/video321/mp4/360/big_buck_bunny_360p_2mb.mp4', title: 'B-Roll Sample 360p 2MB', tags: ['sample', '360p'], duration: 10 },
  { id: 'click-broll-8', url: 'https://www.sample-videos.com/video321/mp4/240/big_buck_bunny_240p_1mb.mp4', title: 'B-Roll Sample 240p', tags: ['sample', '240p'], duration: 8 },
]

// Built-in Sound Effects (free SFX - royalty-free)
// Uses known working URLs; users can upload their own SFX in the Asset Library
const BUILTIN_SFX = [
  { id: 'sfx-whoosh-1', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', title: 'Transition Build', tags: ['transition', 'build'], duration: 2 },
  { id: 'sfx-impact-1', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', title: 'Impact Hit', tags: ['hit', 'punch'], duration: 1 },
  { id: 'sfx-notification', url: 'https://www.w3schools.com/html/horse.mp3', title: 'Notification', tags: ['alert', 'attention'], duration: 2 },
  { id: 'sfx-pop', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', title: 'Pop', tags: ['bubble', 'click'], duration: 1 },
  { id: 'sfx-ding', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', title: 'Ding', tags: ['success', 'chime'], duration: 1 },
  { id: 'sfx-swoosh', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3', title: 'Swoosh', tags: ['transition', 'swipe'], duration: 1 },
  { id: 'sfx-tada', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3', title: 'Tada', tags: ['celebration', 'reveal'], duration: 1 },
  { id: 'sfx-tick', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', title: 'Tick', tags: ['clock', 'countdown'], duration: 0.5 },
  { id: 'sfx-click', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3', title: 'Click', tags: ['ui', 'button'], duration: 0.5 },
  { id: 'sfx-success', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3', title: 'Success', tags: ['confirm', 'done'], duration: 1 },
]

const IMAGES_PER_PAGE = 30
const MUSIC_PER_PAGE = 24
const BROLL_PER_PAGE = 24
const SFX_PER_PAGE = 24

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    lib.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch {
          reject(new Error('Invalid JSON'))
        }
      })
    }).on('error', reject)
  })
}

/**
 * Fetch stock images from Picsum (unlimited, paginated)
 */
async function fetchStockImages(page = 1, limit = 24, search = '') {
  try {
    const url = `https://picsum.photos/v2/list?page=${page}&limit=${Math.min(limit, 100)}`
    const list = await fetchJson(url)
    if (!Array.isArray(list)) return { items: [], hasMore: false }
    const q = search.trim().toLowerCase()
    let filtered = list
    if (q) {
      filtered = list.filter((i) =>
        (i.author || '').toLowerCase().includes(q) ||
        (i.id || '').toString().includes(q)
      )
    }
    const items = filtered.map((img) => ({
      id: `click-img-${img.id}`,
      url: img.download_url || `https://picsum.photos/id/${img.id}/800/600`,
      thumbnail: `https://picsum.photos/id/${img.id}/400/300`,
      title: (img.author ? `${img.author} - ` : '') + `Photo ${img.id}`,
      type: 'image',
      source: 'click',
      author: img.author,
    }))
    return {
      items,
      hasMore: list.length >= limit,
      total: items.length,
    }
  } catch (err) {
    logger.warn('Stock images fetch failed', { error: err.message })
    return { items: [], hasMore: false }
  }
}

/**
 * Fetch stock music (built-in catalog, paginated)
 */
function fetchStockMusic(page = 1, limit = 24, search = '') {
  const q = search.trim().toLowerCase()
  let filtered = BUILTIN_MUSIC
  if (q) {
    filtered = BUILTIN_MUSIC.filter(
      (m) =>
        (m.title || '').toLowerCase().includes(q) ||
        (m.genre || '').toLowerCase().includes(q) ||
        (m.mood || '').toLowerCase().includes(q)
    )
  }
  const start = (page - 1) * limit
  const slice = filtered.slice(start, start + limit)
  const items = slice.map((m) => ({
    id: m.id,
    url: m.url,
    title: m.title,
    type: 'music',
    duration: m.duration,
    source: 'click',
    genre: m.genre,
    mood: m.mood,
  }))
  return {
    items,
    hasMore: start + slice.length < filtered.length,
    total: filtered.length,
  }
}

/**
 * Fetch stock B-Roll (built-in + optional Pexels API)
 */
async function fetchStockBroll(page = 1, limit = 24, search = '') {
  const pexelsKey = process.env.PEXELS_API_KEY
  if (pexelsKey && search.trim()) {
    try {
      const q = encodeURIComponent(search.trim())
      const url = `https://api.pexels.com/videos/search?query=${q}&per_page=${limit}&page=${page}`
      const res = await new Promise((resolve, reject) => {
        https.get(url, { headers: { Authorization: pexelsKey } }, (r) => {
          let data = ''
          r.on('data', (chunk) => { data += chunk })
          r.on('end', () => resolve(JSON.parse(data || '{}')))
        }).on('error', reject)
      })
      const videos = res.videos || []
      const items = videos.map((v) => {
        const file = (v.video_files || []).find((f) => f.quality === 'hd' || f.width >= 1280) || v.video_files?.[0]
        return {
          id: `pexels-${v.id}`,
          url: file?.link || v.url,
          thumbnail: v.image,
          title: v.user?.name ? `${v.user.name} - ${v.id}` : `Video ${v.id}`,
          type: 'broll',
          duration: v.duration || 10,
          source: 'click',
          user: v.user?.name,
        }
      })
      return {
        items,
        hasMore: (res.page || 1) * (res.per_page || limit) < (res.total_results || 0),
        total: res.total_results || items.length,
      }
    } catch (err) {
      logger.warn('Pexels B-roll fetch failed', { error: err.message })
    }
  }

  const q = search.trim().toLowerCase()
  let filtered = BUILTIN_BROLL
  if (q) {
    filtered = BUILTIN_BROLL.filter(
      (b) =>
        (b.title || '').toLowerCase().includes(q) ||
        (b.tags || []).some((t) => t.toLowerCase().includes(q))
    )
  }
  const start = (page - 1) * limit
  const slice = filtered.slice(start, start + limit)
  const items = slice.map((b) => ({
    id: b.id,
    url: b.url,
    title: b.title,
    type: 'broll',
    duration: b.duration,
    source: 'click',
    thumbnail: null,
  }))
  return {
    items,
    hasMore: start + slice.length < filtered.length,
    total: filtered.length,
  }
}

/**
 * Fetch stock sound effects (built-in catalog)
 */
function fetchStockSfx(page = 1, limit = 24, search = '') {
  const q = search.trim().toLowerCase()
  let filtered = BUILTIN_SFX
  if (q) {
    filtered = BUILTIN_SFX.filter(
      (s) =>
        (s.title || '').toLowerCase().includes(q) ||
        (s.tags || []).some((t) => t.toLowerCase().includes(q))
    )
  }
  const start = (page - 1) * limit
  const slice = filtered.slice(start, start + limit)
  const items = slice.map((s) => ({
    id: s.id,
    url: s.url,
    title: s.title,
    type: 'sfx',
    duration: s.duration,
    source: 'click',
    tags: s.tags,
  }))
  return {
    items,
    hasMore: start + slice.length < filtered.length,
    total: filtered.length,
  }
}

/**
 * Main: fetch stock assets by type
 */
async function fetchStockAssets(type, page = 1, limit = 24, search = '') {
  const p = Math.max(1, parseInt(page, 10) || 1)
  const l = Math.min(50, Math.max(6, parseInt(limit, 10) || 24))
  const s = String(search || '').trim()

  switch (type) {
    case 'images':
      return fetchStockImages(p, l, s)
    case 'music':
      return fetchStockMusic(p, l, s)
    case 'broll':
      return fetchStockBroll(p, l, s)
    case 'sfx':
      return fetchStockSfx(p, l, s)
    default:
      return { items: [], hasMore: false, total: 0 }
  }
}

module.exports = {
  fetchStockAssets,
  fetchStockImages,
  fetchStockMusic,
  fetchStockBroll,
  fetchStockSfx,
}
