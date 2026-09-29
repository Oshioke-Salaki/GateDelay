// Query indexes for the markets reference table.
//
// Why a follow-up migration (and not an edit to 001):
// 001 is checksummed by services/migrationService.js and recorded in
// migration_log, so rewriting it would fail validateIntegrity() on any
// environment that already applied it. New DDL always ships as a new file and
// is discovered by alphabetical order (discoverScripts()).
//
// Why these four indexes (#917):
//   * market status  — the list/filter path is "markets in state X"; a plain
//                      status index keeps that off a full table scan.
//   * flight number  — GateDelay markets are flight-based (see
//                      Frontend/components/market/CreateMarketForm.tsx), and
//                      lookup by flight number is the primary market read.
//   * close time     — "markets closing before T" drives expiry sweeps and the
//                      resolution scheduler.
//   * status+close   — the scheduler's hot path is both predicates at once
//                      (still open AND past its close time), so a compound index
//                      avoids intersecting two single-column indexes per tick.
//
// Cache strategy: unchanged from 001 — these are secondary indexes only, so
// write-through cache invalidation in 001 still applies unchanged.

/** Columns the market read paths filter/sort on, with their DDL fragment. */
const NEW_COLUMNS = {
  status: 'status TEXT',
  flight_number: 'flight_number TEXT',
  close_time: 'close_time DATETIME',
};

/** [name, SQL that creates the index]. CREATE INDEX IF NOT EXISTS is idempotent. */
const INDEXES = [
  ['idx_markets_status', 'CREATE INDEX IF NOT EXISTS idx_markets_status ON markets (status)'],
  [
    'idx_markets_flight_number',
    'CREATE INDEX IF NOT EXISTS idx_markets_flight_number ON markets (flight_number)',
  ],
  [
    'idx_markets_close_time',
    'CREATE INDEX IF NOT EXISTS idx_markets_close_time ON markets (close_time)',
  ],
  [
    'idx_markets_status_close_time',
    'CREATE INDEX IF NOT EXISTS idx_markets_status_close_time ON markets (status, close_time)',
  ],
];

/**
 * Names of the columns the markets table actually has.
 * @param {import('sequelize').Sequelize} sequelize
 * @returns {Promise<Set<string>>}
 */
async function existingColumns(sequelize) {
  const described = await sequelize.getQueryInterface().describeTable('markets');
  return new Set(Object.keys(described));
}

module.exports = {
  steps: ['schema', 'indexes'],
  async up(context, step) {
    const { sequelize } = context;

    if (step === 'schema') {
      const columns = await existingColumns(sequelize);
      for (const [name, ddl] of Object.entries(NEW_COLUMNS)) {
        // SQLite has no ADD COLUMN IF NOT EXISTS, so guard on the table shape.
        if (columns.has(name)) continue;
        await sequelize.query(`ALTER TABLE markets ADD COLUMN ${ddl}`);
      }
      return;
    }

    if (step === 'indexes') {
      for (const [, statement] of INDEXES) {
        await sequelize.query(statement);
      }
    }
  },
  async down(context) {
    const { sequelize } = context;

    for (const [name] of INDEXES) {
      await sequelize.query(`DROP INDEX IF EXISTS ${name}`);
    }

    // Column removal is best-effort: older SQLite builds (< 3.35) cannot
    // DROP COLUMN, and a stranded nullable column is harmless next to a failed
    // rollback. A missing column is likewise not worth failing the rollback.
    const columns = await existingColumns(sequelize);
    for (const name of Object.keys(NEW_COLUMNS).reverse()) {
      if (!columns.has(name)) continue;
      try {
        await sequelize.query(`ALTER TABLE markets DROP COLUMN ${name}`);
      } catch (err) {
        console.warn(`[migration 002] could not drop markets.${name}: ${err.message}`);
      }
    }
  },
};
