const logger = require('./logger');

/**
 * Shared storage utility for OAuth tokens.
 * Handles both Supabase (primary) and Mongoose (fallback) storage.
 */
class OAuthStorage {
  /**
   * Get the storage provider based on environment config.
   * @returns {'supabase' | 'mongoose'}
   */
  static getProvider() {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.ENABLE_SUPABASE_AUTH === 'true') {
      return 'supabase';
    }
    return 'mongoose';
  }

  /**
   * Save OAuth tokens for a user.
   * @param {string} userId - UUID (Supabase) or ObjectId (Mongoose)
   * @param {string} platform - e.g., 'google', 'twitter', 'tiktok'
   * @param {Object} data - Token and profile data
   */
  static async saveTokens(userId, platform, data) {
    const provider = this.getProvider();
    
    if (provider === 'supabase') {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      
      // Fetch current social_links
      const { data: user } = await supabase
        .from('users')
        .select('social_links')
        .eq('id', userId)
        .single();
        
      const socialLinks = user?.social_links || {};
      const oauth = socialLinks.oauth || {};
      
      const { error } = await supabase
        .from('users')
        .update({
          social_links: {
            ...socialLinks,
            oauth: {
              ...oauth,
              [platform]: {
                ...(oauth[platform] || {}),
                ...data,
                connected: true,
                connectedAt: new Date().toISOString()
              }
            }
          }
        })
        .eq('id', userId);
        
      if (error) throw error;
    } else {
      const User = require('../models/User');
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found in Mongoose');
      
      user.oauth = user.oauth || {};
      // Map 'google' platform to 'youtube' in the Mongoose schema if needed, 
      // but let's assume the schema handles the platform names.
      const schemaPlatform = platform === 'google' ? 'youtube' : platform;
      
      user.oauth[schemaPlatform] = {
        ...(user.oauth[schemaPlatform] || {}),
        ...data,
        connected: true,
        connectedAt: new Date().toISOString()
      };
      
      await user.save();
    }
    
    logger.info(`OAuth tokens saved for ${platform}`, { userId, provider });
  }

  /**
   * Load OAuth tokens for a user.
   * @param {string} userId
   * @param {string} platform
   */
  static async loadTokens(userId, platform) {
    const provider = this.getProvider();
    
    if (provider === 'supabase') {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      
      const { data, error } = await supabase
        .from('users')
        .select('social_links')
        .eq('id', userId)
        .single();
        
      if (error) return null;
      return data?.social_links?.oauth?.[platform] || null;
    } else {
      const User = require('../models/User');
      const user = await User.findById(userId);
      if (!user) return null;
      
      const schemaPlatform = platform === 'google' ? 'youtube' : platform;
      return user.oauth?.[schemaPlatform] || null;
    }
  }

  /**
   * Clear OAuth tokens for a user (disconnect).
   * @param {string} userId
   * @param {string} platform
   */
  static async clearTokens(userId, platform) {
    const provider = this.getProvider();
    
    if (provider === 'supabase') {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      
      const { data: user } = await supabase
        .from('users')
        .select('social_links')
        .eq('id', userId)
        .single();
        
      if (!user) return;
      
      const socialLinks = user.social_links || {};
      const oauth = socialLinks.oauth || {};
      delete oauth[platform];
      
      await supabase
        .from('users')
        .update({
          social_links: {
            ...socialLinks,
            oauth
          }
        })
        .eq('id', userId);
    } else {
      const User = require('../models/User');
      const user = await User.findById(userId);
      if (!user) return;
      
      const schemaPlatform = platform === 'google' ? 'youtube' : platform;
      if (user.oauth && user.oauth[schemaPlatform]) {
        user.oauth[schemaPlatform] = { connected: false };
        await user.save();
      }
    }
    
    logger.info(`OAuth tokens cleared for ${platform}`, { userId, provider });
  }
}

module.exports = OAuthStorage;
