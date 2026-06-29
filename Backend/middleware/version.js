/**
 * VERSION MIDDLEWARE
 * API versioning middleware for backward compatibility
 * Supports header-based, URL-based, and query-based versioning
 */

/**
 * Extract API version from request
 */
function extractVersion(req, options = {}) {
  const { defaultVersion = 'v1', versionPrefix = 'v' } = options;

  // 1. Check custom header (e.g., X-API-Version: v2)
  const headerVersion = req.headers['x-api-version'] || req.headers['api-version'];
  if (headerVersion) {
    return headerVersion.startsWith(versionPrefix) ? headerVersion : `${versionPrefix}${headerVersion}`;
  }

  // 2. Check URL path (e.g., /api/v2/users)
  const pathMatch = req.path.match(/\/(v\d+)\//);
  if (pathMatch) {
    return pathMatch[1];
  }

  // 3. Check query parameter (e.g., ?version=v2)
  if (req.query.version) {
    const qv = req.query.version;
    return qv.startsWith(versionPrefix) ? qv : `${versionPrefix}${qv}`;
  }

  // 4. Check Accept header (e.g., Accept: application/vnd.api.v2+json)
  const acceptHeader = req.headers['accept'];
  if (acceptHeader) {
    const acceptMatch = acceptHeader.match(/\.v(\d+)\+/);
    if (acceptMatch) {
      return `${versionPrefix}${acceptMatch[1]}`;
    }
  }

  return defaultVersion;
}

/**
 * Version middleware factory
 */
function versionMiddleware(options = {}) {
  const config = {
    defaultVersion: options.defaultVersion || 'v1',
    supportedVersions: options.supportedVersions || ['v1', 'v2'],
    deprecatedVersions: options.deprecatedVersions || [],
    versionPrefix: options.versionPrefix || 'v',
    strict: options.strict || false, // Reject unsupported versions
    ...options,
  };

  return (req, res, next) => {
    const version = extractVersion(req, config);
    
    // Validate version
    if (!config.supportedVersions.includes(version)) {
      if (config.strict) {
        return res.status(400).json({
          success: false,
          error: 'Unsupported API version',
          code: 'UNSUPPORTED_VERSION',
          requestedVersion: version,
          supportedVersions: config.supportedVersions,
        });
      }
      // Fall back to default
      req.apiVersion = config.defaultVersion;
    } else {
      req.apiVersion = version;
    }

    // Add deprecation warning
    if (config.deprecatedVersions.includes(req.apiVersion)) {
      const deprecationInfo = config.deprecatedVersions.find(
        v => typeof v === 'object' && v.version === req.apiVersion
      ) || { version: req.apiVersion };

      res.setHeader('X-API-Deprecation', 'true');
      res.setHeader('X-API-Deprecation-Version', req.apiVersion);
      
      if (deprecationInfo.sunset) {
        res.setHeader('X-API-Sunset', deprecationInfo.sunset);
      }
      
      if (deprecationInfo.message) {
        res.setHeader('X-API-Deprecation-Message', deprecationInfo.message);
      }
    }

    // Add version header to response
    res.setHeader('X-API-Version', req.apiVersion);

    next();
  };
}

/**
 * Version routing helper
 * Routes requests to version-specific handlers
 */
function versionRoute(handlers) {
  return (req, res, next) => {
    const version = req.apiVersion || 'v1';
    const handler = handlers[version] || handlers.default;

    if (!handler) {
      return res.status(501).json({
        success: false,
        error: 'Version not implemented',
        code: 'VERSION_NOT_IMPLEMENTED',
        version,
      });
    }

    handler(req, res, next);
  };
}

/**
 * Deprecation notice helper
 */
function deprecationNotice(version, options = {}) {
  return (req, res, next) => {
    if (req.apiVersion === version) {
      const notice = {
        deprecated: true,
        version,
        message: options.message || `API version ${version} is deprecated`,
        sunset: options.sunset || null,
        migration: options.migration || null,
      };

      // Add to response
      res.locals.deprecationNotice = notice;

      // Log warning
      if (options.log !== false) {
        console.warn(`[API Deprecation] ${req.method} ${req.path} using deprecated version ${version}`);
      }
    }
    next();
  };
}

/**
 * Version compatibility checker
 * Validates if request features are supported in the requested version
 */
function checkCompatibility(feature, minVersion = 'v1') {
  return (req, res, next) => {
    const requestedVersion = req.apiVersion || 'v1';
    const requested = parseInt(requestedVersion.replace('v', ''));
    const minimum = parseInt(minVersion.replace('v', ''));

    if (requested < minimum) {
      return res.status(400).json({
        success: false,
        error: `Feature "${feature}" requires API version ${minVersion} or higher`,
        code: 'FEATURE_NOT_AVAILABLE',
        feature,
        requestedVersion,
        minimumVersion: minVersion,
      });
    }

    next();
  };
}

/**
 * Version migration helper
 * Transforms request/response data between versions
 */
function versionTransform(transformers) {
  return (req, res, next) => {
    const version = req.apiVersion || 'v1';
    const transformer = transformers[version];

    if (transformer) {
      // Transform request
      if (transformer.request) {
        req.body = transformer.request(req.body, req);
        req.query = transformer.query ? transformer.query(req.query, req) : req.query;
      }

      // Intercept response
      if (transformer.response) {
        const originalJson = res.json.bind(res);
        res.json = function(data) {
          const transformed = transformer.response(data, req, res);
          return originalJson(transformed);
        };
      }
    }

    next();
  };
}

/**
 * Generate version documentation
 */
function versionDocs(versions) {
  return (req, res) => {
    const docs = {
      currentVersion: versions.current || 'v1',
      versions: versions.supported || ['v1'],
      deprecated: versions.deprecated || [],
      endpoints: versions.endpoints || {},
      migration: versions.migration || {},
    };

    res.json({
      success: true,
      data: docs,
    });
  };
}

module.exports = {
  versionMiddleware,
  versionRoute,
  deprecationNotice,
  checkCompatibility,
  versionTransform,
  versionDocs,
  extractVersion,
};
