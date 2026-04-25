// White-Label Theme Builder Service

const { getOrSet } = require('./cacheService');
const logger = require('../utils/logger');

/**
 * Generate theme configuration
 */
function generateThemeConfig(brandConfig) {
  try {
    const {
      primaryColor = '#667eea',
      secondaryColor = '#764ba2',
      accentColor = '#f093fb',
      backgroundColor = '#ffffff',
      textColor = '#333333',
      fontFamily = 'Inter, sans-serif',
      borderRadius = '8px',
      spacing = '16px',
    } = brandConfig;

    return {
      colors: {
        primary: primaryColor,
        secondary: secondaryColor,
        accent: accentColor,
        background: backgroundColor,
        text: textColor,
        border: adjustBrightness(primaryColor, -20),
        hover: adjustBrightness(primaryColor, 10),
        active: adjustBrightness(primaryColor, -10),
      },
      typography: {
        fontFamily,
        fontSize: {
          xs: '0.75rem',
          sm: '0.875rem',
          base: '1rem',
          lg: '1.125rem',
          xl: '1.25rem',
          '2xl': '1.5rem',
          '3xl': '1.875rem',
        },
        fontWeight: {
          normal: 400,
          medium: 500,
          semibold: 600,
          bold: 700,
        },
      },
      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: spacing,
        lg: '1.5rem',
        xl: '2rem',
      },
      borderRadius: {
        sm: '4px',
        md: borderRadius,
        lg: '12px',
        full: '9999px',
      },
      shadows: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
        md: '0 4px 6px rgba(0, 0, 0, 0.1)',
        lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
      },
    };
  } catch (error) {
    logger.error('Generate theme config error', { error: error.message });
    throw error;
  }
}

/**
 * Generate CSS variables from theme
 */
function generateCSSVariables(themeConfig) {
  const css = `
    :root {
      /* Colors */
      --color-primary: ${themeConfig.colors.primary};
      --color-secondary: ${themeConfig.colors.secondary};
      --color-accent: ${themeConfig.colors.accent};
      --color-background: ${themeConfig.colors.background};
      --color-text: ${themeConfig.colors.text};
      --color-border: ${themeConfig.colors.border};
      --color-hover: ${themeConfig.colors.hover};
      --color-active: ${themeConfig.colors.active};
      
      /* Typography */
      --font-family: ${themeConfig.typography.fontFamily};
      --font-size-xs: ${themeConfig.typography.fontSize.xs};
      --font-size-sm: ${themeConfig.typography.fontSize.sm};
      --font-size-base: ${themeConfig.typography.fontSize.base};
      --font-size-lg: ${themeConfig.typography.fontSize.lg};
      --font-size-xl: ${themeConfig.typography.fontSize.xl};
      
      /* Spacing */
      --spacing-xs: ${themeConfig.spacing.xs};
      --spacing-sm: ${themeConfig.spacing.sm};
      --spacing-md: ${themeConfig.spacing.md};
      --spacing-lg: ${themeConfig.spacing.lg};
      --spacing-xl: ${themeConfig.spacing.xl};
      
      /* Border Radius */
      --radius-sm: ${themeConfig.borderRadius.sm};
      --radius-md: ${themeConfig.borderRadius.md};
      --radius-lg: ${themeConfig.borderRadius.lg};
      --radius-full: ${themeConfig.borderRadius.full};
      
      /* Shadows */
      --shadow-sm: ${themeConfig.shadows.sm};
      --shadow-md: ${themeConfig.shadows.md};
      --shadow-lg: ${themeConfig.shadows.lg};
    }
  `;

  return css;
}

/**
 * Generate Tailwind config (if using Tailwind)
 */
function generateTailwindConfig(themeConfig) {
  return {
    theme: {
      extend: {
        colors: themeConfig.colors,
        fontFamily: {
          sans: themeConfig.typography.fontFamily.split(','),
        },
        spacing: themeConfig.spacing,
        borderRadius: themeConfig.borderRadius,
        boxShadow: themeConfig.shadows,
      },
    },
  };
}

/**
 * Adjust color brightness
 */
function adjustBrightness(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

/**
 * Validate color
 */
function validateColor(color) {
  const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return hexRegex.test(color);
}

/**
 * Generate theme preview
 */
function generateThemePreview(themeConfig) {
  return {
    primaryButton: {
      backgroundColor: themeConfig.colors.primary,
      color: '#ffffff',
      borderRadius: themeConfig.borderRadius.md,
      padding: themeConfig.spacing.md,
    },
    secondaryButton: {
      backgroundColor: themeConfig.colors.secondary,
      color: '#ffffff',
      borderRadius: themeConfig.borderRadius.md,
      padding: themeConfig.spacing.md,
    },
    card: {
      backgroundColor: themeConfig.colors.background,
      borderColor: themeConfig.colors.border,
      borderRadius: themeConfig.borderRadius.lg,
      boxShadow: themeConfig.shadows.md,
    },
  };
}

module.exports = {
  generateThemeConfig,
  generateCSSVariables,
  generateTailwindConfig,
  adjustBrightness,
  validateColor,
  generateThemePreview,
};






