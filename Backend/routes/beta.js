/**
 * @file routes/beta.js
 * @description Beta access management route handler for GateDelay.
 *
 * Provides Express router middleware for:
 *   - GET  /features              — List available beta features
 *   - GET  /users                  — List beta users (optional ?status=, ?limit=)
 *   - POST /users                  — Add a user to the beta list
 *   - DELETE /users/:walletAddress — Remove a user from the beta list
 *   - POST /invite/accept          — Accept a beta invitation
 *   - GET  /access/:walletAddress  — Check beta access for a wallet
 *   - POST /activity               — Track a beta activity event
 *   - GET  /activity/:walletAddress — Get activity log for a wallet
 *
 * ## Path Alias
 *
 * This file bridges the legacy Express server (`backend/server.js`) and the
 * NestJS backend (`Backend/src/`).  The beta access service lives at
 * `backend/services/betaAccess.js`, reached via a relative cross-directory
 * require (`../../backend/services/betaAccess`).
 *
 * ## Environment Variables
 *
 *   BETA_INVITE_SECRET  — HMAC secret for invite token hashing
 *                          (default: 'gatedelay-beta-secret')
 *   MONGODB_URI          — MongoDB connection string for beta data
 *                          (default: mongodb://127.0.0.1:27017/gatedelay)
 *
 * ## Usage (mount in an Express app)
 *
 *   const betaRoutes = require('./routes/beta');
 *   app.use('/api/beta', betaRoutes);
 *
 * ## Related Files
 *
 *   - backend/services/betaAccess.js  — Service layer (beta user CRUD, invites)
 *   - backend/server.js               — Legacy Express server mounting this route
 */

const MODULE_NAME = 'beta.js';

// ----- Boot-time dependency check -------------------------------------------
let express;
try {
  express = require('express');
} catch (err) {
  console.error(
    `[${MODULE_NAME}] FATAL: Failed to require 'express'. ` +
    `Is it installed? Run: npm install express`
  );
  throw err;
}

let betaAccess;
try {
  betaAccess = require('../../backend/services/betaAccess');
} catch (err) {
  console.error(
    `[${MODULE_NAME}] FATAL: Failed to require betaAccess service. ` +
    `Expected at ../../backend/services/betaAccess. ` +
    `Check that backend/services/betaAccess.js exists.`
  );
  throw err;
}

const router = express.Router();

// ----- Startup logging ------------------------------------------------------
console.log(`[${MODULE_NAME}] Initializing beta access route handler...`);
console.log(`[${MODULE_NAME}] Routes: GET /features, GET /users, POST /users, DELETE /users/:walletAddress, POST /invite/accept, GET /access/:walletAddress, POST /activity, GET /activity/:walletAddress`);
console.log(`[${MODULE_NAME}] Boot check passed — module loaded successfully`);

// GET /features — List available beta features
router.get('/features', (_req, res) => {
  res.json({ success: true, data: betaAccess.getAvailableFeatures() });
});

// GET /users — List beta users
router.get('/users', async (req, res) => {
  try {
    const { status, limit } = req.query;
    const users = await betaAccess.getBetaList({ status, limit: limit ? parseInt(limit, 10) : 100 });
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /users — Add a user to the beta list
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

// DELETE /users/:walletAddress — Remove a user from the beta list
router.delete('/users/:walletAddress', async (req, res) => {
  try {
    const user = await betaAccess.removeFromBetaList(req.params.walletAddress);
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

// POST /invite/accept — Accept a beta invitation
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

// GET /access/:walletAddress — Check beta access
router.get('/access/:walletAddress', async (req, res) => {
  try {
    const { feature } = req.query;
    const result = await betaAccess.checkAccess(req.params.walletAddress, feature);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /activity — Track a beta activity event
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

// GET /activity/:walletAddress — Get activity log
router.get('/activity/:walletAddress', async (req, res) => {
  try {
    const activity = await betaAccess.getUserActivity(req.params.walletAddress);
    res.json({ success: true, data: activity });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

module.exports = router;
