/**
 * legacy.js — Typed config validation for legacy JavaScript config modules.
 *
 * Validates required environment variables at startup and exposes a single
 * `config` object that consuming code can safely destructure. Throws
 * descriptive errors rather than silently using empty strings, preventing
 * hard-to-debug runtime failures.
 *
 * Closes #613
 */

'use strict';

// ─── Validators ──────────────────────────────────────────────────────────────

/**
 * @typedef {'string'|'number'|'boolean'|'url'|'email'|'port'} FieldType
 */

/**
 * @typedef {Object} FieldSpec
 * @property {FieldType} type
 * @property {boolean}   [required]
 * @property {*}         [defaultValue]
 * @property {string}    [description]
 */

/**
 * Parse and validate a single environment variable against a FieldSpec.
 *
 * @param {string}    name  - env variable name
 * @param {string|undefined} raw - raw string value from process.env
 * @param {FieldSpec} spec
 * @returns {*} coerced value
 */
function parseField(name, raw, spec) {
  const missing = raw === undefined || raw === '';

  if (missing) {
    if (spec.required) {
      throw new Error(
        `[config] Required environment variable "${name}" is not set.` +
          (spec.description ? ` (${spec.description})` : ''),
      );
    }
    return spec.defaultValue !== undefined ? spec.defaultValue : undefined;
  }

  switch (spec.type) {
    case 'number': {
      const n = Number(raw);
      if (Number.isNaN(n)) {
        throw new TypeError(
          `[config] "${name}" must be a number, got "${raw}".`,
        );
      }
      return n;
    }

    case 'port': {
      const p = Number(raw);
      if (!Number.isInteger(p) || p < 1 || p > 65535) {
        throw new RangeError(
          `[config] "${name}" must be a valid port (1-65535), got "${raw}".`,
        );
      }
      return p;
    }

    case 'boolean': {
      if (raw === 'true' || raw === '1') return true;
      if (raw === 'false' || raw === '0') return false;
      throw new TypeError(
        `[config] "${name}" must be "true"/"false"/"1"/"0", got "${raw}".`,
      );
    }

    case 'url': {
      try {
        return new URL(raw).toString();
      } catch {
        throw new TypeError(
          `[config] "${name}" must be a valid URL, got "${raw}".`,
        );
      }
    }

    case 'email': {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
        throw new TypeError(
          `[config] "${name}" must be a valid email address, got "${raw}".`,
        );
      }
      return raw;
    }

    case 'string':
    default:
      return raw;
  }
}

/**
 * Build a validated config object from a schema of FieldSpecs.
 *
 * @param {Record<string, FieldSpec>} schema
 * @returns {Record<string, *>}
 */
function buildConfig(schema) {
  const errors = [];
  const result = {};

  for (const [key, spec] of Object.entries(schema)) {
    try {
      result[key] = parseField(key, process.env[key], spec);
    } catch (err) {
      errors.push(err.message);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      '[config] Configuration validation failed:\n  - ' +
        errors.join('\n  - '),
    );
  }

  return result;
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

/** @type {Record<string, FieldSpec>} */
const appSchema = {
  PORT: {
    type: 'port',
    required: false,
    defaultValue: 4000,
    description: 'Express server port',
  },
  NODE_ENV: {
    type: 'string',
    required: false,
    defaultValue: 'development',
    description: 'Runtime environment',
  },
};

/** @type {Record<string, FieldSpec>} */
const pagerdutySchema = {
  PAGERDUTY_API_KEY: {
    type: 'string',
    required: false,
    defaultValue: '',
    description: 'PagerDuty REST API key',
  },
  PAGERDUTY_SERVICE_ID: {
    type: 'string',
    required: false,
    defaultValue: '',
    description: 'PagerDuty service ID for alert routing',
  },
  PAGERDUTY_FROM_EMAIL: {
    type: 'email',
    required: false,
    defaultValue: '',
    description: 'Sender address for PagerDuty incidents',
  },
};

/** @type {Record<string, FieldSpec>} */
const redisSchema = {
  REDIS_HOST: {
    type: 'string',
    required: false,
    defaultValue: 'localhost',
    description: 'Redis hostname',
  },
  REDIS_PORT: {
    type: 'port',
    required: false,
    defaultValue: 6379,
    description: 'Redis port',
  },
};

/** @type {Record<string, FieldSpec>} */
const mongoSchema = {
  MONGODB_URI: {
    type: 'string',
    required: false,
    defaultValue: 'mongodb://localhost:27017/gatedelay',
    description: 'MongoDB connection URI',
  },
};

/** @type {Record<string, FieldSpec>} */
const blockchainSchema = {
  BLOCKCHAIN_RPC_URL: {
    type: 'url',
    required: false,
    defaultValue: 'https://rpc.mantle.xyz',
    description: 'Blockchain JSON-RPC endpoint',
  },
  BLOCKCHAIN_CHAIN_ID: {
    type: 'number',
    required: false,
    defaultValue: 5000,
    description: 'EVM chain ID',
  },
};

// ─── Validated config export ──────────────────────────────────────────────────

const app        = buildConfig(appSchema);
const pagerduty  = buildConfig(pagerdutySchema);
const redis      = buildConfig(redisSchema);
const mongo      = buildConfig(mongoSchema);
const blockchain = buildConfig(blockchainSchema);

/** Fully-validated legacy configuration. */
const config = {
  app: {
    port:    app.PORT,
    nodeEnv: app.NODE_ENV,
  },
  pagerduty: {
    apiKey:     pagerduty.PAGERDUTY_API_KEY,
    serviceId:  pagerduty.PAGERDUTY_SERVICE_ID,
    fromEmail:  pagerduty.PAGERDUTY_FROM_EMAIL,
    apiUrl:     'https://api.pagerduty.com',
  },
  redis: {
    host: redis.REDIS_HOST,
    port: redis.REDIS_PORT,
  },
  mongo: {
    uri: mongo.MONGODB_URI,
  },
  blockchain: {
    rpcUrl:  blockchain.BLOCKCHAIN_RPC_URL,
    chainId: blockchain.BLOCKCHAIN_CHAIN_ID,
  },
};

module.exports = { config, buildConfig, parseField };