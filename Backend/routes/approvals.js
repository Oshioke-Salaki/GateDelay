/**
 * APPROVALS ROUTES
 * API endpoints for the multi-step trade approval workflow.
 *
 * Approver authorization via headers:
 *   x-approver-id: <approverId>
 *   x-approver-role: <role>
 */

const express = require('express');
const approvalService = require('../services/approvalService');

const router = express.Router();

// ─────────────────────────────────────────────────────────────── Middleware

/**
 * Wrap async route handlers and normalize errors.
 */
const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    console.error('Approvals Route Error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message,
      code: 'APPROVAL_ERROR',
    });
  }
};

/**
 * Validate required body fields.
 */
const validateRequest = (requiredFields) => (req, res, next) => {
  const missing = requiredFields.filter((f) => req.body[f] === undefined || req.body[f] === null || req.body[f] === '');
  if (missing.length > 0) {
    return res.status(400).json({
      success: false,
      error: `Missing required fields: ${missing.join(', ')}`,
      code: 'VALIDATION_ERROR',
    });
  }
  next();
};

/**
 * Require approver identity headers.
 */
const requireApprover = (req, res, next) => {
  const approverId = req.headers['x-approver-id'];
  const role = req.headers['x-approver-role'];

  if (!approverId) {
    return res.status(401).json({
      success: false,
      error: 'Missing x-approver-id header',
      code: 'UNAUTHORIZED',
    });
  }
  if (!role) {
    return res.status(403).json({
      success: false,
      error: 'Missing x-approver-role header',
      code: 'FORBIDDEN',
    });
  }

  req.approverId = approverId;
  req.approverRole = role;
  next();
};

/**
 * Require user identity header.
 */
const requireUser = (req, res, next) => {
  const userId = req.headers['x-user-id'] || req.body.userId;
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User authentication required (x-user-id header)',
      code: 'UNAUTHORIZED',
    });
  }
  req.userId = userId;
  next();
};

// ─────────────────────────────────────────────────────────────── Routes

/**
 * GET /approvals/stages
 * List all defined approval stages and their configuration.
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "stages": [ { name, label, order, requiredApprovers, timeoutMs, automated } ]
 *   }
 * }
 */
router.get(
  '/stages',
  handleErrors(async (req, res) => {
    const stages = Object.values(approvalService.APPROVAL_STAGES).sort(
      (a, b) => a.order - b.order
    );
    res.status(200).json({
      success: true,
      data: { stages },
    });
  })
);

/**
 * GET /approvals/history
 * Get approval workflow history with optional filters.
 *
 * Query params:
 *   userId (optional)
 *   status (optional) — PENDING | IN_PROGRESS | APPROVED | REJECTED | EXPIRED
 *   limit (optional)
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { "workflows": [...], "total": number }
 * }
 */
router.get(
  '/history',
  handleErrors(async (req, res) => {
    const { userId, status, limit } = req.query;
    const result = approvalService.getApprovalHistory({
      userId,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.status(200).json(result);
  })
);

/**
 * GET /approvals/notifications
 * Get pending notification queue (admin/monitoring use).
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { "notifications": [...], "total": number }
 * }
 */
router.get(
  '/notifications',
  handleErrors(async (req, res) => {
    const result = approvalService.getPendingNotifications();
    res.status(200).json(result);
  })
);

/**
 * GET /approvals/trade/:tradeId
 * Get all workflows associated with a specific trade.
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { "tradeId": string, "workflows": [...], "total": number }
 * }
 */
router.get(
  '/trade/:tradeId',
  handleErrors(async (req, res) => {
    const result = approvalService.getWorkflowsByTrade(req.params.tradeId);
    res.status(200).json(result);
  })
);

/**
 * GET /approvals/:workflowId
 * Get the full status of a specific workflow.
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { workflow object with all stages }
 * }
 */
router.get(
  '/:workflowId',
  handleErrors(async (req, res) => {
    const result = approvalService.getWorkflowStatus(req.params.workflowId);
    res.status(200).json(result);
  })
);

/**
 * POST /approvals
 * Create a new approval workflow for a trade.
 *
 * Headers:
 *   x-user-id: <string>
 *
 * Request body:
 * {
 *   "tradeId": "string",
 *   "tradeData": {
 *     "pair": "string",
 *     "amount": "string",
 *     "price": "string",
 *     "side": "Buy" | "Sell",
 *     "type": "Limit" | "Market" | "Stop-Loss"
 *   }
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { workflow object },
 *   "message": string
 * }
 */
router.post(
  '/',
  requireUser,
  validateRequest(['tradeId', 'tradeData']),
  handleErrors(async (req, res) => {
    const result = approvalService.createWorkflow({
      tradeId: req.body.tradeId,
      userId: req.userId,
      tradeData: req.body.tradeData,
    });
    res.status(201).json(result);
  })
);

/**
 * POST /approvals/:workflowId/approve
 * Submit an approval decision for the current stage.
 *
 * Headers:
 *   x-approver-id: <string>
 *   x-approver-role: <string>
 *
 * Request body:
 * {
 *   "decision": "APPROVED" | "REJECTED",
 *   "notes": "string (optional)"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "workflowId": string,
 *     "currentStage": string,
 *     "workflowStatus": string,
 *     "stageStatus": string,
 *     "decision": string,
 *     "approvalsReceived": number,
 *     "approvalsRequired": number
 *   }
 * }
 */
router.post(
  '/:workflowId/approve',
  requireApprover,
  validateRequest(['decision']),
  handleErrors(async (req, res) => {
    const result = approvalService.submitApproval({
      workflowId: req.params.workflowId,
      approverId: req.approverId,
      role: req.approverRole,
      decision: req.body.decision,
      notes: req.body.notes,
    });
    res.status(200).json(result);
  })
);

/**
 * POST /approvals/delegate
 * Delegate approval authority for a stage to another user.
 *
 * Request body:
 * {
 *   "delegatorId": "string",
 *   "delegateeId": "string",
 *   "stageName": "RISK_CHECK" | "COMPLIANCE_REVIEW" | "SENIOR_APPROVAL" | "FINAL_EXECUTION",
 *   "notes": "string (optional)"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { delegatorId, delegateeId, stageName, delegatedAt }
 * }
 */
router.post(
  '/delegate',
  validateRequest(['delegatorId', 'delegateeId', 'stageName']),
  handleErrors(async (req, res) => {
    const result = approvalService.delegateApproval({
      delegatorId: req.body.delegatorId,
      delegateeId: req.body.delegateeId,
      stageName: req.body.stageName,
      notes: req.body.notes,
    });
    res.status(200).json(result);
  })
);

/**
 * DELETE /approvals/delegate
 * Revoke a delegation.
 *
 * Request body:
 * {
 *   "delegatorId": "string",
 *   "stageName": "string"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { delegatorId, stageName, revoked: boolean }
 * }
 */
router.delete(
  '/delegate',
  validateRequest(['delegatorId', 'stageName']),
  handleErrors(async (req, res) => {
    const result = approvalService.revokeDelegation(
      req.body.delegatorId,
      req.body.stageName
    );
    res.status(200).json(result);
  })
);

module.exports = router;
