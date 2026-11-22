// Trade and user reference tables for the migration smoke tests.
//
// Why a separate migration:
// The markets table (001) and its indexes (002) are already checksummed and
// recorded in migration_log. Adding trade and user tables as a new migration
// follows the established pattern of never editing applied migrations.
//
// These tables support the migration smoke tests by providing representative
// fixtures for market, trade, and user data that exercise the full
// apply → verify → rollback lifecycle.

module.exports = {
  steps: ['schema', 'indexes', 'seed'],
  async up(context, step) {
    const { sequelize } = context;

    if (step === 'schema') {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS trades (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          market_id TEXT NOT NULL,
          side TEXT NOT NULL CHECK(side IN ('Buy', 'Sell')),
          price TEXT NOT NULL,
          amount TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Partial', 'Filled', 'Canceled')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL UNIQUE,
          tier TEXT NOT NULL DEFAULT 'basic' CHECK(tier IN ('public', 'basic', 'premium', 'vip', 'admin')),
          wallet_address TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      return;
    }

    if (step === 'indexes') {
      await sequelize.query(
        'CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades (user_id)'
      );
      await sequelize.query(
        'CREATE INDEX IF NOT EXISTS idx_trades_market_id ON trades (market_id)'
      );
      await sequelize.query(
        'CREATE INDEX IF NOT EXISTS idx_trades_status ON trades (status)'
      );
      await sequelize.query(
        'CREATE INDEX IF NOT EXISTS idx_trades_user_market ON trades (user_id, market_id)'
      );
      await sequelize.query(
        'CREATE INDEX IF NOT EXISTS idx_users_tier ON users (tier)'
      );
      await sequelize.query(
        'CREATE INDEX IF NOT EXISTS idx_users_wallet ON users (wallet_address)'
      );
      return;
    }

    if (step === 'seed') {
      // Representative market fixtures
      await sequelize.query(`
        INSERT OR IGNORE INTO markets (id, name, status, flight_number, close_time)
        VALUES
          ('market-001', 'Flight AA1234 Arrival Time', 'open', 'AA1234', '2026-12-31T23:59:59Z'),
          ('market-002', 'Flight DL5678 Delay > 30min', 'open', 'DL5678', '2026-12-31T23:59:59Z'),
          ('market-003', 'Flight UA9012 Cancellation', 'closed', 'UA9012', '2026-09-15T12:00:00Z'),
          ('market-004', 'Flight BA3456 On-Time', 'open', 'BA3456', '2026-12-31T23:59:59Z'),
          ('market-005', 'Flight LH7890 Diversion', 'resolved', 'LH7890', '2026-08-01T08:00:00Z')
      `);

      // Representative user fixtures
      await sequelize.query(`
        INSERT OR IGNORE INTO users (id, username, email, tier, wallet_address)
        VALUES
          ('user-001', 'trader_alice', 'alice@example.com', 'premium', '0x1234567890abcdef1234567890abcdef12345678'),
          ('user-002', 'trader_bob', 'bob@example.com', 'basic', '0xabcdef1234567890abcdef1234567890abcdef12'),
          ('user-003', 'trader_charlie', 'charlie@example.com', 'vip', '0x9876543210fedcba9876543210fedcba98765432'),
          ('user-004', 'trader_dave', 'dave@example.com', 'public', '0xfedcba9876543210fedcba9876543210fedcba98'),
          ('user-005', 'admin_eve', 'eve@example.com', 'admin', '0x1111111111111111111111111111111111111111')
      `);

      // Representative trade fixtures
      await sequelize.query(`
        INSERT OR IGNORE INTO trades (id, user_id, market_id, side, price, amount, status)
        VALUES
          ('trade-001', 'user-001', 'market-001', 'Buy', '2.50', '100', 'Filled'),
          ('trade-002', 'user-001', 'market-001', 'Sell', '2.75', '50', 'Partial'),
          ('trade-003', 'user-002', 'market-002', 'Buy', '1.80', '200', 'Pending'),
          ('trade-004', 'user-003', 'market-001', 'Buy', '3.00', '75', 'Filled'),
          ('trade-005', 'user-003', 'market-004', 'Sell', '1.50', '150', 'Filled'),
          ('trade-006', 'user-004', 'market-002', 'Buy', '2.00', '300', 'Canceled'),
          ('trade-007', 'user-001', 'market-003', 'Sell', '4.00', '25', 'Filled'),
          ('trade-008', 'user-005', 'market-005', 'Buy', '1.20', '500', 'Filled')
      `);
      return;
    }
  },
  async down(context) {
    const { sequelize } = context;

    // Drop indexes first
    await sequelize.query('DROP INDEX IF EXISTS idx_trades_user_id');
    await sequelize.query('DROP INDEX IF EXISTS idx_trades_market_id');
    await sequelize.query('DROP INDEX IF EXISTS idx_trades_status');
    await sequelize.query('DROP INDEX IF EXISTS idx_trades_user_market');
    await sequelize.query('DROP INDEX IF EXISTS idx_users_tier');
    await sequelize.query('DROP INDEX IF EXISTS idx_users_wallet');

    // Drop tables
    await sequelize.query('DROP TABLE IF EXISTS trades');
    await sequelize.query('DROP TABLE IF EXISTS users');
  },
};
