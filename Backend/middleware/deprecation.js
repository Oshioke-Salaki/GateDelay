const deprecationService = require('../services/deprecationService');

const deprecationMiddleware = (options = {}) => {
  return (req, res, next) => {
    const endpoint = `${req.method} ${req.path}`;
    const status = deprecationService.getDeprecationStatus(endpoint);

    if (!status.deprecated) {
      return next();
    }

    if (status.sunset) {
      return res.status(410).json({
        error: 'Gone',
        message: `This endpoint has been sunset and is no longer available.`,
        alternative: status.alternative,
        migrationGuide: status.migrationGuide
      });
    }

    const userId = req.user?.id || req.ip;
    deprecationService.trackUsage(endpoint, userId, {
      method: req.method,
      path: req.path,
      userAgent: req.get('user-agent')
    });

    const warning = {
      'Deprecation': `This endpoint is deprecated and will be removed on ${status.sunsetDate.toISOString()}`,
      'Link': `<${status.migrationGuide}>; rel="deprecation"; type="text/html"`,
      'Sunset': status.sunsetDate.toISOString(),
      'Alternative': status.alternative
    };

    res.setHeader('Warning', `299 - "Deprecated: ${warning['Deprecation']}"`);
    res.setHeader('Deprecation', `true, sunset="${status.sunsetDate.toISOString()}"`);
    res.setHeader('Link', warning['Link']);

    res.setHeader('X-Deprecation-Warning', JSON.stringify({
      deprecated: true,
      sunsetDate: status.sunsetDate,
      alternative: status.alternative,
      daysUntilSunset: status.daysUntilSunset
    }));

    next();
  };
};

const markDeprecated = (endpoint, config) => {
  deprecationService.registerDeprecatedEndpoint(endpoint, config);
};

module.exports = {
  deprecationMiddleware,
  markDeprecated
};
