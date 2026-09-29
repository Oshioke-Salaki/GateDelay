import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { createRequire } from 'module';
import {
  MarketResolution,
  ResolutionDispute,
  ResolutionConfirmation,
  ResolutionReport,
} from './resolution.entity';
import {
  RequestResolutionDto,
  ConfirmResolutionDto,
  DisputeResolutionDto,
  ReviewDisputeDto,
} from './dto/resolution.dto';

// Durable audit trail for market lifecycle actions (#914) — the CommonJS
// services/auditTrail.js writing to the `audit_logs` collection. Bridged the same
// way market-audit.module.ts and markets.controller.ts do.
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
export class ResolutionService {
  private readonly logger = new Logger(ResolutionService.name);

  private readonly resolutions = new Map<string, MarketResolution>();
  /** marketId → resolutionId (one active resolution per market) */
  private readonly resolutionByMarket = new Map<string, string>();
  private readonly confirmations = new Map<string, ResolutionConfirmation>();
  /** resolutionId → confirmation ids */
  private readonly confirmationsByResolution = new Map<string, string[]>();
  private readonly disputes = new Map<string, ResolutionDispute>();
  /** resolutionId → dispute ids */
  private readonly disputesByResolution = new Map<string, string[]>();

  // ── Status ──────────────────────────────────────────────────────────────────

  getStatus(marketId: string): MarketResolution | null {
    const resolutionId = this.resolutionByMarket.get(marketId);
    if (!resolutionId) return null;
    return this.resolutions.get(resolutionId) ?? null;
  }

  getResolutionById(resolutionId: string): MarketResolution {
    const resolution = this.resolutions.get(resolutionId);
    if (!resolution) throw new NotFoundException('Resolution not found');
    return resolution;
  }

  listResolutions(status?: string): MarketResolution[] {
    const all = [...this.resolutions.values()];
    if (!status) return all;
    return all.filter((r) => r.status === status);
  }

  // ── Manual resolution request ────────────────────────────────────────────────

  requestResolution(
    userId: string,
    dto: RequestResolutionDto,
  ): MarketResolution {
    const existing = this.resolutionByMarket.get(dto.marketId);
    if (existing) {
      const res = this.resolutions.get(existing)!;
      if (res.status !== 'cancelled') {
        throw new ConflictException(
          `Market ${dto.marketId} already has an active resolution (status: ${res.status})`,
        );
      }
    }

    const resolution: MarketResolution = {
      id: uuidv4(),
      marketId: dto.marketId,
      requestedBy: userId,
      outcome: dto.outcome,
      status: 'requested',
      evidence: dto.evidence,
      requestedAt: new Date(),
    };

    this.resolutions.set(resolution.id, resolution);
    this.resolutionByMarket.set(dto.marketId, resolution.id);
    this.logger.log(
      `Resolution requested for market ${dto.marketId} by user ${userId} — outcome: ${dto.outcome}`,
    );
    return resolution;
  }

  cancelResolution(userId: string, resolutionId: string): MarketResolution {
    const resolution = this.getResolutionById(resolutionId);
    if (resolution.requestedBy !== userId) {
      throw new BadRequestException(
        'Only the requester can cancel this resolution',
      );
    }
    if (!['requested', 'pending'].includes(resolution.status)) {
      throw new BadRequestException(
        `Cannot cancel a resolution with status: ${resolution.status}`,
      );
    }
    resolution.status = 'cancelled';
    resolution.cancelledAt = new Date();
    this.logger.log(`Resolution ${resolutionId} cancelled by user ${userId}`);
    return resolution;
  }

  // ── Confirmation ─────────────────────────────────────────────────────────────

  confirmResolution(
    userId: string,
    resolutionId: string,
    dto: ConfirmResolutionDto,
  ): ResolutionConfirmation {
    const resolution = this.getResolutionById(resolutionId);

    if (!['requested', 'pending'].includes(resolution.status)) {
      throw new BadRequestException(
        `Cannot confirm a resolution with status: ${resolution.status}`,
      );
    }

    const confirmation: ResolutionConfirmation = {
      id: uuidv4(),
      resolutionId,
      marketId: resolution.marketId,
      confirmedBy: userId,
      txHash: dto.txHash,
      blockNumber: dto.blockNumber,
      confirmedAt: new Date(),
    };

    this.confirmations.set(confirmation.id, confirmation);

    const existing = this.confirmationsByResolution.get(resolutionId) ?? [];
    existing.push(confirmation.id);
    this.confirmationsByResolution.set(resolutionId, existing);

    // Mark resolution as confirmed once at least one confirmation is recorded
    resolution.status = 'confirmed';
    resolution.confirmedAt = new Date();
    if (dto.txHash) resolution.txHash = dto.txHash;

    this.logger.log(
      `Resolution ${resolutionId} confirmed by user ${userId}${dto.txHash ? ` (tx: ${dto.txHash})` : ''}`,
    );
    return confirmation;
  }

  getConfirmations(resolutionId: string): ResolutionConfirmation[] {
    this.getResolutionById(resolutionId); // ensure it exists
    const ids = this.confirmationsByResolution.get(resolutionId) ?? [];
    return ids.map((id) => this.confirmations.get(id)!).filter(Boolean);
  }

  // ── Finalise resolution ───────────────────────────────────────────────────────

  /**
   * Finalise a confirmed resolution, recording it in the audit trail (#914).
   *
   * This is the manual counterpart to `MarketResolverService.resolveMarket` and
   * settles real stakes, so the outcome and the evidence trail behind it are
   * captured durably rather than only in the in-memory resolution store — which
   * is discarded on restart along with the entire dispute history.
   *
   * @param resolutionId - The resolution to finalise.
   * @param actor - Optional finaliser identifier for the audit entry.
   */
  async finaliseResolution(
    resolutionId: string,
    actor?: string,
  ): Promise<MarketResolution> {
    const resolution = this.getResolutionById(resolutionId);

    if (resolution.status !== 'confirmed') {
      throw new BadRequestException(
        `Resolution must be confirmed before finalising (current status: ${resolution.status})`,
      );
    }

    const openDisputes = this.getDisputes(resolutionId).filter(
      (d) => d.status === 'open' || d.status === 'under_review',
    );
    if (openDisputes.length > 0) {
      throw new BadRequestException(
        `Cannot finalise: ${openDisputes.length} open dispute(s) must be resolved first`,
      );
    }

    const previousStatus = resolution.status;
    // Bound to a local so the audit entry below gets a `Date`, not
    // `Date | undefined` — `resolvedAt` is optional on the entity and
    // strictNullChecks is on.
    const resolvedAt = new Date();
    resolution.status = 'resolved';
    resolution.resolvedAt = resolvedAt;
    this.logger.log(
      `Resolution ${resolutionId} finalised — market ${resolution.marketId} resolved as ${resolution.outcome}`,
    );

    await auditTrail.logMarketResolved({
      marketId: resolution.marketId,
      actor: actor ?? resolution.requestedBy,
      outcome: resolution.outcome,
      // A manual finalisation has no computed payout of its own; the oracle /
      // resolver pipeline records that in MARKET_RESOLVED.
      totalPayout: 0n,
      resolvedAt,
    });
    void auditTrail.logMarketAction({
      action: auditTrail.MARKET_AUDIT_ACTIONS.RESOLUTION_FINALISED,
      marketId: resolution.marketId,
      description: `Resolution ${resolutionId} finalised for market ${resolution.marketId} as ${resolution.outcome}`,
      severity: 'HIGH',
      metadata: {
        resolutionId,
        requestedBy: resolution.requestedBy,
        txHash: resolution.txHash ?? null,
        confirmations: this.getConfirmations(resolutionId).length,
        disputes: this.getDisputes(resolutionId).length,
      },
      changes: {
        before: { status: previousStatus },
        after: { status: resolution.status, outcome: resolution.outcome },
      },
    });

    return resolution;
  }

  // ── Disputes ─────────────────────────────────────────────────────────────────

  raiseDispute(
    userId: string,
    resolutionId: string,
    dto: DisputeResolutionDto,
  ): ResolutionDispute {
    const resolution = this.getResolutionById(resolutionId);

    if (!['requested', 'confirmed'].includes(resolution.status)) {
      throw new BadRequestException(
        `Cannot dispute a resolution with status: ${resolution.status}`,
      );
    }

    const dispute: ResolutionDispute = {
      id: uuidv4(),
      resolutionId,
      marketId: resolution.marketId,
      disputedBy: userId,
      reason: dto.reason,
      status: 'open',
      raisedAt: new Date(),
    };

    this.disputes.set(dispute.id, dispute);

    const existing = this.disputesByResolution.get(resolutionId) ?? [];
    existing.push(dispute.id);
    this.disputesByResolution.set(resolutionId, existing);

    // Flag the resolution as disputed
    resolution.status = 'disputed';

    this.logger.log(
      `Dispute raised on resolution ${resolutionId} by user ${userId}`,
    );
    return dispute;
  }

  getDisputes(resolutionId: string): ResolutionDispute[] {
    this.getResolutionById(resolutionId); // ensure it exists
    const ids = this.disputesByResolution.get(resolutionId) ?? [];
    return ids.map((id) => this.disputes.get(id)!).filter(Boolean);
  }

  getDisputeById(disputeId: string): ResolutionDispute {
    const dispute = this.disputes.get(disputeId);
    if (!dispute) throw new NotFoundException('Dispute not found');
    return dispute;
  }

  reviewDispute(disputeId: string, dto: ReviewDisputeDto): ResolutionDispute {
    const dispute = this.getDisputeById(disputeId);

    if (dispute.status !== 'open' && dispute.status !== 'under_review') {
      throw new BadRequestException(`Dispute is already ${dispute.status}`);
    }

    dispute.status = dto.decision === 'upheld' ? 'upheld' : 'rejected';
    dispute.reviewNotes = dto.reviewNotes;
    dispute.reviewedAt = new Date();
    dispute.resolvedAt = new Date();

    // If upheld, revert resolution to requested so it can be re-evaluated
    if (dto.decision === 'upheld') {
      const resolution = this.resolutions.get(dispute.resolutionId);
      if (resolution) {
        resolution.status = 'requested';
        resolution.confirmedAt = undefined;
        this.logger.log(
          `Dispute ${disputeId} upheld — resolution ${dispute.resolutionId} reverted to requested`,
        );
      }
    } else {
      // If all disputes on this resolution are now rejected, restore confirmed status
      const allDisputes = this.getDisputes(dispute.resolutionId);
      const anyOpen = allDisputes.some(
        (d) => d.status === 'open' || d.status === 'under_review',
      );
      if (!anyOpen) {
        const resolution = this.resolutions.get(dispute.resolutionId);
        if (resolution && resolution.status === 'disputed') {
          resolution.status = 'confirmed';
          this.logger.log(
            `All disputes on resolution ${dispute.resolutionId} rejected — status restored to confirmed`,
          );
        }
      }
    }

    return dispute;
  }

  // ── Reports ──────────────────────────────────────────────────────────────────

  generateReport(marketId: string): ResolutionReport {
    const resolution = this.getStatus(marketId);
    const resolutionId = resolution?.id;

    const confirmations = resolutionId
      ? this.getConfirmations(resolutionId)
      : [];
    const disputes = resolutionId ? this.getDisputes(resolutionId) : [];
    const openDisputes = disputes.filter(
      (d) => d.status === 'open' || d.status === 'under_review',
    ).length;

    const report: ResolutionReport = {
      marketId,
      resolution,
      confirmations,
      disputes,
      totalDisputes: disputes.length,
      openDisputes,
      generatedAt: new Date(),
    };

    this.logger.log(`Resolution report generated for market ${marketId}`);
    return report;
  }
}
