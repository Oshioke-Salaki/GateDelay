/**
 * APPROVAL SERVICE
 * Multi-step approval workflow for trade execution.
 * Manages approval stages, status tracking, approver notifications,
 * delegation, and history.
 *
 * Dependencies: mongoose, node-cron
 */

const mongoose = require('mongoose');
const cron = require('node-cron');

// ─────────────────────────────────────────────────────────────── Constants

const APPROVAL_STAGES = {
  RISK_CHECK: {
    order: 1,
    name: 'RISK_CHECK',
    label: 'Risk Assessment',
    description: 'Automated risk scoring and threshold validation',
    requiredApprovers: 1,
    timeoutMs: 30_000, // 30 seconds — automated
    automated: true,
  },
  COMPLIANCE_REVIEW: {
    order: 2,
    name: 'COMPLIANCE_REVIEW',
    label: 'Compliance Review',
    description: 'Compliance officer review for large or flagged trades',
    requiredApprovers: 1,
    timeoutMs: 3_600_000, // 1 hour
    automated: false,
  },
  SENIOR_APPROVAL: {
    order: 3,
    name: 'SENIOR_APPROVAL',
    label: 'Senior Approval',
    description: 'Senior trader or manager sign-off for high-value trades',
    requiredApprovers: 2,
    timeoutMs: 7_200_000, // 2 hours
    automated: false,
  },
  FINAL_EXECUTION: {
    order: 4,
    name: 'FINAL_EXECUTION',
    label: 'Final Execution',
    description: 'Final gate before trade is submitted to the matching engine',
    requiredApprovers: 1,
    timeoutMs: 300_000, // 5 minutes
    automated: true,
  },
};

const APPROVAL_STATUSES = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  DELEGATED: 'DELEGATED',
};

const WORKFLOW_STATUSES = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
};

// Roles that can approve at each stage
const STAGE_APPROVER_ROLES = {
  RISK_CHECK: ['SYSTEM', 'RISK_MANAGER'],
  COMPLIANCE_REVIEW: ['COMPLIANCE_OFFICER', 'SUPER_ADMIN'],
  SENIOR_APPROVAL: ['SENIOR_TRADER', 'TRADING_MANAGER', 'SUPER_ADMIN'],
  FINAL_EXECUTION: ['SYSTEM', 'TRADING_MANAGER', 'SUPER_ADMIN'],
};

// ─────────────────────────────────────────────────────────────── State

/**
 * In-memory workflow store.
 * Key: workflowId, Value: workflow object
 * In production: persist to MongoDB.
 */
const workflows = new Map();

/**
 * Delegation registry.
 * Key: `${delegatorId}:${stageName}`, Value: delegateeId
 */
const delegations = new Map();

/**
 * Notification queue (in production: integrate with email/push service).
 */
const notificationQueue = [];

// ─────────────────────────────────────────────────────────────── Helpers

/**
 * Generate a unique workflow ID.
 * @returns {string}
 */
function generateWorkflowId() {
  return `WF_${Date.now()}_${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
}

/**
 * Determine which approval stages are required for a given trade.
 * Stages are always executed in order (by `order` field).
 *
 * @param {object} tradeData
 * @returns {string[]} Ordered list of stage names
 */
function determineRequiredStages(tradeData) {
  const stages = [APPROVAL_STAGES.RISK_CHECK.name]; // Always required

  // Large trades require compliance review
  const amount = parseFloat(tradeData.amount || '0');
  const price = parseFloat(tradeData.price || '0');
  const notional = amount * price;

  if (notional >= 10_000) {
    stages.push(APPROVAL_STAGES.COMPLIANCE_REVIEW.name);
  }

  // Very large trades also require senior approval
  if (notional >= 100_000) {
    stages.push(APPROVAL_STAGES.SENIOR_APPROVAL.name);
  }

  stages.push(APPROVAL_STAGES.FINAL_EXECUTION.name); // Always required
  return stages;
}

/**
 * Build the initial stage records for a workflow.
 * @param {string[]} stageNames
 * @returns {object[]}
 */
function buildStageRecords(stageNames) {
  return stageNames.map((name) => {
    const config = APPROVAL_STAGES[name];
    return {
      name,
      label: config.label,
      order: config.order,
      status: APPROVAL_STATUSES.PENDING,
      requiredApprovers: config.requiredApprovers,
      approvals: [],
      rejections: [],
      startedAt: null,
      completedAt: null,
      expiresAt: null,
      automated: config.automated,
    };
  });
}

/**
 * Resolve the effective approver (accounting for delegation).
 * @param {string} approverId
 * @param {string} stageName
 * @returns {string} Effective approver ID
 */
function resolveApprover(approverId, stageName) {
  const delegationKey = `${approverId}:${stageName}`;
  return delegations.get(delegationKey) || approverId;
}

/**
 * Validate that an approver has the right role for a stage.
 * @param {string} role
 * @param {string} stageName
 * @throws {Error}
 */
function validateApproverRole(role, stageName) {
  const allowed = STAGE_APPROVER_ROLES[stageName] || [];
  if (!allowed.includes(role)) {
    throw new Error(
      `Role "${role}" cannot approve stage "${stageName}". Allowed: ${allowed.join(', ')}`
    );
  }
}

/**
 * Queue a notification (stub — wire to email/push in production).
 * @param {string} type
 * @param {object} payload
 */
function queueNotification(type, payload) {
  const notification = {
    id: `NOTIF_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    type,
    payload,
    queuedAt: new Date().toISOString(),
    sent: false,
  };
  notificationQueue.push(notification);
  console.log(`[APPROVAL] Notification queued: ${type} | workflow=${payload.workflowId}`);
  return notification;
}

/**
 * Advance a workflow to the next pending stage.
 * @param {object} workflow
 */
function advanceWorkflow(workflow) {
  const nextStage = workflow.stages.find(
    (s) => s.status === APPROVAL_STATUSES.PENDING
  );

  if (!nextStage) {
    // All stages complete — workflow approved
    workflow.status = WORKFLOW_STATUSES.APPROVED;
    workflow.completedAt = new Date().toISOString();
    queueNotification('WORKFLOW_APPROVED', {
      workflowId: workflow.id,
      tradeId: workflow.tradeId,
      userId: workflow.userId,
    });
    return;
  }

  // Activate next stage
  nextStage.status = APPROVAL_STATUSES.IN_PROGRESS;
  nextStage.startedAt = new Date().toISOString();
  nextStage.expiresAt = new Date(
    Date.now() + APPROVAL_STAGES[nextStage.name].timeoutMs
  ).toISOString();

  workflow.currentStage = nextStage.name;
  workflow.status = WORKFLOW_STATUSES.IN_PROGRESS;

  queueNotification('STAGE_STARTED', {
    workflowId: workflow.id,
    tradeId: workflow.tradeId,
    userId: workflow.userId,
    stage: nextStage.name,
    expiresAt: nextStage.expiresAt,
  });

  // Auto-process automated stages
  if (nextStage.automated) {
    setImmediate(() => processAutomatedStage(workflow.id, nextStage.name));
  }
}

/**
 * Simulate automated stage processing (risk check, final execution gate).
 * In production: call actual risk engine / execution service.
 * @param {string} workflowId
 * @param {string} stageName
 */
async function processAutomatedStage(workflowId, stageName) {
  const workflow = workflows.get(workflowId);
  if (!workflow) return;

  const stage = workflow.stages.find((s) => s.name === stageName);
  if (!stage || stage.status !== APPROVAL_STATUSES.IN_PROGRESS) return;

  try {
    // Simulate automated check (replace with real logic)
    const passed = await runAutomatedCheck(stageName, workflow.tradeData);

    if (passed) {
      stage.approvals.push({
        approverId: 'SYSTEM',
        role: 'SYSTEM',
        decision: 'APPROVED',
        notes: `Automated ${stageName} passed`,
        timestamp: new Date().toISOString(),
      });
      stage.status = APPROVAL_STATUSES.APPROVED;
      stage.completedAt = new Date().toISOString();
      advanceWorkflow(workflow);
    } else {
      stage.rejections.push({
        approverId: 'SYSTEM',
        role: 'SYSTEM',
        decision: 'REJECTED',
        notes: `Automated ${stageName} failed`,
        timestamp: new Date().toISOString(),
      });
      stage.status = APPROVAL_STATUSES.REJECTED;
      stage.completedAt = new Date().toISOString();
      workflow.status = WORKFLOW_STATUSES.REJECTED;
      workflow.completedAt = new Date().toISOString();
      queueNotification('WORKFLOW_REJECTED', {
        workflowId: workflow.id,
        tradeId: workflow.tradeId,
        stage: stageName,
        reason: `Automated ${stageName} failed`,
      });
    }
  } catch (err) {
    console.error(`[APPROVAL] Automated stage ${stageName} error:`, err.message);
  }
}

/**
 * Stub for automated checks. Replace with real risk engine calls.
 * @param {string} stageName
 * @param {object} tradeData
 * @returns {Promise<boolean>}
 */
async function runAutomatedCheck(stageName, tradeData) {
  if (stageName === APPROVAL_STAGES.RISK_CHECK.name) {
    // Example: reject if amount is suspiciously large
    const amount = parseFloat(tradeData.amount || '0');
    return amount < 1_000_000;
  }
  if (stageName === APPROVAL_STAGES.FINAL_EXECUTION.name) {
    return true; // Final gate always passes in this stub
  }
  return true;
}

// ─────────────────────────────────────────────────────────────── Core Operations

/**
 * Create a new approval workflow for a trade.
 *
 * @param {object} params
 * @param {string} params.tradeId - Trade/order ID requiring approval
 * @param {string} params.userId - User who submitted the trade
 * @param {object} params.tradeData - Trade details (pair, amount, price, side, type)
 * @returns {object} Created workflow
 */
function createWorkflow({ tradeId, userId, tradeData }) {
  if (!tradeId || typeof tradeId !== 'string') {
    throw new Error('tradeId is required');
  }
  if (!userId || typeof userId !== 'string') {
    throw new Error('userId is required');
  }
  if (!tradeData || typeof tradeData !== 'object') {
    throw new Error('tradeData is required');
  }

  // Prevent duplicate workflows for the same trade
  const existing = [...workflows.values()].find(
    (w) =>
      w.tradeId === tradeId &&
      ![WORKFLOW_STATUSES.APPROVED, WORKFLOW_STATUSES.REJECTED, WORKFLOW_STATUSES.EXPIRED].includes(
        w.status
      )
  );
  if (existing) {
    throw new Error(
      `Active approval workflow already exists for trade ${tradeId}: ${existing.id}`
    );
  }

  const workflowId = generateWorkflowId();
  const requiredStages = determineRequiredStages(tradeData);
  const stages = buildStageRecords(requiredStages);

  const workflow = {
    id: workflowId,
    tradeId,
    userId,
    tradeData,
    status: WORKFLOW_STATUSES.PENDING,
    currentStage: null,
    stages,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
  };

  workflows.set(workflowId, workflow);

  queueNotification('WORKFLOW_CREATED', {
    workflowId,
    tradeId,
    userId,
    stages: requiredStages,
  });

  // Kick off the first stage
  advanceWorkflow(workflow);

  return {
    success: true,
    data: workflow,
    message: `Approval workflow ${workflowId} created with ${stages.length} stages.`,
  };
}

/**
 * Submit an approval decision for the current stage of a workflow.
 *
 * @param {object} params
 * @param {string} params.workflowId
 * @param {string} params.approverId
 * @param {string} params.role
 * @param {string} params.decision - 'APPROVED' | 'REJECTED'
 * @param {string} [params.notes]
 * @returns {object}
 */
function submitApproval({ workflowId, approverId, role, decision, notes }) {
  const workflow = workflows.get(workflowId);
  if (!workflow) {
    throw new Error(`Workflow ${workflowId} not found`);
  }

  if (workflow.status === WORKFLOW_STATUSES.APPROVED) {
    throw new Error('Workflow is already fully approved');
  }
  if (workflow.status === WORKFLOW_STATUSES.REJECTED) {
    throw new Error('Workflow has been rejected and cannot be modified');
  }
  if (workflow.status === WORKFLOW_STATUSES.EXPIRED) {
    throw new Error('Workflow has expired');
  }

  const currentStage = workflow.stages.find(
    (s) => s.name === workflow.currentStage
  );
  if (!currentStage || currentStage.status !== APPROVAL_STATUSES.IN_PROGRESS) {
    throw new Error('No active stage awaiting approval');
  }

  if (currentStage.automated) {
    throw new Error(`Stage "${currentStage.name}" is automated and cannot be manually approved`);
  }

  // Resolve delegation
  const effectiveApproverId = resolveApprover(approverId, currentStage.name);
  validateApproverRole(role, currentStage.name);

  // Prevent duplicate approvals from the same approver
  const alreadyApproved = currentStage.approvals.some(
    (a) => a.approverId === effectiveApproverId
  );
  if (alreadyApproved) {
    throw new Error(`Approver ${effectiveApproverId} has already submitted a decision for this stage`);
  }

  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    throw new Error('Decision must be "APPROVED" or "REJECTED"');
  }

  const decisionRecord = {
    approverId: effectiveApproverId,
    originalApproverId: effectiveApproverId !== approverId ? approverId : undefined,
    role,
    decision,
    notes: notes || null,
    timestamp: new Date().toISOString(),
  };

  if (decision === 'APPROVED') {
    currentStage.approvals.push(decisionRecord);

    // Check if enough approvers have approved
    if (currentStage.approvals.length >= currentStage.requiredApprovers) {
      currentStage.status = APPROVAL_STATUSES.APPROVED;
      currentStage.completedAt = new Date().toISOString();
      workflow.updatedAt = new Date().toISOString();

      queueNotification('STAGE_APPROVED', {
        workflowId,
        tradeId: workflow.tradeId,
        stage: currentStage.name,
        approvedBy: effectiveApproverId,
      });

      advanceWorkflow(workflow);
    }
  } else {
    // Any rejection immediately fails the stage and workflow
    currentStage.rejections.push(decisionRecord);
    currentStage.status = APPROVAL_STATUSES.REJECTED;
    currentStage.completedAt = new Date().toISOString();
    workflow.status = WORKFLOW_STATUSES.REJECTED;
    workflow.completedAt = new Date().toISOString();
    workflow.updatedAt = new Date().toISOString();

    queueNotification('WORKFLOW_REJECTED', {
      workflowId,
      tradeId: workflow.tradeId,
      stage: currentStage.name,
      rejectedBy: effectiveApproverId,
      reason: notes || 'No reason provided',
    });
  }

  return {
    success: true,
    data: {
      workflowId,
      currentStage: workflow.currentStage,
      workflowStatus: workflow.status,
      stageStatus: currentStage.status,
      decision,
      approvalsReceived: currentStage.approvals.length,
      approvalsRequired: currentStage.requiredApprovers,
    },
    message: `Decision "${decision}" recorded for stage "${currentStage.name}".`,
  };
}

/**
 * Delegate approval authority for a stage to another user.
 *
 * @param {object} params
 * @param {string} params.delegatorId - Who is delegating
 * @param {string} params.delegateeId - Who receives the delegation
 * @param {string} params.stageName - Which stage to delegate
 * @param {string} [params.notes]
 * @returns {object}
 */
function delegateApproval({ delegatorId, delegateeId, stageName, notes }) {
  if (!delegatorId || !delegateeId) {
    throw new Error('delegatorId and delegateeId are required');
  }
  if (!stageName || !APPROVAL_STAGES[stageName]) {
    throw new Error(
      `Invalid stageName. Must be one of: ${Object.keys(APPROVAL_STAGES).join(', ')}`
    );
  }
  if (delegatorId === delegateeId) {
    throw new Error('Cannot delegate to yourself');
  }

  const key = `${delegatorId}:${stageName}`;
  delegations.set(key, delegateeId);

  queueNotification('APPROVAL_DELEGATED', {
    delegatorId,
    delegateeId,
    stageName,
    notes: notes || null,
  });

  return {
    success: true,
    data: {
      delegatorId,
      delegateeId,
      stageName,
      notes: notes || null,
      delegatedAt: new Date().toISOString(),
    },
    message: `Approval for stage "${stageName}" delegated from ${delegatorId} to ${delegateeId}.`,
  };
}

/**
 * Revoke a delegation.
 * @param {string} delegatorId
 * @param {string} stageName
 * @returns {object}
 */
function revokeDelegation(delegatorId, stageName) {
  const key = `${delegatorId}:${stageName}`;
  const existed = delegations.has(key);
  delegations.delete(key);

  return {
    success: true,
    data: { delegatorId, stageName, revoked: existed },
    message: existed
      ? `Delegation for stage "${stageName}" revoked.`
      : `No active delegation found for stage "${stageName}".`,
  };
}

/**
 * Get the full status of a workflow.
 * @param {string} workflowId
 * @returns {object}
 */
function getWorkflowStatus(workflowId) {
  const workflow = workflows.get(workflowId);
  if (!workflow) {
    throw new Error(`Workflow ${workflowId} not found`);
  }

  return {
    success: true,
    data: workflow,
  };
}

/**
 * Get all workflows for a specific trade.
 * @param {string} tradeId
 * @returns {object}
 */
function getWorkflowsByTrade(tradeId) {
  const tradeWorkflows = [...workflows.values()].filter(
    (w) => w.tradeId === tradeId
  );

  return {
    success: true,
    data: {
      tradeId,
      workflows: tradeWorkflows,
      total: tradeWorkflows.length,
    },
  };
}

/**
 * Get approval history with optional filters.
 *
 * @param {object} [filters]
 * @param {string} [filters.userId]
 * @param {string} [filters.status]
 * @param {number} [filters.limit]
 * @returns {object}
 */
function getApprovalHistory({ userId, status, limit } = {}) {
  let results = [...workflows.values()];

  if (userId) {
    results = results.filter((w) => w.userId === userId);
  }
  if (status) {
    results = results.filter((w) => w.status === status);
  }

  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (limit && limit > 0) {
    results = results.slice(0, limit);
  }

  return {
    success: true,
    data: {
      workflows: results,
      total: results.length,
    },
  };
}

/**
 * Get pending notifications (for monitoring/debugging).
 * @returns {object}
 */
function getPendingNotifications() {
  return {
    success: true,
    data: {
      notifications: notificationQueue.filter((n) => !n.sent),
      total: notificationQueue.filter((n) => !n.sent).length,
    },
  };
}

// ─────────────────────────────────────────────────────────────── Background Jobs

/**
 * Expire workflows/stages that have passed their timeout.
 * Run periodically via cron.
 */
function expireStaleWorkflows() {
  const now = Date.now();
  let expiredCount = 0;

  for (const [, workflow] of workflows) {
    if (
      [WORKFLOW_STATUSES.APPROVED, WORKFLOW_STATUSES.REJECTED, WORKFLOW_STATUSES.EXPIRED].includes(
        workflow.status
      )
    ) {
      continue;
    }

    const currentStage = workflow.stages.find(
      (s) => s.status === APPROVAL_STATUSES.IN_PROGRESS
    );

    if (currentStage && currentStage.expiresAt) {
      const expiresAt = new Date(currentStage.expiresAt).getTime();
      if (now > expiresAt) {
        currentStage.status = APPROVAL_STATUSES.EXPIRED;
        currentStage.completedAt = new Date().toISOString();
        workflow.status = WORKFLOW_STATUSES.EXPIRED;
        workflow.completedAt = new Date().toISOString();
        expiredCount++;

        queueNotification('WORKFLOW_EXPIRED', {
          workflowId: workflow.id,
          tradeId: workflow.tradeId,
          stage: currentStage.name,
        });
      }
    }
  }

  if (expiredCount > 0) {
    console.log(`[APPROVAL] Expired ${expiredCount} stale workflow(s)`);
  }
}

// Run expiry check every minute
cron.schedule('* * * * *', expireStaleWorkflows);

// ─────────────────────────────────────────────────────────────── Exports

module.exports = {
  createWorkflow,
  submitApproval,
  delegateApproval,
  revokeDelegation,
  getWorkflowStatus,
  getWorkflowsByTrade,
  getApprovalHistory,
  getPendingNotifications,
  expireStaleWorkflows,
  APPROVAL_STAGES,
  APPROVAL_STATUSES,
  WORKFLOW_STATUSES,
  STAGE_APPROVER_ROLES,
};
