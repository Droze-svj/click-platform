// Stock Assets API - Unlimited Music, Images & B-Roll
// GET /api/assets/stock?type=images|music|broll&page=1&limit=24&q=search

const express = require('express')
const auth = require('../middleware/auth')
const asyncHandler = require('../middleware/asyncHandler')
const { sendSuccess, sendError } = require('../utils/response')
const { signMediaUrls } = require('../utils/mediaUrlSigner')
const stockAssetsService = require('../services/stockAssetsService')
const { tagMedia } = require('../services/mediaTaggingService')
const { generateSmartFolders } = require('../services/smartFolderService')

const router = express.Router()

/**
 * GET /api/assets/stock
 * Fetch stock assets (images, music, B-roll) - unlimited with pagination
 * Query: type (images|music|broll), page (default 1), limit (default 24), q (search)
 */
router.get('/stock', auth, asyncHandler(async (req, res) => {
  const { type = 'images', page = 1, limit = 24, q = '' } = req.query

  if (!['images', 'music', 'broll', 'sfx', 'gifs', 'all'].includes(type)) {
    return sendError(res, 'Invalid type. Use images, music, broll, sfx, gifs, or all', 400)
  }

  try {
    const result = await stockAssetsService.fetchStockAssets(type, page, limit, q)
    sendSuccess(res, 'Stock assets retrieved', 200, {
      items: signMediaUrls(result.items),
      hasMore: result.hasMore,
      total: result.total,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 24,
    })
  } catch (error) {
    sendError(res, error.message || 'Failed to fetch stock assets', 500)
  }
}))

/**
 * POST /api/assets/smart-organize
 * Automatically tags and organizes the provided assets into smart folders via CLIP semantic analysis
 */
router.post('/smart-organize', auth, asyncHandler(async (req, res) => {
  const { assets = [] } = req.body
  
  // 1. Semantic Tagging (Parallel process)
  const taggedAssets = await Promise.all(assets.map(async (asset) => {
    const hasTags = asset.metadata?.tags && asset.metadata.tags.length > 0
    if (!hasTags && asset.url) {
      const taggingResult = await tagMedia(asset.url, asset.type || 'image')
      return { 
        ...asset, 
        metadata: { ...(asset.metadata || {}), tags: taggingResult.tags } 
      }
    }
    return asset
  }))

  // 2. Smart Folder Grouping
  const folders = await generateSmartFolders(taggedAssets)

  sendSuccess(res, 'Assets organized into smart folders', 200, {
    folders: signMediaUrls(folders),
    totalAssets: taggedAssets.length
  })
}))

module.exports = router
