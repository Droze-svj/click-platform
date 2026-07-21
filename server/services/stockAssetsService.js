// Stock Assets Service
// Provides unlimited Music, Images & B-Roll from free APIs and built-in catalogs

const https = require('https')
const http = require('http')
const logger = require('../utils/logger')
const { ensureStockAssets, STOCK_SFX, STOCK_MUSIC } = require('../utils/stockAssets')

// Generate the same-origin stock audio (SFX one-shots + music beds) on first load
// so /uploads/stock/*.wav exists. Idempotent + best-effort.
ensureStockAssets()

// Built-in music catalog — SAME-ORIGIN generated beds (was external SoundHelix
// songs that the page CSP blocked in the preview). See utils/stockAssets.js.
const BUILTIN_MUSIC = STOCK_MUSIC

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
// Built-in SFX — SAME-ORIGIN generated one-shots with correct durations (was full
// SoundHelix SONGS mislabelled as 0.5-2s SFX on external, CSP-blocked hosts).
const BUILTIN_SFX = STOCK_SFX

const BUILTIN_GIFS = [
  { id: 'gif-reaction-1', url: 'https://media.giphy.com/media/11ISwbgCxEzMyY/giphy.gif', title: 'Thumbs Up', tags: ['reaction', 'yes'], duration: 2 },
  { id: 'gif-reaction-2', url: 'https://media.giphy.com/media/3o7TKWpu2WClyyq3q8/giphy.gif', title: 'Mind Blown', tags: ['reaction', 'wow'], duration: 3 },
  { id: 'gif-reaction-3', url: 'https://media.giphy.com/media/l0HlOBZcl7mbj52gC/giphy.gif', title: 'Waiting', tags: ['reaction', 'time'], duration: 2 },
  { id: 'gif-sticker-1', url: 'https://media.giphy.com/media/xT0xezQGU5xCDJuCPe/giphy.gif', title: 'Sparkles', tags: ['sticker', 'effect'], duration: 1 },
]

const IMAGES_PER_PAGE = 30
const MUSIC_PER_PAGE = 24
const BROLL_PER_PAGE = 24
const SFX_PER_PAGE = 24
const GIFS_PER_PAGE = 24

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
 * Fetch stock GIFs (built-in + optional GIPHY API)
 */
async function fetchStockGifs(page = 1, limit = 24, search = '') {
  const giphyKey = process.env.GIPHY_API_KEY
  if (giphyKey && search.trim()) {
    try {
      const q = encodeURIComponent(search.trim())
      const offset = (page - 1) * limit
      const url = `https://api.giphy.com/v1/gifs/search?api_key=${giphyKey}&q=${q}&limit=${limit}&offset=${offset}`
      const res = await fetchJson(url)
      
      const items = (res.data || []).map(g => ({
        id: `giphy-${g.id}`,
        url: g.images.original.url,
        thumbnail: g.images.fixed_height_small.url,
        title: g.title,
        type: 'gif',
        source: 'click',
        tags: [search.trim()],
      }))
      
      return {
        items,
        hasMore: (offset + limit) < (res.pagination?.total_count || 0),
        total: res.pagination?.total_count || items.length,
      }
    } catch (err) {
      logger.warn('Giphy API fetch failed', { error: err.message })
    }
  }

  // Fallback
  const q = search.trim().toLowerCase()
  let filtered = BUILTIN_GIFS
  if (q) {
    filtered = BUILTIN_GIFS.filter(
      (g) =>
        (g.title || '').toLowerCase().includes(q) ||
        (g.tags || []).some((t) => t.toLowerCase().includes(q))
    )
  }
  const start = (page - 1) * limit
  const slice = filtered.slice(start, start + limit)
  const items = slice.map((g) => ({
    id: g.id,
    url: g.url,
    title: g.title,
    type: 'gif',
    duration: g.duration,
    source: 'click',
    thumbnail: g.url,
  }))
  return {
    items,
    hasMore: start + slice.length < filtered.length,
    total: filtered.length,
  }
}

/**
 * Unified Semantic Search Bin - Fetch concurrently across all sources
 */
async function fetchAllStock(page = 1, limit = 24, search = '') {
  // Distribute the limit across sources (e.g. 24 limit = 6 per source)
  const limitPerSource = Math.max(1, Math.floor(limit / 4))
  
  const [images, broll, music, sfx, gifs] = await Promise.all([
    fetchStockImages(page, limitPerSource, search),
    fetchStockBroll(page, limitPerSource, search),
    fetchStockMusic(page, limitPerSource, search),
    fetchStockSfx(page, limitPerSource, search),
    fetchStockGifs(page, limitPerSource, search)
  ])

  // Interleave results for a mixed masonry layout effect
  const interleaved = []
  const maxLen = Math.max(images.items.length, broll.items.length, music.items.length, sfx.items.length, gifs.items.length)
  
  for (let i = 0; i < maxLen; i++) {
    if (images.items[i]) interleaved.push(images.items[i])
    if (broll.items[i]) interleaved.push(broll.items[i])
    if (music.items[i]) interleaved.push(music.items[i])
    if (sfx.items[i]) interleaved.push(sfx.items[i])
    if (gifs.items[i]) interleaved.push(gifs.items[i])
  }

  return {
    items: interleaved,
    hasMore: images.hasMore || broll.hasMore || music.hasMore || sfx.hasMore || gifs.hasMore,
    total: images.total + broll.total + music.total + sfx.total + gifs.total,
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
  case 'gifs':
    return fetchStockGifs(p, l, s)
  case 'all':
    return fetchAllStock(p, l, s)
  default:
    return { items: [], hasMore: false, total: 0 }
  }
}

module.exports = {
  fetchStockAssets,
  fetchAllStock,
  fetchStockImages,
  fetchStockMusic,
  fetchStockBroll,
  fetchStockSfx,
  fetchStockGifs,
}
