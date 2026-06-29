import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { AuditLog, AuditReport } from './market-audit.entity';

@Injectable()
export class MarketAuditService {
  private logs: AuditLog[] = [];
  private retentionDays = 90;

  createLog(input: {
    marketId: string;
    operation: string;
    actor: string;
    details: string;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }): AuditLog {
    const previousHash = this.logs.length
      ? this.logs[this.logs.length - 1].hash
      : 'GENESIS';

    const createdAt = new Date().toISOString();
    const log: AuditLog = {
      id: randomUUID(),
      marketId: input.marketId,
      operation: input.operation,
      actor: input.actor,
      details: input.details,
      severity: input.severity ?? 'LOW',
      createdAt,
      previousHash,
      hash: this.hashRecord(
        `${input.marketId}|${input.operation}|${input.actor}|${input.details}|${createdAt}|${previousHash}`,
      ),
    };

    this.logs.push(log);
    return log;
  }

  queryLogs(filters: {
    marketId?: string;
    operation?: string;
    actor?: string;
    from?: string;
    to?: string;
    limit?: number;
  }): AuditLog[] {
    const fromTs = filters.from ? new Date(filters.from).getTime() : undefined;
    const toTs = filters.to ? new Date(filters.to).getTime() : undefined;

    const result = this.logs.filter((entry) => {
      if (filters.marketId && entry.marketId !== filters.marketId) return false;
      if (filters.operation && entry.operation !== filters.operation)
        return false;
      if (filters.actor && entry.actor !== filters.actor) return false;

      const ts = new Date(entry.createdAt).getTime();
      if (fromTs && ts < fromTs) return false;
      if (toTs && ts > toTs) return false;

      return true;
    });

    const limit = filters.limit && filters.limit > 0 ? filters.limit : 100;
    return result.slice(-limit);
  }

  setRetentionPolicy(retentionDays: number): void {
    this.retentionDays = retentionDays;
  }

  enforceRetention(): { removed: number; retained: number; retentionDays: number } {
    const cutoff = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
    const originalCount = this.logs.length;

    this.logs = this.logs.filter(
      (entry) => new Date(entry.createdAt).getTime() >= cutoff,
    );

    return {
      removed: originalCount - this.logs.length,
      retained: this.logs.length,
      retentionDays: this.retentionDays,
    };
  }

  generateReport(windowStart?: string, windowEnd?: string): AuditReport {
    const selected = this.queryLogs({
      from: windowStart,
      to: windowEnd,
      limit: Number.MAX_SAFE_INTEGER,
    });

    const severityTemplate: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', number> =
      {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        CRITICAL: 0,
      };

    const byOperation: Record<string, number> = {};
    const marketSet = new Set<string>();
    const actorSet = new Set<string>();

    selected.forEach((log) => {
      severityTemplate[log.severity] += 1;
      byOperation[log.operation] = (byOperation[log.operation] ?? 0) + 1;
      marketSet.add(log.marketId);
      actorSet.add(log.actor);
    });

    return {
      totalLogs: selected.length,
      marketsTouched: marketSet.size,
      actors: actorSet.size,
      bySeverity: severityTemplate,
      byOperation,
      windowStart,
      windowEnd,
    };
  }

  verifyIntegrity(): { valid: boolean; brokenAt?: string } {
    let previousHash = 'GENESIS';

    for (const log of this.logs) {
      const recomputed = this.hashRecord(
        `${log.marketId}|${log.operation}|${log.actor}|${log.details}|${log.createdAt}|${previousHash}`,
      );

      if (log.previousHash !== previousHash || log.hash !== recomputed) {
        return { valid: false, brokenAt: log.id };
      }

      previousHash = log.hash;
    }

    return { valid: true };
  }

  private hashRecord(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
