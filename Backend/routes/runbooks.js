const express = require('express');
const router = express.Router();
const runbookService = require('../services/runbookService');

router.post('/', (req, res) => {
  try {
    const runbook = runbookService.createRunbook(req.body);
    res.status(201).json({ success: true, runbook });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/', (req, res) => {
  res.json({ success: true, runbooks: runbookService.getRunbooks() });
});

router.get('/search', (req, res) => {
  const results = runbookService.searchRunbooks(req.query.q || '');
  res.json({ success: true, results });
});

router.get('/:id', (req, res) => {
  const runbook = runbookService.getRunbookById(req.params.id);
  if (!runbook) {
    return res.status(404).json({ success: false, error: 'Runbook not found' });
  }
  res.json({ success: true, runbook });
});

router.put('/:id', (req, res) => {
  try {
    const runbook = runbookService.updateRunbook(req.params.id, req.body);
    res.json({ success: true, runbook });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const result = runbookService.deleteRunbook(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/execute', (req, res) => {
  try {
    const execution = runbookService.executeRunbook(req.params.id, req.body.executor);
    res.status(201).json({ success: true, execution });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/executions/:id/complete', (req, res) => {
  try {
    const execution = runbookService.completeExecution(req.params.id);
    res.json({ success: true, execution });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/executions', (req, res) => {
  res.json({ success: true, executions: runbookService.getExecutions() });
});

router.get('/analytics', (req, res) => {
  res.json({ success: true, analytics: runbookService.getRunbookAnalytics() });
});

module.exports = router;
