const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');

// Initialize S3 Client
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload Buffer or Stream to Cloud Architecture
 */
async function uploadToProduction(file, folder = 'raw-clips') {
    try {
        const fileName = `${folder}/${Date.now()}-${file.originalname}`;

        // Industrial S3 Upload
        const command = new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: fileName,
            Body: file.buffer,
            ContentType: file.mimetype
        });

        await s3Client.send(command);
        logger.info('Asset uploaded to industrial cloud storage', { fileName });

        return {
            success: true,
            key: fileName,
            bucket: process.env.AWS_S3_BUCKET
        };
    } catch (error) {
        logger.error('Cloud upload error', { error: error.message });
        throw error;
    }
}

/**
 * Generate Secure Pre-signed URL for high-speed streaming
 */
async function getSecureAccessUrl(key) {
    try {
        const command = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: key
        });

        // URL valid for 1 hour for professional workflows
        return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    } catch (error) {
        logger.error('Signed URL generation error', { error: error.message });
        throw error;
    }
}

module.exports = {
    uploadToProduction,
    getSecureAccessUrl
};
