const { createCanvas, loadImage } = require('canvas');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const { uploadFile } = require('./storageService');

class CommerceAssetService {
  /**
   * Generate a "Neural Glass" style QR code and Product Pill
   */
  async generateNeuralCommerceOverlay(productData) {
    const { name, price, checkoutUrl, id } = productData;
    const width = 800; // High res base
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    try {
      // 1. 🌌 Build "Neural Glass" Background (Glassmorphism)
      this.drawGlassBackground(ctx, 0, 0, width, height, 40);

      // 2. 🏁 Generate QR Code (Semi-transparent)
      const qrSize = 300;
      const qrCanvas = createCanvas(qrSize, qrSize);
      await QRCode.toCanvas(qrCanvas, checkoutUrl, {
        margin: 1,
        width: qrSize,
        color: {
          dark: '#FFFFFF', // High contrast white dots
          light: '#00000000' // Fully transparent background
        },
        errorCorrectionLevel: 'H'
      });

      // Overlay QR onto glass
      ctx.drawImage(qrCanvas, 50, 50);

      // 3. 📝 Product Info (Neural Typography)
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 48px Arial'; // Simplified font handle
      ctx.fillText(name.toUpperCase(), 380, 150);

      ctx.fillStyle = '#6366F1'; // Indigo-500
      ctx.font = '900 72px Arial italic';
      ctx.fillText(`$${price}`, 380, 240);

      ctx.fillStyle = '#94A3B8'; // Slate-400
      ctx.font = 'bold 24px Arial';
      ctx.fillText('SCAN TO JOIN', 380, 300);

      // 4. ✨ Scannability Glow
      ctx.shadowBlur = 20;
      ctx.shadowColor = 'rgba(99, 102, 241, 0.5)';
      ctx.strokeStyle = '#FFFFFF88';
      ctx.lineWidth = 2;
      ctx.strokeRect(45, 45, qrSize + 10, qrSize + 10);

      // 5. Save & Upload
      const filename = `monetization-${id}-${Date.now()}.png`;
      const tempPath = path.join(__dirname, '../../uploads/temp', filename);
      
      if (!fs.existsSync(path.dirname(tempPath))) {
        fs.mkdirSync(path.dirname(tempPath), { recursive: true });
      }

      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(tempPath, buffer);

      const uploadResult = await uploadFile(tempPath, `commerce/${filename}`, 'image/png');
      
      // Cleanup
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

      return uploadResult.url;
    } catch (error) {
      logger.error('Failed to generate neural commerce overlay', { error: error.message, productData });
      throw error;
    }
  }

  /**
   * Helper: Draw rounded glassmorphism background
   */
  drawGlassBackground(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();

    // Fill with semi-transparent white + blur-like gradient
    const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.02)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Glass Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Subtle Inner Glow
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

module.exports = new CommerceAssetService();
