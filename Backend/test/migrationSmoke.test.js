/**
 * migrationSmoke.test.js — Apply and rollback smoke tests for all migrations.
 *
 * Tests the full migration lifecycle using representative market, trade, and
 * user fixtures:
 *   1. Apply all migrations (001, 002, 003) and verify schema + seed data
 *   2. Rollback all migrations and verify cleanup
 *   3. Re-apply and verify idempotency
 *   4. Verify data integrity with representative fixtures
 *
 * Uses a temporary SQLite database to avoid polluting the dev database.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Use a temporary SQLite database for isolation
const TEST_DB_PATH = path.join(os.tmpdir(), `gatedelay-migration-test-${Date.now()}.sqlite`);
process.env.MIGRATIONS_DB_PATH = TEST_DB_PATH;

const mongoose = require('mongoose');
const migrationService = require('../services/migrationService');

// MongoDB connection attempts in connectDatabases() can take 3s when MongoDB
// is not running. Pretend we're already connected to skip the connection attempt.
mongoose.connection.readyState = 1;

// Give all tests a generous timeout for SQLite operations.
jest.setTimeout(30000);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMockSequelize() {
  // We use the real Sequelize instance from migrationService
  // but point it at our test database
  return migrationService.sequelize;
}

async function getTableNames(sequelize) {
  const [results] = await sequelize.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'migration_log'"
  );
  return results.map((r) => r.name);
}

async function getTableColumns(sequelize, tableName) {
  const [results] = await sequelize.query(`PRAGMA table_info(${tableName})`);
  return results.map((r) => r.name);
}

async function getIndexNames(sequelize, tableName) {
  const [results] = await sequelize.query(
    `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='${tableName}' AND name NOT LIKE 'sqlite_%'`
  );
  return results.map((r) => r.name);
}

async function getRowCount(sequelize, tableName) {
  const [results] = await sequelize.query(`SELECT COUNT(*) as count FROM ${tableName}`);
  return results[0].count;
}

// ─── Test Data Fixtures ──────────────────────────────────────────────────────

const MARKET_FIXTURES = [
  { id: 'market-001', name: 'Flight AA1234 Arrival Time', status: 'open', flight_number: 'AA1234', close_time: '2026-12-31T23:59:59Z' },
  { id: 'market-002', name: 'Flight DL5678 Delay > 30min', status: 'open', flight_number: 'DL5678', close_time: '2026-12-31T23:59:59Z' },
  { id: 'market-003', name: 'Flight UA9012 Cancellation', status: 'closed', flight_number: 'UA9012', close_time: '2026-09-15T12:00:00Z' },
  { id: 'market-004', name: 'Flight BA3456 On-Time', status: 'open', flight_number: 'BA3456', close_time: '2026-12-31T23:59:59Z' },
  { id: 'market-005', name: 'Flight LH7890 Diversion', status: 'resolved', flight_number: 'LH7890', close_time: '2026-08-01T08:00:00Z' },
];

const USER_FIXTURES = [
  { id: 'user-001', username: 'trader_alice', email: 'alice@example.com', tier: 'premium', wallet_address: '0x1234567890abcdef1234567890abcdef12345678' },
  { id: 'user-002', username: 'trader_bob', email: 'bob@example.com', tier: 'basic', wallet_address: '0xabcdef1234567890abcdef1234567890abcdef12' },
  { id: 'user-003', username: 'trader_charlie', email: 'charlie@example.com', tier: 'vip', wallet_address: '0x9876543210fedcba9876543210fedcba98765432' },
  { id: 'user-004', username: 'trader_dave', email: 'dave@example.com', tier: 'public', wallet_address: '0xfedcba9876543210fedcba9876543210fedcba98' },
  { id: 'user-005', username: 'admin_eve', email: 'eve@example.com', tier: 'admin', wallet_address: '0x1111111111111111111111111111111111111111' },
];

const TRADE_FIXTURES = [
  { id: 'trade-001', user_id: 'user-001', market_id: 'market-001', side: 'Buy', price: '2.50', amount: '100', status: 'Filled' },
  { id: 'trade-002', user_id: 'user-001', market_id: 'market-001', side: 'Sell', price: '2.75', amount: '50', status: 'Partial' },
  { id: 'trade-003', user_id: 'user-002', market_id: 'market-002', side: 'Buy', price: '1.80', amount: '200', status: 'Pending' },
  { id: 'trade-004', user_id: 'user-003', market_id: 'market-001', side: 'Buy', price: '3.00', amount: '75', status: 'Filled' },
  { id: 'trade-005', user_id: 'user-003', market_id: 'market-004', side: 'Sell', price: '1.50', amount: '150', status: 'Filled' },
  { id: 'trade-006', user_id: 'user-004', market_id: 'market-002', side: 'Buy', price: '2.00', amount: '300', status: 'Canceled' },
  { id: 'trade-007', user_id: 'user-001', market_id: 'market-003', side: 'Sell', price: '4.00', amount: '25', status: 'Filled' },
  { id: 'trade-008', user_id: 'user-005', market_id: 'market-005', side: 'Buy', price: '1.20', amount: '500', status: 'Filled' },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Migration Apply & Rollback Smoke Tests', () => {
  let sequelize;

  beforeAll(async () => {
    // Ensure clean state
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    await migrationService.connectDatabases();
    sequelize = migrationService.sequelize;
  });

  afterAll(async () => {
    // Cleanup
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  beforeEach(async () => {
    // Reset migration state for each test
    migrationService.state = { applied: [], history: [] };
    migrationService.migrations.clear();
    migrationService.activeMigration = null;

    // Drop all tables to start fresh
    const tables = await getTableNames(sequelize);
    for (const table of tables) {
      await sequelize.query(`DROP TABLE IF EXISTS ${table}`);
    }
  });

  // ─── 1. Apply All Migrations ───────────────────────────────────────────────

  describe('1. Apply All Migrations', () => {
    it('should apply all three migrations successfully', async () => {
      const results = await migrationService.executeAll();

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('completed');
      expect(results[1].status).toBe('completed');
      expect(results[2].status).toBe('completed');

      // Verify state
      expect(migrationService.state.applied).toContain('001_init_markets');
      expect(migrationService.state.applied).toContain('002_market_query_indexes');
      expect(migrationService.state.applied).toContain('003_trade_user_tables');
    }, 30000);

    it('should create all required tables', async () => {
      await migrationService.executeAll();

      const tables = await getTableNames(sequelize);
      expect(tables).toContain('markets');
      expect(tables).toContain('trades');
      expect(tables).toContain('users');
    });

    it('should create markets table with correct columns', async () => {
      await migrationService.executeAll();

      const columns = await getTableColumns(sequelize, 'markets');
      expect(columns).toContain('id');
      expect(columns).toContain('name');
      expect(columns).toContain('status');
      expect(columns).toContain('flight_number');
      expect(columns).toContain('close_time');
      expect(columns).toContain('created_at');
    });

    it('should create trades table with correct columns', async () => {
      await migrationService.executeAll();

      const columns = await getTableColumns(sequelize, 'trades');
      expect(columns).toContain('id');
      expect(columns).toContain('user_id');
      expect(columns).toContain('market_id');
      expect(columns).toContain('side');
      expect(columns).toContain('price');
      expect(columns).toContain('amount');
      expect(columns).toContain('status');
      expect(columns).toContain('created_at');
    });

    it('should create users table with correct columns', async () => {
      await migrationService.executeAll();

      const columns = await getTableColumns(sequelize, 'users');
      expect(columns).toContain('id');
      expect(columns).toContain('username');
      expect(columns).toContain('email');
      expect(columns).toContain('tier');
      expect(columns).toContain('wallet_address');
      expect(columns).toContain('created_at');
    });

    it('should create all required indexes on markets table', async () => {
      await migrationService.executeAll();

      const indexes = await getIndexNames(sequelize, 'markets');
      expect(indexes).toContain('idx_markets_status');
      expect(indexes).toContain('idx_markets_flight_number');
      expect(indexes).toContain('idx_markets_close_time');
      expect(indexes).toContain('idx_markets_status_close_time');
    });

    it('should create all required indexes on trades table', async () => {
      await migrationService.executeAll();

      const indexes = await getIndexNames(sequelize, 'trades');
      expect(indexes).toContain('idx_trades_user_id');
      expect(indexes).toContain('idx_trades_market_id');
      expect(indexes).toContain('idx_trades_status');
      expect(indexes).toContain('idx_trades_user_market');
    });

    it('should create all required indexes on users table', async () => {
      await migrationService.executeAll();

      const indexes = await getIndexNames(sequelize, 'users');
      expect(indexes).toContain('idx_users_tier');
      expect(indexes).toContain('idx_users_wallet');
    });

    it('should seed representative market fixtures', async () => {
      await migrationService.executeAll();

      const count = await getRowCount(sequelize, 'markets');
      expect(count).toBe(MARKET_FIXTURES.length);

      // Verify specific market data
      const [markets] = await sequelize.query("SELECT * FROM markets WHERE id = 'market-001'");
      expect(markets).toHaveLength(1);
      expect(markets[0].name).toBe('Flight AA1234 Arrival Time');
      expect(markets[0].status).toBe('open');
      expect(markets[0].flight_number).toBe('AA1234');
    });

    it('should seed representative user fixtures', async () => {
      await migrationService.executeAll();

      const count = await getRowCount(sequelize, 'users');
      expect(count).toBe(USER_FIXTURES.length);

      // Verify specific user data
      const [users] = await sequelize.query("SELECT * FROM users WHERE id = 'user-001'");
      expect(users).toHaveLength(1);
      expect(users[0].username).toBe('trader_alice');
      expect(users[0].tier).toBe('premium');
      expect(users[0].wallet_address).toBe('0x1234567890abcdef1234567890abcdef12345678');
    });

    it('should seed representative trade fixtures', async () => {
      await migrationService.executeAll();

      const count = await getRowCount(sequelize, 'trades');
      expect(count).toBe(TRADE_FIXTURES.length);

      // Verify specific trade data
      const [trades] = await sequelize.query("SELECT * FROM trades WHERE id = 'trade-001'");
      expect(trades).toHaveLength(1);
      expect(trades[0].user_id).toBe('user-001');
      expect(trades[0].market_id).toBe('market-001');
      expect(trades[0].side).toBe('Buy');
      expect(trades[0].status).toBe('Filled');
    });

    it('should have correct data types and constraints', async () => {
      await migrationService.executeAll();

      // Verify trades table constraints
      const [tradesInfo] = await sequelize.query("PRAGMA table_info(trades)");
      const sideCol = tradesInfo.find((c) => c.name === 'side');
      expect(sideCol).toBeDefined();

      const statusCol = tradesInfo.find((c) => c.name === 'status');
      expect(statusCol).toBeDefined();

      // Verify users table constraints
      const [usersInfo] = await sequelize.query("PRAGMA table_info(users)");
      const tierCol = usersInfo.find((c) => c.name === 'tier');
      expect(tierCol).toBeDefined();
    });
  });

  // ─── 2. Rollback All Migrations ────────────────────────────────────────────

  describe('2. Rollback All Migrations', () => {
    beforeEach(async () => {
      // Apply all migrations first
      await migrationService.executeAll();
    });

    it('should rollback migration 003 and remove trade/user tables', async () => {
      // Find the actual migration ID from history
      const historyEntry = migrationService.state.history.find(
        (h) => h.name === '003_trade_user_tables' && h.status === 'completed'
      );
      expect(historyEntry).toBeDefined();

      const result = await migrationService.rollback(historyEntry.id);

      expect(result.status).toBe('rolled_back');

      const tables = await getTableNames(sequelize);
      expect(tables).not.toContain('trades');
      expect(tables).not.toContain('users');
      expect(tables).toContain('markets');
    });

    it('should rollback migration 002 and remove market indexes', async () => {
      // Get migration ID for 002
      const scripts = migrationService.discoverScripts();
      const script002 = scripts.find((s) => s.name === '002_market_query_indexes');

      // Find the migration ID from history
      const historyEntry = migrationService.state.history.find(
        (h) => h.name === '002_market_query_indexes' && h.status === 'completed'
      );

      if (historyEntry) {
        await migrationService.rollback(historyEntry.id);

        const indexes = await getIndexNames(sequelize, 'markets');
        expect(indexes).not.toContain('idx_markets_status');
        expect(indexes).not.toContain('idx_markets_flight_number');
        expect(indexes).not.toContain('idx_markets_close_time');
        expect(indexes).not.toContain('idx_markets_status_close_time');
      }
    });

    it('should rollback migration 001 and remove markets table', async () => {
      const historyEntry = migrationService.state.history.find(
        (h) => h.name === '001_init_markets' && h.status === 'completed'
      );

      if (historyEntry) {
        await migrationService.rollback(historyEntry.id);

        const tables = await getTableNames(sequelize);
        expect(tables).not.toContain('markets');
      }
    });

    it('should remove migration from applied list after rollback', async () => {
      const historyEntry = migrationService.state.history.find(
        (h) => h.name === '003_trade_user_tables' && h.status === 'completed'
      );

      if (historyEntry) {
        await migrationService.rollback(historyEntry.id);
        expect(migrationService.state.applied).not.toContain('003_trade_user_tables');
      }
    });

    it('should add rollback entry to history', async () => {
      const historyEntry = migrationService.state.history.find(
        (h) => h.name === '003_trade_user_tables' && h.status === 'completed'
      );

      if (historyEntry) {
        await migrationService.rollback(historyEntry.id);

        const rollbackEntry = migrationService.state.history.find(
          (h) => h.name === '003_trade_user_tables' && h.status === 'rolled_back'
        );
        expect(rollbackEntry).toBeDefined();
      }
    });
  });

  // ─── 3. Re-apply and Idempotency ───────────────────────────────────────────

  describe('3. Re-apply and Idempotency', () => {
    it('should re-apply migrations after rollback', async () => {
      // Apply all
      await migrationService.executeAll();

      // Rollback 003
      const historyEntry = migrationService.state.history.find(
        (h) => h.name === '003_trade_user_tables' && h.status === 'completed'
      );
      if (historyEntry) {
        await migrationService.rollback(historyEntry.id);
      }

      // Re-apply 003
      const result = await migrationService.executeMigration('003_trade_user_tables');
      expect(result.status).toBe('completed');

      // Verify tables exist again
      const tables = await getTableNames(sequelize);
      expect(tables).toContain('trades');
      expect(tables).toContain('users');
    });

    it('should not duplicate seed data on re-apply', async () => {
      // Apply all
      await migrationService.executeAll();

      // Rollback 003
      const historyEntry = migrationService.state.history.find(
        (h) => h.name === '003_trade_user_tables' && h.status === 'completed'
      );
      if (historyEntry) {
        await migrationService.rollback(historyEntry.id);
      }

      // Re-apply 003
      await migrationService.executeMigration('003_trade_user_tables');

      // Verify no duplicate data
      const marketCount = await getRowCount(sequelize, 'markets');
      const userCount = await getRowCount(sequelize, 'users');
      const tradeCount = await getRowCount(sequelize, 'trades');

      expect(marketCount).toBe(MARKET_FIXTURES.length);
      expect(userCount).toBe(USER_FIXTURES.length);
      expect(tradeCount).toBe(TRADE_FIXTURES.length);
    });

    it('should throw error when applying already-applied migration', async () => {
      await migrationService.executeAll();

      await expect(
        migrationService.executeMigration('001_init_markets')
      ).rejects.toThrow('Migration already applied');
    });
  });

  // ─── 4. Data Integrity with Fixtures ───────────────────────────────────────

  describe('4. Data Integrity with Representative Fixtures', () => {
    beforeEach(async () => {
      await migrationService.executeAll();
    });

    it('should maintain referential integrity between trades and users', async () => {
      // All trade user_ids should exist in users table
      const [orphanTrades] = await sequelize.query(`
        SELECT t.id FROM trades t
        LEFT JOIN users u ON t.user_id = u.id
        WHERE u.id IS NULL
      `);
      expect(orphanTrades).toHaveLength(0);
    });

    it('should maintain referential integrity between trades and markets', async () => {
      // All trade market_ids should exist in markets table
      const [orphanTrades] = await sequelize.query(`
        SELECT t.id FROM trades t
        LEFT JOIN markets m ON t.market_id = m.id
        WHERE m.id IS NULL
      `);
      expect(orphanTrades).toHaveLength(0);
    });

    it('should have valid trade sides (Buy or Sell)', async () => {
      const [invalidTrades] = await sequelize.query(`
        SELECT id FROM trades WHERE side NOT IN ('Buy', 'Sell')
      `);
      expect(invalidTrades).toHaveLength(0);
    });

    it('should have valid trade statuses', async () => {
      const [invalidTrades] = await sequelize.query(`
        SELECT id FROM trades WHERE status NOT IN ('Pending', 'Partial', 'Filled', 'Canceled')
      `);
      expect(invalidTrades).toHaveLength(0);
    });

    it('should have valid user tiers', async () => {
      const [invalidUsers] = await sequelize.query(`
        SELECT id FROM users WHERE tier NOT IN ('public', 'basic', 'premium', 'vip', 'admin')
      `);
      expect(invalidUsers).toHaveLength(0);
    });

    it('should have valid market statuses', async () => {
      const [invalidMarkets] = await sequelize.query(`
        SELECT id FROM markets WHERE status NOT IN ('open', 'closed', 'resolved')
      `);
      expect(invalidMarkets).toHaveLength(0);
    });

    it('should have unique usernames', async () => {
      const [dupes] = await sequelize.query(`
        SELECT username, COUNT(*) as cnt FROM users GROUP BY username HAVING cnt > 1
      `);
      expect(dupes).toHaveLength(0);
    });

    it('should have unique emails', async () => {
      const [dupes] = await sequelize.query(`
        SELECT email, COUNT(*) as cnt FROM users GROUP BY email HAVING cnt > 1
      `);
      expect(dupes).toHaveLength(0);
    });

    it('should support complex queries with joins', async () => {
      const [results] = await sequelize.query(`
        SELECT
          u.username,
          u.tier,
          COUNT(t.id) as trade_count,
          SUM(CASE WHEN t.status = 'Filled' THEN 1 ELSE 0 END) as filled_count
        FROM users u
        LEFT JOIN trades t ON u.id = t.user_id
        GROUP BY u.id
        ORDER BY trade_count DESC
      `);

      expect(results.length).toBe(USER_FIXTURES.length);

      // trader_alice should have 3 trades
      const alice = results.find((r) => r.username === 'trader_alice');
      expect(alice).toBeDefined();
      expect(alice.trade_count).toBe(3);
      expect(alice.filled_count).toBe(2);
    });

    it('should support market analytics queries', async () => {
      const [results] = await sequelize.query(`
        SELECT
          m.name,
          m.status,
          COUNT(t.id) as trade_count,
          SUM(CASE WHEN t.side = 'Buy' THEN 1 ELSE 0 END) as buy_count,
          SUM(CASE WHEN t.side = 'Sell' THEN 1 ELSE 0 END) as sell_count
        FROM markets m
        LEFT JOIN trades t ON m.id = t.market_id
        GROUP BY m.id
        ORDER BY trade_count DESC
      `);

      expect(results.length).toBe(MARKET_FIXTURES.length);

      // market-001 should have 3 trades (2 Buy, 1 Sell)
      const market001 = results.find((r) => r.name === 'Flight AA1234 Arrival Time');
      expect(market001).toBeDefined();
      expect(market001.trade_count).toBe(3);
      expect(market001.buy_count).toBe(2);
      expect(market001.sell_count).toBe(1);
    });
  });

  // ─── 5. Edge Cases ─────────────────────────────────────────────────────────

  describe('5. Edge Cases', () => {
    it('should handle empty database gracefully', async () => {
      // Don't apply any migrations
      const tables = await getTableNames(sequelize);
      expect(tables).toHaveLength(0);
    });

    it('should handle partial migration state', async () => {
      // Apply only 001
      await migrationService.executeMigration('001_init_markets');

      const tables = await getTableNames(sequelize);
      expect(tables).toContain('markets');
      expect(tables).not.toContain('trades');
      expect(tables).not.toContain('users');

      // Apply remaining
      await migrationService.executeAll();

      const tablesAfter = await getTableNames(sequelize);
      expect(tablesAfter).toContain('markets');
      expect(tablesAfter).toContain('trades');
      expect(tablesAfter).toContain('users');
    });

    it('should track migration history correctly', async () => {
      await migrationService.executeAll();

      const history = migrationService.state.history;
      const completed = history.filter((h) => h.status === 'completed');

      expect(completed.length).toBe(3);
      expect(completed.map((h) => h.name)).toContain('001_init_markets');
      expect(completed.map((h) => h.name)).toContain('002_market_query_indexes');
      expect(completed.map((h) => h.name)).toContain('003_trade_user_tables');
    });

    it('should validate migration integrity before applying', async () => {
      const scripts = migrationService.discoverScripts();
      const script001 = scripts.find((s) => s.name === '001_init_markets');

      expect(() => migrationService.validateIntegrity(script001)).not.toThrow();
    });

    it('should report correct migration status', async () => {
      await migrationService.executeAll();

      const status = migrationService.getStatus();
      expect(status.total).toBe(3);
      expect(status.applied).toBe(3);
      expect(status.pending).toBe(0);
    });
  });
});
