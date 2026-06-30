const winston = require('winston');
const AuditLog = require('../models/AuditLog');

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
  const logLevel = severity === 'CRITICAL' || severity === 'HIGH' ? 'warn' : 'info';
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

  const query = {};

  if (userId)       query.userId       = userId;
  if (category)     query.category     = category;
  if (action)       query.action       = new RegExp(action, 'i');
  if (status)       query.status       = status;
  if (severity)     query.severity     = severity;
  if (resourceType) query.resourceType = resourceType;
  if (resourceId)   query.resourceId   = resourceId;

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate)   query.createdAt.$lte = new Date(endDate);
  }

  if (search) {
    query.$or = [
      { description: new RegExp(search, 'i') },
      { userEmail:   new RegExp(search, 'i') },
      { action:      new RegExp(search, 'i') },
    ];
  }

  const skip  = (page - 1) * limit;
  const sort  = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [logs, total] = await Promise.all([
    AuditLog.find(query).sort(sort).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(query),
  ]);

  return {
    logs,
    total,
    page: Number(page),
    pages: Math.ceil(total / limit),
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
  return AuditLog.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
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
    if (endDate)   matchStage.createdAt.$lte = new Date(endDate);
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
            $gte: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 86400000),
          },
        },
      },
      {
        $group: {
          _id: {
            year:  { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day:   { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]),
  ]);

  const successCount = (byStatus.find((s) => s._id === 'SUCCESS') || {}).count || 0;
  const failureCount = (byStatus.find((s) => s._id === 'FAILURE') || {}).count || 0;

  return {
    summary: {
      totalEvents:    totalCount,
      successCount,
      failureCount,
      successRate:    totalCount ? ((successCount / totalCount) * 100).toFixed(2) : '0.00',
    },
    byCategory:    byCategory.map((i) => ({ category: i._id, count: i.count })),
    byStatus:      byStatus.map((i) => ({ status: i._id, count: i.count })),
    bySeverity:    bySeverity.map((i) => ({ severity: i._id, count: i.count })),
    topActions:    topActions.map((i) => ({ action: i._id, count: i.count })),
    dailyActivity: dailyActivity.map((i) => ({
      date:  `${i._id.year}-${String(i._id.month).padStart(2, '0')}-${String(i._id.day).padStart(2, '0')}`,
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
      'id', 'action', 'category', 'userId', 'userEmail',
      'resourceType', 'resourceId', 'description',
      'status', 'severity', 'ipAddress', 'createdAt',
    ];
    const escape = (v) => (v == null ? '' : `"${String(v).replace(/"/g, '""')}"`);
    const rows = logs.map((l) =>
      headers.map((h) => escape(h === 'id' ? l._id : l[h])).join(',')
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
  const cutoff = new Date(Date.now() - days * 86400000);
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

  // Logger (for external use / testing)
  logger,
};
