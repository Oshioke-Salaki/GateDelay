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
  const { incremental = true, sources = marketDataSources.filter(s => s.enabled).map(s => s.id) } = options;
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
  
  return { sources: sources, syncedAt: new Date(), data: finalData };
}

function getSyncStatus() {
  return Object.fromEntries(syncStatus);
}

async function queueSyncJob(options = {}) {
  return syncQueue.add(options);
}

module.exports = {
  syncMarketData,
  getSyncStatus,
  queueSyncJob,
  syncQueue
};
