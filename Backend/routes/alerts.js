const express = require('express');
const router = express.Router();
const alertRouting = require('../services/alertRouting');

router.post('/', async (req, res) => {
  try {
    const result = await alertRouting.createAlert(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/history', (_req, res) => {
  res.json({ success: true, data: alertRouting.getAlertHistory() });
});

router.get('/templates', (_req, res) => {
  res.json({ success: true, data: alertRouting.getTemplates() });
});

module.exports = router;
