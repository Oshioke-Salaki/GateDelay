const express = require('express');
const request = require('supertest');
const { ethers } = require('ethers');

jest.mock('../middleware/ddosGuard', () => ({
  strictDDoSGuard: () => (req, res, next) => next(),
}));

const multisigRouter = require('../routes/multisig');
const multisigService = require('../services/multisigService');

const OWNER_1_KEY = '0x' + '11'.repeat(32);
const OWNER_2_KEY = '0x' + '22'.repeat(32);
const owner1Wallet = new ethers.Wallet(OWNER_1_KEY);
const owner2Wallet = new ethers.Wallet(OWNER_2_KEY);

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/multisig', multisigRouter);
  return app;
}

function uniqueTxData() {
  return {
    target: '0x' + 'ab'.repeat(20),
    value: '100',
    data: '0x',
  };
}

describe('Multisig routes — auth hardening', () => {
  const app = createApp();

  describe('negative authentication and validation', () => {
    it('rejects propose without an owner proof', async () => {
      const res = await request(app)
        .post('/api/multisig/propose')
        .send({
          walletId: 'MARKET_OPS',
          txData: uniqueTxData(),
          proposer: owner1Wallet.address,
        });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    });

    it('rejects propose when the proof does not match the claimed proposer', async () => {
      const txData = uniqueTxData();
      const challenge = multisigRouter.buildProposeChallenge('MARKET_OPS', {
        target: txData.target,
        value: txData.value,
        data: txData.data,
      });
      const forged = owner2Wallet.signMessageSync(challenge);

      const res = await request(app)
        .post('/api/multisig/propose')
        .send({
          walletId: 'MARKET_OPS',
          txData,
          proposer: owner1Wallet.address,
          proposerSignature: forged,
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
      expect(res.body.error).toBe('Authentication required');
    });

    it('rejects propose from a non-owner even with a valid self-signature', async () => {
      const outsider = ethers.Wallet.createRandom();
      const txData = uniqueTxData();
      const challenge = multisigRouter.buildProposeChallenge('MARKET_OPS', {
        target: txData.target,
        value: txData.value,
        data: txData.data,
      });

      const res = await request(app)
        .post('/api/multisig/propose')
        .send({
          walletId: 'MARKET_OPS',
          txData,
          proposer: outsider.address,
          proposerSignature: outsider.signMessageSync(challenge),
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect(res.body.error).not.toMatch(/stack|secret|private/i);
    });

    it('rejects reserved or malformed wallet identifiers', async () => {
      const res = await request(app)
        .get('/api/multisig/wallet/constructor');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects non-object txData without calling the service', async () => {
      const res = await request(app)
        .post('/api/multisig/propose')
        .send({
          walletId: 'MARKET_OPS',
          txData: 'not-an-object',
          proposer: owner1Wallet.address,
          proposerSignature: '0x' + 'ab'.repeat(65),
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects sign without a usable signature as unauthorized', async () => {
      const res = await request(app)
        .post('/api/multisig/sign')
        .send({
          txId: '0x' + '11'.repeat(32),
          owner: owner1Wallet.address,
          signature: 'short',
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('rejects execute without an owner proof', async () => {
      const res = await request(app)
        .post('/api/multisig/execute')
        .send({ txId: '0x' + '22'.repeat(32) });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    });

    it('does not expose internal error details for unknown transactions', async () => {
      const txId = '0x' + '33'.repeat(32);
      const res = await request(app)
        .post('/api/multisig/execute')
        .send({
          txId,
          executor: owner1Wallet.address,
          executorSignature: owner1Wallet.signMessageSync(
            multisigRouter.buildExecuteChallenge(txId)
          ),
        });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
      expect(JSON.stringify(res.body)).not.toMatch(/at Object\.|node_modules|private key/i);
    });
  });

  describe('authenticated happy path', () => {
    it('proposes, signs, reports redacted status, and executes for owners', async () => {
      const txData = uniqueTxData();
      const normalized = {
        target: txData.target,
        value: txData.value,
        data: txData.data,
      };
      const proposeChallenge = multisigRouter.buildProposeChallenge('MARKET_OPS', normalized);

      const proposeRes = await request(app)
        .post('/api/multisig/propose')
        .send({
          walletId: 'MARKET_OPS',
          txData,
          proposer: owner1Wallet.address,
          proposerSignature: owner1Wallet.signMessageSync(proposeChallenge),
        });

      expect(proposeRes.status).toBe(200);
      expect(proposeRes.body.success).toBe(true);
      const txId = proposeRes.body.data.txId;
      expect(txId).toMatch(/^0x[0-9a-f]{64}$/);

      const sign1 = await request(app)
        .post('/api/multisig/sign')
        .send({
          txId,
          owner: owner1Wallet.address,
          signature: owner1Wallet.signMessageSync(txId),
        });
      expect(sign1.status).toBe(200);
      expect(sign1.body.data.signatures[0].signature).toBeUndefined();

      const sign2 = await request(app)
        .post('/api/multisig/sign')
        .send({
          txId,
          owner: owner2Wallet.address,
          signature: owner2Wallet.signMessageSync(txId),
        });
      expect(sign2.status).toBe(200);
      expect(sign2.body.data.status).toBe('Ready');

      const statusRes = await request(app).get(`/api/multisig/status/${txId}`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.status).toBe('Ready');
      expect(statusRes.body.data.signatures).toHaveLength(2);
      expect(statusRes.body.data.signatures.every((entry) => !entry.signature)).toBe(true);

      const executeRes = await request(app)
        .post('/api/multisig/execute')
        .send({
          txId,
          executor: owner1Wallet.address,
          executorSignature: owner1Wallet.signMessageSync(
            multisigRouter.buildExecuteChallenge(txId)
          ),
        });

      expect(executeRes.status).toBe(200);
      expect(executeRes.body.data.status).toBe('Executed');
      expect(executeRes.body.data.signatures.every((entry) => !entry.signature)).toBe(true);
    });

    it('still returns public wallet metadata for a valid id', async () => {
      const res = await request(app).get('/api/multisig/wallet/MARKET_OPS');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.threshold).toBe(2);
      expect(res.body.data.owners).toContain(owner1Wallet.address);
    });
  });

  describe('service-level executor guard remains in force', () => {
    it('does not execute when the caller is not an owner of the ready transaction', async () => {
      const txId = await multisigService.proposeTransaction(
        'MARKET_OPS',
        uniqueTxData(),
        owner1Wallet.address
      );
      await multisigService.collectSignature(
        txId,
        owner1Wallet.address,
        owner1Wallet.signMessageSync(txId)
      );
      await multisigService.collectSignature(
        txId,
        owner2Wallet.address,
        owner2Wallet.signMessageSync(txId)
      );

      const outsider = ethers.Wallet.createRandom();
      const res = await request(app)
        .post('/api/multisig/execute')
        .send({
          txId,
          executor: outsider.address,
          executorSignature: outsider.signMessageSync(
            multisigRouter.buildExecuteChallenge(txId)
          ),
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });
});
