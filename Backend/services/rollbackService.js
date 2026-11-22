const mongoose = require('mongoose');
const { Web3 } = require('web3');
const { buildPaginationMeta, normalizePagination } = require('../utils/pagination');
const auditTrail = require('./auditTrail');

const rollbackHistorySchema = new mongoose.Schema(
  {
    rollbackId: { type: String, required: true, unique: true },
    marketId: { type: String, required: true, index: true },
    operationType: { type: String, required: true },
    reason: String,
    status: {
      type: String,
      enum: ['pending', 'validating', 'executing', 'completed', 'failed', 'rejected'],
      default: 'pending',
    },
    conditions: mongoose.Schema.Types.Mixed,
    transactionHash: String,
    blockNumber: Number,
    error: String,
    initiatedBy: String,
    completedAt: Date,
  },
  { timestamps: true },
);

const RollbackHistory =
  mongoose.models.RollbackHistory || mongoose.model('RollbackHistory', rollbackHistorySchema);

class RollbackService {
  constructor() {
    this.activeRollbacks = new Map();
    this.web3 = null;
    this.contractAddress = process.env.MARKET_CONTRACT_ADDRESS || null;
  }

  async connect() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gatedelay';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    if (!this.web3) {
      const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
      this.web3 = new Web3(rpcUrl);
    }
  }

  async validateConditions({ marketId, operationType, snapshotBlock }) {
    await this.connect();

    if (!marketId) throw new Error('marketId is required');
    if (!operationType) throw new Error('operationType is required');

    const validOperations = ['trade', 'liquidity', 'resolution', 'market_creation'];
    if (!validOperations.includes(operationType)) {
      throw new Error(`Invalid operation type. Must be one of: ${validOperations.join(', ')}`);
    }

    const recentRollback = await RollbackHistory.findOne({
      marketId,
      status: { $in: ['pending', 'executing'] },
    });
    if (recentRollback) {
      return { valid: false, reason: 'Rollback already in progress for this market' };
    }

    if (snapshotBlock && this.web3) {
      const latest = await this.web3.eth.getBlockNumber();
      if (BigInt(snapshotBlock) > latest) {
        return { valid: false, reason: 'Snapshot block is in the future' };
      }
    }

    return { valid: true, marketId, operationType, snapshotBlock: snapshotBlock || null };
  }

  async requestRollback({ marketId, operationType, reason, initiatedBy, snapshotBlock }) {
    const validation = await this.validateConditions({ marketId, operationType, snapshotBlock });
    if (!validation.valid) {
      const entry = await RollbackHistory.create({
        rollbackId: `rb_${Date.now()}`,
        marketId,
        operationType,
        reason,
        status: 'rejected',
        error: validation.reason,
        initiatedBy,
        conditions: validation,
      });
      // A refused rollback is exactly the attempt an incident review needs to
      // see, and it leaves no other trace beyond the rejected history row.
      await auditTrail.logMarketRollbackRejected({
        marketId,
        rollbackId: entry.rollbackId,
        operationType,
        actor: initiatedBy,
        reason: validation.reason,
      });
      return { rejected: true, rollback: entry };
    }

    const rollbackId = `rb_${Date.now()}`;
    const rollback = {
      rollbackId,
      marketId,
      operationType,
      reason,
      status: 'pending',
      progress: 0,
      initiatedBy,
      snapshotBlock,
      steps: ['validate', 'prepare', 'execute', 'confirm'],
      currentStep: 0,
    };
    this.activeRollbacks.set(rollbackId, rollback);

    const historyEntry = await RollbackHistory.create({
      rollbackId,
      marketId,
      operationType,
      reason,
      status: 'pending',
      initiatedBy,
      conditions: validation,
    });

    await auditTrail.logMarketRollbackRequested({
      marketId,
      rollbackId,
      operationType,
      actor: initiatedBy,
      reason,
      snapshotBlock,
    });

    return { rollbackId, history: historyEntry };
  }

  async executeRollback(rollbackId) {
    const rollback = this.activeRollbacks.get(rollbackId);
    if (!rollback) {
      const hist = await RollbackHistory.findOne({ rollbackId });
      if (!hist) throw new Error(`Rollback not found: ${rollbackId}`);
      if (hist.status === 'completed') return hist;
      throw new Error(`Rollback not active: ${rollbackId}`);
    }

    await this.connect();
    rollback.status = 'executing';
    await RollbackHistory.updateOne({ rollbackId }, { status: 'executing' });

    const startedAt = Date.now();

    try {
      for (let i = 0; i < rollback.steps.length; i++) {
        rollback.currentStep = i + 1;
        rollback.progress = Math.round(((i + 1) / rollback.steps.length) * 100);

        if (rollback.steps[i] === 'execute') {
          const txResult = await this._executeOnChain(rollback);
          rollback.transactionHash = txResult.transactionHash;
          rollback.blockNumber = txResult.blockNumber;
        } else {
          await new Promise((r) => setTimeout(r, 50));
        }
      }

      rollback.status = 'completed';
      rollback.progress = 100;
      rollback.completedAt = new Date();

      await RollbackHistory.updateOne(
        { rollbackId },
        {
          status: 'completed',
          transactionHash: rollback.transactionHash,
          blockNumber: rollback.blockNumber,
          completedAt: rollback.completedAt,
        },
      );

      await auditTrail.logMarketRollbackCompleted({
        marketId: rollback.marketId,
        rollbackId,
        operationType: rollback.operationType,
        actor: rollback.initiatedBy,
        transactionHash: rollback.transactionHash,
        blockNumber: rollback.blockNumber,
        durationMs: Date.now() - startedAt,
      });

      return rollback;
    } catch (err) {
      rollback.status = 'failed';
      rollback.error = err.message;
      await RollbackHistory.updateOne({ rollbackId }, { status: 'failed', error: err.message });
      await auditTrail.logMarketRollbackFailed({
        marketId: rollback.marketId,
        rollbackId,
        operationType: rollback.operationType,
        actor: rollback.initiatedBy,
        error: err.message,
      });
      throw err;
    }
  }

  async _executeOnChain(rollback) {
    if (!this.contractAddress || !process.env.PRIVATE_KEY) {
      return {
        transactionHash: `0x${rollback.rollbackId.replace(/\D/g, '').padStart(64, '0')}`,
        blockNumber: rollback.snapshotBlock || 0,
        simulated: true,
      };
    }

    const account = this.web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY);
    const data = this.web3.eth.abi.encodeFunctionCall(
      {
        name: 'rollbackMarket',
        type: 'function',
        inputs: [
          { type: 'string', name: 'marketId' },
          { type: 'uint8', name: 'operationType' },
        ],
      },
      [rollback.marketId, 0],
    );

    const tx = {
      from: account.address,
      to: this.contractAddress,
      data,
      gas: 500000,
    };

    const signed = await account.signTransaction(tx);
    const receipt = await this.web3.eth.sendSignedTransaction(signed.rawTransaction);
    return {
      transactionHash: receipt.transactionHash,
      blockNumber: Number(receipt.blockNumber),
    };
  }

  getStatus(rollbackId) {
    const active = this.activeRollbacks.get(rollbackId);
    if (active) {
      return {
        rollbackId: active.rollbackId,
        marketId: active.marketId,
        status: active.status,
        progress: active.progress,
        currentStep: active.currentStep,
        totalSteps: active.steps.length,
        transactionHash: active.transactionHash || null,
        error: active.error || null,
      };
    }
    return null;
  }

  async getStatusFromDb(rollbackId) {
    await this.connect();
    return RollbackHistory.findOne({ rollbackId });
  }

  /**
   * List rollback history, newest first, with pagination metadata (#916).
   *
   * The `status` filter and `page`/`limit` bounds come from the request DTO
   * (dto/rollback.dto.js); the clamping itself is centralised in
   * utils/pagination.js so this and the Mongo-backed lists agree.
   *
   * @param {object} [options]
   * @param {string} [options.marketId]
   * @param {string} [options.status]
   * @param {number} [options.page=1]
   * @param {number} [options.limit=50]
   * @returns {Promise<{ history: object[], meta: object }>}
   */
  async getHistory({ marketId, status, page, limit } = {}) {
    await this.connect();
    const { page: safePage, limit: safeLimit, skip } = normalizePagination({ page, limit, defaultLimit: 50 });

    const query = {};
    if (marketId) query.marketId = marketId;
    if (status) query.status = status;

    const [history, total] = await Promise.all([
      RollbackHistory.find(query).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
      RollbackHistory.countDocuments(query),
    ]);

    return {
      history,
      meta: buildPaginationMeta({ total, count: history.length, page: safePage, limit: safeLimit }),
    };
  }
}

module.exports = new RollbackService();
