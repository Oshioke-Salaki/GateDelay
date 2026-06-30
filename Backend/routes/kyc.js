const express = require('express');
const router = express.Router();

module.exports = (kycService, auth) => {
  router.post('/upload', auth.middleware, kycService.upload.single('document'), async (req, res) => {
    try {
      const { docType } = req.body;
      const result = await kycService.uploadDocument(req.user.id, docType, req.file);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/verify', auth.middleware, async (req, res) => {
    try {
      const { docTypes, provider } = req.body;
      const result = await kycService.createVerificationRequest(req.user.id, docTypes, provider);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/status/:requestId', auth.middleware, async (req, res) => {
    try {
      const status = await kycService.trackVerificationStatus(req.params.requestId);
      res.json(status);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  });

  router.get('/report', auth.middleware, async (req, res) => {
    try {
      const report = await kycService.generateVerificationReport(req.user.id);
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/providers', async (req, res) => {
    try {
      const providers = await kycService.supportedProviders();
      res.json({ providers });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
