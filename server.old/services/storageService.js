// Cloud storage service for file uploads (AWS S3, Cloudinary, or local)

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');

// Initialize storage clients
let s3Client = null;
let cloudinary = null;
let useCloudStorage = false;
let storageProvider = 'local'; // 's3', 'cloudinary', or 'local'

// Check if Cloudinary is configured
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  try {
    cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    useCloudStorage = true;
    storageProvider = 'cloudinary';
    logger.info('✅ Cloud storage (Cloudinary) configured');
  } catch (error) {
    logger.warn('⚠️ Cloudinary package not installed. Run: npm install cloudinary');
  }
}
// Check if S3 is configured (only if Cloudinary is not)
else if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  useCloudStorage = true;
  storageProvider = 's3';
  logger.info('✅ Cloud storage (S3) configured');
} else {
  logger.warn('⚠️ Cloud storage not configured. Using local file storage.');
}

const BUCKET_NAME = process.env.AWS_S3_BUCKET;
const CDN_URL = process.env.AWS_CLOUDFRONT_URL || process.env.AWS_S3_CDN_URL;

/**
 * Upload file to cloud storage (S3) or local storage
 */
async function uploadFile(filePath, key, contentType = null, metadata = {}) {
  try {
    if (useCloudStorage && storageProvider === 'cloudinary' && cloudinary) {
      // Upload to Cloudinary
      const fileContent = fs.readFileSync(filePath);
      const fileName = path.basename(key);
      const folder = path.dirname(key).replace(/^\/+/, '').replace(/\/+$/, '') || 'uploads';
      
      const result = await cloudinary.uploader.upload(filePath, {
        folder: folder,
        public_id: path.parse(fileName).name,
        resource_type: 'auto', // Automatically detect image, video, raw
        overwrite: true,
      });
      
      logger.info('File uploaded to Cloudinary', { key, url: result.secure_url });
      
      return {
        url: result.secure_url,
        key: result.public_id,
        storage: 'cloudinary',
        cloudinaryId: result.public_id,
      };
    } else if (useCloudStorage && storageProvider === 's3' && s3Client) {
      // Upload to S3
      const fileContent = fs.readFileSync(filePath);
      const fileName = path.basename(key);
      const folder = path.dirname(key).replace(/^\/+/, ''); // Remove leading slashes
      const s3Key = folder ? `${folder}/${fileName}` : fileName;

      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: fileContent,
        ContentType: contentType || 'application/octet-stream',
        Metadata: metadata,
        // Make files publicly readable (adjust based on your needs)
        ACL: process.env.AWS_S3_ACL || 'private',
      });

      await s3Client.send(command);
      logger.info('File uploaded to S3', { key: s3Key });

      // Return public URL
      const publicUrl = CDN_URL 
        ? `${CDN_URL}/${s3Key}`
        : `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;

      return {
        url: publicUrl,
        key: s3Key,
        bucket: BUCKET_NAME,
        storage: 's3',
      };
    } else {
      // Use local storage (development/fallback)
      const uploadsDir = path.join(__dirname, '../../uploads');
      const destPath = path.join(uploadsDir, key);
      const destDir = path.dirname(destPath);

      // Ensure directory exists
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      // Copy file to destination
      fs.copyFileSync(filePath, destPath);

      // Return local URL
      return {
        url: `/uploads/${key}`,
        key: key,
        storage: 'local',
        path: destPath,
      };
    }
  } catch (error) {
    logger.error('File upload error', { error: error.message, key });
    captureException(error, {
      tags: { operation: 'file_upload' },
      extra: { key, contentType },
    });
    throw error;
  }
}

/**
 * Upload file buffer directly (for in-memory files)
 */
async function uploadBuffer(buffer, key, contentType = null, metadata = {}) {
  try {
    if (useCloudStorage && storageProvider === 'cloudinary' && cloudinary) {
      // Upload buffer to Cloudinary
      const fileName = path.basename(key);
      const folder = path.dirname(key).replace(/^\/+/, '').replace(/\/+$/, '') || 'uploads';
      
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: folder,
            public_id: path.parse(fileName).name,
            resource_type: 'auto',
            overwrite: true,
          },
          (error, result) => {
            if (error) {
              logger.error('Cloudinary upload error', { error: error.message, key });
              reject(error);
            } else {
              logger.info('Buffer uploaded to Cloudinary', { key, url: result.secure_url });
              resolve({
                url: result.secure_url,
                key: result.public_id,
                storage: 'cloudinary',
                cloudinaryId: result.public_id,
              });
            }
          }
        );
        uploadStream.end(buffer);
      });
    } else if (useCloudStorage && storageProvider === 's3' && s3Client) {
      const fileName = path.basename(key);
      const folder = path.dirname(key).replace(/^\/+/, '');
      const s3Key = folder ? `${folder}/${fileName}` : fileName;

      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: buffer,
        ContentType: contentType || 'application/octet-stream',
        Metadata: metadata,
        ACL: process.env.AWS_S3_ACL || 'private',
      });

      await s3Client.send(command);
      logger.info('Buffer uploaded to S3', { key: s3Key });

      const publicUrl = CDN_URL 
        ? `${CDN_URL}/${s3Key}`
        : `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;

      return {
        url: publicUrl,
        key: s3Key,
        bucket: BUCKET_NAME,
        storage: 's3',
      };
    } else {
      // Save to local storage
      const uploadsDir = path.join(__dirname, '../../uploads');
      const destPath = path.join(uploadsDir, key);
      const destDir = path.dirname(destPath);

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      fs.writeFileSync(destPath, buffer);

      return {
        url: `/uploads/${key}`,
        key: key,
        storage: 'local',
        path: destPath,
      };
    }
  } catch (error) {
    logger.error('Buffer upload error', { error: error.message, key });
    captureException(error, {
      tags: { operation: 'buffer_upload' },
      extra: { key, contentType },
    });
    throw error;
  }
}

/**
 * Delete file from cloud storage
 */
async function deleteFile(key) {
  try {
    if (useCloudStorage && storageProvider === 'cloudinary' && cloudinary) {
      // Delete from Cloudinary
      try {
        // Cloudinary public_id includes folder, so use the key directly
        const publicId = key.includes('/') ? key : `uploads/${key}`;
        const result = await cloudinary.uploader.destroy(publicId, {
          resource_type: 'auto',
        });
        
        if (result.result === 'ok') {
          logger.info('File deleted from Cloudinary', { key: publicId });
          return { success: true, storage: 'cloudinary' };
        } else {
          logger.warn('File not found in Cloudinary', { key: publicId });
          return { success: true, message: 'File not found' };
        }
      } catch (err) {
        logger.error('Cloudinary deletion error', { error: err.message, key });
        throw err;
      }
    } else if (useCloudStorage && storageProvider === 's3' && s3Client) {
      const fileName = path.basename(key);
      const folder = path.dirname(key).replace(/^\/+/, '');
      const s3Key = folder ? `${folder}/${fileName}` : fileName;

      // Check if file exists first
      try {
        await s3Client.send(new HeadObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key,
        }));
      } catch (err) {
        if (err.name === 'NotFound') {
          logger.warn('File not found in S3', { key: s3Key });
          return { success: true, message: 'File not found' };
        }
        throw err;
      }

      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
      });

      await s3Client.send(command);
      logger.info('File deleted from S3', { key: s3Key });

      return { success: true, storage: 's3' };
    } else {
      // Delete from local storage
      const uploadsDir = path.join(__dirname, '../../uploads');
      const filePath = path.join(uploadsDir, key);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info('File deleted from local storage', { path: filePath });
        return { success: true, storage: 'local' };
      } else {
        logger.warn('File not found in local storage', { path: filePath });
        return { success: true, message: 'File not found' };
      }
    }
  } catch (error) {
    logger.error('File deletion error', { error: error.message, key });
    captureException(error, {
      tags: { operation: 'file_delete' },
      extra: { key },
    });
    throw error;
  }
}

/**
 * Get signed URL for private file access (S3 only)
 */
async function getSignedUrlForFile(key, expiresIn = 3600) {
  try {
    if (useCloudStorage && s3Client) {
      const fileName = path.basename(key);
      const folder = path.dirname(key).replace(/^\/+/, '');
      const s3Key = folder ? `${folder}/${fileName}` : fileName;

      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
      });

      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
      return signedUrl;
    } else {
      // Return local URL for local storage
      return `/uploads/${key}`;
    }
  } catch (error) {
    logger.error('Signed URL generation error', { error: error.message, key });
    captureException(error, {
      tags: { operation: 'signed_url' },
      extra: { key },
    });
    throw error;
  }
}

/**
 * Check if file exists
 */
async function fileExists(key) {
  try {
    if (useCloudStorage && storageProvider === 'cloudinary' && cloudinary) {
      // Check if file exists in Cloudinary
      try {
        const publicId = key.includes('/') ? key : `uploads/${key}`;
        const result = await cloudinary.api.resource(publicId, {
          resource_type: 'auto',
        });
        return !!result;
      } catch (err) {
        if (err.http_code === 404) {
          return false;
        }
        throw err;
      }
    } else if (useCloudStorage && storageProvider === 's3' && s3Client) {
      const fileName = path.basename(key);
      const folder = path.dirname(key).replace(/^\/+/, '');
      const s3Key = folder ? `${folder}/${fileName}` : fileName;

      try {
        await s3Client.send(new HeadObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key,
        }));
        return true;
      } catch (err) {
        if (err.name === 'NotFound') {
          return false;
        }
        throw err;
      }
    } else {
      const uploadsDir = path.join(__dirname, '../../uploads');
      const filePath = path.join(uploadsDir, key);
      return fs.existsSync(filePath);
    }
  } catch (error) {
    logger.error('File existence check error', { error: error.message, key });
    return false;
  }
}

/**
 * Get file URL (public or signed)
 */
function getFileUrl(key, useSignedUrl = false) {
  if (useCloudStorage && storageProvider === 'cloudinary' && cloudinary) {
    // Cloudinary URLs are already public and optimized
    const publicId = key.includes('/') ? key : `uploads/${key}`;
    return cloudinary.url(publicId, {
      secure: true,
      resource_type: 'auto',
    });
  } else if (useCloudStorage && storageProvider === 's3') {
    if (CDN_URL) {
      const fileName = path.basename(key);
      const folder = path.dirname(key).replace(/^\/+/, '');
      const s3Key = folder ? `${folder}/${fileName}` : fileName;
      return `${CDN_URL}/${s3Key}`;
    } else {
      const fileName = path.basename(key);
      const folder = path.dirname(key).replace(/^\/+/, '');
      const s3Key = folder ? `${folder}/${fileName}` : fileName;
      return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;
    }
  } else {
    return `/uploads/${key}`;
  }
}

module.exports = {
  uploadFile,
  uploadBuffer,
  deleteFile,
  getSignedUrlForFile,
  fileExists,
  getFileUrl,
  isCloudStorageEnabled: () => useCloudStorage,
};






