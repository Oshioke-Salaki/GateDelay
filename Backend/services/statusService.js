/**
 * MARKET STATUS SERVICE
 * Tracks, manages, and queries market operational statuses.
 * Persists status history in MongoDB and caches hot state in Redis.
 *
 * Dependencies: mongoose, redis (ioredis)
 */

const mongoose = require('mongoose');
const { buildPaginationMeta, normalizePagination } = require('../utils/pagination');
const auditTrail = require('./auditTrail');
const { MARKET_AUDIT_ACTIONS } = auditTrail;

// ─────────────────────────────────────────────────────────────── Schemas

const MarketStatusSchema = new mongoose.Schema(
  {
    marketId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['ACTIVE', 'PAUSED', 'MAINTENANCE', 'OFFLINE'],
      default: 'ACTIVE',
    },
    uptimeSeconds: {
      type: Number,
      default: 0,
    },
    downtimeSeconds: {
      type: Number,
      default: 0,
    },
    lastStatusChange: {
      type: Date,
      default: Date.now,
    },
    updatedBy: {
      type: String,
      default: 'SYSTEM',
    },
    notes: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

const MarketStatusHistorySchema = new mongoose.Schema(
  {
    marketId: {
      type: String,
      required: true,
      index: true,
    },
    fromStatus: {
      type: String,
      required: true,
    },
    toStatus: {
      type: String,
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    changedBy: {
      type: String,
      required: true,
    },
    durationSeconds: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      default: null,
    },
  }
);

// ─────────────────────────────────────────────────────────────── Indexes

// Declared before `mongoose.model()` below, deliberately. Mongoose only builds
// a model's indexes when it initialises that model, so a `schema.index()` call
// made after compilation is picked up only if nothing has touched the model
// first — which depends on module require order. Declaring them here makes the
// indexes exist regardless of who loads this file and in what order.

/**
 * Every operator query filters on the current state and orders by how recently
 * it changed, so `status` leads and `lastStatusChange` supplies the sort —
 * otherwise each call is a collection scan followed by an in-memory sort.
 */
MarketStatusSchema.index({ status: 1, lastStatusChange: -1 });

/**
 * getStatusHistory() paginates `{ marketId, changedAt: -1 }`; without this the
 * skip/limit pair degrades to a full scan of the history collection.
 *
 * The second index backs the `toStatus` transition filter, which the
 * `fromStatus` / `toStatus` query parameters added to that endpoint rely on.
 */
MarketStatusHistorySchema.index({ marketId: 1, changedAt: -1 });
MarketStatusHistorySchema.index({ toStatus: 1, changedAt: -1 });

const MarketStatus =
  mongoose.models.MarketStatus ||
  mongoose.model('MarketStatus', MarketStatusSchema);

const MarketStatusHistory =
  mongoose.models.MarketStatusHistory ||
  mongoose.model('MarketStatusHistory', MarketStatusHistorySchema);

// ─────────────────────────────────────────────────────────────── Redis Client Integration

let redisClient = null;
const CACHE_TTL = 3600; // 1 hour

function setRedisClient(client) {
  redisClient = client;
}

function getRedisKey(marketId) {
  return `market:status:${marketId.toLowerCase()}`;
}

// ─────────────────────────────────────────────────────────────── Service Functions

/**
 * Gets the current status of a market. Resolves from Redis cache if available,
 * otherwise falls back to MongoDB.
 *
 * @param {string} marketId
 * @returns {Promise<object>} Current status details
 */
async function getMarketStatus(marketId) {
  if (!marketId) throw new Error('marketId is required');

  const cacheKey = getRedisKey(marketId);
  if (redisClient) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return {
          success: true,
          marketId,
          status: cached,
          source: 'cache',
        };
      }
    } catch (err) {
      console.warn('[STATUS SERVICE] Redis read failed:', err.message);
    }
  }

  let record = await MarketStatus.findOne({ marketId });
  if (!record) {
    // Lazy initialization for new markets
    record = await MarketStatus.create({
      marketId,
      status: 'ACTIVE',
      lastStatusChange: new Date(),
    });
  }

  // Update Redis cache
  if (redisClient) {
    try {
      await redisClient.setex(cacheKey, CACHE_TTL, record.status);
    } catch (err) {
      console.warn('[STATUS SERVICE] Redis write failed:', err.message);
    }
  }

  // Calculate current interval duration
  const now = new Date();
  const currentIntervalSeconds = Math.floor((now - record.lastStatusChange) / 1000);
  let totalUptime = record.uptimeSeconds;
  let totalDowntime = record.downtimeSeconds;

  if (record.status === 'ACTIVE') {
    totalUptime += currentIntervalSeconds;
  } else {
    totalDowntime += currentIntervalSeconds;
  }

  const totalTime = totalUptime + totalDowntime;
  const uptimeRatio = totalTime > 0 ? (totalUptime / totalTime) * 100 : 100;

  return {
    success: true,
    marketId,
    status: record.status,
    uptimeSeconds: totalUptime,
    downtimeSeconds: totalDowntime,
    uptimePercentage: parseFloat(uptimeRatio.toFixed(4)),
    lastStatusChange: record.lastStatusChange,
    source: 'db',
  };
}

/**
 * Updates the operational status of a market. Emits PubSub notifications,
 * computes accumulated uptime/downtime, and logs change history.
 *
 * @param {object} params
 * @param {string} params.marketId
 * @param {string} params.status - 'ACTIVE', 'PAUSED', 'MAINTENANCE', 'OFFLINE'
 * @param {string} params.operatorId
 * @param {string} [params.notes]
 * @returns {Promise<object>} The updated market status record
 */
async function updateMarketStatus({ marketId, status, operatorId, notes = '' }) {
  if (!marketId) throw new Error('marketId is required');
  if (!['ACTIVE', 'PAUSED', 'MAINTENANCE', 'OFFLINE'].includes(status)) {
    throw new Error('Invalid status value');
  }
  if (!operatorId) throw new Error('operatorId is required');

  const now = new Date();

  // Find or create current status record
  let record = await MarketStatus.findOne({ marketId });
  if (!record) {
    record = new MarketStatus({
      marketId,
      status: 'ACTIVE',
      lastStatusChange: now,
      uptimeSeconds: 0,
      downtimeSeconds: 0,
    });
  }

  const oldStatus = record.status;
  if (oldStatus === status) {
    return {
      success: true,
      message: `Market is already ${status}`,
      data: record,
    };
  }

  // Calculate duration of the previous status state
  const durationSeconds = Math.floor((now - record.lastStatusChange) / 1000);

  // Add accumulated time to uptime/downtime
  if (oldStatus === 'ACTIVE') {
    record.uptimeSeconds += durationSeconds;
  } else {
    record.downtimeSeconds += durationSeconds;
  }

  // Update status record
  record.status = status;
  record.lastStatusChange = now;
  record.updatedBy = operatorId;
  record.notes = notes;
  await record.save();

  // Record history log
  await MarketStatusHistory.create({
    marketId,
    fromStatus: oldStatus,
    toStatus: status,
    changedAt: now,
    changedBy: operatorId,
    durationSeconds,
    notes,
  });

  // Update Redis cache
  if (redisClient) {
    try {
      const cacheKey = getRedisKey(marketId);
      await redisClient.setex(cacheKey, CACHE_TTL, status);
      
      // Handle status change notifications via Redis Pub/Sub
      const notificationPayload = JSON.stringify({
        marketId,
        oldStatus,
        newStatus: status,
        changedAt: now,
        operatorId,
        notes,
      });
      await redisClient.publish('market:status:changes', notificationPayload);
    } catch (err) {
      console.warn('[STATUS SERVICE] Redis updates failed:', err.message);
    }
  }

  console.log(`[STATUS SERVICE] Market ${marketId} status changed from ${oldStatus} to ${status} by ${operatorId}`);

  // Durable audit entry (#914). `MarketStatusHistory` is the operational record,
  // but it is a separate collection with no actor context beyond `changedBy` and
  // is not exported anywhere, so "who took this market offline" is not otherwise
  // answerable outside this process's logs.
  await auditTrail.logMarketAction({
    action: status === 'ACTIVE' ? MARKET_AUDIT_ACTIONS.MARKET_UNPAUSED : MARKET_AUDIT_ACTIONS.MARKET_PAUSED,
    marketId,
    description: `Market status changed from ${oldStatus} to ${status} by ${operatorId}`,
    actor: operatorId,
    metadata: { fromStatus: oldStatus, toStatus: status, durationSeconds },
    changes: {
      before: { status: oldStatus },
      after: { status },
    },
  });

  return {
    success: true,
    message: `Market ${marketId} status updated to ${status}`,
    data: record,
  };
}

/**
 * Retrieves the status transition history for a market.
 *
 * `fromStatus` / `toStatus` are optional transition filters and are backed by the
 * `{ toStatus, changedAt }` index added alongside this change.
 *
 * @param {object} params
 * @param {string} params.marketId
 * @param {number} [params.limit]
 * @param {number} [params.page]
 * @param {string} [params.fromStatus]
 * @param {string} [params.toStatus]
 * @returns {Promise<object>} Paginated status history records
 */
async function getStatusHistory({ marketId, limit, page, fromStatus, toStatus }) {
  if (!marketId) throw new Error('marketId is required');

  const { page: safePage, limit: safeLimit, skip } = normalizePagination({
    page,
    limit,
    defaultLimit: 50,
    maxLimit: 100,
  });

  const query = { marketId };
  if (fromStatus) query.fromStatus = fromStatus;
  if (toStatus) query.toStatus = toStatus;

  const [history, total] = await Promise.all([
    MarketStatusHistory.find(query)
      .sort({ changedAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    MarketStatusHistory.countDocuments(query),
  ]);

  return {
    success: true,
    data: {
      marketId,
      history,
    },
    meta: buildPaginationMeta({
      total,
      count: history.length,
      page: safePage,
      limit: safeLimit,
    }),
  };
}

module.exports = {
  getMarketStatus,
  updateMarketStatus,
  getStatusHistory,
  setRedisClient,
  MarketStatus,
  MarketStatusHistory,
};
