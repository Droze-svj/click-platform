// Stock Assets API - Unlimited Music, Images & B-Roll
// GET /api/assets/stock?type=images|music|broll&page=1&limit=24&q=search

const express = require('express')
const auth = require('../middleware/auth')
const asyncHandler = require('../middleware/asyncHandler')
const { sendSuccess, sendError } = require('../utils/response')
const stockAssetsService = require('../services/stockAssetsService')

const router = express.Router()

/**
 * GET /api/assets/stock
 * Fetch stock assets (images, music, B-roll) - unlimited with pagination
 * Query: type (images|music|broll), page (default 1), limit (default 24), q (search)
 */
router.get('/stock', auth, asyncHandler(async (req, res) => {
  const { type = 'images', page = 1, limit = 24, q = '' } = req.query

  if (!['images', 'music', 'broll', 'sfx'].includes(type)) {
    return sendError(res, 'Invalid type. Use images, music, broll, or sfx', 400)
  }

  try {
    const result = await stockAssetsService.fetchStockAssets(type, page, limit, q)
    sendSuccess(res, 'Stock assets retrieved', 200, {
      items: result.items,
      hasMore: result.hasMore,
      total: result.total,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 24,
    })
  } catch (error) {
    sendError(res, error.message || 'Failed to fetch stock assets', 500)
  }
}))

module.exports = router
