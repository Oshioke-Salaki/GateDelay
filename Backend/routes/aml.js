const express = require('express');
const router = express.Router();

module.exports = (amlService, auth) => {
  router.post('/screen', auth.middleware, async (req, res) => {
    try {
      const { userId, userDetails } = req.body;
      const result = await amlService.screenUser(userId, userDetails);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/flag', auth.middleware, async (req, res) => {
    try {
      const { userId, activity } = req.body;
      const flag = await amlService.flagSuspiciousActivity(userId, activity);
      res.status(201).json(flag);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/report/:userId', auth.middleware, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const report = await amlService.generateScreeningReport(
        req.params.userId,
        startDate,
        endDate
      );
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/file-report', auth.middleware, async (req, res) => {
    try {
      const { userId } = req.body;
      const filing = await amlService.submitFilings(userId);
      res.status(201).json(filing);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
