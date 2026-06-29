const schedule = require('node-schedule');

class ComplianceChecker {
  constructor(complianceService, db) {
    this.service = complianceService;
    this.db = db;
  }

  start() {
    // Run compliance checks every hour
    schedule.scheduleJob('0 * * * *', async () => {
      await this.runComplianceCheck();
    });
  }

  async runComplianceCheck() {
    try {
      const pendingTrades = await this.db.query(
        'SELECT * FROM trades WHERE compliance_status = ? LIMIT 100',
        ['pending']
      );

      for (const trade of pendingTrades) {
        const result = await this.service.checkCompliance(trade);
        await this.db.update('trades', { id: trade.id }, {
          compliance_status: result.status,
          compliance_flagged: result.flagged
        });
      }
    } catch (error) {
      console.error('Compliance check failed:', error);
    }
  }
}

module.exports = ComplianceChecker;
