/**
 * Core Storage Configuration Layer
 * Centralizes the environment parsing for AWS S3 and Cloudinary credentials.
 * Utilized across the Sovereign platform to stabilize CDN ingestion.
 */

module.exports = {
  // S3 Strategy configuration
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    bucket: process.env.AWS_S3_BUCKET,
    acl: process.env.AWS_S3_ACL || 'private',
    cdnUrl: process.env.AWS_CLOUDFRONT_URL || process.env.AWS_S3_CDN_URL
  },

  // Cloudinary configuration (if preferred over raw S3)
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET
  },

  // Feature Toggles and Constraints
  options: {
    useCloudStorage: !!(
      (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) || 
      (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
    ),
    maxUploadSizeLimit: 2 * 1024 * 1024 * 1024, // 2GB constraint
  }
};
