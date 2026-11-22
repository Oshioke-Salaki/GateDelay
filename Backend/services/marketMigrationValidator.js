/**
 * marketMigrationValidator.js — Startup sanity checks for market database migrations.
 *
 * Verifies that all required market database migrations have been applied and
 * that the database schema (e.g. `markets` table and required columns) matches
 * expected state before market endpoints accept traffic or the server binds ports.
 *
 * Requirements:
 * - Detect missing required database migrations for markets.
 * - Throw explicit descriptive errors on missing/pending migrations.
 * - Support fail-fast server startup and health check status integration.
 *
 * Closes #919
 */

'use strict';

const fs = require('fs');
const path = require('path');
let Sequelize;
try {
  Sequelize = require('sequelize').Sequelize || require('sequelize');
} catch {
  Sequelize = null;
}

const migrationService = require('./migrationService');

class MarketMigrationValidationError extends Error {
  constructor(message, report) {
    super(message);
    this.name = 'MarketMigrationValidationError';
    this.report = report;
  }
}

/**
 * Expected columns on the `markets` table after all current migrations (001, 002) have applied.
 */
const REQUIRED_MARKET_COLUMNS = [
  'id',
  'name',
  'created_at',
  'status',
  'flight_number',
  'close_time',
];

/**
 * Validates market migration status against disk scripts, migration state, and database schema.
 *
 * @param {object} [options]
 * @param {object} [options.migrationService] - custom migration service instance
 * @param {object} [options.sequelize] - custom Sequelize DB instance
 * @param {boolean} [options.checkSchema=true] - whether to query the live DB schema
 * @param {string} [options.dbPath] - SQLite DB file path
 * @returns {Promise<{ valid: boolean, errors: string[], pendingMigrations: string[], schemaErrors: string[], appliedCount: number, totalCount: number }>}
 */
async function validateMarketMigrations(options = {}) {
  const errors = [];
  const pendingMigrations = [];
  const schemaErrors = [];

  const service = options.migrationService || migrationService;
  const scripts = service.discoverScripts();
  const marketScripts = scripts.filter(
    (s) => s.name.includes('market') || s.filename.includes('market'),
  );

  if (marketScripts.length === 0) {
    errors.push('[market-migration] No market migration scripts discovered.');
    return {
      valid: false,
      errors,
      pendingMigrations,
      schemaErrors,
      appliedCount: 0,
      totalCount: 0,
    };
  }

  // 1. Verify migration state for each discovered market script
  let appliedCount = 0;
  for (const script of marketScripts) {
    if (script.applied) {
      appliedCount++;
    } else {
      pendingMigrations.push(script.name);
      errors.push(
        `[market-migration] Pending market migration not applied: "${script.name}" (${script.filename})`,
      );
    }
  }

  // 2. Query database schema integrity if enabled
  const checkSchema = options.checkSchema !== false;
  if (checkSchema) {
    let sequelize = options.sequelize || service.sequelize;
    let createdLocalDb = false;

    try {
      if (!sequelize && Sequelize) {
        const dbPath =
          options.dbPath ||
          process.env.MIGRATIONS_DB_PATH ||
          path.join(__dirname, '../data/migrations.sqlite');

        sequelize = new Sequelize({
          dialect: 'sqlite',
          storage: dbPath,
          logging: false,
        });
        await sequelize.authenticate();
        createdLocalDb = true;
      }

      if (sequelize) {
        const queryInterface = sequelize.getQueryInterface();
        const tables = await queryInterface.showAllTables();
        const hasMarketsTable = tables.includes('markets') || tables.includes('MARKETS');

        if (!hasMarketsTable) {
          const err =
            '[market-migration] Database schema check failed: table "markets" does not exist in database.';
          schemaErrors.push(err);
          if (!errors.includes(err)) errors.push(err);
        } else {
          try {
            const described = await queryInterface.describeTable('markets');
            const existingCols = new Set(Object.keys(described));
            const missingCols = REQUIRED_MARKET_COLUMNS.filter(
              (col) => !existingCols.has(col),
            );

            if (missingCols.length > 0) {
              const err = `[market-migration] Database schema check failed: table "markets" is missing required column(s): ${missingCols.join(', ')}.`;
              schemaErrors.push(err);
              if (!errors.includes(err)) errors.push(err);
            }
          } catch (descErr) {
            const err = `[market-migration] Database schema check failed: unable to describe table "markets": ${descErr.message}`;
            schemaErrors.push(err);
            if (!errors.includes(err)) errors.push(err);
          }
        }
      }
    } catch (dbErr) {
      const err = `[market-migration] Database connection/schema query failed: ${dbErr.message}`;
      schemaErrors.push(err);
      if (!errors.includes(err)) errors.push(err);
    } finally {
      if (createdLocalDb && sequelize) {
        await sequelize.close().catch(() => {});
      }
    }
  }

  const valid = errors.length === 0;

  return {
    valid,
    errors,
    pendingMigrations,
    schemaErrors,
    appliedCount,
    totalCount: marketScripts.length,
  };
}

/**
 * Asserts that all market migrations are applied and the database schema is complete.
 * Throws MarketMigrationValidationError if any migration is missing or pending.
 *
 * @param {object} [options]
 * @returns {Promise<{ valid: boolean, errors: string[], pendingMigrations: string[], schemaErrors: string[], appliedCount: number, totalCount: number }>}
 */
async function assertValidMarketMigrations(options = {}) {
  const report = await validateMarketMigrations(options);

  if (!report.valid) {
    const formattedErrors = report.errors.map((e) => `  - ${e}`).join('\n');
    const message = `[market-migration] FATAL: Market migration sanity check failed:\n${formattedErrors}\nAction Required: Apply pending market migrations before starting the server.`;
    throw new MarketMigrationValidationError(message, report);
  }

  return report;
}

module.exports = {
  REQUIRED_MARKET_COLUMNS,
  MarketMigrationValidationError,
  validateMarketMigrations,
  assertValidMarketMigrations,
};
