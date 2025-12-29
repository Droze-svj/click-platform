// Image optimization utility

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

/**
 * Optimize image
 */
async function optimizeImage(inputPath, outputPath, options = {}) {
  const {
    width = null,
    height = null,
    quality = 85,
    format = 'jpeg',
    fit = 'cover'
  } = options;

  try {
    let pipeline = sharp(inputPath);

    // Resize if dimensions provided
    if (width || height) {
      pipeline = pipeline.resize(width, height, {
        fit,
        position: 'center'
      });
    }

    // Convert format and optimize
    switch (format.toLowerCase()) {
      case 'jpeg':
      case 'jpg':
        pipeline = pipeline.jpeg({ quality, mozjpeg: true });
        break;
      case 'png':
        pipeline = pipeline.png({ quality, compressionLevel: 9 });
        break;
      case 'webp':
        pipeline = pipeline.webp({ quality });
        break;
      default:
        pipeline = pipeline.jpeg({ quality });
    }

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    await pipeline.toFile(outputPath);

    // Get file sizes
    const originalStats = fs.statSync(inputPath);
    const optimizedStats = fs.statSync(outputPath);
    const savings = ((1 - optimizedStats.size / originalStats.size) * 100).toFixed(2);

    logger.info('Image optimized', {
      input: inputPath,
      output: outputPath,
      originalSize: originalStats.size,
      optimizedSize: optimizedStats.size,
      savings: `${savings}%`
    });

    return {
      success: true,
      originalSize: originalStats.size,
      optimizedSize: optimizedStats.size,
      savings: parseFloat(savings),
      path: outputPath
    };
  } catch (error) {
    logger.error('Image optimization error', { error: error.message, inputPath });
    throw error;
  }
}

/**
 * Generate thumbnail
 */
async function generateThumbnail(inputPath, outputPath, size = 300) {
  return optimizeImage(inputPath, outputPath, {
    width: size,
    height: size,
    quality: 80,
    format: 'jpeg'
  });
}

/**
 * Optimize multiple images
 */
async function optimizeImages(inputPaths, outputDir, options = {}) {
  const results = [];

  for (const inputPath of inputPaths) {
    const filename = path.basename(inputPath, path.extname(inputPath));
    const outputPath = path.join(outputDir, `${filename}-optimized.jpg`);

    try {
      const result = await optimizeImage(inputPath, outputPath, options);
      results.push({ success: true, inputPath, ...result });
    } catch (error) {
      results.push({ success: false, inputPath, error: error.message });
    }
  }

  return results;
}

module.exports = {
  optimizeImage,
  generateThumbnail,
  optimizeImages
};







