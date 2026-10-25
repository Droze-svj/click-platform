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
const multer = require('multer')
const os = require('os')
const path = require('path')
const fs = require('fs')
const mongoose = require('mongoose')
const logger = require('../utils/logger')
const UserImage = require('../models/UserImage')
const { uploadFile, deleteFile } = require('../services/storageService')
const { randomMediaName } = require('../utils/mediaName')

const router = express.Router()

// ── User image uploads (editor asset library) ───────────────────────────────
// The library's "Upload image" used to post the image to /api/video/upload as a
// `video` field, whose filter only accepts video files → every image was a 400.
// Raster formats only: SVG can carry script and /uploads is served from our own
// origin, so it is deliberately not accepted.
const IMAGE_MIME_EXT = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/jpg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
}
const MAX_IMAGE_BYTES = 20 * 1024 * 1024 // 20 MB

const imageUpload = multer({
  dest: path.join(os.tmpdir(), 'click-user-images'),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const allowedExt = IMAGE_MIME_EXT[String(file.mimetype || '').toLowerCase()]
    const ext = path.extname(file.originalname || '').toLowerCase()
    if (allowedExt && allowedExt.includes(ext)) return cb(null, true)
    const err = new Error('Unsupported image. Upload a PNG, JPG, WebP or GIF file.')
    err.code = 'INVALID_FILE_TYPE'
    return cb(err)
  },
}).single('image')

// Multer failures are client mistakes (wrong type / too big) → 400/413, not 500.
function handleImageUpload(req, res, next) {
  imageUpload(req, res, (err) => {
    if (!err) return next()
    if (err.code === 'LIMIT_FILE_SIZE') return sendError(res, 'Image is larger than 20 MB.', 413)
    return sendError(res, err.message || 'Image upload was rejected.', 400)
  })
}

function hasMongoUserId(req) {
  const id = req.user?._id ? String(req.user._id) : ''
  return /^[a-f0-9]{24}$/i.test(id) && mongoose.Types.ObjectId.isValid(id)
}

/**
 * POST /api/assets/images  (multipart, field "image", optional "title")
 * Stores the image under an unguessable name and indexes it for the owner.
 */
router.post('/images', auth, handleImageUpload, asyncHandler(async (req, res) => {
  if (!req.file) return sendError(res, 'image file is required (form field "image")', 400)
  const tmpPath = req.file.path
  try {
    if (!hasMongoUserId(req)) return sendError(res, 'Image uploads need a signed-in account.', 403)
    const ext = path.extname(req.file.originalname || '').toLowerCase()
    const key = `user-images/${randomMediaName(ext)}`
    const stored = await uploadFile(tmpPath, key, req.file.mimetype)
    const rawTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
    const title = (rawTitle || path.basename(req.file.originalname || 'Image', ext) || 'Image').slice(0, 200)
    const image = await UserImage.create({
      userId: req.user._id,
      workspaceId: req.user.workspaceId || undefined,
      title,
      file: {
        url: stored.url,
        filename: path.basename(stored.key || key),
        size: req.file.size,
        mimeType: req.file.mimetype,
      },
    })
    return sendSuccess(res, 'Image uploaded', 201, { image: signMediaUrls(image) })
  } finally {
    await fs.promises.unlink(tmpPath).catch(() => {})
  }
}))

/** GET /api/assets/images — the caller's uploaded images, newest first. */
router.get('/images', auth, asyncHandler(async (req, res) => {
  if (!hasMongoUserId(req)) return sendSuccess(res, 'Images retrieved', 200, { images: [] })
  const images = await UserImage.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(500).lean()
  return sendSuccess(res, 'Images retrieved', 200, { images: signMediaUrls(images) })
}))

/** DELETE /api/assets/images/:id — owner only. */
router.delete('/images/:id', auth, asyncHandler(async (req, res) => {
  if (!hasMongoUserId(req) || !mongoose.Types.ObjectId.isValid(req.params.id)) {
    return sendError(res, 'Image not found', 404)
  }
  const image = await UserImage.findOneAndDelete({ _id: req.params.id, userId: req.user._id })
  if (!image) return sendError(res, 'Image not found', 404)
  const url = image.file?.url || ''
  if (url.startsWith('/uploads/')) {
    await deleteFile(url.replace(/^\/uploads\//, '')).catch((e) => logger.warn('User image file delete failed', { error: e.message }))
  }
  return sendSuccess(res, 'Image deleted', 200, { id: String(image._id) })
}))

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
