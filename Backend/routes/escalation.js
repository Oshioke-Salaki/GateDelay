const express = require('express');
const router = express.Router();
const escalation = require('../services/escalation');

router.post('/policies', (req, res) => {
  try {
    const policy = escalation.createPolicy(req.body);
    res.status(201).json({ success: true, policy });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/policies', (req, res) => {
  res.json({ success: true, policies: escalation.getPolicies() });
});

router.post('/trigger', (req, res) => {
  try {
    const result = escalation.triggerEscalation(req.body.policyId, req.body.alert);
    res.status(201).json({ success: true, escalation: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/acknowledge', (req, res) => {
  try {
    const result = escalation.acknowledgeEscalation(req.params.id, req.body.acknowledger);
    res.json({ success: true, escalation: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/resolve', (req, res) => {
  try {
    const result = escalation.resolveEscalation(req.params.id);
    res.json({ success: true, escalation: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/active', (req, res) => {
  res.json({ success: true, escalations: escalation.getActiveEscalations() });
});

router.get('/analytics', (req, res) => {
  res.json({ success: true, analytics: escalation.getEscalationAnalytics() });
});

module.exports = router;
