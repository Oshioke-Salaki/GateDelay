const express = require('express');
const compressionService = require('../services/compressionService');

const router = express.Router();

/**
 * Middleware for error handling
 */
const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'COMPRESSION_ERROR',
    });
  }
};

/**
 * POST /compress
 * Compress trade data for storage
 */
router.post(
  '/compress',
  handleErrors(async (req, res) => {
    const { data, algorithm = 'gzip' } = req.body;
    
    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Data is required for compression'
      });
    }
    
    const result = await compressionService.compressTradeData(data, algorithm);
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    res.json({
      success: true,
      message: 'Data compressed successfully',
      data: result
    });
  })
);

/**
 * POST /decompress
 * Decompress data for queries
 */
router.post(
  '/decompress',
  handleErrors(async (req, res) => {
    const { compressedData, algorithm = 'gzip' } = req.body;
    
    if (!compressedData) {
      return res.status(400).json({
        success: false,
        error: 'Compressed data is required for decompression'
      });
    }
    
    const result = await compressionService.decompressTradeData(compressedData, algorithm);
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    res.json({
      success: true,
      message: 'Data decompressed successfully',
      data: result
    });
  })
);

/**
 * POST /compress/analyze
 * Analyze compression efficiency for trade data
 */
router.post(
  '/compress/analyze',
  handleErrors(async (req, res) => {
    const { data } = req.body;
    
    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Data is required for compression analysis'
      });
    }
    
    const result = await compressionService.analyzeCompressionEfficiency(data);
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    res.json({
      success: true,
      message: 'Compression analysis completed',
      data: result
    });
  })
);

/**
 * POST /compress/verify
 * Verify data integrity after compression/decompression
 */
router.post(
  '/compress/verify',
  handleErrors(async (req, res) => {
    const { originalData, compressedData, algorithm = 'gzip' } = req.body;
    
    if (!originalData || !compressedData) {
      return res.status(400).json({
        success: false,
        error: 'Both original data and compressed data are required for verification'
      });
    }
    
    const result = await compressionService.verifyDataIntegrity(
      originalData, 
      compressedData, 
      algorithm
    );
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    res.json({
      success: true,
      message: 'Data integrity verification completed',
      data: result
    });
  })
);

/**
 * GET /compress/analytics
 * Get compression analytics
 */
router.get(
  '/compress/analytics',
  handleErrors(async (req, res) => {
    // In a real implementation, you would retrieve compression history from storage
    // For now, we'll return analytics based on empty history or mock data
    const compressionHistory = []; // This would come from your database/storage
    
    const result = compressionService.getCompressionAnalytics(compressionHistory);
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    res.json({
      success: true,
      message: 'Compression analytics retrieved',
      data: result.analytics
    });
  })
);

/**
 * POST /compress/trade
 * Compress specific trade data from database
 */
router.post(
  '/compress/trade',
  handleErrors(async (req, res) => {
    const { tradeId, algorithm = 'gzip' } = req.body;
    
    if (!tradeId) {
      return res.status(400).json({
        success: false,
        error: 'Trade ID is required'
      });
    }
    
    try {
      // Fetch trade data from database
      const trade = await Trade.findById(tradeId);
      if (!trade) {
        return res.status(404).json({
          success: false,
          error: 'Trade not found'
        });
      }
      
      // Compress the trade data
      const result = await compressionService.compressTradeData(trade, algorithm);
      
      if (!result.success) {
        return res.status(500).json(result);
      }
      
      res.json({
        success: true,
        message: 'Trade data compressed successfully',
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `Failed to compress trade data: ${error.message}`
      });
    }
  })
);

module.exports = router;