// QR Code Service
// Generate QR codes for branded links

const QRCode = require('qrcode');
const BrandedLink = require('../models/BrandedLink');
const logger = require('../utils/logger');

/**
 * Generate QR code for link
 */
async function generateQRCode(linkId, options = {}) {
  try {
    const {
      size = 300,
      margin = 1,
      color = '#000000',
      backgroundColor = '#FFFFFF',
      errorCorrectionLevel = 'M'
    } = options;

    const link = await BrandedLink.findById(linkId);
    if (!link) {
      throw new Error('Link not found');
    }

    const shortUrl = `https://${link.domain}/${link.shortCode}`;

    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(shortUrl, {
      width: size,
      margin: margin,
      color: {
        dark: color,
        light: backgroundColor
      },
      errorCorrectionLevel: errorCorrectionLevel.toUpperCase()
    });

    // Generate QR code as buffer (for file download)
    const qrBuffer = await QRCode.toBuffer(shortUrl, {
      width: size,
      margin: margin,
      color: {
        dark: color,
        light: backgroundColor
      },
      errorCorrectionLevel: errorCorrectionLevel.toUpperCase()
    });

    return {
      dataUrl: qrDataUrl,
      buffer: qrBuffer,
      url: shortUrl,
      size,
      format: 'png'
    };
  } catch (error) {
    logger.error('Error generating QR code', { error: error.message, linkId });
    throw error;
  }
}

/**
 * Generate QR code with logo
 */
async function generateQRCodeWithLogo(linkId, logoUrl, options = {}) {
  try {
    // This would require canvas manipulation
    // For now, return basic QR code
    return await generateQRCode(linkId, options);
  } catch (error) {
    logger.error('Error generating QR code with logo', { error: error.message, linkId });
    throw error;
  }
}

module.exports = {
  generateQRCode,
  generateQRCodeWithLogo
};


