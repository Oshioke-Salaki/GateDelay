const bridgeService = require('../services/bridgeService');

describe('Bridge Service', () => {
  let transferId;
  const recipient = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
  const sender = '0x0000000000000000000000000000000000000001';

  it('should expose supported protocols', () => {
    expect(bridgeService.PROTOCOLS.LAYERZERO).toBeDefined();
    expect(bridgeService.PROTOCOLS.LAYERZERO.chains).toContain('ethereum');
  });

  it('should initiate a valid transfer', async () => {
    const transfer = await bridgeService.initiateTransfer({
      protocol: 'LAYERZERO',
      sourceChain: 'ethereum',
      destChain: 'arbitrum',
      token: 'USDC',
      amount: 1000,
      sender,
      recipient,
    });

    transferId = transfer.id;
    expect(transferId).toMatch(/^brg_/);
    expect(transfer.status).toBe(bridgeService.TRANSFER_STATUS.PENDING);
    expect(transfer.requiredConfirmations).toBe(12);
  });

  it('should reject an unsupported protocol', async () => {
    await expect(
      bridgeService.initiateTransfer({
        protocol: 'NOPE',
        sourceChain: 'ethereum',
        destChain: 'arbitrum',
        token: 'USDC',
        amount: 1000,
        sender,
        recipient,
      })
    ).rejects.toThrow(/Unsupported bridge protocol/);
  });

  it('should reject a disallowed token', async () => {
    await expect(
      bridgeService.initiateTransfer({
        protocol: 'LAYERZERO',
        sourceChain: 'ethereum',
        destChain: 'arbitrum',
        token: 'SCAM',
        amount: 10,
        sender,
        recipient,
      })
    ).rejects.toThrow(/Token not allowed/);
  });

  it('should reject an amount over the security limit', async () => {
    await expect(
      bridgeService.initiateTransfer({
        protocol: 'LAYERZERO',
        sourceChain: 'ethereum',
        destChain: 'arbitrum',
        token: 'USDC',
        amount: bridgeService.SECURITY.MAX_TRANSFER_AMOUNT + 1,
        sender,
        recipient,
      })
    ).rejects.toThrow(/exceeds bridge limit/);
  });

  it('should reject an invalid recipient address', async () => {
    await expect(
      bridgeService.initiateTransfer({
        protocol: 'LAYERZERO',
        sourceChain: 'ethereum',
        destChain: 'arbitrum',
        token: 'USDC',
        amount: 10,
        sender,
        recipient: 'not-an-address',
      })
    ).rejects.toThrow(/Invalid recipient address/);
  });

  it('should reject identical source and destination chains', async () => {
    await expect(
      bridgeService.initiateTransfer({
        protocol: 'LAYERZERO',
        sourceChain: 'ethereum',
        destChain: 'ethereum',
        token: 'USDC',
        amount: 10,
        sender,
        recipient,
      })
    ).rejects.toThrow(/must differ/);
  });

  it('should track confirmations and mark CONFIRMING below threshold', async () => {
    const updated = await bridgeService.updateConfirmations(transferId, 5, {
      sourceTxHash: '0xabc',
    });
    expect(updated.confirmations).toBe(5);
    expect(updated.status).toBe(bridgeService.TRANSFER_STATUS.CONFIRMING);
    expect(updated.sourceTxHash).toBe('0xabc');
  });

  it('should complete the transfer once confirmations are met', async () => {
    const updated = await bridgeService.updateConfirmations(transferId, 12, {
      destTxHash: '0xdef',
    });
    expect(updated.status).toBe(bridgeService.TRANSFER_STATUS.COMPLETED);
    expect(updated.destTxHash).toBe('0xdef');
  });

  it('should not update a completed transfer', async () => {
    await expect(
      bridgeService.updateConfirmations(transferId, 20)
    ).rejects.toThrow(/already completed/);
  });

  it('should produce analytics reflecting completed volume', async () => {
    const analytics = await bridgeService.getBridgeAnalytics();
    expect(analytics.completedTransfers).toBeGreaterThanOrEqual(1);
    expect(analytics.totalVolume).toBeGreaterThanOrEqual(1000);
    expect(analytics.volumeByProtocol.LAYERZERO).toBeGreaterThanOrEqual(1000);
    expect(analytics.volumeByToken.USDC).toBeGreaterThanOrEqual(1000);
  });

  it('should fail a pending transfer with a reason', async () => {
    const pending = await bridgeService.initiateTransfer({
      protocol: 'AXELAR',
      sourceChain: 'ethereum',
      destChain: 'polygon',
      token: 'USDT',
      amount: 50,
      sender,
      recipient,
    });
    const failed = await bridgeService.failTransfer(pending.id, 'relayer timeout');
    expect(failed.status).toBe(bridgeService.TRANSFER_STATUS.FAILED);
    expect(failed.failureReason).toBe('relayer timeout');
  });
});
