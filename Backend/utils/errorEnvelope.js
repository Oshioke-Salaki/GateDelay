const { getRequestId } = require('./correlation');

function buildErrorEnvelope(error, options = {}) {
  const statusCode = options.statusCode || error?.statusCode || error?.status || 500;
  const code =
    options.code ||
    error?.code ||
    (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_FAILED');
  const message =
    options.message ||
    error?.message ||
    (statusCode >= 500 ? 'Internal server error' : 'Request failed');

  return {
    error: {
      code,
      message,
      details: options.details || error?.details || null,
      requestId: options.requestId || getRequestId() || null,
      timestamp: new Date().toISOString(),
    },
  };
}

function sendError(res, error, options = {}) {
  const statusCode = options.statusCode || error?.statusCode || error?.status || 500;
  return res.status(statusCode).json(buildErrorEnvelope(error, options));
}

function expressNotFoundHandler(req, res) {
  return sendError(
    res,
    { message: `Route ${req.method} ${req.originalUrl} not found` },
    {
      statusCode: 404,
      code: 'NOT_FOUND',
      requestId: req.requestId,
    },
  );
}

function expressErrorHandler(err, req, res, _next) {
  const statusCode = err?.statusCode || err?.status || 500;
  const exposeMessage = statusCode < 500;
  return sendError(res, err, {
    statusCode,
    code: err?.code,
    message: exposeMessage ? err?.message : 'Internal server error',
    requestId: req.requestId,
  });
}

function expressErrorEnvelopeMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (
      res.statusCode >= 400 &&
      body &&
      !body.error?.requestId &&
      (body.error || body.message || body.code || body.success === false)
    ) {
      const message =
        typeof body.error === 'string'
          ? body.error
          : body.message || body.error?.message || 'Request failed';
      return originalJson(
        buildErrorEnvelope(
          { message, code: body.code },
          {
            statusCode: res.statusCode,
            code: body.code,
            details: body.details || null,
            requestId: req.requestId,
          },
        ),
      );
    }

    return originalJson(body);
  };
  next();
}

module.exports = {
  buildErrorEnvelope,
  expressErrorEnvelopeMiddleware,
  expressErrorHandler,
  expressNotFoundHandler,
  sendError,
};
