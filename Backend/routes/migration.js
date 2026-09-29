const express = require('express');
const migrationService = require('../services/migrationService');

const router = express.Router();

router.get('/status', (_req, res) => {
  try {
    res.json({ success: true, data: migrationService.getStatus() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/scripts', (_req, res) => {
  try {
    res.json({ success: true, data: migrationService.discoverScripts() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/progress/:id', (req, res) => {
  const progress = migrationService.getProgress(req.params.id);
  if (!progress) {
    return res.status(404).json({ success: false, error: 'Migration not found' });
  }
  res.json({ success: true, data: progress });
});

router.post('/execute', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'name is required' });
    }
    const result = await migrationService.executeMigration(name);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/execute-all', async (_req, res) => {
  try {
    const results = await migrationService.executeAll();
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/rollback/:id', async (req, res) => {
  try {
    const result = await migrationService.rollback(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/validate/:name', (req, res) => {
  try {
    const scripts = migrationService.discoverScripts();
    const script = scripts.find((s) => s.name === req.params.name);
    if (!script) {
      return res.status(404).json({ success: false, error: 'Migration not found' });
    }
    migrationService.validateIntegrity(script);
    res.json({ success: true, data: { name: script.name, valid: true, checksum: script.checksum } });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
