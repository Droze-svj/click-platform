const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

/**
 * Spatial Awareness Service
 * Uses Gemini Vision to detect faces, objects, and text in video frames
 * to optimize caption placement and avoid covering important visual elements.
 */
class SpatialService {
  constructor() {
    this.apiKey = process.env.GOOGLE_AI_API_KEY;
    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: 'You are a precise spatial awareness visual assistant specializing in coordinate modeling.'
      });
    }
  }

  /**
   * Detect objects and faces in a frame
   * @param {string} base64Image - Base64 encoded image (JPEG/PNG)
   * @returns {Promise<Array>} Array of detections with bounding boxes
   */
  async detectSpatialZones(base64Image) {
    if (!this.model) {
      logger.warn('[SpatialService] Model not initialized; returning mock zones.');
      return this.getMockDetections();
    }

    try {
      const prompt = `
        Analyze this image and identify the bounding boxes of:
        1. Human faces
        2. Important focal objects (e.g. products, main subject)
        3. On-screen text or logos
        
        Return valid JSON only with a "detections" array. 
        Each detection MUST have:
        - "label": (e.g. "face", "product", "text")
        - "x": x-coordinate of top-left corner (0-1000 normalized)
        - "y": y-coordinate of top-left corner (0-1000 normalized)
        - "w": width (0-1000 normalized)
        - "h": height (0-1000 normalized)
        - "confidence": 0-1 score
      `;

      const result = await this.model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Image,
            mimeType: 'image/jpeg'
          }
        }
      ]);

      const response = await result.response;
      const text = response.text();
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        return data.detections || [];
      }
      
      return [];
    } catch (error) {
      logger.error('[SpatialService] Detection failed', { error: error.message });
      return this.getMockDetections();
    }
  }

  getMockDetections() {
    return [
      { label: 'face', x: 400, y: 150, w: 200, h: 250, confidence: 0.98 },
      { label: 'text', x: 100, y: 800, w: 300, h: 50, confidence: 0.92 }
    ];
  }
}

module.exports = new SpatialService();
