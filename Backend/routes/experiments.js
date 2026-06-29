const express = require('express');
const router = express.Router();
const abTestingService = require('../services/abTesting');

module.exports = (auth) => {
  router.post('/', auth.middleware, async (req, res) => {
    try {
      const experiment = await abTestingService.createExperiment(req.body);
      res.status(201).json(experiment);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/', auth.middleware, async (req, res) => {
    try {
      const { status } = req.query;
      const experiments = await abTestingService.getAllExperiments(status);
      res.json({ experiments });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/:id', auth.middleware, async (req, res) => {
    try {
      const experiment = await abTestingService.getExperiment(req.params.id);
      if (!experiment) {
        return res.status(404).json({ error: 'Experiment not found' });
      }
      res.json(experiment);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.put('/:id', auth.middleware, async (req, res) => {
    try {
      const experiment = await abTestingService.updateExperiment(req.params.id, req.body);
      res.json(experiment);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.delete('/:id', auth.middleware, async (req, res) => {
    try {
      await abTestingService.deleteExperiment(req.params.id);
      res.json({ message: 'Experiment deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/:id/start', auth.middleware, async (req, res) => {
    try {
      const experiment = await abTestingService.startExperiment(req.params.id);
      res.json(experiment);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/:id/pause', auth.middleware, async (req, res) => {
    try {
      const experiment = await abTestingService.pauseExperiment(req.params.id);
      res.json(experiment);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/:id/complete', auth.middleware, async (req, res) => {
    try {
      const experiment = await abTestingService.completeExperiment(req.params.id);
      res.json(experiment);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/:id/assign', async (req, res) => {
    try {
      const user = req.user || { id: req.body.userId || req.ip, ip: req.ip };
      const assignment = await abTestingService.assignUser(req.params.id, user);
      if (!assignment) {
        return res.json({ assigned: false, reason: 'User does not match targeting criteria' });
      }
      res.json({ assigned: true, variant: assignment.variant });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/:id/metrics', async (req, res) => {
    try {
      const { userId, metricName, metricValue } = req.body;
      const metric = await abTestingService.trackMetric(req.params.id, userId, metricName, metricValue);
      res.status(201).json(metric);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/:id/results', auth.middleware, async (req, res) => {
    try {
      const results = await abTestingService.getExperimentResults(req.params.id);
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/user/:userId/assignments', auth.middleware, async (req, res) => {
    try {
      const assignments = await abTestingService.getUserAssignments(req.params.userId);
      res.json({ assignments });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
