// Save video exports to organized folders with configurable expiration (default 10 days)
// User can extend expiration

const path = require('path')
const fs = require('fs')
const SavedExport = require('../models/SavedExport')
const Content = require('../models/Content')
const logger = require('../utils/logger')

const DEFAULT_EXPIRES_DAYS = 10
const SAVED_EXPORTS_BASE = path.join(__dirname, '../../uploads/saved-exports')

/**
 * Resolve server path from relative URL (e.g. /uploads/exports/render-xxx.mp4)
 */
function resolveExportPath(exportPathOrUrl) {
  let normalized = (exportPathOrUrl || '').trim()
  try {
    if (normalized.startsWith('http')) {
      const u = new URL(normalized)
      normalized = u.pathname || ''
    }
  } catch (_) { }
  normalized = normalized.replace(/^\/+/, '')
  if (normalized.startsWith('uploads/')) {
    return path.join(__dirname, '../..', normalized)
  }
  if (normalized.startsWith('exports/')) {
    return path.join(__dirname, '../../uploads', normalized)
  }
  return path.join(__dirname, '../..', 'uploads', normalized)
}

/**
 * Save an export to the organized folder and create a SavedExport record
 * @param {Object} options
 * @param {string} options.userId
 * @param {string} options.contentId
 * @param {string} options.exportPathOrUrl - path or URL of the rendered file (e.g. /uploads/exports/render-xxx.mp4)
 * @param {string} [options.title]
 * @param {string} [options.quality]
 * @param {number} [options.expiresInDays] - default 10
 * @param {string} [options.workspaceId]
 */
async function saveExport(options) {
  const {
    userId,
    contentId,
    exportPathOrUrl,
    title = 'Exported video',
    quality = '1080p',
    expiresInDays = DEFAULT_EXPIRES_DAYS,
    workspaceId,
  } = options

  if (!userId || !contentId || !exportPathOrUrl) {
    throw new Error('userId, contentId, and exportPathOrUrl are required')
  }

  const sourcePath = resolveExportPath(exportPathOrUrl)
  if (!fs.existsSync(sourcePath)) {
    throw new Error('Export file not found. Render again and save immediately.')
  }

  const days = Math.max(1, Math.min(365, Number(expiresInDays) || DEFAULT_EXPIRES_DAYS))
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)

  const relDir = path.join(String(userId), String(contentId))
  const exportDir = path.join(SAVED_EXPORTS_BASE, relDir)
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true })
  }

  const timestamp = Date.now()
  const ext = path.extname(sourcePath) || '.mp4'
  const filename = `export-${quality}-${timestamp}${ext}`
  const destPath = path.join(exportDir, filename)
  const relativePath = path.join('saved-exports', relDir, filename).replace(/\\/g, '/')
  const url = '/' + path.join('uploads', relativePath).replace(/\\/g, '/')

  fs.copyFileSync(sourcePath, destPath)
  logger.info('Saved export copied', { userId, contentId, destPath })

  const content = await Content.findById(contentId).select('title').lean()
  const exportTitle = title || content?.title || 'Exported video'

  const saved = await SavedExport.create({
    userId,
    contentId,
    workspaceId,
    title: exportTitle,
    filePath: relativePath,
    url,
    quality,
    expiresAt,
    expiresInDays: days,
  })

  return saved.toObject ? saved.toObject() : saved
}

/**
 * Extend expiration of a saved export
 * @param {string} id - SavedExport id
 * @param {string} userId - must own the export
 * @param {number} extendByDays - days to add from current expiresAt
 */
async function extendExpiration(id, userId, extendByDays = 10) {
  const doc = await SavedExport.findOne({ _id: id, userId })
  if (!doc) {
    throw new Error('Saved export not found or access denied')
  }

  const addDays = Math.max(1, Math.min(365, Number(extendByDays) || 10))
  const current = new Date(doc.expiresAt).getTime()
  const now = Date.now()
  const base = current > now ? current : now
  doc.expiresAt = new Date(base + addDays * 24 * 60 * 60 * 1000)
  doc.expiresInDays = doc.expiresInDays + addDays
  await doc.save()

  return doc.toObject ? doc.toObject() : doc
}

/**
 * List saved exports for a user, optionally filtered by contentId
 * @param {string} userId
 * @param {string|null} contentId
 * @param {string} [baseUrl] - e.g. https://api.example.com - to build full downloadUrl for each item
 */
async function listSavedExports(userId, contentId = null, baseUrl = '') {
  const query = { userId }
  if (contentId) query.contentId = contentId

  const list = await SavedExport.find(query)
    .sort({ createdAt: -1 })
    .limit(100)
    .lean()

  const base = (baseUrl || '').replace(/\/+$/, '')
  return list.map((doc) => {
    const url = doc.url || ''
    const downloadUrl = base && url ? (url.startsWith('http') ? url : `${base}${url.startsWith('/') ? '' : '/'}${url}`) : url
    return {
      ...doc,
      downloadUrl: downloadUrl || url,
      isExpired: new Date(doc.expiresAt) < new Date(),
    }
  })
}

/**
 * Delete a saved export (file + record) - for cleanup job or user action
 */
async function deleteSavedExport(id, userId) {
  const doc = await SavedExport.findOne({ _id: id, userId })
  if (!doc) return null

  const fullPath = path.join(__dirname, '../..', 'uploads', doc.filePath.replace(/^\//, ''))
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath)
    } catch (e) {
      logger.warn('Could not delete saved export file', { id, error: e.message })
    }
  }
  await SavedExport.deleteOne({ _id: id, userId })
  return { deleted: true }
}

module.exports = {
  saveExport,
  extendExpiration,
  listSavedExports,
  deleteSavedExport,
  DEFAULT_EXPIRES_DAYS,
}
