const ExcelJS = require('exceljs');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const TradeReport = require('../models/TradeReport');
const Big = require('big.js');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');

class TradeReportService {
  constructor() {
    this.reportsDir = path.join(__dirname, '..', 'temp', 'reports');
    this.ensureReportsDirectory();
  }

  /**
   * Ensure reports directory exists
   */
  async ensureReportsDirectory() {
    try {
      await fs.mkdir(this.reportsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create reports directory:', error);
    }
  }

  /**
   * Generate a trade report
   * @param {string} userId - User ID
   * @param {object} options - Report options
   * @returns {Promise<object>} - Report metadata
   */
  async generateReport(userId, options = {}) {
    const {
      reportType = 'custom',
      format = 'excel',
      filters = {},
      includeAnalytics = true,
      expiryHours = 24
    } = options;

    // Create report record
    const reportId = uuidv4();
    const report = new TradeReport({
      reportId,
      userId,
      reportType,
      format,
      filters,
      status: 'pending',
      expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000)
    });

    await report.save();

    // Process report asynchronously
    this.processReport(reportId).catch(error => {
      console.error(`Failed to process report ${reportId}:`, error);
      this.updateReportStatus(reportId, 'failed', error.message);
    });

    return {
      reportId,
      status: 'pending',
      message: 'Report generation started'
    };
  }

  /**
   * Process report generation
   */
  async processReport(reportId) {
    const report = await TradeReport.findOne({ reportId });
    if (!report) {
      throw new Error('Report not found');
    }

    try {
      // Update status to processing
      report.status = 'processing';
      await report.save();

      // Fetch trades based on filters
      const trades = await this.fetchTrades(report.userId, report.filters);

      // Calculate summary and analytics
      const summary = this.calculateSummary(trades);
      const analytics = this.calculateAnalytics(trades);

      // Generate file based on format
      let fileUrl, fileSize;
      switch (report.format) {
        case 'excel':
          ({ fileUrl, fileSize } = await this.generateExcelReport(reportId, trades, summary, analytics));
          break;
        case 'csv':
          ({ fileUrl, fileSize } = await this.generateCSVReport(reportId, trades));
          break;
        case 'json':
          ({ fileUrl, fileSize } = await this.generateJSONReport(reportId, trades, summary, analytics));
          break;
        default:
          throw new Error('Unsupported format');
      }

      // Update report with results
      report.status = 'completed';
      report.summary = summary;
      report.analytics = analytics;
      report.fileUrl = fileUrl;
      report.fileSize = fileSize;
      await report.save();

    } catch (error) {
      report.status = 'failed';
      report.errorMessage = error.message;
      await report.save();
      throw error;
    }
  }

  /**
   * Fetch trades based on filters
   */
  async fetchTrades(userId, filters = {}) {
    const query = { userId };

    if (filters.pair) {
      query.pair = filters.pair;
    }

    if (filters.side) {
      query.side = filters.side;
    }

    if (filters.status) {
      query.status = filters.status;
    } else {
      // Default to filled trades only
      query.status = 'Filled';
    }

    if (filters.startDate || filters.endDate) {
      query.updatedAt = {};
      if (filters.startDate) {
        query.updatedAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.updatedAt.$lte = new Date(filters.endDate);
      }
    }

    if (filters.minAmount || filters.maxAmount) {
      // Note: amount is stored as string, need to convert for comparison
      const trades = await Order.find(query).sort({ updatedAt: -1 }).lean();
      
      return trades.filter(trade => {
        const amount = new Big(trade.amount);
        if (filters.minAmount && amount.lt(new Big(filters.minAmount))) {
          return false;
        }
        if (filters.maxAmount && amount.gt(new Big(filters.maxAmount))) {
          return false;
        }
        return true;
      });
    }

    return await Order.find(query).sort({ updatedAt: -1 }).lean();
  }

  /**
   * Calculate report summary
   */
  calculateSummary(trades) {
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        totalVolume: '0',
        totalBuyVolume: '0',
        totalSellVolume: '0',
        avgTradeSize: '0',
        profitLoss: '0',
        winRate: 0,
        bestTrade: '0',
        worstTrade: '0'
      };
    }

    let totalVolume = new Big(0);
    let totalBuyVolume = new Big(0);
    let totalSellVolume = new Big(0);
    let profitLoss = new Big(0);
    let wins = 0;
    let losses = 0;
    let bestTrade = new Big(0);
    let worstTrade = new Big(0);

    // Calculate volumes and P/L
    const costBasis = {}; // Track cost basis per pair

    trades.forEach(trade => {
      const amount = new Big(trade.amount);
      const price = new Big(trade.price || 0);
      const value = amount.times(price);

      totalVolume = totalVolume.plus(value);

      if (trade.side === 'Buy') {
        totalBuyVolume = totalBuyVolume.plus(value);
        
        // Add to cost basis
        if (!costBasis[trade.pair]) {
          costBasis[trade.pair] = { totalCost: new Big(0), totalAmount: new Big(0) };
        }
        costBasis[trade.pair].totalCost = costBasis[trade.pair].totalCost.plus(value);
        costBasis[trade.pair].totalAmount = costBasis[trade.pair].totalAmount.plus(amount);
      } else {
        totalSellVolume = totalSellVolume.plus(value);
        
        // Calculate P/L if we have cost basis
        if (costBasis[trade.pair] && costBasis[trade.pair].totalAmount.gt(0)) {
          const avgCost = costBasis[trade.pair].totalCost.div(costBasis[trade.pair].totalAmount);
          const tradePL = price.minus(avgCost).times(amount);
          profitLoss = profitLoss.plus(tradePL);

          if (tradePL.gt(bestTrade)) bestTrade = tradePL;
          if (tradePL.lt(worstTrade)) worstTrade = tradePL;

          if (tradePL.gt(0)) wins++;
          else if (tradePL.lt(0)) losses++;
        }
      }
    });

    const avgTradeSize = totalVolume.div(trades.length);
    const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0;

    return {
      totalTrades: trades.length,
      totalVolume: totalVolume.toFixed(2),
      totalBuyVolume: totalBuyVolume.toFixed(2),
      totalSellVolume: totalSellVolume.toFixed(2),
      avgTradeSize: avgTradeSize.toFixed(2),
      profitLoss: profitLoss.toFixed(2),
      winRate: parseFloat(winRate.toFixed(2)),
      bestTrade: bestTrade.toFixed(2),
      worstTrade: worstTrade.toFixed(2)
    };
  }

  /**
   * Calculate analytics
   */
  calculateAnalytics(trades) {
    if (trades.length === 0) {
      return {
        topPairs: [],
        hourlyDistribution: [],
        performanceByPair: []
      };
    }

    // Top pairs by volume
    const pairStats = {};
    trades.forEach(trade => {
      if (!pairStats[trade.pair]) {
        pairStats[trade.pair] = { volume: new Big(0), tradeCount: 0 };
      }
      const value = new Big(trade.amount).times(new Big(trade.price || 0));
      pairStats[trade.pair].volume = pairStats[trade.pair].volume.plus(value);
      pairStats[trade.pair].tradeCount++;
    });

    const topPairs = Object.entries(pairStats)
      .map(([pair, stats]) => ({
        pair,
        volume: stats.volume.toFixed(2),
        tradeCount: stats.tradeCount
      }))
      .sort((a, b) => parseFloat(b.volume) - parseFloat(a.volume))
      .slice(0, 10);

    // Hourly distribution
    const hourlyStats = Array(24).fill(0).map((_, i) => ({ hour: i, tradeCount: 0 }));
    trades.forEach(trade => {
      const hour = new Date(trade.updatedAt).getHours();
      hourlyStats[hour].tradeCount++;
    });

    // Performance by pair (simplified P/L)
    const performanceByPair = Object.keys(pairStats).map(pair => {
      const pairTrades = trades.filter(t => t.pair === pair);
      const buys = pairTrades.filter(t => t.side === 'Buy');
      const sells = pairTrades.filter(t => t.side === 'Sell');
      
      let pl = new Big(0);
      if (buys.length > 0 && sells.length > 0) {
        const avgBuyPrice = buys.reduce((sum, t) => sum.plus(new Big(t.price || 0)), new Big(0)).div(buys.length);
        const avgSellPrice = sells.reduce((sum, t) => sum.plus(new Big(t.price || 0)), new Big(0)).div(sells.length);
        pl = avgSellPrice.minus(avgBuyPrice);
      }

      const wins = sells.filter(t => {
        const correspondingBuy = buys.find(b => new Big(b.price).lt(new Big(t.price)));
        return correspondingBuy;
      }).length;

      return {
        pair,
        profitLoss: pl.toFixed(2),
        winRate: sells.length > 0 ? parseFloat(((wins / sells.length) * 100).toFixed(2)) : 0
      };
    });

    return {
      topPairs,
      hourlyDistribution: hourlyStats.filter(h => h.tradeCount > 0),
      performanceByPair
    };
  }

  /**
   * Generate Excel report
   */
  async generateExcelReport(reportId, trades, summary, analytics) {
    const workbook = new ExcelJS.Workbook();
    
    // Metadata
    workbook.creator = 'GateDelay Trading Platform';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 25 },
      { header: 'Value', key: 'value', width: 20 }
    ];

    summarySheet.addRows([
      { metric: 'Total Trades', value: summary.totalTrades },
      { metric: 'Total Volume', value: summary.totalVolume },
      { metric: 'Total Buy Volume', value: summary.totalBuyVolume },
      { metric: 'Total Sell Volume', value: summary.totalSellVolume },
      { metric: 'Average Trade Size', value: summary.avgTradeSize },
      { metric: 'Profit/Loss', value: summary.profitLoss },
      { metric: 'Win Rate (%)', value: summary.winRate },
      { metric: 'Best Trade', value: summary.bestTrade },
      { metric: 'Worst Trade', value: summary.worstTrade }
    ]);

    // Style summary sheet
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };

    // Trades Sheet
    const tradesSheet = workbook.addWorksheet('Trades');
    tradesSheet.columns = [
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Pair', key: 'pair', width: 15 },
      { header: 'Side', key: 'side', width: 10 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Price', key: 'price', width: 15 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Value', key: 'value', width: 15 },
      { header: 'Status', key: 'status', width: 12 }
    ];

    trades.forEach(trade => {
      const value = new Big(trade.amount).times(new Big(trade.price || 0));
      tradesSheet.addRow({
        date: new Date(trade.updatedAt).toLocaleString(),
        pair: trade.pair,
        side: trade.side,
        type: trade.type,
        price: trade.price,
        amount: trade.amount,
        value: value.toFixed(2),
        status: trade.status
      });
    });

    // Style trades sheet header
    tradesSheet.getRow(1).font = { bold: true };
    tradesSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF70AD47' }
    };

    // Top Pairs Sheet
    if (analytics.topPairs.length > 0) {
      const topPairsSheet = workbook.addWorksheet('Top Pairs');
      topPairsSheet.columns = [
        { header: 'Pair', key: 'pair', width: 15 },
        { header: 'Volume', key: 'volume', width: 20 },
        { header: 'Trade Count', key: 'tradeCount', width: 15 }
      ];

      analytics.topPairs.forEach(pair => {
        topPairsSheet.addRow(pair);
      });

      topPairsSheet.getRow(1).font = { bold: true };
      topPairsSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFC000' }
      };
    }

    // Performance Sheet
    if (analytics.performanceByPair.length > 0) {
      const perfSheet = workbook.addWorksheet('Performance by Pair');
      perfSheet.columns = [
        { header: 'Pair', key: 'pair', width: 15 },
        { header: 'Profit/Loss', key: 'profitLoss', width: 15 },
        { header: 'Win Rate (%)', key: 'winRate', width: 15 }
      ];

      analytics.performanceByPair.forEach(perf => {
        perfSheet.addRow(perf);
      });

      perfSheet.getRow(1).font = { bold: true };
      perfSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF5B9BD5' }
      };
    }

    // Save file
    const fileName = `trade_report_${reportId}.xlsx`;
    const filePath = path.join(this.reportsDir, fileName);
    await workbook.xlsx.writeFile(filePath);

    const stats = await fs.stat(filePath);

    return {
      fileUrl: `/reports/${fileName}`,
      fileSize: stats.size
    };
  }

  /**
   * Generate CSV report
   */
  async generateCSVReport(reportId, trades) {
    const { Parser } = require('json2csv');
    
    const fields = [
      { label: 'Date', value: (row) => new Date(row.updatedAt).toLocaleString() },
      { label: 'Pair', value: 'pair' },
      { label: 'Side', value: 'side' },
      { label: 'Type', value: 'type' },
      { label: 'Price', value: 'price' },
      { label: 'Amount', value: 'amount' },
      { label: 'Filled', value: 'filled' },
      { label: 'Status', value: 'status' },
      { label: 'Value', value: (row) => new Big(row.amount).times(new Big(row.price || 0)).toFixed(2) }
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(trades);

    const fileName = `trade_report_${reportId}.csv`;
    const filePath = path.join(this.reportsDir, fileName);
    await fs.writeFile(filePath, csv);

    const stats = await fs.stat(filePath);

    return {
      fileUrl: `/reports/${fileName}`,
      fileSize: stats.size
    };
  }

  /**
   * Generate JSON report
   */
  async generateJSONReport(reportId, trades, summary, analytics) {
    const report = {
      reportId,
      generatedAt: new Date(),
      summary,
      analytics,
      trades: trades.map(trade => ({
        date: trade.updatedAt,
        pair: trade.pair,
        side: trade.side,
        type: trade.type,
        price: trade.price,
        amount: trade.amount,
        filled: trade.filled,
        status: trade.status,
        value: new Big(trade.amount).times(new Big(trade.price || 0)).toFixed(2)
      }))
    };

    const fileName = `trade_report_${reportId}.json`;
    const filePath = path.join(this.reportsDir, fileName);
    await fs.writeFile(filePath, JSON.stringify(report, null, 2));

    const stats = await fs.stat(filePath);

    return {
      fileUrl: `/reports/${fileName}`,
      fileSize: stats.size
    };
  }

  /**
   * Get report status
   */
  async getReportStatus(reportId) {
    const report = await TradeReport.findOne({ reportId }).lean();
    
    if (!report) {
      throw new Error('Report not found');
    }

    return {
      reportId: report.reportId,
      status: report.status,
      reportType: report.reportType,
      format: report.format,
      generatedAt: report.generatedAt,
      fileUrl: report.fileUrl,
      fileSize: report.fileSize,
      summary: report.summary,
      errorMessage: report.errorMessage,
      expiresAt: report.expiresAt
    };
  }

  /**
   * Get report history for a user
   */
  async getReportHistory(userId, options = {}) {
    const { limit = 20, skip = 0, status, reportType } = options;

    const query = { userId };
    if (status) query.status = status;
    if (reportType) query.reportType = reportType;

    const reports = await TradeReport.find(query)
      .sort({ generatedAt: -1 })
      .limit(limit)
      .skip(skip)
      .select('-analytics') // Exclude large analytics data
      .lean();

    const total = await TradeReport.countDocuments(query);

    return {
      reports,
      total,
      limit,
      skip,
      hasMore: total > skip + reports.length
    };
  }

  /**
   * Delete a report
   */
  async deleteReport(reportId, userId) {
    const report = await TradeReport.findOne({ reportId, userId });
    
    if (!report) {
      throw new Error('Report not found or unauthorized');
    }

    // Delete file if exists
    if (report.fileUrl) {
      const fileName = path.basename(report.fileUrl);
      const filePath = path.join(this.reportsDir, fileName);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.error('Failed to delete report file:', error);
      }
    }

    await TradeReport.deleteOne({ reportId });

    return { success: true, message: 'Report deleted' };
  }

  /**
   * Update report status
   */
  async updateReportStatus(reportId, status, errorMessage = null) {
    const update = { status };
    if (errorMessage) update.errorMessage = errorMessage;

    await TradeReport.updateOne({ reportId }, update);
  }

  /**
   * Get report file path
   */
  getReportFilePath(reportId, format) {
    const extension = format === 'excel' ? 'xlsx' : format === 'csv' ? 'csv' : 'json';
    const fileName = `trade_report_${reportId}.${extension}`;
    return path.join(this.reportsDir, fileName);
  }

  /**
   * Clean up expired reports
   */
  async cleanupExpiredReports() {
    const expiredReports = await TradeReport.find({
      expiresAt: { $lte: new Date() }
    });

    for (const report of expiredReports) {
      if (report.fileUrl) {
        const fileName = path.basename(report.fileUrl);
        const filePath = path.join(this.reportsDir, fileName);
        try {
          await fs.unlink(filePath);
        } catch (error) {
          console.error(`Failed to delete expired report file ${fileName}:`, error);
        }
      }
    }

    const result = await TradeReport.deleteMany({
      expiresAt: { $lte: new Date() }
    });

    return {
      deletedCount: result.deletedCount,
      message: `Cleaned up ${result.deletedCount} expired reports`
    };
  }

  /**
   * Get report analytics summary for user
   */
  async getUserReportAnalytics(userId) {
    const totalReports = await TradeReport.countDocuments({ userId });
    const completedReports = await TradeReport.countDocuments({ userId, status: 'completed' });
    const failedReports = await TradeReport.countDocuments({ userId, status: 'failed' });

    const recentReports = await TradeReport.find({ userId })
      .sort({ generatedAt: -1 })
      .limit(5)
      .select('reportId reportType status generatedAt')
      .lean();

    const reportsByType = await TradeReport.aggregate([
      { $match: { userId } },
      { $group: { _id: '$reportType', count: { $sum: 1 } } }
    ]);

    return {
      totalReports,
      completedReports,
      failedReports,
      recentReports,
      reportsByType: reportsByType.map(r => ({ type: r._id, count: r.count }))
    };
  }
}

module.exports = new TradeReportService();
