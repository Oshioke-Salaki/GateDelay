const mongoose = require('mongoose');

/**
 * PERMISSION SERVICE
 * Defines permission tiers, validates trade access, handles delegation,
 * tracks changes, and provides query endpoints.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Ordered tiers — higher index = more access */
const PERMISSION_TIERS = {
  BLOCKED:    0,
  BASIC:      1,
  STANDARD:   2,
  ADVANCED:   3,
  MODERATOR:  4,
  ADMIN:      5,
};

/** Trade operations and the minimum tier required to perform them */
const OPERATION_REQUIREMENTS = {
  PLACE_ORDER:        PERMISSION_TIERS.BASIC,
  CANCEL_ORDER:       PERMISSION_TIERS.BASIC,
  MARKET_ORDER:       PERMISSION_TIERS.STANDARD,
  LIMIT_ORDER:        PERMISSION_TIERS.STANDARD,
  MARGIN_TRADE:       PERMISSION_TIERS.ADVANCED,
  BULK_ORDER:         PERMISSION_TIERS.ADVANCED,
  FREEZE_MARKET:      PERMISSION_TIERS.MODERATOR,
  RESOLVE_DISPUTE:    PERMISSION_TIERS.MODERATOR,
  ADMIN_OVERRIDE:     PERMISSION_TIERS.ADMIN,
};

// ─── Mongoose Schema ──────────────────────────────────────────────────────────

const permissionRecordSchema = new mongoose.Schema({
  userId:       { type: String, required: true, unique: true, index: true },
  tier:         { type: Number, enum: Object.values(PERMISSION_TIERS), default: PERMISSION_TIERS.BASIC },
  // Explicit per-operation overrides (grant or deny specific ops regardless of tier)
  overrides: {
    granted: { type: [String], default: [] },
    denied:  { type: [String], default: [] },
  },
  // Delegations granted TO this user by another user
  delegations: [{
    fromUserId:  { type: String, required: true },
    operations:  { type: [String], required: true },
    expiresAt:   { type: Date, default: null },
    grantedAt:   { type: Date, default: Date.now },
  }],
  // Audit log of changes
  changeLog: [{
    changedBy:   String,
    changeType:  String,   // TIER_CHANGE | OVERRIDE_GRANT | OVERRIDE_DENY | DELEGATION
    detail:      String,
    timestamp:   { type: Date, default: Date.now },
  }],
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

const PermissionRecord = mongoose.models.PermissionRecord
  || mongoose.model('PermissionRecord', permissionRecordSchema);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetch or create a permission record for a user.
 * @param {string} userId
 * @returns {Promise<object>} Mongoose document
 */
async function getOrCreateRecord(userId) {
  let record = await PermissionRecord.findOne({ userId });
  if (!record) {
    record = new PermissionRecord({ userId });
    await record.save();
  }
  return record;
}

/**
 * Validate that an operation name is known.
 * @param {string} operation
 */
function assertValidOperation(operation) {
  if (!Object.keys(OPERATION_REQUIREMENTS).includes(operation)) {
    throw new Error(
      `Unknown operation: "${operation}". Valid: ${Object.keys(OPERATION_REQUIREMENTS).join(', ')}`
    );
  }
}

/**
 * Validate that a tier value is known.
 * @param {number} tier
 */
function assertValidTier(tier) {
  if (!Object.values(PERMISSION_TIERS).includes(tier)) {
    throw new Error(
      `Invalid tier: ${tier}. Valid: ${Object.entries(PERMISSION_TIERS).map(([k,v]) => `${k}(${v})`).join(', ')}`
    );
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * VALIDATE TRADE PERMISSION
 * Returns true if the user is allowed to perform the given operation.
 * Checks: explicit deny → explicit grant → delegation → tier requirement.
 *
 * @param {string} userId
 * @param {string} operation - One of OPERATION_REQUIREMENTS keys
 * @returns {Promise<{ allowed: boolean, reason: string }>}
 */
async function validatePermission(userId, operation) {
  assertValidOperation(operation);

  const record = await getOrCreateRecord(userId);
  const now = new Date();

  // 1. Explicit deny overrides everything
  if (record.overrides.denied.includes(operation)) {
    return { allowed: false, reason: 'Operation explicitly denied for this user' };
  }

  // 2. Explicit grant
  if (record.overrides.granted.includes(operation)) {
    return { allowed: true, reason: 'Operation explicitly granted' };
  }

  // 3. Active delegation
  const hasDelegation = record.delegations.some(d =>
    d.operations.includes(operation) &&
    (!d.expiresAt || d.expiresAt > now)
  );
  if (hasDelegation) {
    return { allowed: true, reason: 'Permission granted via delegation' };
  }

  // 4. Tier check
  const required = OPERATION_REQUIREMENTS[operation];
  if (record.tier >= required) {
    return { allowed: true, reason: `Tier ${record.tier} meets requirement ${required}` };
  }

  return {
    allowed: false,
    reason: `Tier ${record.tier} insufficient. Operation "${operation}" requires tier ${required}`,
  };
}

/**
 * SET USER TIER
 * Updates a user's permission tier (admin only).
 *
 * @param {string} userId
 * @param {number} tier - One of PERMISSION_TIERS values
 * @param {string} changedBy - Admin user ID
 * @returns {Promise<object>}
 */
async function setUserTier(userId, tier, changedBy) {
  if (!userId)    throw new Error('Invalid userId');
  if (!changedBy) throw new Error('Invalid changedBy');
  assertValidTier(tier);

  const record = await getOrCreateRecord(userId);
  const oldTier = record.tier;

  record.tier = tier;
  record.updatedAt = new Date();
  record.changeLog.push({
    changedBy,
    changeType: 'TIER_CHANGE',
    detail: `Tier changed from ${oldTier} to ${tier}`,
    timestamp: new Date(),
  });

  await record.save();
  return { success: true, data: record, message: `Tier updated to ${tier}` };
}

/**
 * GRANT OPERATION OVERRIDE
 * Explicitly grants a specific operation to a user regardless of tier.
 *
 * @param {string} userId
 * @param {string} operation
 * @param {string} grantedBy
 * @returns {Promise<object>}
 */
async function grantOperationOverride(userId, operation, grantedBy) {
  assertValidOperation(operation);
  if (!grantedBy) throw new Error('Invalid grantedBy');

  const record = await getOrCreateRecord(userId);

  // Remove from denied if present
  record.overrides.denied = record.overrides.denied.filter(op => op !== operation);

  if (!record.overrides.granted.includes(operation)) {
    record.overrides.granted.push(operation);
  }

  record.updatedAt = new Date();
  record.changeLog.push({
    changedBy: grantedBy,
    changeType: 'OVERRIDE_GRANT',
    detail: `Granted override for operation: ${operation}`,
    timestamp: new Date(),
  });

  await record.save();
  return { success: true, data: record, message: `Override granted for ${operation}` };
}

/**
 * DENY OPERATION OVERRIDE
 * Explicitly denies a specific operation for a user regardless of tier.
 *
 * @param {string} userId
 * @param {string} operation
 * @param {string} deniedBy
 * @returns {Promise<object>}
 */
async function denyOperationOverride(userId, operation, deniedBy) {
  assertValidOperation(operation);
  if (!deniedBy) throw new Error('Invalid deniedBy');

  const record = await getOrCreateRecord(userId);

  // Remove from granted if present
  record.overrides.granted = record.overrides.granted.filter(op => op !== operation);

  if (!record.overrides.denied.includes(operation)) {
    record.overrides.denied.push(operation);
  }

  record.updatedAt = new Date();
  record.changeLog.push({
    changedBy: deniedBy,
    changeType: 'OVERRIDE_DENY',
    detail: `Denied override for operation: ${operation}`,
    timestamp: new Date(),
  });

  await record.save();
  return { success: true, data: record, message: `Override denied for ${operation}` };
}

/**
 * DELEGATE PERMISSION
 * Allows a user to delegate specific operations to another user.
 *
 * @param {object} params
 * @param {string} params.fromUserId   - Delegating user
 * @param {string} params.toUserId     - Receiving user
 * @param {string[]} params.operations - Operations to delegate
 * @param {number} [params.durationMs] - Expiry in ms; null = indefinite
 * @returns {Promise<object>}
 */
async function delegatePermission(params) {
  const { fromUserId, toUserId, operations, durationMs = null } = params;

  if (!fromUserId) throw new Error('Invalid fromUserId');
  if (!toUserId)   throw new Error('Invalid toUserId');
  if (!Array.isArray(operations) || !operations.length) throw new Error('operations must be a non-empty array');

  operations.forEach(assertValidOperation);

  // Verify delegating user actually has these permissions
  for (const op of operations) {
    const check = await validatePermission(fromUserId, op);
    if (!check.allowed) {
      throw new Error(`User ${fromUserId} cannot delegate "${op}": ${check.reason}`);
    }
  }

  const record = await getOrCreateRecord(toUserId);
  const expiresAt = durationMs ? new Date(Date.now() + durationMs) : null;

  record.delegations.push({ fromUserId, operations, expiresAt, grantedAt: new Date() });
  record.updatedAt = new Date();
  record.changeLog.push({
    changedBy: fromUserId,
    changeType: 'DELEGATION',
    detail: `Delegated [${operations.join(', ')}] from ${fromUserId}${expiresAt ? ` until ${expiresAt.toISOString()}` : ''}`,
    timestamp: new Date(),
  });

  await record.save();
  return { success: true, data: record, message: 'Permission delegated successfully' };
}

/**
 * GET USER PERMISSIONS
 * Returns the full permission record for a user.
 *
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function getUserPermissions(userId) {
  if (!userId) throw new Error('Invalid userId');
  const record = await getOrCreateRecord(userId);
  return { success: true, data: record };
}

/**
 * GET PERMISSION CHANGE LOG
 * Returns the audit trail for a user's permission changes.
 *
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function getPermissionChangeLog(userId) {
  if (!userId) throw new Error('Invalid userId');
  const record = await PermissionRecord.findOne({ userId }, 'userId changeLog');
  if (!record) return { success: true, data: [] };
  return { success: true, data: record.changeLog };
}

module.exports = {
  validatePermission,
  setUserTier,
  grantOperationOverride,
  denyOperationOverride,
  delegatePermission,
  getUserPermissions,
  getPermissionChangeLog,
  PERMISSION_TIERS,
  OPERATION_REQUIREMENTS,
};
