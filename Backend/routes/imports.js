const express = require('express');
const importService = require('../services/importService');

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
      code: 'IMPORT_ERROR',
    });
  }
};

/**
 * POST /import
 * Import market data (CSV or JSON)
 */
router.post(
  '/',
  handleErrors(async (req, res) => {
    const { format = 'csv', updateExisting = true, skipDuplicates = false } = req.body;
    let data = req.body.data;
    
    // Handle file upload if present
    if (req.file) {
      // For file uploads, you would use multer middleware
      // This is a simplified version expecting data in body
      data = req.file.buffer.toString();
    }
    
    // Validate the import data
    const validation = importService.validateImportData(data, format);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
        details: validation.details
      });
    }
    
    // Process the bulk import
    const result = await importService.processBulkImport(validation.data, {
      updateExisting,
      skipDuplicates
    });
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    res.json({
      success: true,
      message: 'Import completed successfully',
      data: result.results
    });
  })
);

/**
 * POST /import/conflicts
 * Handle import conflicts with specific strategy
 */
router.post(
  '/conflicts',
  handleErrors(async (req, res) => {
    const { data, conflictResolution = 'overwrite' } = req.body;
    
    // Validate the import data first
    const validation = importService.validateImportData(data, 'json'); // Assuming JSON for conflict resolution
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }
    
    // Handle conflicts
    const result = await importService.handleImportConflicts(validation.data, conflictResolution);
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    res.json({
      success: true,
      message: 'Conflict resolution completed',
      data: result.results
    });
  })
);

/**
 * GET /import/progress/:importId
 * Get import progress tracking
 */
router.get(
  '/progress/:importId',
  handleErrors(async (req, res) => {
    const { importId } = req.params;
    
    // In a real implementation, you would retrieve progress from storage
    // For now, we'll return a placeholder
    res.json({
      success: true,
      data: {
        importId,
        status: 'completed', // or 'in_progress', 'failed', etc.
        progress: 100,
        message: 'Import completed'
      }
    });
  })
);

/**
 * POST /import/incremental
 * Process incremental imports
 */
router.post(
  '/incremental',
  handleErrors(async (req, res) => {
    const { data, lastImportTime } = req.body;
    
    if (!lastImportTime) {
      return res.status(400).json({
        success: false,
        error: 'lastImportTime is required for incremental imports'
      });
    }
    
    // Validate the import data
    const validation = importService.validateImportData(data, 'json');
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }
    
    // Process incremental import
    const result = await importService.processIncrementalImport(
      validation.data,
      new Date(lastImportTime)
    );
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    res.json({
      success: true,
      message: 'Incremental import completed',
      data: result.results
    });
  })
);

module.exports = router;