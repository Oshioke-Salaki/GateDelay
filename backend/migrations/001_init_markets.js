// Cache Strategy:
// Markets table is a reference dataset that changes infrequently.
// Read cache: 5 min TTL via application-level cache-manager (NestJS CacheModule).
// Write-through: seed data is written once at migration time; no invalidation needed.
// If markets are updated via admin UI, call cache.invalidate('markets:*') explicitly.
// Long-term: consider Redis-backed caching with Keyv (already in deps) for horizontal scale.

module.exports = {
  steps: ['schema', 'indexes', 'seed'],
  async up(context) {
    const { sequelize } = context;
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS markets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  },
  async down(context) {
    const { sequelize } = context;
    await sequelize.query('DROP TABLE IF EXISTS markets');
  },
};
