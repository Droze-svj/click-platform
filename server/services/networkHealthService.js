const logger = require('../utils/logger');
const User = require('../models/User');
const linkedinOAuth = require('./linkedinOAuthService');
const facebookOAuth = require('./facebookOAuthService');
const googleOAuth = require('./googleOAuthService');
const tiktokOAuth = require('./tiktokOAuthService');

/**
 * NetworkHealthService
 * Audits the global Sovereign distribution network for OAuth integrity and platform quotas.
 */
class NetworkHealthService {
  /**
   * Audit all connected social accounts for a specific user
   */
  async auditAllSocialConnections(userId) {
    logger.info('Live-Wire: Auditing Global Network Health...', { userId });
    
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const platforms = ['linkedin', 'facebook', 'instagram', 'youtube', 'tiktok', 'twitter'];
    const auditResults = {};

    for (const platform of platforms) {
      auditResults[platform] = await this.auditPlatformHealth(userId, platform, user.oauth?.[platform]);
    }

    return {
      timestamp: new Date(),
      status: this.calculateOverallHealth(auditResults),
      platforms: auditResults,
      quotas: await this.getSimulatedQuotas(userId)
    };
  }

  /**
   * Check health of a specific platform connection
   */
  async auditPlatformHealth(userId, platform, oauthData) {
    if (!oauthData || !oauthData.connected) {
      return { status: 'disconnected', message: 'No active bridge detected.' };
    }

    const now = new Date();
    const expiresAt = oauthData.expiresAt ? new Date(oauthData.expiresAt) : null;

    // 1. Check if expired
    if (expiresAt && now >= expiresAt) {
      return { status: 'expired', message: 'Bridge authorization has lapsed.' };
    }

    // 2. Check if expiring soon (within 24 hours)
    if (expiresAt && (expiresAt - now) < 24 * 60 * 60 * 1000) {
      return { status: 'warning', message: 'Bridge stability degrading (expiring soon).' };
    }

    // 3. Platform-specific deep-check (Live API call)
    try {
      if (platform === 'linkedin' && linkedinOAuth.isConfigured()) {
        await linkedinOAuth.getLinkedInUserInfo(oauthData.accessToken);
      }
      // Add more real-time checks as needed
    } catch (err) {
      logger.warn(`Bridge heartbeat failed for ${platform}`, { error: err.message });
      return { status: 'error', message: 'Heartbeat failed. API rejection.' };
    }

    return { status: 'healthy', message: 'Bridge is operational and locked.' };
  }

  /**
   * Calculates overall status based on platform nodes
   */
  calculateOverallHealth(auditResults) {
    const statuses = Object.values(auditResults).map(r => r.status);
    if (statuses.includes('error')) return 'degraded';
    if (statuses.includes('expired')) return 'critical';
    if (statuses.includes('healthy')) return 'operational';
    return 'inactive';
  }

  /**
   * Simulated Quotas (Transitioning to live API analytics in Phase 25)
   */
  async getSimulatedQuotas(userId) {
    return [
        { platform: 'youtube', limit: 10, used: 2, label: 'Daily Uploads' },
        { platform: 'linkedin', limit: 5, used: 1, label: 'UGC Shares' },
        { platform: 'facebook', limit: 25, used: 0, label: 'Page Posts' }
    ];
  }
}

module.exports = new NetworkHealthService();
