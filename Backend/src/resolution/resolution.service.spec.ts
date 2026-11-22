jest.mock('../../services/auditTrail', () => ({
  MARKET_AUDIT_ACTIONS: {}, logMarketResolved: jest.fn(), logMarketAction: jest.fn(),
}));
import { ResolutionService } from './resolution.service';

// These tests deliberately exercise the persisted compare-and-set boundary.
describe('durable resolution transitions', () => {
  let service: ResolutionService;
  let record: any;
  let model: any;
  let verify: jest.Mock;
  const confirmation = { id: 'c', resolutionId: 'r', marketId: 'market', attempt: 1,
    outcome: 'YES', txHash: 'hash', blockHash: 'block' };
  beforeEach(() => {
    record = { id: 'r', marketId: 'market', attempt: 1, revision: 0, active: true,
      status: 'disputed', outcome: 'YES', requestedBy: 'owner', confirmations: [],
      disputes: [{ id: 'd', resolutionId: 'r', marketId: 'market', attempt: 1,
        status: 'open', priorStatus: 'requested' }] };
    const query = (value: any) => ({ lean: () => ({ exec: async () => structuredClone(value) }) });
    model = { findOne: jest.fn(() => query(record)),
      findOneAndUpdate: jest.fn((filter, update) => {
        if (filter.revision !== record.revision || filter.status !== record.status) return query(null);
        Object.assign(record, update.$set);
        for (const key of Object.keys(update.$unset ?? {})) delete record[key];
        return query(record);
      }) };
    verify = jest.fn();
    service = new ResolutionService(model, { verify } as any);
  });
  it('restores requested after rejecting a dispute on an unconfirmed request', async () => {
    await service.reviewDispute('d', { decision: 'rejected' });
    expect(record.status).toBe('requested');
    await expect(service.finaliseResolution('r')).rejects.toThrow();
  });
  it('only restores confirmed when the prior state has independent current evidence', async () => {
    record.disputes[0].priorStatus = 'confirmed';
    await service.reviewDispute('d', { decision: 'rejected' });
    expect(record.status).toBe('requested');
  });
  it('restores an evidenced prior confirmation', async () => {
    record.disputes[0].priorStatus = 'confirmed'; record.confirmations = [confirmation]; record.txHash = 'hash';
    await service.reviewDispute('d', { decision: 'rejected' });
    expect(record.status).toBe('confirmed');
  });
  it('seals upheld attempts and clears active evidence while preserving history', async () => {
    record.confirmations = [confirmation]; record.txHash = 'hash'; record.confirmedAt = new Date();
    await service.reviewDispute('d', { decision: 'upheld' });
    expect(record).toMatchObject({ status: 'cancelled', active: false, attempt: 1 });
    expect(record.txHash).toBeUndefined(); expect(record.confirmedAt).toBeUndefined();
    expect(record.confirmations[0].invalidatedAt).toBeInstanceOf(Date);
    await expect(service.confirmResolution('user', 'r', { txHash: 'hash' })).rejects.toThrow();
    await expect(service.reviewDispute('d', { decision: 'rejected' })).rejects.toThrow();
  });
  it('does not write when verification fails', async () => {
    record.status = 'requested'; verify.mockRejectedValue(new Error('bad receipt'));
    await expect(service.confirmResolution('user', 'r', { txHash: 'hash' })).rejects.toThrow('bad receipt');
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('rejects stale writes after a concurrent state change', async () => {
    model.findOneAndUpdate.mockImplementation(() => ({ lean: () => ({ exec: async () => null }) }));
    await expect(service.reviewDispute('d', { decision: 'rejected' })).rejects.toThrow('Resolution changed');
  });
});
