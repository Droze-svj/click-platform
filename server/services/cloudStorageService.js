// aws-sdk is optional — many self-hosted deployments use Cloudinary for
// images and don't push videos to S3. Resolving it lazily means a missing
// install no longer crashes the entire CloudStorageService at first
// require (which broke avatar uploads through `uploadImage`, because the
// module never loaded). When aws-sdk is unavailable, `s3` stays null and
// the S3-backed methods throw a clear error explaining the dependency.
let AWS = null;
let s3 = null;
try {
  AWS = require('aws-sdk');
  AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
  });
  s3 = new AWS.S3();
} catch (e) {
  // Logged once at boot — the rest of the service still works for
  // Cloudinary-backed uploads.
  // eslint-disable-next-line no-console
  console.warn('[cloudStorageService] aws-sdk not installed; S3 uploads disabled. Cloudinary uploads still work.');
}
const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

// Configure Cloudinary (for thumbnails/images)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

class CloudStorageService {
  /**
   * Uploads a file to AWS S3 (best for videos)
   */
  static async uploadVideo(filePath, folder = 'videos') {
    if (!s3) {
      throw new Error('S3 uploads are disabled — aws-sdk is not installed. Run `pnpm add aws-sdk` to enable.');
    }
    const fileName = `${folder}/${Date.now()}-${path.basename(filePath)}`;
    const fileStream = fs.createReadStream(filePath);

    const params = {
      Bucket: process.env.AWS_S3_BUCKET || 'click-platform-assets',
      Key: fileName,
      Body: fileStream,
      ContentType: 'video/mp4',
      ACL: 'public-read'
    };

    try {
      const uploadResult = await s3.upload(params).promise();
      logger.info(`[CloudStorage] Video uploaded to S3: ${uploadResult.Location}`);
      
      // Auto-cleanup local file to save space
      fs.unlink(filePath, (err) => {
        if (err) logger.warn(`[CloudStorage] Failed to delete local file: ${filePath}`, { error: err.message });
        else logger.info(`[CloudStorage] Cleaned up local file: ${filePath}`);
      });

      return uploadResult.Location;
    } catch (error) {
      logger.error('[CloudStorage] S3 upload failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Uploads an image to Cloudinary (best for thumbnails)
   */
  static async uploadImage(filePath, folder = 'thumbnails') {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: `click/${folder}`,
        resource_type: 'image'
      });
      logger.info(`[CloudStorage] Image uploaded to Cloudinary: ${result.secure_url}`);
      
      // Auto-cleanup local file
      fs.unlink(filePath, (err) => {
        if (err) logger.warn(`[CloudStorage] Failed to delete local image: ${filePath}`);
      });

      return result.secure_url;
    } catch (error) {
      logger.error('[CloudStorage] Cloudinary upload failed', { error: error.message });
      throw error;
    }
  }
}

module.exports = CloudStorageService;
