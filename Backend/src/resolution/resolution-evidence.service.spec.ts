import { ethers } from 'ethers';
import { ResolutionEvidenceService } from './resolution-evidence.service';

const market = '0x' + '11'.repeat(20);
const contract = '0x' + '22'.repeat(20);
const hash = '0x' + '33'.repeat(32);
const blockHash = '0x' + '44'.repeat(32);
const abi = new ethers.Interface(['event MarketResolved(address indexed market, uint8 outcome, address indexed resolver)']);

describe('resolution transaction evidence', () => {
  let service: ResolutionEvidenceService;
  let receipt: any;
  let provider: any;
  const resolution: any = { marketId: market, outcome: 'YES' };
  beforeEach(() => {
    const event = abi.encodeEventLog(abi.getEvent('MarketResolved')!, [market, 1, contract]);
    receipt = { hash, status: 1, blockNumber: 100, blockHash, logs: [{ ...event, address: contract, index: 0 }] };
    provider = { getNetwork: jest.fn().mockResolvedValue({ chainId: 5000n }),
      getTransactionReceipt: jest.fn().mockImplementation(async () => receipt),
      getBlockNumber: jest.fn().mockResolvedValue(111), getBlock: jest.fn().mockResolvedValue({ hash: blockHash }) };
    service = new ResolutionEvidenceService({ get: (_key: string, fallback: unknown) => fallback } as any,
      { getDeployedContract: () => ({ address: contract, chainId: 5000 }) } as any);
    Object.assign(service, { provider });
  });
  it('derives evidence from a final successful matching event', async () => {
    await expect(service.verify(resolution, { txHash: hash })).resolves.toMatchObject({
      txHash: hash, blockNumber: 100, blockHash, chainId: 5000, contractAddress: contract, logIndex: 0,
    });
  });
  it.each(['missing', 'failed', 'contract', 'market', 'outcome', 'finality', 'chain', 'reorg', 'block'])('rejects %s evidence', async kind => {
    if (kind === 'missing') receipt = null;
    if (kind === 'failed') receipt.status = 0;
    if (kind === 'contract') receipt.logs[0].address = market;
    if (kind === 'market' || kind === 'outcome') {
      Object.assign(receipt.logs[0], abi.encodeEventLog(abi.getEvent('MarketResolved')!,
        [kind === 'market' ? contract : market, kind === 'outcome' ? 2 : 1, contract]));
    }
    if (kind === 'finality') provider.getBlockNumber.mockResolvedValue(110);
    if (kind === 'chain') provider.getNetwork.mockResolvedValue({ chainId: 1n });
    if (kind === 'reorg') provider.getBlock.mockResolvedValue({ hash });
    await expect(service.verify(resolution, { txHash: hash, ...(kind === 'block' ? { blockNumber: 99 } : {}) })).rejects.toThrow();
  });
  it('fails closed when RPC is unavailable', async () => {
    provider.getTransactionReceipt.mockRejectedValue(new Error('offline'));
    await expect(service.verify(resolution, { txHash: hash })).rejects.toThrow('offline');
  });
  it('does not treat INVALID as the NONE contract outcome', async () => {
    await expect(service.verify({ ...resolution, outcome: 'INVALID' }, { txHash: hash })).rejects.toThrow();
  });
});
