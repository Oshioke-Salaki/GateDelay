/**
 * WHITELIST SERVICE
 * Manages market whitelist operations and access control.
 * Handles address management, validation, updates, removals,
 * and batch operations with Redis caching.
 *
 * Dependencies: mongoose, redis (ioredis)
 */

const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────── Schema

/**
 * Whitelist entry schema.
 * Stored in MongoDB; Redis used for fast membership lookups.
 */
const WhitelistEntrySchema = new mongoose.Schema(
  {
    address: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    marketId: {
      type: String,
      required: true,
      index: true,
    },
    addedBy: {
      type: String,
      required: true,
    },
    notes: {
      type: String,
      default: null,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
    removedAt: {
      type: Date,
      default: null,
    },
    removedBy: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Compound unique index: one active entry per address+market
WhitelistEntrySchema.index({ address: 1, marketId: 1 }, { unique: true });
WhitelistEntrySchema.index({ marketId: 1, active: 1 });
WhitelistEntrySchema.index({ active: 1, expiresAt: 1 });

const WhitelistEntry =
  mongoose.models.WhitelistEntry ||
  mongoose.model('WhitelistEntry', WhitelistEntrySchema);

// ─────────────────────────────────────────────────────────────── Redis Cache

let redisClient = null;
const CACHE_TTL = 300; // 5 minutes

/**
 * Initialize Redis client (optional — service degrades gracefully without it).
 * @param {object} client - ioredis client instance
 */
function setRedisClient(client) {
  redisClient = client;
}

/**
 * Build Redis cache key for a whitelist membership check.
 * @param {string} address
 * @param {string} marketId
 * @returns {string}
 */
function cacheKey(address, marketId) {
  return `whitelist:${marketId}:${address.toLowerCase()}`;
}

/**
 * Cache a membership result.
 * @param {string} address
 * @param {string} marketId
 * @param {boolean} isMember
 */
async function cacheResult(address, marketId, isMember) {
  if (!redisClient) return;
  try {
    await redisClient.setex(
      cacheKey(address, marketId),
      CACHE_TTL,
      isMember ? '1' : '0'
    );
  } catch (err) {
    console.warn('[WHITELIST] Redis cache write failed:', err.message);
  }
}

/**
 * Get cached membership result.
 * @param {string} address
 * @param {string} marketId
 * @returns {Promise<boolean|null>} null = cache miss
 */
async function getCachedResult(address, marketId) {
  if (!redisClient) return null;
  try {
    const val = await redisClient.get(cacheKey(address, marketId));
    if (val === null) return null;
    return val === '1';
  } catch (err) {
    console.warn('[WHITELIST] Redis cache read failed:', err.message);
    return null;
  }
}

/**
 * Invalidate cache for an address+market pair.
 * @param {string} address
 * @param {string} marketId
 */
async function invalidateCache(address, marketId) {
  if (!redisClient) return;
  try {
    await redisClient.del(cacheKey(address, marketId));
  } catch (err) {
    console.warn('[WHITELIST] Redis cache invalidation failed:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────── Helpers

/**
 * Normalize an Ethereum address to lowercase.
 * @param {string} address
 * @returns {string}
 * @throws {Error} if invalid
 */
function normalizeAddress(address) {
  if (!address || typeof address !== 'string') {
    throw new Error('Address must be a non-empty string');
  }
  const trimmed = address.trim().toLowerCase();
  // Basic Ethereum address format check (0x + 40 hex chars)
  if (!/^0x[0-9a-f]{40}$/.test(trimmed)) {
    throw new Error(`Invalid Ethereum address format: "${address}"`);
  }
  return trimmed;
}

/**
 * Validate operator authorization.
 * @param {string} operatorId
 * @throws {Error}
 */
function validateOperator(operatorId) {
  if (!operatorId || typeof operatorId !== 'string' || operatorId.trim() === '') {
    throw new Error('operatorId is required');
  }
}

// ─────────────────────────────────────────────────────────────── Core Operations

/**
 * Add a single address to a market's whitelist.
 *
 * @param {object} params
 * @param {string} params.address - Ethereum address
 * @param {string} params.marketId
 * @param {string} params.operatorId - Who is adding the address
 * @param {string} [params.notes]
 * @param {Date|string} [params.expiresAt] - Optional expiry
 * @param {object} [params.metadata] - Optional extra data
 * @returns {Promise<object>}
 */
async function addAddress({ address, marketId, operatorId, notes, expiresAt, metadata }) {
  validateOperator(operatorId);

  if (!marketId || typeof marketId !== 'string') {
    throw new Error('marketId is required');
  }

  const normalizedAddress = normalizeAddress(address);

  // Upsert: if entry exists (even inactive), reactivate it
  const entry = await WhitelistEntry.findOneAndUpdate(
    { address: normalizedAddress, marketId },
    {
      $set: {
        active: true,
        addedBy: operatorId,
        notes: notes || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        metadata: metadata || {},
        addedAt: new Date(),
        removedAt: null,
        removedBy: null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await invalidateCache(normalizedAddress, marketId);

  console.log(`[WHITELIST] Added ${normalizedAddress} to market ${marketId} by ${operatorId}`);

  return {
    success: true,
    data: entry,
    message: `Address ${normalizedAddress} added to whitelist for market ${marketId}.`,
  };
}

/**
 * Remove an address from a market's whitelist (soft delete).
 *
 * @param {object} params
 * @param {string} params.address
 * @param {string} params.marketId
 * @param {string} params.operatorId
 * @param {string} [params.reason]
 * @returns {Promise<object>}
 */
async function removeAddress({ address, marketId, operatorId, reason }) {
  validateOperator(operatorId);

  const normalizedAddress = normalizeAddress(address);

  const entry = await WhitelistEntry.findOneAndUpdate(
    { address: normalizedAddress, marketId, active: true },
    {
      $set: {
        active: false,
        removedAt: new Date(),
        removedBy: operatorId,
        notes: reason || null,
      },
    },
    { new: true }
  );

  if (!entry) {
    throw new Error(
      `Address ${normalizedAddress} is not on the whitelist for market ${marketId}`
    );
  }

  await invalidateCache(normalizedAddress, marketId);

  console.log(`[WHITELIST] Removed ${normalizedAddress} from market ${marketId} by ${operatorId}`);

  return {
    success: true,
    data: entry,
    message: `Address ${normalizedAddress} removed from whitelist for market ${marketId}.`,
  };
}

/**
 * Check if an address is whitelisted for a market.
 * Uses Redis cache for fast lookups; falls back to MongoDB.
 *
 * @param {string} address
 * @param {string} marketId
 * @returns {Promise<object>}
 */
async function isWhitelisted(address, marketId) {
  const normalizedAddress = normalizeAddress(address);

  // Try cache first
  const cached = await getCachedResult(normalizedAddress, marketId);
  if (cached !== null) {
    return {
      success: true,
      data: {
        address: normalizedAddress,
        marketId,
        whitelisted: cached,
        source: 'cache',
      },
    };
  }

  // Query DB
  const entry = await WhitelistEntry.findOne({
    address: normalizedAddress,
    marketId,
    active: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  });

  const whitelisted = !!entry;
  await cacheResult(normalizedAddress, marketId, whitelisted);

  return {
    success: true,
    data: {
      address: normalizedAddress,
      marketId,
      whitelisted,
      entry: entry || null,
      source: 'db',
    },
  };
}

/**
 * Get all whitelisted addresses for a market.
 *
 * @param {object} params
 * @param {string} params.marketId
 * @param {boolean} [params.includeExpired] - Include expired entries
 * @param {number} [params.page]
 * @param {number} [params.limit]
 * @returns {Promise<object>}
 */
async function getWhitelistForMarket({ marketId, includeExpired = false, page = 1, limit = 50 }) {
  if (!marketId) throw new Error('marketId is required');

  const filter = { marketId, active: true };
  if (!includeExpired) {
    filter.$or = [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }];
  }

  const skip = (page - 1) * limit;

  const [entries, total] = await Promise.all([
    WhitelistEntry.find(filter)
      .sort({ addedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    WhitelistEntry.countDocuments(filter),
  ]);

  return {
    success: true,
    data: {
      marketId,
      entries,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Batch add multiple addresses to a market's whitelist.
 *
 * @param {object} params
 * @param {string[]} params.addresses
 * @param {string} params.marketId
 * @param {string} params.operatorId
 * @param {string} [params.notes]
 * @param {Date|string} [params.expiresAt]
 * @returns {Promise<object>}
 */
async function batchAddAddresses({ addresses, marketId, operatorId, notes, expiresAt }) {
  validateOperator(operatorId);

  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new Error('addresses must be a non-empty array');
  }
  if (addresses.length > 500) {
    throw new Error('Batch size cannot exceed 500 addresses');
  }
  if (!marketId) throw new Error('marketId is required');

  const results = { added: [], failed: [] };

  // Normalize and deduplicate
  const normalized = [];
  const seen = new Set();
  for (const addr of addresses) {
    try {
      const n = normalizeAddress(addr);
      if (!seen.has(n)) {
        seen.add(n);
        normalized.push(n);
      }
    } catch (err) {
      results.failed.push({ address: addr, error: err.message });
    }
  }

  if (normalized.length === 0) {
    return {
      success: false,
      data: results,
      message: 'No valid addresses to add.',
    };
  }

  // Bulk upsert
  const bulkOps = normalized.map((addr) => ({
    updateOne: {
      filter: { address: addr, marketId },
      update: {
        $set: {
          active: true,
          addedBy: operatorId,
          notes: notes || null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          addedAt: new Date(),
          removedAt: null,
          removedBy: null,
        },
      },
      upsert: true,
    },
  }));

  await WhitelistEntry.bulkWrite(bulkOps, { ordered: false });

  // Invalidate cache for all added addresses
  await Promise.all(
    normalized.map((addr) => invalidateCache(addr, marketId))
  );

  results.added = normalized;

  console.log(
    `[WHITELIST] Batch add: ${normalized.length} addresses to market ${marketId} by ${operatorId}`
  );

  return {
    success: true,
    data: {
      ...results,
      addedCount: results.added.length,
      failedCount: results.failed.length,
      marketId,
    },
    message: `${results.added.length} addresses added, ${results.failed.length} failed.`,
  };
}

/**
 * Batch remove multiple addresses from a market's whitelist.
 *
 * @param {object} params
 * @param {string[]} params.addresses
 * @param {string} params.marketId
 * @param {string} params.operatorId
 * @param {string} [params.reason]
 * @returns {Promise<object>}
 */
async function batchRemoveAddresses({ addresses, marketId, operatorId, reason }) {
  validateOperator(operatorId);

  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new Error('addresses must be a non-empty array');
  }
  if (addresses.length > 500) {
    throw new Error('Batch size cannot exceed 500 addresses');
  }
  if (!marketId) throw new Error('marketId is required');

  const results = { removed: [], failed: [] };
  const normalized = [];

  for (const addr of addresses) {
    try {
      normalized.push(normalizeAddress(addr));
    } catch (err) {
      results.failed.push({ address: addr, error: err.message });
    }
  }

  if (normalized.length > 0) {
    const result = await WhitelistEntry.updateMany(
      { address: { $in: normalized }, marketId, active: true },
      {
        $set: {
          active: false,
          removedAt: new Date(),
          removedBy: operatorId,
          notes: reason || null,
        },
      }
    );

    results.removed = normalized;
    results.removedCount = result.modifiedCount;

    await Promise.all(
      normalized.map((addr) => invalidateCache(addr, marketId))
    );
  }

  console.log(
    `[WHITELIST] Batch remove: ${results.removedCount || 0} addresses from market ${marketId} by ${operatorId}`
  );

  return {
    success: true,
    data: {
      ...results,
      failedCount: results.failed.length,
      marketId,
    },
    message: `${results.removedCount || 0} addresses removed, ${results.failed.length} failed.`,
  };
}

/**
 * Get whitelist statistics for a market.
 *
 * @param {string} marketId
 * @returns {Promise<object>}
 */
async function getWhitelistStats(marketId) {
  if (!marketId) throw new Error('marketId is required');

  const [activeCount, expiredCount, totalCount] = await Promise.all([
    WhitelistEntry.countDocuments({
      marketId,
      active: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    }),
    WhitelistEntry.countDocuments({
      marketId,
      active: true,
      expiresAt: { $lte: new Date() },
    }),
    WhitelistEntry.countDocuments({ marketId }),
  ]);

  return {
    success: true,
    data: {
      marketId,
      activeCount,
      expiredCount,
      totalCount,
      inactiveCount: totalCount - activeCount - expiredCount,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Expire entries whose expiresAt has passed.
 * Called by a background job.
 * @returns {Promise<number>} Number of entries expired
 */
async function expireEntries() {
  const result = await WhitelistEntry.updateMany(
    {
      active: true,
      expiresAt: { $lte: new Date() },
    },
    {
      $set: {
        active: false,
        removedAt: new Date(),
        removedBy: 'SYSTEM',
        notes: 'Expired automatically',
      },
    }
  );

  const count = result.modifiedCount || 0;
  if (count > 0) {
    console.log(`[WHITELIST] Expired ${count} whitelist entries`);
  }
  return count;
}

// ─────────────────────────────────────────────────────────────── Exports

module.exports = {
  addAddress,
  removeAddress,
  isWhitelisted,
  getWhitelistForMarket,
  batchAddAddresses,
  batchRemoveAddresses,
  getWhitelistStats,
  expireEntries,
  setRedisClient,
  WhitelistEntry,
};
