const multisigService = require('../services/multisigService');

describe('Multisig Service', () => {
  const walletId = 'MARKET_OPS';
  const owner1 = '0xOwner1...';
  const owner2 = '0xOwner2...';
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

    it('should collect signatures and reach threshold', async () => {
      // First signature
      await multisigService.collectSignature(currentTxId, owner1, 'sig1');
      let status = multisigService.getTransactionStatus(currentTxId);
      expect(status.signatures.length).toBe(1);
      expect(status.status).toBe('Pending');

      // Second signature (reaches threshold of 2)
      await multisigService.collectSignature(currentTxId, owner2, 'sig2');
      status = multisigService.getTransactionStatus(currentTxId);
      expect(status.signatures.length).toBe(2);
      expect(status.status).toBe('Ready');
    });

    it('should prevent duplicate signatures from same owner', async () => {
      await expect(multisigService.collectSignature(currentTxId, owner1, 'sig3'))
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
  });
});
