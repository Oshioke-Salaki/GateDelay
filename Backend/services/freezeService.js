const mongoose = require('mongoose');
const { EventEmitter } = require('events');

/**
 * FREEZE SERVICE
 * Manages market operation freezes during disputes or admin actions.
 * Supports selective function-level freezing, permission control, duration tracking,
 * and real-time notifications via socket.io.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const FREEZE_STATUSES = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  LIFTED: 'LIFTED',
};

/** All freezable market functions */
const FREEZABLE_FUNCTIONS = {
  TRADE: 'TRADE',
  DEPOSIT: 'DEPOSIT',
  WITHDRAWAL: 'WITHDRAWAL',
  ORDER_PLACEMENT: 'ORDER_PLACEMENT',
  ORDER_CANCELLATION: 'ORDER_CANCELLATION',
  SETTLEMENT: 'SETTLEMENT',
};

/** Roles allowed to freeze/unfreeze markets */
const FREEZE_PERMISSIONS = {
  ADMIN: 'ADMIN',
  MODERATOR: 'MODERATOR',
  SYSTEM: 'SYSTEM',
};

// ─── In-Memory Store ──────────────────────────────────────────────────────────
// Keyed by marketId → array of freeze records
const freezeStore = new Map();

// Event emitter for notifications
const freezeEvents = new EventEmitter();

// Socket.io instance (injected at startup)
let _io = null;

// ─── Schema (Mongoose) ────────────────────────────────────────────────────────

const freezeRecordSchema = new mongoose.Schema({
  marketId:       { type: String, required: true, index: true },
  frozenBy:       { type: String, required: true },
  frozenByRole:   { type: String, enum: Object.values(FREEZE_PERMISSIONS), required: true },
  reason:         { type: String, required: true },
  frozenFunctions: { type: [String], default: Object.values(FREEZABLE_FUNCTIONS) },
  status:         { type: String, enum: Object.values(FREEZE_STATUSES), default: FREEZE_STATUSES.ACTIVE },
  disputeId:      { type: String, default: null },
  frozenAt:       { type: Date, default: Date.now },
  expiresAt:      { type: Date, default: null },
  liftedAt:       { type: Date, default: null },
  liftedBy:       { type: String, default: null },
  liftReason:     { type: String, default: null },
}, { timestamps: true });

const FreezeRecord = mongoose.models.FreezeRecord
  || mongoose.model('FreezeRecord', freezeRecordSchema);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validate that the caller has a permitted role.
 * @param {string} role
 */
function assertPermission(role) {
  if (!Object.values(FREEZE_PERMISSIONS).includes(role)) {
    throw new Error(`Unauthorized role: "${role}". Must be one of: ${Object.values(FREEZE_PERMISSIONS).join(', ')}`);
  }
}

/**
 * Validate that all requested functions are freezable.
 * @param {string[]} fns
 */
function assertValidFunctions(fns) {
  const valid = Object.values(FREEZABLE_FUNCTIONS);
  const invalid = fns.filter(f => !valid.includes(f));
  if (invalid.length) {
    throw new Error(`Unknown freezable functions: ${invalid.join(', ')}. Valid: ${valid.join(', ')}`);
  }
}

/**
 * Emit a socket.io event and internal EventEmitter event.
 * @param {string} event
 * @param {object} payload
 */
function emitNotification(event, payload) {
  freezeEvents.emit(event, payload);
  if (_io) {
    _io.emit(event, payload);
  }
}

/**
 * Sync the in-memory cache from a persisted record.
 * @param {object} record - Mongoose document
 */
function syncToMemory(record) {
  const marketId = record.marketId;
  if (!freezeStore.has(marketId)) {
    freezeStore.set(marketId, []);
  }
  const list = freezeStore.get(marketId);
  const idx = list.findIndex(r => r._id?.toString() === record._id?.toString());
  if (idx >= 0) {
    list[idx] = record;
  } else {
    list.push(record);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Inject the socket.io server instance for real-time notifications.
 * Call this once during app bootstrap.
 * @param {object} io - socket.io Server instance
 */
function setSocketIO(io) {
  _io = io;
}

/**
 * FREEZE MARKET
 * Freezes all or selected operations for a market.
 *
 * @param {object} params
 * @param {string} params.marketId
 * @param {string} params.frozenBy        - ID of the actor
 * @param {string} params.frozenByRole    - Role of the actor (ADMIN | MODERATOR | SYSTEM)
 * @param {string} params.reason          - Human-readable reason
 * @param {string[]} [params.functions]   - Subset of FREEZABLE_FUNCTIONS; defaults to all
 * @param {string} [params.disputeId]     - Optional linked dispute ID
 * @param {number} [params.durationMs]    - Auto-expiry in milliseconds; null = indefinite
 * @returns {Promise<object>}
 */
async function freezeMarket(params) {
  const {
    marketId,
    frozenBy,
    frozenByRole,
    reason,
    functions = Object.values(FREEZABLE_FUNCTIONS),
    disputeId = null,
    durationMs = null,
  } = params;

  if (!marketId || typeof marketId !== 'string') throw new Error('Invalid marketId');
  if (!frozenBy  || typeof frozenBy  !== 'string') throw new Error('Invalid frozenBy');
  if (!reason    || typeof reason    !== 'string') throw new Error('Invalid reason');

  assertPermission(frozenByRole);
  assertValidFunctions(functions);

  const expiresAt = durationMs ? new Date(Date.now() + durationMs) : null;

  const record = new FreezeRecord({
    marketId,
    frozenBy,
    frozenByRole,
    reason: reason.trim(),
    frozenFunctions: functions,
    status: FREEZE_STATUSES.ACTIVE,
    disputeId,
    frozenAt: new Date(),
    expiresAt,
  });

  await record.save();
  syncToMemory(record);

  const payload = {
    event: 'MARKET_FROZEN',
    marketId,
    freezeId: record._id,
    frozenFunctions: functions,
    reason: record.reason,
    expiresAt,
    timestamp: record.frozenAt,
  };

  emitNotification('market:frozen', payload);

  return { success: true, data: record, message: 'Market frozen successfully' };
}

/**
 * LIFT FREEZE
 * Removes an active freeze by its ID.
 *
 * @param {object} params
 * @param {string} params.freezeId
 * @param {string} params.liftedBy
 * @param {string} params.liftedByRole
 * @param {string} params.liftReason
 * @returns {Promise<object>}
 */
async function liftFreeze(params) {
  const { freezeId, liftedBy, liftedByRole, liftReason } = params;

  if (!freezeId)   throw new Error('Invalid freezeId');
  if (!liftedBy)   throw new Error('Invalid liftedBy');
  if (!liftReason) throw new Error('liftReason is required');

  assertPermission(liftedByRole);

  const record = await FreezeRecord.findById(freezeId);
  if (!record) throw new Error('Freeze record not found');
  if (record.status !== FREEZE_STATUSES.ACTIVE) {
    throw new Error(`Cannot lift a freeze with status "${record.status}"`);
  }

  record.status    = FREEZE_STATUSES.LIFTED;
  record.liftedAt  = new Date();
  record.liftedBy  = liftedBy;
  record.liftReason = liftReason.trim();
  await record.save();
  syncToMemory(record);

  const payload = {
    event: 'FREEZE_LIFTED',
    marketId: record.marketId,
    freezeId: record._id,
    liftedBy,
    liftReason: record.liftReason,
    timestamp: record.liftedAt,
  };

  emitNotification('market:freeze_lifted', payload);

  return { success: true, data: record, message: 'Freeze lifted successfully' };
}

/**
 * CHECK FUNCTION FROZEN
 * Returns true if a specific function is currently frozen for a market.
 * Checks in-memory cache first; falls back to DB.
 *
 * @param {string} marketId
 * @param {string} fn - One of FREEZABLE_FUNCTIONS
 * @returns {Promise<boolean>}
 */
async function isFunctionFrozen(marketId, fn) {
  assertValidFunctions([fn]);

  const now = new Date();

  // Check memory cache
  const cached = freezeStore.get(marketId) || [];
  const activeInMemory = cached.some(r =>
    r.status === FREEZE_STATUSES.ACTIVE &&
    r.frozenFunctions.includes(fn) &&
    (!r.expiresAt || r.expiresAt > now)
  );
  if (activeInMemory) return true;

  // Fallback to DB (handles restarts)
  const dbRecord = await FreezeRecord.findOne({
    marketId,
    status: FREEZE_STATUSES.ACTIVE,
    frozenFunctions: fn,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  });

  return !!dbRecord;
}

/**
 * GET ACTIVE FREEZES
 * Returns all currently active freeze records for a market.
 *
 * @param {string} marketId
 * @returns {Promise<object>}
 */
async function getActiveFreezes(marketId) {
  if (!marketId) throw new Error('Invalid marketId');

  const now = new Date();
  const records = await FreezeRecord.find({
    marketId,
    status: FREEZE_STATUSES.ACTIVE,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  }).sort({ frozenAt: -1 });

  return { success: true, data: records };
}

/**
 * GET FREEZE HISTORY
 * Returns all freeze records for a market (all statuses).
 *
 * @param {string} marketId
 * @returns {Promise<object>}
 */
async function getFreezeHistory(marketId) {
  if (!marketId) throw new Error('Invalid marketId');

  const records = await FreezeRecord.find({ marketId }).sort({ frozenAt: -1 });
  return { success: true, data: records };
}

/**
 * EXPIRE STALE FREEZES
 * Background job helper — marks expired freezes as EXPIRED.
 * Call periodically (e.g., every minute via cron).
 *
 * @returns {Promise<number>} Count of records expired
 */
async function expireStaleFreeze() {
  const now = new Date();
  const result = await FreezeRecord.updateMany(
    { status: FREEZE_STATUSES.ACTIVE, expiresAt: { $lte: now } },
    { $set: { status: FREEZE_STATUSES.EXPIRED } }
  );

  const count = result.modifiedCount || 0;
  if (count > 0) {
    emitNotification('market:freezes_expired', { count, timestamp: now });
    // Invalidate memory cache for affected markets
    freezeStore.clear();
  }

  return count;
}

module.exports = {
  setSocketIO,
  freezeMarket,
  liftFreeze,
  isFunctionFrozen,
  getActiveFreezes,
  getFreezeHistory,
  expireStaleFreeze,
  freezeEvents,
  FREEZE_STATUSES,
  FREEZABLE_FUNCTIONS,
  FREEZE_PERMISSIONS,
};
