const winston = require('winston');
const AuditLog = require('../models/AuditLog');

// ─── THREAT MODEL REVIEW (Issue #705) ───────────────────────────────────────
// Risk Level: HIGH — Audit trail is a security-critical subsystem.
// Compromised audit logs can mask attacks or be used for denial of service.
//
// Findings:
// 1. REGEX INJECTION (ReDoS) — queryAuditLogs() creates RegExp directly from
//    user-supplied `action`, `search` params without sanitization. An attacker
//    could craft a malicious regex to cause catastrophic backtracking.
//    MITIGATION: escapeRegExp() helper applied to all regex inputs.
//
// 2. NO INPUT VALIDATION ON logOperation — category, status, severity params
//    accept arbitrary strings. Invalid values would be persisted to DB and
//    could poison analytics queries.
//    MITIGATION: Allowlist validation added for category, status, severity.
//
// 3. NO RATE LIMITING ON QUERY/EXPORT — expensive aggregation queries (especially
//    getAuditAnalytics and exportAuditLogs with limit=10000) have no throttling.
//    Aligned with Backend/src/rate-limiter/ tiers: query endpoints should use
//    'standard' tier (100/min), export should use 'elevated' tier (300/min).
//    NOTE: Rate limiting must be applied at the route layer.
//
// 4. EXPORT CAP — exportAuditLogs caps at 10,000 records. This is documented
//    but should be enforced at the route layer with query param validation.
//
// 5. NO SECRETS/PRIVATE KEYS — Confirmed: no secrets, keys, or .env values
//    are present in this file.
//
// Alignment with rate-limiter policies:
// - Backend/src/rate-limiter/rate-limiter.config.ts: standard=100/min, elevated=300/min
// - Contracts/src/RateLimiter.sol: operator-protected recordOperation()
// ─────────────────────────────────────────────────────────────────────────────

// ─── Input validation constants ──────────────────────────────────────────────

const VALID_CATEGORIES = [
  'AUTH',
  'USER',
  'SYSTEM',
  'DATA',
  'SECURITY',
  'EXPORT',
];
const VALID_STATUSES = ['SUCCESS', 'FAILURE', 'WARNING'];
const VALID_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/**
 * Escape special regex characters to prevent ReDoS attacks.
 * @param {string} str - Raw user input
 * @returns {string} Safely escaped string for use in RegExp constructor
 */
function escapeRegExp(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validate and sanitize a logOperation params object.
 * Throws on invalid required fields; sanitizes optional fields.
 * @param {object} params
 * @returns {object} Validated params
 */
function validateLogParams(params) {
  const { action, category, description, status, severity } = params;

  if (!action || typeof action !== 'string' || action.trim() === '') {
    throw new Error(
      'auditTrail: action is required and must be a non-empty string',
    );
  }
  if (!category || !VALID_CATEGORIES.includes(category)) {
    throw new Error(
      `auditTrail: category must be one of: ${VALID_CATEGORIES.join(', ')}`,
    );
  }
  if (
    !description ||
    typeof description !== 'string' ||
    description.trim() === ''
  ) {
    throw new Error(
      'auditTrail: description is required and must be a non-empty string',
    );
  }
  if (status && !VALID_STATUSES.includes(status)) {
    throw new Error(
      `auditTrail: status must be one of: ${VALID_STATUSES.join(', ')}`,
    );
  }
  if (severity && !VALID_SEVERITIES.includes(severity)) {
    throw new Error(
      `auditTrail: severity must be one of: ${VALID_SEVERITIES.join(', ')}`,
    );
  }

  return params;
}

// ─── Winston logger setup ────────────────────────────────────────────────────

const { combine, timestamp, json, errors } = winston.format;

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(errors({ stack: true }), timestamp(), json()),
  defaultMeta: { service: 'audit-trail' },
  transports: [
    new winston.transports.Console({
      silent: process.env.NODE_ENV === 'test',
    }),
    new winston.transports.File({
      filename: 'logs/audit-error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/audit-combined.log',
    }),
  ],
});

// ─── Core logging function ───────────────────────────────────────────────────

/**
 * Log an auditable event to both MongoDB and Winston.
 *
 * @param {object} params
 * @param {string} params.action        - Machine-readable action name, e.g. 'USER_LOGIN'
 * @param {string} params.category      - 'AUTH' | 'USER' | 'SYSTEM' | 'DATA' | 'SECURITY' | 'EXPORT'
 * @param {string} params.description   - Human-readable description
 * @param {string} [params.userId]      - MongoDB ObjectId of the acting user
 * @param {string} [params.userEmail]
 * @param {string} [params.resourceType]
 * @param {string} [params.resourceId]
 * @param {'SUCCESS'|'FAILURE'|'WARNING'} [params.status]
 * @param {'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'} [params.severity]
 * @param {string} [params.ipAddress]
 * @param {string} [params.userAgent]
 * @param {object} [params.metadata]
 * @param {object} [params.changes]     - { before, after }
 * @param {number} [params.duration]    - Operation duration in ms
 * @returns {Promise<AuditLog>}
 */
async function logOperation(params) {
  validateLogParams(params);

  const {
    action,
    category,
    description,
    userId = null,
    userEmail = null,
    resourceType = null,
    resourceId = null,
    status = 'SUCCESS',
    severity = 'LOW',
    ipAddress = null,
    userAgent = null,
    metadata = {},
    changes = { before: null, after: null },
    duration = null,
  } = params;

  const entry = {
    action,
    category,
    description,
    userId,
    userEmail,
    resourceType,
    resourceId,
    status,
    severity,
    ipAddress,
    userAgent,
    metadata,
    changes,
    duration,
  };

  // Always write to Winston (even if DB is down)
  const logLevel =
    severity === 'CRITICAL' || severity === 'HIGH' ? 'warn' : 'info';
  logger[logLevel]('AUDIT', entry);

  // Persist to MongoDB
  const auditLog = await AuditLog.create(entry);
  return auditLog;
}

// ─── Convenience wrappers ────────────────────────────────────────────────────

const trackUserAction = (params) =>
  logOperation({ category: 'USER', severity: 'LOW', ...params });

const trackSystemOperation = (params) =>
  logOperation({ category: 'SYSTEM', severity: 'LOW', ...params });

const trackSecurityEvent = (params) =>
  logOperation({ category: 'SECURITY', severity: 'HIGH', ...params });

const trackAuthEvent = (params) =>
  logOperation({ category: 'AUTH', severity: 'MEDIUM', ...params });

const trackDataOperation = (params) =>
  logOperation({ category: 'DATA', severity: 'LOW', ...params });

// ─── Query functions ─────────────────────────────────────────────────────────

/**
 * Query audit logs with flexible filtering and pagination.
 *
 * @param {object} filters
 * @param {object} [options]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=50]
 * @param {string} [options.sortBy='createdAt']
 * @param {'asc'|'desc'} [options.sortOrder='desc']
 * @returns {Promise<{ logs: AuditLog[], total: number, page: number, pages: number }>}
 */
async function queryAuditLogs(filters = {}, options = {}) {
  const {
    userId,
    category,
    action,
    status,
    severity,
    resourceType,
    resourceId,
    startDate,
    endDate,
    search,
  } = filters;

  const {
    page = 1,
    limit = 50,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = options;

  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const safeLimit = Math.min(Math.max(1, Math.floor(Number(limit) || 50)), 200);
  const validSortFields = [
    'createdAt',
    'action',
    'category',
    'status',
    'severity',
  ];
  const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const safeSortOrder = sortOrder === 'asc' ? 1 : -1;

  const query = {};

  if (userId) query.userId = userId;
  if (category) query.category = category;
  if (action) query.action = new RegExp(escapeRegExp(action), 'i');
  if (status) query.status = status;
  if (severity) query.severity = severity;
  if (resourceType) query.resourceType = resourceType;
  if (resourceId) query.resourceId = resourceId;

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  if (search) {
    const safeSearch = escapeRegExp(search);
    query.$or = [
      { description: new RegExp(safeSearch, 'i') },
      { userEmail: new RegExp(safeSearch, 'i') },
      { action: new RegExp(safeSearch, 'i') },
    ];
  }

  const skip = (safePage - 1) * safeLimit;
  const sort = { [safeSortBy]: safeSortOrder };

  const [logs, total] = await Promise.all([
    AuditLog.find(query).sort(sort).skip(skip).limit(safeLimit).lean(),
    AuditLog.countDocuments(query),
  ]);

  return {
    logs,
    total,
    page: safePage,
    pages: Math.ceil(total / safeLimit),
  };
}

/**
 * Fetch a single audit log by ID.
 */
async function getAuditLogById(id) {
  return AuditLog.findById(id).lean();
}

/**
 * Fetch recent activity for a specific user.
 */
async function getUserActivity(userId, limit = 20) {
  return AuditLog.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();
}

// ─── Analytics ───────────────────────────────────────────────────────────────

/**
 * Return aggregate analytics for a date range.
 *
 * @param {object} [options]
 * @param {string} [options.startDate]
 * @param {string} [options.endDate]
 * @returns {Promise<object>}
 */
async function getAuditAnalytics(options = {}) {
  const { startDate, endDate } = options;

  const matchStage = {};
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }

  const [
    totalCount,
    byCategory,
    byStatus,
    bySeverity,
    topActions,
    dailyActivity,
  ] = await Promise.all([
    // Total log count
    AuditLog.countDocuments(matchStage),

    // Group by category
    AuditLog.aggregate([
      { $match: matchStage },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    // Group by status
    AuditLog.aggregate([
      { $match: matchStage },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    // Group by severity
    AuditLog.aggregate([
      { $match: matchStage },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
    ]),

    // Top 10 actions
    AuditLog.aggregate([
      { $match: matchStage },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),

    // Daily activity (last 30 days by default)
    AuditLog.aggregate([
      {
        $match: {
          ...matchStage,
          createdAt: {
            $gte: startDate
              ? new Date(startDate)
              : new Date(Date.now() - 30 * 86400000),
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]),
  ]);

  const successCount =
    (byStatus.find((s) => s._id === 'SUCCESS') || {}).count || 0;
  const failureCount =
    (byStatus.find((s) => s._id === 'FAILURE') || {}).count || 0;

  return {
    summary: {
      totalEvents: totalCount,
      successCount,
      failureCount,
      successRate: totalCount
        ? ((successCount / totalCount) * 100).toFixed(2)
        : '0.00',
    },
    byCategory: byCategory.map((i) => ({ category: i._id, count: i.count })),
    byStatus: byStatus.map((i) => ({ status: i._id, count: i.count })),
    bySeverity: bySeverity.map((i) => ({ severity: i._id, count: i.count })),
    topActions: topActions.map((i) => ({ action: i._id, count: i.count })),
    dailyActivity: dailyActivity.map((i) => ({
      date: `${i._id.year}-${String(i._id.month).padStart(2, '0')}-${String(i._id.day).padStart(2, '0')}`,
      count: i.count,
    })),
  };
}

// ─── Export ──────────────────────────────────────────────────────────────────

/**
 * Export audit logs in JSON or CSV format.
 *
 * @param {object} filters   - Same filters as queryAuditLogs
 * @param {'json'|'csv'} [format='json']
 * @returns {Promise<string>}  Serialized export string
 */
async function exportAuditLogs(filters = {}, format = 'json') {
  // Fetch all matching (cap at 10 000 for safety)
  const { logs } = await queryAuditLogs(filters, { page: 1, limit: 10000 });

  // Log the export event itself
  await logOperation({
    action: 'AUDIT_EXPORT',
    category: 'EXPORT',
    description: `Audit logs exported as ${format.toUpperCase()}`,
    status: 'SUCCESS',
    severity: 'MEDIUM',
    metadata: { format, resultCount: logs.length, filters },
  });

  if (format === 'csv') {
    const headers = [
      'id',
      'action',
      'category',
      'userId',
      'userEmail',
      'resourceType',
      'resourceId',
      'description',
      'status',
      'severity',
      'ipAddress',
      'createdAt',
    ];
    const escape = (v) =>
      v == null ? '' : `"${String(v).replace(/"/g, '""')}"`;
    const rows = logs.map((l) =>
      headers.map((h) => escape(h === 'id' ? l._id : l[h])).join(','),
    );
    return [headers.join(','), ...rows].join('\n');
  }

  return JSON.stringify(logs, null, 2);
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

/**
 * Manually purge audit logs older than `days` days.
 * (The TTL index handles this automatically; this is for on-demand use.)
 */
async function purgeOldLogs(days = 365) {
  const safeDays = Math.max(1, Math.floor(Number(days) || 365));
  const cutoff = new Date(Date.now() - safeDays * 86400000);
  const result = await AuditLog.deleteMany({ createdAt: { $lt: cutoff } });

  logger.info('AUDIT_PURGE', { deletedCount: result.deletedCount, cutoff });
  return result.deletedCount;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Core
  logOperation,

  // Convenience wrappers
  trackUserAction,
  trackSystemOperation,
  trackSecurityEvent,
  trackAuthEvent,
  trackDataOperation,

  // Query
  queryAuditLogs,
  getAuditLogById,
  getUserActivity,

  // Analytics
  getAuditAnalytics,

  // Export
  exportAuditLogs,

  // Maintenance
  purgeOldLogs,

  // Validation helpers (exported for testing)
  escapeRegExp,
  validateLogParams,
  VALID_CATEGORIES,
  VALID_STATUSES,
  VALID_SEVERITIES,

  // Logger (for external use / testing)
  logger,
};
