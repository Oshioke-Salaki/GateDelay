const express = require('express');
const betaAccess = require('../services/betaAccess');

const router = express.Router();

router.get('/features', (_req, res) => {
  res.json({ success: true, data: betaAccess.getAvailableFeatures() });
});

router.get('/users', async (req, res) => {
  try {
    const { status, limit } = req.query;
    const users = await betaAccess.getBetaList({ status, limit: limit ? parseInt(limit, 10) : 100 });
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/users', async (req, res) => {
  try {
    const { walletAddress, email, features, invitedBy } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ success: false, error: 'walletAddress is required' });
    }
    const result = await betaAccess.addToBetaList({ walletAddress, email, features, invitedBy });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.delete('/users/:walletAddress', async (req, res) => {
  try {
    const user = await betaAccess.removeFromBetaList(req.params.walletAddress);
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

router.post('/invite/accept', async (req, res) => {
  try {
    const { token, walletAddress } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'token is required' });
    }
    const user = await betaAccess.acceptInvitation(token, walletAddress);
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/access/:walletAddress', async (req, res) => {
  try {
    const { feature } = req.query;
    const result = await betaAccess.checkAccess(req.params.walletAddress, feature);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/activity', async (req, res) => {
  try {
    const { walletAddress, action, feature, metadata } = req.body;
    if (!walletAddress || !action) {
      return res.status(400).json({ success: false, error: 'walletAddress and action are required' });
    }
    const user = await betaAccess.trackActivity(walletAddress, { action, feature, metadata });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/activity/:walletAddress', async (req, res) => {
  try {
    const activity = await betaAccess.getUserActivity(req.params.walletAddress);
    res.json({ success: true, data: activity });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

module.exports = router;
