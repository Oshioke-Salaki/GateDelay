import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import {
  ReconciliationReport,
  SourceTrade,
  TradeDiscrepancy,
} from './trade-reconciliation.entity';

@Injectable()
export class TradeReconciliationService {
  private readonly sourceBooks = new Map<string, Map<string, SourceTrade>>();
  private readonly discrepancies = new Map<string, TradeDiscrepancy>();
  private readonly reports: ReconciliationReport[] = [];

  ingestTrades(source: string, trades: SourceTrade[]): { ingested: number } {
    if (!this.sourceBooks.has(source)) {
      this.sourceBooks.set(source, new Map<string, SourceTrade>());
    }

    const book = this.sourceBooks.get(source);
    trades.forEach((trade) => book?.set(trade.tradeId, { ...trade }));

    return { ingested: trades.length };
  }

  reconcile(requestedSources?: string[]): {
    report: ReconciliationReport;
    discrepancies: TradeDiscrepancy[];
  } {
    const runId = randomUUID();
    const startedAt = new Date().toISOString();

    const sources =
      requestedSources && requestedSources.length
        ? requestedSources
        : Array.from(this.sourceBooks.keys());

    const activeBooks = sources
      .map((source) => ({ source, book: this.sourceBooks.get(source) }))
      .filter((entry): entry is { source: string; book: Map<string, SourceTrade> } =>
        Boolean(entry.book),
      );

    const allTradeIds = new Set<string>();
    activeBooks.forEach(({ book }) => {
      book.forEach((_value, tradeId) => allTradeIds.add(tradeId));
    });

    let resolvedCount = 0;
    let unresolvedCount = 0;

    allTradeIds.forEach((tradeId) => {
      const valuesBySource: Record<string, SourceTrade> = {};
      activeBooks.forEach(({ source, book }) => {
        const trade = book.get(tradeId);
        if (trade) {
          valuesBySource[source] = trade;
        }
      });

      const presentSources = Object.keys(valuesBySource);
      if (presentSources.length < 2) {
        return;
      }

      const fields = this.findConflictingFields(valuesBySource);
      if (!fields.length) {
        this.discrepancies.delete(tradeId);
        return;
      }

      const discrepancy: TradeDiscrepancy = {
        tradeId,
        sources: presentSources,
        fields,
        valuesBySource,
        resolutionStatus: 'OPEN',
        detectedAt: new Date().toISOString(),
      };

      const autoResolved = this.tryAutoResolve(discrepancy);
      if (autoResolved) {
        resolvedCount += 1;
      } else {
        unresolvedCount += 1;
      }

      this.discrepancies.set(tradeId, discrepancy);
    });

    const report: ReconciliationReport = {
      runId,
      startedAt,
      completedAt: new Date().toISOString(),
      comparedTrades: allTradeIds.size,
      discrepanciesFound: resolvedCount + unresolvedCount,
      resolvedCount,
      unresolvedCount,
    };

    this.reports.unshift(report);

    return {
      report,
      discrepancies: this.getDiscrepancies(),
    };
  }

  getDiscrepancies(status?: 'OPEN' | 'RESOLVED'): TradeDiscrepancy[] {
    const all = Array.from(this.discrepancies.values());
    return status ? all.filter((entry) => entry.resolutionStatus === status) : all;
  }

  getReports(limit = 20): ReconciliationReport[] {
    return this.reports.slice(0, limit);
  }

  @Cron('*/15 * * * *')
  runScheduledReconciliation() {
    if (this.sourceBooks.size < 2) {
      return;
    }
    this.reconcile();
  }

  private findConflictingFields(valuesBySource: Record<string, SourceTrade>): string[] {
    const fields: Array<keyof SourceTrade> = ['marketId', 'amount', 'status', 'txHash'];
    const conflicts: string[] = [];

    fields.forEach((field) => {
      const values = Object.values(valuesBySource).map((entry) => entry[field]);
      const canonical = values.map((v) => (v ?? '').toString());
      if (new Set(canonical).size > 1) {
        conflicts.push(field);
      }
    });

    return conflicts;
  }

  private tryAutoResolve(discrepancy: TradeDiscrepancy): boolean {
    const sourceEntries = Object.entries(discrepancy.valuesBySource);
    const confirmed = sourceEntries.filter(
      ([, value]) => value.status === 'confirmed',
    );

    // Auto-resolve when one source has a confirmed trade while others are pending.
    if (confirmed.length === 1) {
      discrepancy.resolutionStatus = 'RESOLVED';
      discrepancy.resolutionNote = `Auto-resolved using confirmed record from ${confirmed[0][0]}`;
      discrepancy.resolvedAt = new Date().toISOString();
      return true;
    }

    return false;
  }
}
