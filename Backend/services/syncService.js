const Queue = require('bull');
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const syncQueue = new Queue('market-data-sync', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  }
});

const syncStatus = new Map();

// Resolution states for a market snapshot, tracked separately so that a market
// is never treated as resolved until the on-chain confirmation is observed (#1355).
//   'proposed'  -> resolver computed a proposed resolution (off-chain only)
//   'submitted' -> resolution tx submitted to the contract, awaiting confirmation
//   'confirmed' -> on-chain confirmation event observed
const RESOLUTION_STATES = Object.freeze({
  PROPOSED: 'proposed',
  SUBMITTED: 'submitted',
  CONFIRMED: 'confirmed'
});

// In-memory store of resolution records keyed by marketId. In production this
// would be backed by the MarketSnapshot persistence layer.
const resolutionRecords = new Map();

function getResolutionRecord(marketId) {
  return resolutionRecords.get(marketId) || null;
}

function setResolutionState(marketId, state, details = {}) {
  const existing = resolutionRecords.get(marketId) || { marketId };
  const updated = { ...existing, ...details, resolutionState: state, updatedAt: new Date() };
  resolutionRecords.set(marketId, updated);
  return updated;
}

function recordProposedResolution(marketId, details = {}) {
  return setResolutionState(marketId, RESOLUTION_STATES.PROPOSED, details);
}

function recordSubmittedResolution(marketId, txHash, details = {}) {
  return setResolutionState(marketId, RESOLUTION_STATES.SUBMITTED, { ...details, txHash });
}

// Applies an on-chain confirmation event, moving 'submitted' -> 'confirmed'.
// Returns the updated record, or null if the event is unknown/stale.
function handleResolutionConfirmation(event = {}) {
  const { marketId, txHash, confirmedAt } = event;
  if (!marketId) {
    console.warn('[SyncService] Ignoring resolution confirmation without marketId');
    return null;
  }

  const existing = resolutionRecords.get(marketId);
  if (!existing) {
    console.warn(`[SyncService] Confirmation for unknown market ${marketId}; recording as confirmed`);
  } else if (existing.resolutionState === RESOLUTION_STATES.CONFIRMED) {
    return existing;
  } else if (existing.resolutionState !== RESOLUTION_STATES.SUBMITTED) {
    console.warn(
      `[SyncService] Confirmation for market ${marketId} arrived in state ` +
      `'${existing.resolutionState}'; promoting to confirmed`
    );
  }

  return setResolutionState(marketId, RESOLUTION_STATES.CONFIRMED, {
    txHash: txHash || (existing && existing.txHash) || null,
    confirmedAt: confirmedAt ? new Date(confirmedAt) : new Date()
  });
}

// Polls the contract for resolution confirmation events and reconciles them
// into the resolution records. Returns the list of newly confirmed markets.
async function pollResolutionConfirmations(fetchEvents) {
  if (typeof fetchEvents !== 'function') {
    return [];
  }

  const events = await fetchEvents();
  const confirmed = [];

  for (const event of events || []) {
    const record = handleResolutionConfirmation(event);
    if (record && record.resolutionState === RESOLUTION_STATES.CONFIRMED) {
      confirmed.push(record);
    }
  }

  return confirmed;
}

function isMarketResolved(marketId) {
  const record = resolutionRecords.get(marketId);
  return !!record && record.resolutionState === RESOLUTION_STATES.CONFIRMED;
}

const marketDataSources = [
  { id: 'binance', name: 'Binance', enabled: true },
  { id: 'coinbase', name: 'Coinbase', enabled: true },
  { id: 'kraken', name: 'Kraken', enabled: true }
];

async function syncFromSource(sourceId, lastSyncTime) {
  console.log(`[SyncService] Syncing from source ${sourceId}...`);
  await new Promise(resolve => setTimeout(resolve, 300));
  
  return {
    sourceId,
    syncedAt: new Date(),
    data: [
      { pair: 'BTC/USDT', price: Math.random() * 70000 + 50000, volume: Math.random() * 1000 },
      { pair: 'ETH/USDT', price: Math.random() * 4000 + 2000, volume: Math.random() * 5000 }
    ]
  };
}

async function resolveConflicts(data1, data2) {
  const combined = new Map();
  
  [...data1, ...data2].forEach(item => {
    const existing = combined.get(item.pair);
    if (!existing || item.syncedAt > existing.syncedAt) {
      combined.set(item.pair, item);
    }
  });
  
  return Array.from(combined.values());
}

async function syncMarketData(options = {}) {
  const {
    incremental = true,
    sources = marketDataSources.filter(s => s.enabled).map(s => s.id),
    fetchResolutionEvents = null
  } = options;

  // Reconcile on-chain resolution confirmations before reporting any market as
  // resolved, so a market is never treated as resolved without confirmation (#1355).
  if (fetchResolutionEvents) {
    try {
      await pollResolutionConfirmations(fetchResolutionEvents);
    } catch (error) {
      console.error('[SyncService] Failed to poll resolution confirmations:', error);
    }
  }
  const lastSync = await redis.get('lastSyncTime');
  const lastSyncTime = incremental && lastSync ? new Date(lastSync) : null;
  
  const results = [];
  
  for (const sourceId of sources) {
    try {
      syncStatus.set(sourceId, { status: 'syncing', startedAt: new Date() });
      
      const data = await syncFromSource(sourceId, lastSyncTime);
      results.push(data);
      
      syncStatus.set(sourceId, { status: 'completed', completedAt: new Date(), data: data });
    } catch (error) {
      syncStatus.set(sourceId, { status: 'failed', error: error.message, failedAt: new Date() });
      console.error(`[SyncService] Failed to sync ${sourceId}:`, error);
    }
  }
  
  let finalData = [];
  if (results.length > 0) {
    finalData = results.reduce((acc, result) => resolveConflicts(acc, result.data.map(d => ({ ...d, sourceId: result.sourceId, syncedAt: result.syncedAt }))), []);
  }
  
  await redis.set('lastSyncTime', new Date().toISOString());

  // Only markets with an observed on-chain confirmation are reported as resolved.
  const resolvedMarkets = Array.from(resolutionRecords.values())
    .filter(record => record.resolutionState === RESOLUTION_STATES.CONFIRMED)
    .map(record => record.marketId);

  return { sources: sources, syncedAt: new Date(), data: finalData, resolvedMarkets };
}

function getSyncStatus() {
  return Object.fromEntries(syncStatus);
}

async function queueSyncJob(options = {}) {
  // Bounded retries: without `attempts`, Bull fails a sync job on the first
  // error and the missed market-data window is only noticed by a user (#913).
  return syncQueue.add(options, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: false,
  });
}

module.exports = {
  syncMarketData,
  getSyncStatus,
  queueSyncJob,
  syncQueue,
  RESOLUTION_STATES,
  getResolutionRecord,
  recordProposedResolution,
  recordSubmittedResolution,
  handleResolutionConfirmation,
  pollResolutionConfirmations,
  isMarketResolved
};
