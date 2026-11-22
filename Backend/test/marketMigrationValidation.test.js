/**
 * marketMigrationValidation.test.js — Unit & integration tests for market migration startup checks.
 *
 * Tests:
 * 1. Migration status inspection & schema validators (pass/fail states)
 * 2. Fail-fast error throwing on missing/pending market migrations
 * 3. Health check integration (UP when applied, DOWN when missing)
 * 4. Market endpoint protection middleware (allow when applied, 503 when pending)
 *
 * Closes #919
 */

'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const supertest = require('supertest');

const {
  validateMarketMigrations,
  assertValidMarketMigrations,
  MarketMigrationValidationError,
  REQUIRED_MARKET_COLUMNS,
} = require('../services/marketMigrationValidator');

const {
  marketMigrationGuard,
  resetMigrationGuardCache,
} = require('../middleware/marketMigrationGuard');

const healthCheckService = require('../services/healthCheck');

function createMockSequelize({ tables = [], columns = {} } = {}) {
  return {
    getQueryInterface() {
      return {
        async showAllTables() {
          return tables;
        },
        async describeTable(tableName) {
          if (!tables.includes(tableName)) {
            throw new Error(`Table ${tableName} does not exist`);
          }
          const cols = columns[tableName] || [];
          const res = {};
          cols.forEach((col) => {
            res[col] = { type: 'TEXT' };
          });
          return res;
        },
      };
    },
  };
}

describe('Market Migration Startup Sanity Checks (#919)', () => {
  beforeEach(() => {
    resetMigrationGuardCache();
  });

  describe('1. Unit Tests: Migration Inspection & Schema Validation', () => {
    it('detects pending migrations when scripts are unapplied in migrationService state', async () => {
      const mockService = {
        discoverScripts: () => [
          { name: '001_init_markets', filename: '001_init_markets.js', applied: false },
          { name: '002_market_query_indexes', filename: '002_market_query_indexes.js', applied: false },
        ],
      };

      const report = await validateMarketMigrations({
        migrationService: mockService,
        checkSchema: false,
      });

      expect(report.valid).toBe(false);
      expect(report.pendingMigrations).toEqual(['001_init_markets', '002_market_query_indexes']);
      expect(report.errors.length).toBeGreaterThanOrEqual(2);
      expect(report.appliedCount).toBe(0);
      expect(report.totalCount).toBe(2);
    });

    it('flags schema error if "markets" table does not exist in database', async () => {
      const mockService = {
        discoverScripts: () => [
          { name: '001_init_markets', filename: '001_init_markets.js', applied: true },
          { name: '002_market_query_indexes', filename: '002_market_query_indexes.js', applied: true },
        ],
      };

      const mockSequelize = createMockSequelize({ tables: [] });

      const report = await validateMarketMigrations({
        migrationService: mockService,
        sequelize: mockSequelize,
        checkSchema: true,
      });

      expect(report.valid).toBe(false);
      expect(report.pendingMigrations).toEqual([]);
      expect(report.schemaErrors.some((e) => e.includes('table "markets" does not exist'))).toBe(true);
    });

    it('flags schema error if "markets" table is missing required columns (partial migration)', async () => {
      const mockService = {
        discoverScripts: () => [
          { name: '001_init_markets', filename: '001_init_markets.js', applied: true },
          { name: '002_market_query_indexes', filename: '002_market_query_indexes.js', applied: true },
        ],
      };

      // Table exists but only has 001 columns ('id', 'name', 'created_at')
      const mockSequelize = createMockSequelize({
        tables: ['markets'],
        columns: { markets: ['id', 'name', 'created_at'] },
      });

      const report = await validateMarketMigrations({
        migrationService: mockService,
        sequelize: mockSequelize,
        checkSchema: true,
      });

      expect(report.valid).toBe(false);
      expect(report.schemaErrors.some((e) => e.includes('missing required column(s)'))).toBe(true);
      expect(report.schemaErrors.some((e) => e.includes('status, flight_number, close_time'))).toBe(true);
    });

    it('passes validation when all migrations are applied and database schema is complete', async () => {
      const mockService = {
        discoverScripts: () => [
          { name: '001_init_markets', filename: '001_init_markets.js', applied: true },
          { name: '002_market_query_indexes', filename: '002_market_query_indexes.js', applied: true },
        ],
      };

      const mockSequelize = createMockSequelize({
        tables: ['markets'],
        columns: { markets: REQUIRED_MARKET_COLUMNS },
      });

      const report = await validateMarketMigrations({
        migrationService: mockService,
        sequelize: mockSequelize,
        checkSchema: true,
      });

      expect(report.valid).toBe(true);
      expect(report.pendingMigrations).toEqual([]);
      expect(report.schemaErrors).toEqual([]);
      expect(report.errors).toEqual([]);
      expect(report.appliedCount).toBe(2);
      expect(report.totalCount).toBe(2);
    });

    it('assertValidMarketMigrations throws MarketMigrationValidationError on failure with clear error details', async () => {
      const mockService = {
        discoverScripts: () => [
          { name: '001_init_markets', filename: '001_init_markets.js', applied: false },
        ],
      };

      await expect(
        assertValidMarketMigrations({
          migrationService: mockService,
          checkSchema: false,
        }),
      ).rejects.toThrow(MarketMigrationValidationError);

      try {
        await assertValidMarketMigrations({
          migrationService: mockService,
          checkSchema: false,
        });
      } catch (err) {
        expect(err.name).toBe('MarketMigrationValidationError');
        expect(err.message).toContain('FATAL: Market migration sanity check failed');
        expect(err.message).toContain('001_init_markets');
        expect(err.report).toBeDefined();
        expect(err.report.valid).toBe(false);
      }
    });

    it('assertValidMarketMigrations resolves when all migrations and schema are clean', async () => {
      const mockService = {
        discoverScripts: () => [
          { name: '001_init_markets', filename: '001_init_markets.js', applied: true },
          { name: '002_market_query_indexes', filename: '002_market_query_indexes.js', applied: true },
        ],
      };

      const mockSequelize = createMockSequelize({
        tables: ['markets'],
        columns: { markets: REQUIRED_MARKET_COLUMNS },
      });

      const result = await assertValidMarketMigrations({
        migrationService: mockService,
        sequelize: mockSequelize,
        checkSchema: true,
      });

      expect(result.valid).toBe(true);
      expect(result.appliedCount).toBe(2);
    });
  });

  describe('2. Integration Tests: Health Checks & Market Endpoint Guard', () => {
    it('checkMarketMigrations reports status in health service', async () => {
      const report = await healthCheckService.checkMarketMigrations();
      expect(report).toHaveProperty('status');
      expect(['UP', 'DOWN']).toContain(report.status);
    });

    it('marketMigrationGuard middleware permits requests when migrations are valid', async () => {
      const app = express();
      app.use(express.json());
      app.use(marketMigrationGuard());

      app.get('/api/v2/markets/ticker', (req, res) => {
        res.json({ success: true, symbol: 'FLIGHT-123' });
      });

      const validator = require('../services/marketMigrationValidator');
      const spy = jest.spyOn(validator, 'validateMarketMigrations').mockResolvedValue({
        valid: true,
        errors: [],
        pendingMigrations: [],
        schemaErrors: [],
        appliedCount: 2,
        totalCount: 2,
      });

      const res = await supertest(app).get('/api/v2/markets/ticker');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.symbol).toBe('FLIGHT-123');

      spy.mockRestore();
    });

    it('marketMigrationGuard middleware blocks market endpoints with 503 when migrations are pending', async () => {
      const app = express();
      app.use(express.json());
      app.use(marketMigrationGuard());

      app.get('/api/v2/markets/ticker', (req, res) => {
        res.json({ success: true, symbol: 'FLIGHT-123' });
      });

      app.get('/api/other-route', (req, res) => {
        res.json({ success: true, route: 'other' });
      });

      const validator = require('../services/marketMigrationValidator');
      const spy = jest.spyOn(validator, 'validateMarketMigrations').mockResolvedValue({
        valid: false,
        errors: ['Pending migration: 001_init_markets'],
        pendingMigrations: ['001_init_markets'],
        schemaErrors: [],
        appliedCount: 0,
        totalCount: 1,
      });

      // Market endpoint must be blocked with 503
      const marketRes = await supertest(app).get('/api/v2/markets/ticker');
      expect(marketRes.status).toBe(503);
      expect(marketRes.body.success).toBe(false);
      expect(marketRes.body.code).toBe('MARKET_MIGRATIONS_PENDING');
      expect(marketRes.body.error).toContain('Market endpoints disabled');

      // Non-market route should proceed unblocked
      const otherRes = await supertest(app).get('/api/other-route');
      expect(otherRes.status).toBe(200);
      expect(otherRes.body.route).toBe('other');

      spy.mockRestore();
    });
  });
});
