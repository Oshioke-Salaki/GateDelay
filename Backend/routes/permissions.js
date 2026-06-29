const express = require('express');
const permissionService = require('../services/permissionService');

const router = express.Router();

// ─── Shared Middleware ────────────────────────────────────────────────────────

const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    console.error('Permissions Route Error:', error.message);
    res.status(400).json({ success: false, error: error.message, code: 'PERMISSION_ERROR' });
  }
};

const validateRequest = (requiredFields) => (req, res, next) => {
  const missing = requiredFields.filter(f => !req.body[f] && req.body[f] !== 0);
  if (missing.length) {
    return res.status(400).json({
      success: false,
      error: `Missing required fields: ${missing.join(', ')}`,
      code: 'VALIDATION_ERROR',
    });
  }
  next();
};

/** Require ADMIN role to mutate permissions */
const requireAdmin = (req, res, next) => {
  const adminId = req.headers['x-admin-id'] || req.body.adminId;
  if (!adminId) {
    return res.status(403).json({
      success: false,
      error: 'Admin authorization required',
      code: 'FORBIDDEN',
    });
  }
  req.adminId = adminId;
  next();
};

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /permissions/:userId
 * Get full permission record for a user.
 */
router.get(
  '/:userId',
  handleErrors(async (req, res) => {
    const result = await permissionService.getUserPermissions(req.params.userId);
    res.status(200).json(result);
  })
);

/**
 * GET /permissions/:userId/check/:operation
 * Check if a user can perform a specific operation.
 * Returns { allowed: boolean, reason: string }
 */
router.get(
  '/:userId/check/:operation',
  handleErrors(async (req, res) => {
    const result = await permissionService.validatePermission(
      req.params.userId,
      req.params.operation.toUpperCase()
    );
    res.status(200).json({ success: true, data: result });
  })
);

/**
 * GET /permissions/:userId/log
 * Get permission change audit log for a user.
 */
router.get(
  '/:userId/log',
  handleErrors(async (req, res) => {
    const result = await permissionService.getPermissionChangeLog(req.params.userId);
    res.status(200).json(result);
  })
);

/**
 * PATCH /permissions/:userId/tier
 * Set a user's permission tier (admin only).
 *
 * Body: { tier: number }
 * Headers: x-admin-id
 */
router.patch(
  '/:userId/tier',
  requireAdmin,
  validateRequest(['tier']),
  handleErrors(async (req, res) => {
    const result = await permissionService.setUserTier(
      req.params.userId,
      Number(req.body.tier),
      req.adminId
    );
    res.status(200).json(result);
  })
);

/**
 * POST /permissions/:userId/grant
 * Explicitly grant an operation override (admin only).
 *
 * Body: { operation }
 * Headers: x-admin-id
 */
router.post(
  '/:userId/grant',
  requireAdmin,
  validateRequest(['operation']),
  handleErrors(async (req, res) => {
    const result = await permissionService.grantOperationOverride(
      req.params.userId,
      req.body.operation.toUpperCase(),
      req.adminId
    );
    res.status(200).json(result);
  })
);

/**
 * POST /permissions/:userId/deny
 * Explicitly deny an operation override (admin only).
 *
 * Body: { operation }
 * Headers: x-admin-id
 */
router.post(
  '/:userId/deny',
  requireAdmin,
  validateRequest(['operation']),
  handleErrors(async (req, res) => {
    const result = await permissionService.denyOperationOverride(
      req.params.userId,
      req.body.operation.toUpperCase(),
      req.adminId
    );
    res.status(200).json(result);
  })
);

/**
 * POST /permissions/delegate
 * Delegate specific operations from one user to another.
 *
 * Body: { fromUserId, toUserId, operations: string[], durationMs? }
 */
router.post(
  '/delegate',
  validateRequest(['fromUserId', 'toUserId', 'operations']),
  handleErrors(async (req, res) => {
    const result = await permissionService.delegatePermission({
      fromUserId:  req.body.fromUserId,
      toUserId:    req.body.toUserId,
      operations:  req.body.operations.map(op => op.toUpperCase()),
      durationMs:  req.body.durationMs,
    });
    res.status(201).json(result);
  })
);

module.exports = router;
