const { ethers } = require('ethers');
const multisigService = require('../services/multisigService');

// Same mock, non-secret test keys the service derives MARKET_OPS' owner addresses
// from — kept in sync manually since the service intentionally does not export them.
const OWNER_1_KEY = '0x' + '11'.repeat(32);
const OWNER_2_KEY = '0x' + '22'.repeat(32);

describe('Multisig Service', () => {
  const walletId = 'MARKET_OPS';
  const owner1Wallet = new ethers.Wallet(OWNER_1_KEY);
  const owner2Wallet = new ethers.Wallet(OWNER_2_KEY);
  const owner1 = owner1Wallet.address;
  const owner2 = owner2Wallet.address;
  const txData = { target: '0xabc...', value: '100', data: '0x' };

  describe('Wallet Management', () => {
    it('should retrieve wallet configuration', () => {
      const wallet = multisigService.getWallet(walletId);
      expect(wallet.address).toBeDefined();
      expect(wallet.threshold).toBe(2);
      expect(wallet.owners).toContain(owner1);
    });

    it('should throw error for invalid walletId', () => {
      expect(() => multisigService.getWallet('INVALID')).toThrow('Multisig wallet not found');
    });

    it('should not resolve reserved object keys as wallets', () => {
      expect(() => multisigService.getWallet('constructor')).toThrow('Multisig wallet not found');
      expect(() => multisigService.getWallet('__proto__')).toThrow('Multisig wallet not found');
      expect(() => multisigService.getWallet('toString')).toThrow('Multisig wallet not found');
    });

    it('should report owner membership without leaking invalid-address errors', () => {
      expect(multisigService.isOwner(walletId, owner1)).toBe(true);
      expect(multisigService.isOwner(walletId, ethers.Wallet.createRandom().address)).toBe(false);
      expect(multisigService.isOwner(walletId, 'not-an-address')).toBe(false);
    });
  });

  describe('Transaction Flow', () => {
    let currentTxId;

    it('should propose a new transaction', async () => {
      currentTxId = await multisigService.proposeTransaction(walletId, txData, owner1);
      expect(currentTxId).toBeDefined();

      const status = multisigService.getTransactionStatus(currentTxId);
      expect(status.status).toBe('Pending');
      expect(status.proposer).toBe(owner1);
    });

    it('should reject a malformed signature', async () => {
      await expect(multisigService.collectSignature(currentTxId, owner1, 'not-a-real-signature'))
        .rejects.toThrow('Invalid signature');
    });

    it('should reject a signature that recovers to a different address than the claimed owner', async () => {
      const forgedSignature = owner2Wallet.signMessageSync(currentTxId);
      await expect(multisigService.collectSignature(currentTxId, owner1, forgedSignature))
        .rejects.toThrow('Signature does not match owner');
    });

    it('should reject a valid signature from a key that is not a configured owner', async () => {
      const outsiderWallet = ethers.Wallet.createRandom();
      const signature = outsiderWallet.signMessageSync(currentTxId);
      await expect(multisigService.collectSignature(currentTxId, outsiderWallet.address, signature))
        .rejects.toThrow('Signer is not an owner of this multisig');
    });

    it('should collect signatures and reach threshold', async () => {
      // First signature
      const sig1 = owner1Wallet.signMessageSync(currentTxId);
      let status = await multisigService.collectSignature(currentTxId, owner1, sig1);
      expect(status.signatures.length).toBe(1);
      expect(status.status).toBe('Pending');

      // Second signature (reaches threshold of 2)
      const sig2 = owner2Wallet.signMessageSync(currentTxId);
      status = await multisigService.collectSignature(currentTxId, owner2, sig2);
      expect(status.signatures.length).toBe(2);
      expect(status.status).toBe('Ready');
    });

    it('should prevent duplicate signatures from same owner', async () => {
      const sig = owner1Wallet.signMessageSync(currentTxId);
      await expect(multisigService.collectSignature(currentTxId, owner1, sig))
        .rejects.toThrow('Owner has already signed this transaction');
    });

    it('should execute transaction when ready', async () => {
      const result = await multisigService.processTransaction(currentTxId);
      expect(result.status).toBe('Executed');
      expect(result.txHash).toBeDefined();
    });

    it('should prevent execution with insufficient signatures', async () => {
      const newTxId = await multisigService.proposeTransaction(walletId, txData, owner1);
      await expect(multisigService.processTransaction(newTxId))
        .rejects.toThrow(/Insufficient signatures/);
    });

    it('should reject execution when a provided executor is not an owner', async () => {
      const outsider = ethers.Wallet.createRandom().address;
      await expect(multisigService.processTransaction(currentTxId, outsider))
        .rejects.toThrow('Executor is not an owner of this multisig');
    });
  });
});
