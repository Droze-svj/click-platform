const helmet = require('helmet');

/**
 * Configure security headers
 */
function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Adjust for production
        scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        // media-src must be set explicitly — without it, video/audio falls back
        // to default-src ('self') and Cloudinary-hosted uploads won't play.
        // blob: covers local preview before upload; https: covers Cloudinary/CDN.
        mediaSrc: ["'self'", "blob:", "data:", "https:"],
        // connect-src must allow secure WebSockets (wss:) for socket.io realtime
        // (clip-ready, processing progress) and https: for the API/Cloudinary.
        // ws:// localhost entries keep dev working.
        connectSrc: [
          "'self'", "https:", "wss:",
          process.env.API_URL || "http://localhost:5001",
          "http://localhost:3000", "http://localhost:3001", "http://localhost:3002",
          "ws://localhost:5001", "ws://localhost:3000",
        ],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false, // Adjust based on needs
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  });
}

/**
 * Additional custom security headers
 */
function customSecurityHeaders(req, res, next) {
  // X-Content-Type-Options
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // X-Frame-Options
  res.setHeader('X-Frame-Options', 'DENY');

  // X-XSS-Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Permissions-Policy (formerly Feature-Policy)
  res.setHeader('Permissions-Policy', [
    'geolocation=()',
    'microphone=()',
    'camera=()',
    'payment=()',
    'usb=()',
  ].join(', '));

  // Strict-Transport-Security (if not already set by helmet)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // X-Permitted-Cross-Domain-Policies
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // Referrer-Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Remove server information
  res.removeHeader('X-Powered-By');

  next();
}

module.exports = {
  securityHeaders,
  customSecurityHeaders,
};
