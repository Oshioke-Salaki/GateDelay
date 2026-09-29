/**
 * DEPLOY SERVICE
 * Programmatic management and tracking of backend deployments.
 * Handles triggering, logging, rollback orchestration, and status tracking.
 *
 * Dependencies: mongoose, child_process
 */

const mongoose = require('mongoose');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ─────────────────────────────────────────────────────────────── Schema

const DeploymentSchema = new mongoose.Schema(
  {
    deploymentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    env: {
      type: String,
      required: true,
      enum: ['development', 'staging', 'production'],
      index: true,
    },
    version: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'DEPLOYING', 'SUCCESS', 'FAILED', 'ROLLED_BACK'],
      default: 'PENDING',
      index: true,
    },
    operatorId: {
      type: String,
      required: true,
    },
    logs: {
      type: [String],
      default: [],
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const Deployment =
  mongoose.models.Deployment ||
  mongoose.model('Deployment', DeploymentSchema);

// ─────────────────────────────────────────────────────────────── Service Functions

/**
 * Triggers a deployment in the background by calling deploy.js.
 * Tracks execution logs and status transitions in MongoDB.
 *
 * @param {object} params
 * @param {string} params.env - target environment
 * @param {string} params.version - target version tag
 * @param {string} params.operatorId - user triggering deployment
 * @param {boolean} [params.dryRun] - run in simulation mode
 * @returns {Promise<object>} The pending deployment record
 */
async function triggerDeployment({ env, version, operatorId, dryRun = true }) {
  if (!env || !['development', 'staging', 'production'].includes(env)) {
    throw new Error('Invalid or missing environment');
  }
  if (!version || typeof version !== 'string') {
    throw new Error('Version must be a non-empty string');
  }
  if (!operatorId) {
    throw new Error('operatorId is required');
  }

  const deploymentId = `dep-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

  // Create database entry
  const deployment = new Deployment({
    deploymentId,
    env,
    version,
    status: 'DEPLOYING',
    operatorId,
    logs: [`[SYSTEM] Deployment initiated by operator: ${operatorId}`],
  });
  await deployment.save();

  // Run deployment script asynchronously
  const scriptPath = path.join(__dirname, '../scripts/deploy.js');
  const args = [env, version];
  if (dryRun) {
    args.push('--dry-run');
  }

  const deployProcess = spawn('node', [scriptPath, ...args], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, NODE_ENV: env, APP_VERSION: version }
  });

  deployProcess.stdout.on('data', async (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    await Deployment.updateOne(
      { deploymentId },
      { $push: { logs: { $each: lines } } }
    );
  });

  deployProcess.stderr.on('data', async (data) => {
    const lines = data.toString().split('\n').filter(Boolean).map(line => `[STDERR] ${line}`);
    await Deployment.updateOne(
      { deploymentId },
      { $push: { logs: { $each: lines } } }
    );
  });

  deployProcess.on('close', async (code) => {
    let finalStatus = 'SUCCESS';
    if (code !== 0) {
      // Fetch current logs to check if rollback occurred
      const depRecord = await Deployment.findOne({ deploymentId }).select('logs');
      const logString = depRecord ? depRecord.logs.join('\n') : '';
      if (logString.includes('Deployment status: ROLLED_BACK')) {
        finalStatus = 'ROLLED_BACK';
      } else {
        finalStatus = 'FAILED';
      }
    }

    await Deployment.updateOne(
      { deploymentId },
      {
        $set: {
          status: finalStatus,
          completedAt: new Date(),
        },
        $push: {
          logs: `[SYSTEM] Deployment process finished with exit code ${code}. Final status: ${finalStatus}`
        }
      }
    );
  });

  return {
    success: true,
    deploymentId,
    message: `Deployment triggered successfully in ${dryRun ? 'dry-run' : 'live'} mode.`,
    data: deployment,
  };
}

/**
 * Gets the deployment document by ID.
 *
 * @param {string} deploymentId
 * @returns {Promise<object>}
 */
async function getDeployment(deploymentId) {
  const deployment = await Deployment.findOne({ deploymentId });
  if (!deployment) {
    throw new Error(`Deployment with ID ${deploymentId} not found`);
  }
  return {
    success: true,
    data: deployment,
  };
}

/**
 * Gets only the logs for a specific deployment.
 *
 * @param {string} deploymentId
 * @returns {Promise<object>}
 */
async function getDeploymentLogs(deploymentId) {
  const deployment = await Deployment.findOne({ deploymentId }).select('logs');
  if (!deployment) {
    throw new Error(`Deployment with ID ${deploymentId} not found`);
  }
  return {
    success: true,
    deploymentId,
    logs: deployment.logs,
  };
}

/**
 * Lists deployments with optional filtering and pagination.
 *
 * @param {object} params
 * @param {string} [params.env]
 * @param {string} [params.status]
 * @param {number} [params.page]
 * @param {number} [params.limit]
 * @returns {Promise<object>}
 */
async function listDeployments({ env, status, page = 1, limit = 10 } = {}) {
  const filter = {};
  if (env) filter.env = env;
  if (status) filter.status = status;

  const skip = (page - 1) * limit;

  const [deployments, total] = await Promise.all([
    Deployment.find(filter)
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Deployment.countDocuments(filter),
  ]);

  return {
    success: true,
    data: {
      deployments,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    },
  };
}

module.exports = {
  triggerDeployment,
  getDeployment,
  getDeploymentLogs,
  listDeployments,
  Deployment,
};
