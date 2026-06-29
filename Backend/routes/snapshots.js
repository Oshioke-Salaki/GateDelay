const express = require('express');
const snapshotService = require('../services/snapshotService');

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
      code: 'SNAPSHOT_ERROR',
    });
  }
};

/**
 * GET /:pair
 * Retrieve snapshots for a pair
 */
router.get(
  '/:pair',
  handleErrors(async (req, res) => {
    const { pair } = req.params;
    const { limit, skip } = req.query;
    const data = await snapshotService.getSnapshots(
      pair,
      limit ? parseInt(limit) : 100,
      skip ? parseInt(skip) : 0
    );
    res.json({ success: true, data });
  })
);

/**
 * GET /compare
 * Compare two snapshots
 */
router.get(
  '/compare/:id1/:id2',
  handleErrors(async (req, res) => {
    const { id1, id2 } = req.params;
    const data = await snapshotService.compareSnapshots(id1, id2);
    res.json({ success: true, data });
  })
);

/**
 * POST /capture/:pair
 * Manually trigger a snapshot capture
 */
router.post(
  '/capture/:pair',
  handleErrors(async (req, res) => {
    const { pair } = req.params;
    const snapshot = await snapshotService.captureSnapshot(pair);
    res.status(201).json({ success: true, data: snapshot });
  })
);

module.exports = router;
