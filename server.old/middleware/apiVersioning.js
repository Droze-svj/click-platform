// API Versioning Middleware

const { sendError } = require('../utils/response');
const logger = require('../utils/logger');

// Supported API versions
const SUPPORTED_VERSIONS = ['v1', 'v2'];
const DEFAULT_VERSION = 'v1';
const DEPRECATED_VERSIONS = []; // Add versions to deprecate here

/**
 * Extract API version from request
 */
function extractVersion(req) {
  // Check URL path: /api/v1/..., /api/v2/...
  const pathMatch = req.path.match(/^\/api\/(v\d+)\//);
  if (pathMatch) {
    return pathMatch[1];
  }

  // Check header: X-API-Version
  const headerVersion = req.headers['x-api-version'];
  if (headerVersion) {
    return headerVersion;
  }

  // Check query parameter: ?version=v1
  const queryVersion = req.query.version;
  if (queryVersion) {
    return queryVersion;
  }

  return DEFAULT_VERSION;
}

/**
 * API Versioning Middleware
 */
function apiVersioning(req, res, next) {
  const version = extractVersion(req);
  req.apiVersion = version;

  // Check if version is supported
  if (!SUPPORTED_VERSIONS.includes(version)) {
    return sendError(res, `Unsupported API version: ${version}. Supported versions: ${SUPPORTED_VERSIONS.join(', ')}`, 400);
  }

  // Check if version is deprecated
  if (DEPRECATED_VERSIONS.includes(version)) {
    res.set('X-API-Deprecated', 'true');
    res.set('X-API-Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()); // 90 days from now
    logger.warn('Deprecated API version used', { version, path: req.path });
  }

  // Add version info to response headers
  res.set('X-API-Version', version);
  res.set('X-API-Supported-Versions', SUPPORTED_VERSIONS.join(', '));

  next();
}

/**
 * Route version handler
 */
function versionRoute(versions) {
  return (req, res, next) => {
    const version = req.apiVersion || DEFAULT_VERSION;
    
    if (versions[version]) {
      return versions[version](req, res, next);
    }

    // Fallback to default version
    if (versions[DEFAULT_VERSION]) {
      return versions[DEFAULT_VERSION](req, res, next);
    }

    return sendError(res, 'API version handler not found', 500);
  };
}

module.exports = {
  apiVersioning,
  versionRoute,
  SUPPORTED_VERSIONS,
  DEFAULT_VERSION,
};
