const { Parser } = require('json2csv');
const archiver = require('archiver');
const crypto = require('crypto');
const cron = require('node-cron');
const Order = require('../models/Order');
const Balance = require('../models/Balance');
const MarketSnapshot = require('../models/MarketSnapshot');

class ExportService {
  constructor() {
    this.exportJobs = new Map();
    this.scheduledExports = new Map();
    this.encryptionKey = process.env.EXPORT_ENCRYPTION_KEY || 'default-key-change-in-prod';
  }

  async exportData(userId, dataType, format = 'json', options = {}) {
    const jobId = this._generateJobId();
    const job = {
      id: jobId,
      userId,
      dataType,
      format,
      status: 'pending',
      progress: 0,
      createdAt: new Date()
    };
    this.exportJobs.set(jobId, job);

    this._processExport(jobId, userId, dataType, format, options);

    return jobId;
  }

  async _processExport(jobId, userId, dataType, format, options) {
    try {
      const job = this.exportJobs.get(jobId);
      job.status = 'processing';

      let data;

      switch (dataType) {
        case 'orders':
          data = await this._getOrders(userId, options);
          break;
        case 'balances':
          data = await this._getBalances(userId, options);
          break;
        case 'market-snapshots':
          data = await this._getMarketSnapshots(options);
          break;
        default:
          throw new Error(`Unsupported data type: ${dataType}`);
      }

      job.progress = 50;

      let exportedData;
      if (format === 'csv') {
        const parser = new Parser();
        exportedData = parser.parse(data);
      } else {
        exportedData = JSON.stringify(data, null, 2);
      }

      job.progress = 80;

      if (options.encrypt) {
        exportedData = this._encryptData(exportedData);
      }

      job.progress = 100;
      job.status = 'completed';
      job.data = exportedData;
      job.downloadUrl = `/exports/download/${jobId}`;
    } catch (error) {
      const job = this.exportJobs.get(jobId);
      job.status = 'failed';
      job.error = error.message;
    }
  }

  async _getOrders(userId, options) {
    const query = userId ? { userId } : {};
    if (options.startDate) query.timestamp = { $gte: new Date(options.startDate) };
    if (options.endDate) query.timestamp = { ...query.timestamp, $lte: new Date(options.endDate) };
    
    return Order.find(query).sort({ timestamp: -1 });
  }

  async _getBalances(userId, options) {
    const query = userId ? { userId } : {};
    return Balance.find(query);
  }

  async _getMarketSnapshots(options) {
    const query = {};
    if (options.pair) query.pair = options.pair;
    if (options.startDate) query.timestamp = { $gte: new Date(options.startDate) };
    if (options.endDate) query.timestamp = { ...query.timestamp, $lte: new Date(options.endDate) };
    
    return MarketSnapshot.find(query).sort({ timestamp: -1 });
  }

  getExportStatus(jobId) {
    return this.exportJobs.get(jobId);
  }

  getExportData(jobId) {
    const job = this.exportJobs.get(jobId);
    if (!job || job.status !== 'completed') {
      throw new Error('Export not found or not completed');
    }
    return job.data;
  }

  scheduleExport(userId, dataType, format, cronExpression, options = {}) {
    const scheduleId = this._generateJobId();
    const job = cron.schedule(cronExpression, async () => {
      await this.exportData(userId, dataType, format, options);
    });

    this.scheduledExports.set(scheduleId, {
      id: scheduleId,
      userId,
      dataType,
      format,
      cronExpression,
      options,
      job
    });

    return scheduleId;
  }

  cancelScheduledExport(scheduleId) {
    const scheduled = this.scheduledExports.get(scheduleId);
    if (scheduled) {
      scheduled.job.stop();
      this.scheduledExports.delete(scheduleId);
      return { success: true };
    }
    return { success: false, error: 'Scheduled export not found' };
  }

  listScheduledExports(userId) {
    return Array.from(this.scheduledExports.values())
      .filter(exp => exp.userId === userId);
  }

  _encryptData(data) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey.padEnd(32, '0').slice(0, 32)), iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  _generateJobId() {
    return crypto.randomBytes(16).toString('hex');
  }
}

module.exports = new ExportService();
