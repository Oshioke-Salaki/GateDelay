import { Injectable, NotFoundException, BadRequestException, ConflictException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { createRequire } from 'module';
import type { MarketResolution, ResolutionConfirmation, ResolutionDispute, ResolutionReport } from './resolution.entity';
import { RequestResolutionDto, ConfirmResolutionDto, DisputeResolutionDto, ReviewDisputeDto } from './dto/resolution.dto';
import { RESOLUTION_MODEL } from './resolution.schema';
import type { StoredResolution } from './resolution.schema';
import { ResolutionEvidenceService } from './resolution-evidence.service';

const nodeRequire = createRequire(__filename);
const auditTrail = nodeRequire('../../services/auditTrail') as {
  MARKET_AUDIT_ACTIONS: Record<string, string>;
  logMarketAction(params: {
    action: string;
    marketId: string;
    description: string;
    severity?: string;
    metadata?: Record<string, unknown>;
    changes?: { before: unknown; after: unknown };
  }): Promise<unknown>;
  logMarketResolved(params: {
    marketId: string;
    actor?: string;
    outcome: string;
    totalPayout: bigint;
    resolvedAt: Date;
  }): Promise<unknown>;
};

@Injectable()
export class ResolutionService implements OnModuleInit {
  constructor(@InjectModel(RESOLUTION_MODEL) private readonly records: Model<StoredResolution>,
    private readonly evidence: ResolutionEvidenceService) {}

  async onModuleInit() {
    // Explicitly install uniqueness constraints even when production disables autoIndex.
    await this.records.createIndexes();
    // Server-side invariants also protect writes made outside this service.
    await this.records.db.db!.command({ collMod: 'resolution_workflows',
      validator: { $and: [
        { $jsonSchema: { bsonType: 'object', required: ['id', 'marketId', 'attempt', 'revision', 'status', 'active', 'outcome', 'confirmations', 'disputes'],
          properties: { status: { enum: ['pending', 'requested', 'confirmed', 'disputed', 'resolved', 'cancelled'] },
            outcome: { enum: ['YES', 'NO', 'INVALID'] }, attempt: { bsonType: ['double', 'int', 'long', 'decimal'], minimum: 1 },
            revision: { bsonType: ['double', 'int', 'long', 'decimal'], minimum: 0 }, confirmations: { bsonType: 'array' }, disputes: { bsonType: 'array' } } } },
        { $expr: { $and: [
          { $eq: ['$active', { $ne: ['$status', 'cancelled'] }] },
          { $or: [ { $not: [{ $in: ['$status', ['confirmed', 'resolved']] }] },
            { $gt: [{ $size: { $filter: { input: '$confirmations', as: 'c', cond: { $and: [
              { $eq: ['$$c.resolutionId', '$id'] }, { $eq: ['$$c.attempt', '$attempt'] },
              { $eq: ['$$c.marketId', '$marketId'] }, { $eq: ['$$c.outcome', '$outcome'] },
              { $eq: ['$$c.txHash', '$txHash'] }, { $eq: [{ $ifNull: ['$$c.invalidatedAt', null] }, null] },
              { $eq: [{ $type: '$$c.blockHash' }, 'string'] },
            ] } } } }, 0] } ] },
          { $eq: [{ $eq: ['$status', 'disputed'] }, { $gt: [{ $size: { $filter: {
            input: '$disputes', as: 'd', cond: { $in: ['$$d.status', ['open', 'under_review']] },
          } } }, 0] }] },
        ] } },
      ] }, validationLevel: 'strict', validationAction: 'error' });
  }

  private marketKey(marketId: string) { return marketId.trim().toLowerCase(); }
  async getStatus(marketId: string): Promise<MarketResolution | null> {
    return this.records.findOne({ marketId: this.marketKey(marketId) }).sort({ attempt: -1 }).lean().exec();
  }
  async getResolutionById(id: string): Promise<StoredResolution> {
    const record = await this.records.findOne({ id }).lean().exec();
    if (!record) throw new NotFoundException('Resolution not found');
    return record;
  }
  async listResolutions(status?: string): Promise<MarketResolution[]> {
    return this.records.find(status ? { status } : {}).sort({ requestedAt: -1 }).lean().exec();
  }

  // Every mutation compares the persisted state and revision. Racing confirmations,
  // cancellations, disputes, and reviews cannot overwrite a completed transition.
  private async transition(before: StoredResolution, after: StoredResolution) {
    const { id, marketId, attempt, ...changes } = after;
    const unset: Record<string, 1> = {};
    for (const key of ['txHash', 'confirmedAt']) {
      if (changes[key] === undefined) { unset[key] = 1; delete changes[key]; }
    }
    try {
      const updated = await this.records.findOneAndUpdate(
        { id, marketId, attempt, revision: before.revision, status: before.status },
        { $set: { ...changes, revision: before.revision + 1 }, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
        { new: true, runValidators: true },
      ).lean().exec();
      if (!updated) throw new ConflictException('Resolution changed; reload before retrying');
      return updated;
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw new ConflictException('Confirmation evidence was already used');
      throw error;
    }
  }
  private hasEvidence(record: StoredResolution) {
    return record.confirmations.some(c => !c.invalidatedAt && c.attempt === record.attempt &&
      c.resolutionId === record.id && c.marketId === record.marketId && c.outcome === record.outcome &&
      c.txHash === record.txHash && !!c.blockHash);
  }
  async requestResolution(userId: string, dto: RequestResolutionDto): Promise<MarketResolution> {
    const marketId = this.marketKey(dto.marketId);
    const previous = await this.records.findOne({ marketId }).sort({ attempt: -1 }).lean().exec();
    if (previous?.active) throw new ConflictException('Market already has an active resolution');
    try {
      const record = await this.records.create({ id: uuidv4(), marketId, attempt: (previous?.attempt ?? 0) + 1,
        active: true, revision: 0, requestedBy: userId, outcome: dto.outcome, status: 'requested',
        evidence: dto.evidence, requestedAt: new Date(), confirmations: [], disputes: [] });
      return record.toObject();
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw new ConflictException('Market resolution request raced another request; reload');
      throw error;
    }
  }
  async cancelResolution(userId: string, id: string): Promise<MarketResolution> {
    const r = await this.getResolutionById(id);
    if (r.requestedBy !== userId) throw new BadRequestException('Only the requester can cancel this resolution');
    if (!['requested', 'pending'].includes(r.status)) throw new BadRequestException('Resolution cannot be cancelled in its current state');
    return this.transition(r, { ...r, status: 'cancelled', active: false, cancelledAt: new Date() });
  }
  async confirmResolution(userId: string, id: string, dto: ConfirmResolutionDto): Promise<ResolutionConfirmation> {
    const r = await this.getResolutionById(id);
    if (!['requested', 'pending'].includes(r.status)) throw new BadRequestException('Resolution cannot be confirmed in its current state');
    const verified = await this.evidence.verify(r, dto);
    const confirmation: ResolutionConfirmation = { id: uuidv4(), resolutionId: id, marketId: r.marketId,
      attempt: r.attempt, outcome: r.outcome, confirmedBy: userId, confirmedAt: new Date(), ...verified };
    await this.transition(r, { ...r, status: 'confirmed', txHash: verified.txHash,
      confirmedAt: confirmation.confirmedAt, confirmations: [...r.confirmations, confirmation] });
    return confirmation;
  }
  async getConfirmations(id: string): Promise<ResolutionConfirmation[]> {
    return (await this.getResolutionById(id)).confirmations;
  }
  async finaliseResolution(id: string, actor?: string): Promise<MarketResolution> {
    const r = await this.getResolutionById(id);
    if (r.status !== 'confirmed' || !this.hasEvidence(r)) throw new BadRequestException('Current attempt requires verified confirmation before finalising');
    if (r.disputes.some(d => ['open', 'under_review'].includes(d.status))) throw new BadRequestException('Open disputes must be reviewed first');
    const resolvedAt = new Date();
    const updated = await this.transition(r, { ...r, status: 'resolved', resolvedAt });
    await auditTrail.logMarketResolved({ marketId: r.marketId, actor: actor ?? r.requestedBy,
      outcome: r.outcome, totalPayout: 0n, resolvedAt });
    await auditTrail.logMarketAction({ action: auditTrail.MARKET_AUDIT_ACTIONS.RESOLUTION_FINALISED,
      marketId: r.marketId, description: 'Resolution ' + id + ' finalised', severity: 'HIGH',
      metadata: { resolutionId: id, attempt: r.attempt, txHash: r.txHash,
        confirmations: r.confirmations.length, disputes: r.disputes.length },
      changes: { before: { status: r.status }, after: { status: updated.status, outcome: updated.outcome } } });
    return updated;
  }
  async raiseDispute(userId: string, id: string, dto: DisputeResolutionDto): Promise<ResolutionDispute> {
    const r = await this.getResolutionById(id);
    if (r.status !== 'requested' && r.status !== 'confirmed') throw new BadRequestException('Resolution cannot be disputed in its current state');
    const dispute: ResolutionDispute = { id: uuidv4(), resolutionId: id, marketId: r.marketId,
      attempt: r.attempt, priorStatus: r.status, disputedBy: userId, reason: dto.reason, status: 'open', raisedAt: new Date() };
    await this.transition(r, { ...r, status: 'disputed', disputes: [...r.disputes, dispute] });
    return dispute;
  }
  async getDisputes(id: string): Promise<ResolutionDispute[]> { return (await this.getResolutionById(id)).disputes; }
  async getDisputeById(id: string): Promise<ResolutionDispute> {
    const r = await this.records.findOne({ 'disputes.id': id }).lean().exec();
    const dispute = r?.disputes.find(d => d.id === id);
    if (!dispute) throw new NotFoundException('Dispute not found');
    return dispute;
  }
  async reviewDispute(id: string, dto: ReviewDisputeDto): Promise<ResolutionDispute> {
    if (!['upheld', 'rejected'].includes(dto.decision)) throw new BadRequestException('Invalid dispute decision');
    const dispute = await this.getDisputeById(id);
    const r = await this.getResolutionById(dispute.resolutionId);
    if (r.status !== 'disputed' || dispute.attempt !== r.attempt || !['open', 'under_review'].includes(dispute.status)) {
      throw new BadRequestException('Dispute is no longer reviewable');
    }
    const now = new Date();
    const reviewed: ResolutionDispute = { ...dispute, status: dto.decision, reviewNotes: dto.reviewNotes, reviewedAt: now, resolvedAt: now };
    const next = { ...r, disputes: r.disputes.map(d => d.id === id ? reviewed : d) };
    if (dto.decision === 'upheld') {
      // Seal the rejected attempt. A new POST creates a new ID and attempt version,
      // with its own outcome and evidence; old evidence stays reserved for audit.
      next.status = 'cancelled'; next.active = false; next.cancelledAt = now;
      next.confirmedAt = undefined; next.txHash = undefined;
      next.confirmations = r.confirmations.map(c => ({ ...c, invalidatedAt: now }));
    } else {
      next.status = dispute.priorStatus === 'confirmed' && this.hasEvidence(r) ? 'confirmed' : 'requested';
    }
    await this.transition(r, next);
    return reviewed;
  }
  async generateReport(marketId: string): Promise<ResolutionReport> {
    const resolution = await this.getStatus(marketId);
    const record = resolution ? await this.getResolutionById(resolution.id) : null;
    const confirmations = record?.confirmations ?? [];
    const disputes = record?.disputes ?? [];
    return { marketId: this.marketKey(marketId), resolution, confirmations, disputes,
      totalDisputes: disputes.length, openDisputes: disputes.filter(d => ['open', 'under_review'].includes(d.status)).length,
      generatedAt: new Date() };
  }
}
