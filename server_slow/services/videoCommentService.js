const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const Comment = require('../models/Comment');
const Content = require('../models/Content');
const logger = require('../utils/logger');
const { uploadFile } = require('./storageService');

class VideoCommentService {
  /**
   * Create a frame-accurate comment with high-res screenshot
   */
  async createVideoComment(userId, userName, teamId, contentId, commentData) {
    const { text, timestamp, annotation, languageCode } = commentData;

    try {
      const content = await Content.findById(contentId);
      if (!content) throw new Error('Content not found');

      const videoPath = content.originalFile.url.startsWith('/')
        ? path.join(__dirname, '../..', content.originalFile.url)
        : content.originalFile.url;

      let screenshotUrl = null;

      // 📸 Phase 16: Automatic Frame Capture
      if (timestamp !== null) {
        try {
          screenshotUrl = await this.captureFrame(videoPath, timestamp, contentId);
          logger.info('Frame captured for comment', { timestamp, screenshotUrl });
        } catch (capErr) {
          logger.warn('Failed to capture frame, proceeding with text-only comment', { error: capErr.message });
        }
      }

      const comment = new Comment({
        userId,
        userName,
        teamId,
        entityType: 'content',
        entityId: contentId,
        text,
        timestamp,
        screenshotUrl,
        annotation,
        languageCode
      });

      await comment.save();
      return comment;
    } catch (error) {
      logger.error('Error creating video comment', { error: error.message, contentId });
      throw error;
    }
  }

  /**
   * Capture a specific frame from video and upload to storage
   */
  async captureFrame(videoPath, timeInSeconds, contentId) {
    const filename = `review-frame-${contentId}-${Date.now()}.jpg`;
    const tempPath = path.join(__dirname, '../../uploads/temp', filename);

    if (!fs.existsSync(path.dirname(tempPath))) {
      fs.mkdirSync(path.dirname(tempPath), { recursive: true });
    }

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timeInSeconds],
          filename: filename,
          folder: path.dirname(tempPath),
          size: '1920x?' // High-res
        })
        .on('end', async () => {
          try {
            const uploadResult = await uploadFile(tempPath, `reviews/${filename}`, 'image/jpeg');
            // Cleanup temp file
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            resolve(uploadResult.url);
          } catch (err) {
            reject(err);
          }
        })
        .on('error', (err) => reject(err));
    });
  }

  /**
   * Get comments for a specific video time range
   */
  async getCommentsByTimeRange(contentId, startTime, endTime) {
    return await Comment.find({
      entityId: contentId,
      timestamp: { $gte: startTime, $lte: endTime }
    }).sort({ timestamp: 1 });
  }
}

module.exports = new VideoCommentService();
