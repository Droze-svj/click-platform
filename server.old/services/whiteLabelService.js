// White-Label Service

const { getOrSet } = require('./cacheService');
const logger = require('../utils/logger');

// White-label configurations
const whiteLabelConfigs = new Map();

/**
 * Get white-label configuration
 */
async function getWhiteLabelConfig(domain = null) {
  try {
    // In production, fetch from database based on domain
    // For now, use environment-based config
    
    const config = {
      brandName: process.env.WHITE_LABEL_BRAND_NAME || 'Click',
      logo: process.env.WHITE_LABEL_LOGO || '/logo.png',
      favicon: process.env.WHITE_LABEL_FAVICON || '/favicon.ico',
      primaryColor: process.env.WHITE_LABEL_PRIMARY_COLOR || '#667eea',
      secondaryColor: process.env.WHITE_LABEL_SECONDARY_COLOR || '#764ba2',
      customDomain: domain,
      customCss: process.env.WHITE_LABEL_CUSTOM_CSS || '',
      footerText: process.env.WHITE_LABEL_FOOTER_TEXT || 'Powered by Click',
      hideBranding: process.env.WHITE_LABEL_HIDE_BRANDING === 'true',
      customEmailFrom: process.env.WHITE_LABEL_EMAIL_FROM || 'noreply@click.com',
      customSupportEmail: process.env.WHITE_LABEL_SUPPORT_EMAIL || 'support@click.com',
    };

    // Cache by domain
    if (domain) {
      const cacheKey = `whitelabel:${domain}`;
      return await getOrSet(cacheKey, async () => config, 3600);
    }

    return config;
  } catch (error) {
    logger.error('Get white-label config error', { error: error.message, domain });
    // Return default config on error
    return {
      brandName: 'Click',
      logo: '/logo.png',
      favicon: '/favicon.ico',
      primaryColor: '#667eea',
      secondaryColor: '#764ba2',
    };
  }
}

/**
 * Generate custom CSS
 */
function generateCustomCSS(config) {
  const css = `
    :root {
      --primary-color: ${config.primaryColor};
      --secondary-color: ${config.secondaryColor};
    }
    
    .brand-logo {
      background-image: url('${config.logo}');
    }
    
    ${config.customCss}
  `;

  return css;
}

/**
 * Get email template with branding
 */
function getBrandedEmailTemplate(template, config) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; }
        .header { background-color: ${config.primaryColor}; color: white; padding: 20px; }
        .logo { max-width: 200px; }
        .footer { background-color: #f5f5f5; padding: 20px; text-align: center; }
        ${config.customCss}
      </style>
    </head>
    <body>
      <div class="header">
        <img src="${config.logo}" alt="${config.brandName}" class="logo" />
      </div>
      <div class="content">
        ${template}
      </div>
      <div class="footer">
        ${config.footerText}
      </div>
    </body>
    </html>
  `;
}

/**
 * Update white-label configuration
 */
async function updateWhiteLabelConfig(domain, config) {
  try {
    // In production, save to database
    whiteLabelConfigs.set(domain, {
      ...config,
      updatedAt: new Date(),
    });

    logger.info('White-label config updated', { domain });
    return { success: true };
  } catch (error) {
    logger.error('Update white-label config error', {
      error: error.message,
      domain,
    });
    throw error;
  }
}

module.exports = {
  getWhiteLabelConfig,
  generateCustomCSS,
  getBrandedEmailTemplate,
  updateWhiteLabelConfig,
};






