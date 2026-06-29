const express = require('express');
const rollbackService = require('../services/rollbackService');

const router = express.Router();

router.post('/request', async (req, res) => {
  try {
    const { marketId, operationType, reason, initiatedBy, snapshotBlock } = req.body;
    const result = await rollbackService.requestRollback({
      marketId,
      operationType,
      reason,
      initiatedBy,
      snapshotBlock,
    });
    if (result.rejected) {
      return res.status(422).json({ success: false, data: result });
    }
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/execute/:rollbackId', async (req, res) => {
  try {
    const result = await rollbackService.executeRollback(req.params.rollbackId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/status/:rollbackId', async (req, res) => {
  try {
    let status = rollbackService.getStatus(req.params.rollbackId);
    if (!status) {
      status = await rollbackService.getStatusFromDb(req.params.rollbackId);
    }
    if (!status) {
      return res.status(404).json({ success: false, error: 'Rollback not found' });
    }
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const { marketId, limit } = req.query;
    const history = await rollbackService.getHistory({
      marketId,
      limit: limit ? parseInt(limit, 10) : 50,
    });
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/validate', async (req, res) => {
  try {
    const result = await rollbackService.validateConditions(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
