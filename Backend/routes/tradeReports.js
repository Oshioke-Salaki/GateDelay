const express = require('express');
const tradeReportService = require('../services/tradeReportService');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

/**
 * Error handler wrapper
 */
const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    console.error('Trade report error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'TRADE_REPORT_ERROR',
    });
  }
};

/**
 * POST /api/trade-reports
 * Generate a new trade report
 * 
 * Body:
 * - userId: string (required)
 * - reportType: 'daily' | 'weekly' | 'monthly' | 'custom' | 'profit_loss' | 'tax' | 'performance'
 * - format: 'json' | 'csv' | 'excel' | 'pdf' (default: 'excel')
 * - filters: object (optional)
 *   - pair: string
 *   - side: 'Buy' | 'Sell'
 *   - status: string
 *   - startDate: ISO date string
 *   - endDate: ISO date string
 *   - minAmount: string
 *   - maxAmount: string
 * - includeAnalytics: boolean (default: true)
 * - expiryHours: number (default: 24)
 */
router.post(
  '/',
  handleErrors(async (req, res) => {
    const { userId, reportType, format, filters, includeAnalytics, expiryHours } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    const result = await tradeReportService.generateReport(userId, {
      reportType,
      format,
      filters,
      includeAnalytics,
      expiryHours
    });

    res.json({
      success: true,
      data: result
    });
  })
);

/**
 * GET /api/trade-reports/:reportId
 * Get report status and details
 */
router.get(
  '/:reportId',
  handleErrors(async (req, res) => {
    const { reportId } = req.params;

    const report = await tradeReportService.getReportStatus(reportId);

    res.json({
      success: true,
      data: report
    });
  })
);

/**
 * GET /api/trade-reports/:reportId/download
 * Download a completed report file
 */
router.get(
  '/:reportId/download',
  handleErrors(async (req, res) => {
    const { reportId } = req.params;

    const report = await tradeReportService.getReportStatus(reportId);

    if (report.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Report is not ready for download',
        status: report.status
      });
    }

    if (!report.fileUrl) {
      return res.status(404).json({
        success: false,
        error: 'Report file not found'
      });
    }

    // Get file path
    const fileName = path.basename(report.fileUrl);
    const filePath = tradeReportService.getReportFilePath(reportId, report.format);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: 'Report file not found on server'
      });
    }

    // Set appropriate headers
    const contentType = {
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv',
      json: 'application/json',
      pdf: 'application/pdf'
    }[report.format] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', report.fileSize);

    // Stream file to response
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);
  })
);

/**
 * GET /api/trade-reports/user/:userId/history
 * Get report history for a user with filtering support
 * 
 * Query params:
 * - limit: number (default: 20)
 * - skip: number (default: 0)
 * - status: 'pending' | 'processing' | 'completed' | 'failed'
 * - reportType: string
 */
router.get(
  '/user/:userId/history',
  handleErrors(async (req, res) => {
    const { userId } = req.params;
    const { limit, skip, status, reportType } = req.query;

    const options = {
      limit: limit ? parseInt(limit, 10) : 20,
      skip: skip ? parseInt(skip, 10) : 0,
      status,
      reportType
    };

    const history = await tradeReportService.getReportHistory(userId, options);

    res.json({
      success: true,
      data: history
    });
  })
);

/**
 * GET /api/trade-reports/user/:userId/analytics
 * Get analytics summary for user's reports
 */
router.get(
  '/user/:userId/analytics',
  handleErrors(async (req, res) => {
    const { userId } = req.params;

    const analytics = await tradeReportService.getUserReportAnalytics(userId);

    res.json({
      success: true,
      data: analytics
    });
  })
);

/**
 * DELETE /api/trade-reports/:reportId
 * Delete a report
 * 
 * Body:
 * - userId: string (required for authorization)
 */
router.delete(
  '/:reportId',
  handleErrors(async (req, res) => {
    const { reportId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required for authorization'
      });
    }

    const result = await tradeReportService.deleteReport(reportId, userId);

    res.json({
      success: true,
      data: result
    });
  })
);

/**
 * POST /api/trade-reports/cleanup
 * Clean up expired reports (admin only)
 */
router.post(
  '/cleanup',
  handleErrors(async (req, res) => {
    const result = await tradeReportService.cleanupExpiredReports();

    res.json({
      success: true,
      data: result
    });
  })
);

/**
 * POST /api/trade-reports/export/quick
 * Quick export without creating a report record (synchronous)
 * 
 * Body:
 * - userId: string (required)
 * - format: 'json' | 'csv' (default: 'csv')
 * - filters: object (optional)
 */
router.post(
  '/export/quick',
  handleErrors(async (req, res) => {
    const { userId, format = 'csv', filters = {} } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    // Fetch trades
    const trades = await tradeReportService.fetchTrades(userId, filters);

    if (format === 'csv') {
      const { Parser } = require('json2csv');
      
      const fields = [
        { label: 'Date', value: (row) => new Date(row.updatedAt).toLocaleString() },
        { label: 'Pair', value: 'pair' },
        { label: 'Side', value: 'side' },
        { label: 'Type', value: 'type' },
        { label: 'Price', value: 'price' },
        { label: 'Amount', value: 'amount' },
        { label: 'Status', value: 'status' }
      ];

      const parser = new Parser({ fields });
      const csv = parser.parse(trades);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="trades_export_${Date.now()}.csv"`);
      res.send(csv);
    } else {
      // JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="trades_export_${Date.now()}.json"`);
      res.json({
        success: true,
        data: {
          exportedAt: new Date(),
          tradesCount: trades.length,
          trades
        }
      });
    }
  })
);

/**
 * GET /api/trade-reports/filters/pairs
 * Get list of available trading pairs for filtering
 * 
 * Query params:
 * - userId: string (optional - to get user-specific pairs)
 */
router.get(
  '/filters/pairs',
  handleErrors(async (req, res) => {
    const { userId } = req.query;
    const Order = require('../models/Order');

    const query = userId ? { userId } : {};
    
    const pairs = await Order.distinct('pair', query);

    res.json({
      success: true,
      data: {
        pairs: pairs.sort()
      }
    });
  })
);

/**
 * GET /api/trade-reports/filters/date-range
 * Get available date range for reports
 * 
 * Query params:
 * - userId: string (required)
 */
router.get(
  '/filters/date-range',
  handleErrors(async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    const Order = require('../models/Order');

    const oldestTrade = await Order.findOne({ userId })
      .sort({ updatedAt: 1 })
      .select('updatedAt')
      .lean();

    const newestTrade = await Order.findOne({ userId })
      .sort({ updatedAt: -1 })
      .select('updatedAt')
      .lean();

    res.json({
      success: true,
      data: {
        oldestTradeDate: oldestTrade ? oldestTrade.updatedAt : null,
        newestTradeDate: newestTrade ? newestTrade.updatedAt : null
      }
    });
  })
);

module.exports = router;
