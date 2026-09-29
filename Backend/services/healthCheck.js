/**
 * HEALTH CHECK SERVICE
 * System monitoring and component health status verification.
 * Checks Mongoose (MongoDB), Ethers (Blockchain), Redis, and system metrics.
 *
 * Dependencies: mongoose, ethers, process
 */

const mongoose = require('mongoose');
const { ethers } = require('ethers');
const Redis = require('ioredis');
const axios = require('axios');

const { validateMarketMigrations } = require('./marketMigrationValidator');

// Helper to determine component status based on check results
function getOverallStatus(components) {
  const values = Object.values(components);
  if (values.some(v => v.status === 'DOWN')) {
    // If the database or market migrations are DOWN, the system is DOWN.
    if (components.mongodb.status === 'DOWN' || components.marketMigration?.status === 'DOWN') {
      return 'DOWN';
    }
    return 'DEGRADED';
  }
  if (values.some(v => v.status === 'DEGRADED')) return 'DEGRADED';
  return 'UP';
}

/**
 * Check MongoDB connectivity using Mongoose connection state.
 */
async function checkDatabase() {
  try {
    const readyState = mongoose.connection.readyState;
    // mongoose.connection.readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    const isConnected = readyState === 1;

    return {
      status: isConnected ? 'UP' : 'DOWN',
      details: {
        readyState,
        stateName: getMongooseStateName(readyState),
      },
    };
  } catch (error) {
    return {
      status: 'DOWN',
      error: error.message,
    };
  }
}

function getMongooseStateName(state) {
  switch (state) {
    case 0: return 'disconnected';
    case 1: return 'connected';
    case 2: return 'connecting';
    case 3: return 'disconnecting';
    default: return 'unknown';
  }
}

/**
 * Check blockchain RPC provider connectivity.
 */
async function checkBlockchain() {
  const rpcUrl = process.env.RPC_URL || process.env.BLOCKCHAIN_RPC_URL || process.env.ETH_PROVIDER_URL;

  if (!rpcUrl) {
    return {
      status: 'DEGRADED',
      error: 'RPC_URL or BLOCKCHAIN_RPC_URL is not configured',
    };
  }
  
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl, null, {
      staticNetwork: true
    });
    
    // Perform a lightweight request to check connection
    const blockNumber = await Promise.race([
      provider.getBlockNumber(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('RPC request timeout after 3000ms')), 3000))
    ]);

    return {
      status: 'UP',
      details: {
        rpcUrl: rpcUrl.replace(/:[^@/]+@/, ':***@'), // obfuscate credentials
        blockNumber,
      },
    };
  } catch (error) {
    return {
      status: 'DEGRADED',
      error: `Failed to connect to blockchain RPC: ${error.message}`,
      details: {
        rpcUrl: rpcUrl.replace(/:[^@/]+@/, ':***@'),
      }
    };
  }
}

/**
 * Check Redis connectivity.
 */
async function checkRedis() {
  const redisUrl = process.env.REDIS_URL;
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = Number(process.env.REDIS_PORT || 6379);
  const client = redisUrl
    ? new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 0 })
    : new Redis({
        host: redisHost,
        port: redisPort,
        password: process.env.REDIS_PASSWORD || undefined,
        db: Number(process.env.REDIS_DB || 0),
        lazyConnect: true,
        maxRetriesPerRequest: 0,
      });
  client.on('error', () => {
    // Health reports connection failures in-band; avoid noisy ioredis event logs.
  });

  try {
    await withTimeout(client.connect(), 3000, 'Redis connect timeout after 3000ms');
    const pong = await withTimeout(client.ping(), 3000, 'Redis ping timeout after 3000ms');
    return {
      status: 'UP',
      details: {
        endpoint: redisUrl ? maskUrl(redisUrl) : `${redisHost}:${redisPort}`,
        ping: pong,
      }
    };
  } catch (error) {
    return {
      status: 'DOWN',
      error: error.message,
    };
  } finally {
    client.disconnect();
  }
}

async function checkAviationStack() {
  const apiKey = process.env.AVIATION_STACK_API_KEY;
  if (!apiKey || apiKey.startsWith('replace_with')) {
    return {
      status: 'DEGRADED',
      error: 'AVIATION_STACK_API_KEY is not configured',
    };
  }

  try {
    const response = await axios.get('http://api.aviationstack.com/v1/flights', {
      params: { access_key: apiKey, limit: 1 },
      timeout: 5000,
    });

    const providerError = response.data?.error;
    if (providerError) {
      return {
        status: 'DEGRADED',
        error: providerError.message || providerError.code || 'AviationStack returned an error',
      };
    }

    return {
      status: 'UP',
      details: {
        provider: 'aviationstack',
        records: Array.isArray(response.data?.data) ? response.data.data.length : 0,
      },
    };
  } catch (error) {
    return {
      status: 'DEGRADED',
      error: error.message,
    };
  }
}

async function checkAiProvider() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.startsWith('replace_with')) {
    return {
      status: 'DEGRADED',
      error: 'GROQ_API_KEY is not configured; AI analysis falls back to mock data',
      details: { provider: 'groq', mode: 'mock' },
    };
  }

  try {
    const response = await axios.get('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 5000,
    });

    return {
      status: 'UP',
      details: {
        provider: 'groq',
        models: Array.isArray(response.data?.data) ? response.data.data.length : undefined,
      },
    };
  } catch (error) {
    return {
      status: 'DEGRADED',
      error: error.response?.data?.error?.message || error.message,
      details: { provider: 'groq' },
    };
  }
}

/**
 * Retrieve current process and host resources metrics.
 */
function getSystemMetrics() {
  const memoryUsage = process.memoryUsage();
  return {
    status: 'UP',
    details: {
      uptime: process.uptime(),
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`,
      },
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid,
    }
  };
}

async function checkMarketMigrations() {
  try {
    const report = await validateMarketMigrations();
    if (!report.valid) {
      return {
        status: 'DOWN',
        error: `Market database migrations pending or incomplete: ${report.errors.join('; ')}`,
        details: {
          applied: report.appliedCount,
          total: report.totalCount,
          pending: report.pendingMigrations,
          schemaErrors: report.schemaErrors,
        },
      };
    }
    return {
      status: 'UP',
      details: {
        applied: report.appliedCount,
        total: report.totalCount,
      },
    };
  } catch (error) {
    return {
      status: 'DOWN',
      error: error.message,
    };
  }
}

/**
 * Generates a comprehensive report of all system dependencies and component statuses.
 *
 * @returns {Promise<object>} Consolidated health report
 */
async function generateHealthReport() {
  const [mongodb, redis, rpc, aviationStack, aiProvider, marketMigration] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkBlockchain(),
    checkAviationStack(),
    checkAiProvider(),
    checkMarketMigrations(),
  ]);

  const system = getSystemMetrics();
  const components = { mongodb, redis, rpc, aviationStack, aiProvider, marketMigration, system };
  
  const status = getOverallStatus(components);

  return {
    status,
    timestamp: new Date().toISOString(),
    components,
  };
}

module.exports = {
  checkAiProvider,
  checkAviationStack,
  checkDatabase,
  checkBlockchain,
  checkRedis,
  checkMarketMigrations,
  generateHealthReport,
};

function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), timeoutMs)),
  ]);
}

function maskUrl(url) {
  return url.replace(/:\/\/([^:@/]+):([^@/]+)@/, '://$1:***@');
}
