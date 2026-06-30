const express = require('express');
const router = express.Router();

module.exports = (blacklistService, auth) => {
  router.post('/add', auth.middleware, async (req, res) => {
    try {
      const { identifier, reason, expiryDays } = req.body;
      const result = await blacklistService.addToBlacklist(identifier, reason, expiryDays);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/remove', auth.middleware, async (req, res) => {
    try {
      const { identifier } = req.body;
      const result = await blacklistService.removeFromBlacklist(identifier);
      res.json(result);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  });

  router.get('/check/:identifier', async (req, res) => {
    try {
      const result = await blacklistService.isBlacklisted(req.params.identifier);
      res.json({ blacklisted: !!result, entry: result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/batch-add', auth.middleware, async (req, res) => {
    try {
      const { identifiers, reason } = req.body;
      const results = await blacklistService.batchAddToBlacklist(identifiers, reason);
      res.status(201).json(results);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/batch-remove', auth.middleware, async (req, res) => {
    try {
      const { identifiers } = req.body;
      const results = await blacklistService.batchRemoveFromBlacklist(identifiers);
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/count', auth.middleware, async (req, res) => {
    try {
      const count = await blacklistService.getBlacklistCount();
      res.json({ count });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/report', auth.middleware, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const report = await blacklistService.generateReport(
        new Date(startDate),
        new Date(endDate)
      );
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
