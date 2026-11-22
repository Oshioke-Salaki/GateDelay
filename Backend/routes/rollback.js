const express = require('express');
const rollbackService = require('../services/rollbackService');
const { rollback: rollbackSchemas, validateRequest } = require('../dto');

const router = express.Router();

router.post(
  '/request',
  validateRequest({ body: rollbackSchemas.rollbackRequestBody }, 'rollback.request'),
  async (req, res) => {
    try {
      const { marketId, operationType, reason, initiatedBy, snapshotBlock } =
        req.validated.body;
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
  }
);

router.post(
  '/execute/:rollbackId',
  validateRequest({ params: rollbackSchemas.rollbackIdParam }, 'rollback.execute'),
  async (req, res) => {
    try {
      const result = await rollbackService.executeRollback(
        req.validated.params.rollbackId,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

router.get(
  '/status/:rollbackId',
  validateRequest({ params: rollbackSchemas.rollbackIdParam }, 'rollback.status'),
  async (req, res) => {
    try {
      const { rollbackId } = req.validated.params;
      let status = rollbackService.getStatus(rollbackId);
      if (!status) {
        status = await rollbackService.getStatusFromDb(rollbackId);
      }
      if (!status) {
        return res.status(404).json({ success: false, error: 'Rollback not found' });
      }
      res.json({ success: true, data: status });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

router.get(
  '/history',
  validateRequest({ query: rollbackSchemas.rollbackHistoryQuery }, 'rollback.history'),
  async (req, res) => {
    try {
      const { marketId, status, limit, page } = req.validated.query;
      const { history, meta } = await rollbackService.getHistory({
        marketId,
        status,
        limit,
        page,
      });
      res.json({ success: true, data: history, meta });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

router.post(
  '/validate',
  validateRequest({ body: rollbackSchemas.rollbackValidateBody }, 'rollback.validate'),
  async (req, res) => {
    try {
      const result = await rollbackService.validateConditions(req.validated.body);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
);

module.exports = router;
