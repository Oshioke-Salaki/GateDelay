const express = require('express');
const router = express.Router();
const featureFlagService = require('../services/featureFlagService');

module.exports = (auth) => {
  router.get('/', auth.middleware, async (req, res) => {
    try {
      const flags = featureFlagService.getAllFlags();
      res.json({ flags });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/', auth.middleware, async (req, res) => {
    try {
      const { key, name, description, enabled, rolloutPercentage, segments } = req.body;
      const flag = await featureFlagService.createFlag(key, {
        name,
        description,
        enabled,
        rolloutPercentage,
        segments
      });
      res.status(201).json(flag);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/:key', auth.middleware, async (req, res) => {
    try {
      const flag = featureFlagService.getFlag(req.params.key);
      if (!flag) {
        return res.status(404).json({ error: 'Flag not found' });
      }
      res.json(flag);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.put('/:key', auth.middleware, async (req, res) => {
    try {
      const flag = await featureFlagService.updateFlag(req.params.key, req.body);
      res.json(flag);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.delete('/:key', auth.middleware, async (req, res) => {
    try {
      const deleted = await featureFlagService.deleteFlag(req.params.key);
      if (!deleted) {
        return res.status(404).json({ error: 'Flag not found' });
      }
      res.json({ message: 'Flag deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/:key/toggle', auth.middleware, async (req, res) => {
    try {
      const { enabled } = req.body;
      const flag = await featureFlagService.toggleFlag(req.params.key, enabled);
      res.json(flag);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.put('/:key/rollout', auth.middleware, async (req, res) => {
    try {
      const { percentage } = req.body;
      const flag = await featureFlagService.setRolloutPercentage(req.params.key, percentage);
      res.json(flag);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/:key/check', async (req, res) => {
    try {
      const user = req.user || { ip: req.ip };
      const enabled = featureFlagService.isFlagEnabled(req.params.key, user);
      await featureFlagService.trackFlagUsage(req.params.key, user);
      res.json({ key: req.params.key, enabled });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/:key/metrics', auth.middleware, async (req, res) => {
    try {
      const { timeRange } = req.query;
      const metrics = await featureFlagService.getFlagUsageMetrics(req.params.key, timeRange);
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/config/full', auth.middleware, async (req, res) => {
    try {
      const config = await featureFlagService.getConfiguration();
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.put('/config/full', auth.middleware, async (req, res) => {
    try {
      const config = await featureFlagService.updateConfiguration(req.body);
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/segments', auth.middleware, async (req, res) => {
    try {
      const { key, name, criteria } = req.body;
      featureFlagService.defineSegment(key, { name, criteria });
      res.status(201).json({ message: 'Segment created successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
