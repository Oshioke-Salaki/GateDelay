const { AsyncLocalStorage } = require('async_hooks');
const { randomUUID } = require('crypto');

const REQUEST_ID_HEADER = 'x-request-id';
const CORRELATION_ID_HEADER = 'x-correlation-id';
const storage = new AsyncLocalStorage();

function createRequestId() {
  return randomUUID();
}

function normalizeRequestId(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 && trimmed.length <= 128 ? trimmed : null;
}

function getRequestId() {
  return storage.getStore()?.requestId;
}

function runWithRequestId(requestId, fn) {
  return storage.run({ requestId: requestId || createRequestId() }, fn);
}

function expressCorrelationMiddleware(req, res, next) {
  const requestId =
    normalizeRequestId(req.headers[REQUEST_ID_HEADER]) ||
    normalizeRequestId(req.headers[CORRELATION_ID_HEADER]) ||
    createRequestId();

  req.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  res.setHeader(CORRELATION_ID_HEADER, requestId);

  runWithRequestId(requestId, next);
}

function createJobContext(jobName, metadata = {}) {
  const requestId =
    normalizeRequestId(metadata.requestId) ||
    normalizeRequestId(metadata.correlationId) ||
    createRequestId();

  return {
    jobName,
    requestId,
    startedAt: new Date().toISOString(),
  };
}

function withJobContext(jobName, metadata, fn) {
  const context = createJobContext(jobName, metadata);
  return runWithRequestId(context.requestId, () => fn(context));
}

function log(level, message, meta = {}) {
  const requestId = meta.requestId || getRequestId();
  const entry = {
    level,
    message,
    requestId,
    timestamp: new Date().toISOString(),
    ...meta,
  };
  const writer =
    level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  writer(JSON.stringify(entry));
}

module.exports = {
  REQUEST_ID_HEADER,
  CORRELATION_ID_HEADER,
  createRequestId,
  createJobContext,
  expressCorrelationMiddleware,
  getRequestId,
  log,
  normalizeRequestId,
  runWithRequestId,
  withJobContext,
};
