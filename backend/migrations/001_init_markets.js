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
