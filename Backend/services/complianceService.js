const Joi = require('joi');
const moment = require('moment');

class ComplianceService {
  constructor(db) {
    this.db = db;
    this.rules = new Map();
    this.history = [];
  }

  async initializeRules() {
    const defaultRules = [
      { id: 'max_trade_value', threshold: 100000, action: 'flag' },
      { id: 'daily_volume_limit', threshold: 500000, action: 'flag' },
      { id: 'high_frequency', threshold: 100, action: 'review' },
      { id: 'sanctioned_pairs', pairs: [], action: 'block' }
    ];
    defaultRules.forEach(rule => this.rules.set(rule.id, rule));
  }

  async checkCompliance(trade) {
    const schema = Joi.object({
      userId: Joi.string().required(),
      amount: Joi.number().required(),
      pair: Joi.string().required(),
      timestamp: Joi.date().required()
    });

    const { error, value } = schema.validate(trade);
    if (error) throw new Error(`Invalid trade data: ${error.message}`);

    const violations = [];
    const complianceResult = {
      tradeId: trade.id,
      timestamp: new Date(),
      violations,
      status: 'compliant',
      flagged: false
    };

    // Check individual rules
    if (value.amount > this.rules.get('max_trade_value').threshold) {
      violations.push({
        rule: 'max_trade_value',
        severity: 'high',
        action: 'flag'
      });
      complianceResult.flagged = true;
    }

    if (this.rules.get('sanctioned_pairs').pairs.includes(value.pair)) {
      violations.push({
        rule: 'sanctioned_pairs',
        severity: 'critical',
        action: 'block'
      });
      complianceResult.status = 'non-compliant';
    }

    // Store in history
    await this.recordHistory(complianceResult);
    return complianceResult;
  }

  async recordHistory(result) {
    this.history.push({
      ...result,
      recordedAt: moment().toISOString()
    });
    await this.db.insert('compliance_history', result);
  }

  async getComplianceReport(userId, startDate, endDate) {
    const start = moment(startDate).toDate();
    const end = moment(endDate).toDate();
    
    const records = await this.db.query(
      'SELECT * FROM compliance_history WHERE userId = ? AND timestamp BETWEEN ? AND ?',
      [userId, start, end]
    );

    const report = {
      userId,
      period: { start, end },
      totalTrades: records.length,
      flaggedTrades: records.filter(r => r.flagged).length,
      nonCompliant: records.filter(r => r.status === 'non-compliant').length,
      violations: records.flatMap(r => r.violations),
      generatedAt: new Date()
    };

    return report;
  }

  async addRule(rule) {
    const schema = Joi.object({
      id: Joi.string().required(),
      threshold: Joi.number().optional(),
      action: Joi.string().valid('flag', 'review', 'block').required()
    });

    const { value } = schema.validate(rule);
    this.rules.set(value.id, value);
    await this.db.insert('compliance_rules', value);
    return value;
  }
}

module.exports = ComplianceService;
