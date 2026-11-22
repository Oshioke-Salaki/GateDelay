const express = require('express');
const restoreService = require('../services/restoreService');

const router = express.Router();

const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'RESTORE_ERROR',
    });
  }
};

router.post(
  '/',
  handleErrors(async (req, res) => {
    const result = await restoreService.requestRestore(req.body);
    const statusCode = result.status === 'invalid' ? 422 : 201;
    res.status(statusCode).json({ success: true, data: result });
  })
);

router.post(
  '/validate',
  handleErrors(async (req, res) => {
    const validation = restoreService.validateRequest(req.body);
    res.json({ success: true, data: validation });
  })
);

router.get(
  '/status/:restoreId',
  handleErrors(async (req, res) => {
    const status = restoreService.getStatus(req.params.restoreId);
    if (!status) {
      return res.status(404).json({ success: false, error: 'Restore request not found' });
    }
    res.json({ success: true, data: status });
  })
);

router.get(
  '/',
  handleErrors(async (_req, res) => {
    const history = restoreService.listStatuses();
    res.json({ success: true, data: history });
  })
);

module.exports = router;
