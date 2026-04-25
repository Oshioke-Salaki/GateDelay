import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Trade, TradePerformanceMetrics } from './trading-history.entity';
import { GetTradingHistoryDto, ExportTradingHistoryDto } from './dto/trading-history.dto';

@Injectable()
export class TradingHistoryService {
    private readonly trades = new Map<string, Trade>();

    recordTrade(userId: string, trade: Omit<Trade, 'id' | 'createdAt'>): Trade {
        const newTrade: Trade = {
            ...trade,
            id: uuidv4(),
            createdAt: new Date(),
        };
        this.trades.set(newTrade.id, newTrade);
        return newTrade;
    }

    getTradingHistory(userId: string, dto: GetTradingHistoryDto) {
        let userTrades = [...this.trades.values()].filter((t) => t.userId === userId);

        // Apply filters
        if (dto.type) {
            userTrades = userTrades.filter((t) => t.type === dto.type);
        }
        if (dto.status) {
            userTrades = userTrades.filter((t) => t.status === dto.status);
        }
        if (dto.marketId) {
            userTrades = userTrades.filter((t) => t.marketId === dto.marketId);
        }
        if (dto.startDate) {
            const startDate = new Date(dto.startDate);
            userTrades = userTrades.filter((t) => t.createdAt >= startDate);
        }
        if (dto.endDate) {
            const endDate = new Date(dto.endDate);
            endDate.setHours(23, 59, 59, 999);
            userTrades = userTrades.filter((t) => t.createdAt <= endDate);
        }

        // Apply sorting
        userTrades.sort((a, b) => {
            let aVal: any = a[dto.sortBy as keyof Trade] ?? 0;
            let bVal: any = b[dto.sortBy as keyof Trade] ?? 0;

            if (typeof aVal === 'string') {
                aVal = aVal.localeCompare(bVal);
                bVal = 0;
            } else if (aVal instanceof Date) {
                aVal = aVal.getTime();
                bVal = (bVal as Date).getTime();
            }

            const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return dto.sortOrder === 'desc' ? -comparison : comparison;
        });

        // Apply pagination
        const total = userTrades.length;
        const paginated = userTrades.slice(dto.offset, dto.offset + dto.limit);

        return {
            total,
            offset: dto.offset,
            limit: dto.limit,
            data: paginated,
        };
    }

    getPerformanceMetrics(userId: string): TradePerformanceMetrics {
        const userTrades = [...this.trades.values()]
            .filter((t) => t.userId === userId && (t.type === 'sell' || t.type === 'redeem'))
            .filter((t) => t.status === 'confirmed');

        if (userTrades.length === 0) {
            return {
                totalTrades: 0,
                totalVolume: 0,
                totalPnl: 0,
                winRate: 0,
                avgWin: 0,
                avgLoss: 0,
                largestWin: 0,
                largestLoss: 0,
                profitFactor: 0,
            };
        }

        const totalVolume = userTrades.reduce((sum, t) => sum + t.amount, 0);
        const totalPnl = userTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

        const winningTrades = userTrades.filter((t) => (t.pnl ?? 0) > 0);
        const losingTrades = userTrades.filter((t) => (t.pnl ?? 0) < 0);

        const avgWin = winningTrades.length > 0
            ? winningTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0) / winningTrades.length
            : 0;

        const avgLoss = losingTrades.length > 0
            ? losingTrades.reduce((sum, t) => sum + Math.abs(t.pnl ?? 0), 0) / losingTrades.length
            : 0;

        const largestWin = Math.max(...winningTrades.map((t) => t.pnl ?? 0), 0);
        const largestLoss = Math.min(...losingTrades.map((t) => t.pnl ?? 0), 0);

        const profitFactor = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;

        return {
            totalTrades: userTrades.length,
            totalVolume,
            totalPnl,
            winRate: (winningTrades.length / userTrades.length) * 100,
            avgWin,
            avgLoss,
            largestWin,
            largestLoss,
            profitFactor,
        };
    }

    exportTradingHistory(userId: string, dto: ExportTradingHistoryDto): string {
        const historyDto: GetTradingHistoryDto = {
            limit: 10000,
            offset: 0,
            type: dto.type,
            startDate: dto.startDate,
            endDate: dto.endDate,
            sortBy: 'date',
            sortOrder: 'asc',
        };

        const { data } = this.getTradingHistory(userId, historyDto);

        if (dto.format === 'json') {
            return JSON.stringify(data, null, 2);
        }

        // CSV format
        const headers = ['ID', 'Date', 'Type', 'Market ID', 'Side', 'Shares', 'Amount', 'Price', 'Status', 'P&L', 'P&L %'];
        const rows = data.map((t) => [
            t.id,
            t.createdAt.toISOString(),
            t.type,
            t.marketId,
            t.side ?? '-',
            t.shares ?? '-',
            t.amount.toFixed(2),
            t.price?.toFixed(4) ?? '-',
            t.status,
            t.pnl?.toFixed(2) ?? '-',
            t.pnlPct?.toFixed(2) ?? '-',
        ]);

        const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
        return csv;
    }

    confirmTrade(tradeId: string): Trade {
        const trade = this.trades.get(tradeId);
        if (!trade) throw new Error('Trade not found');
        trade.status = 'confirmed';
        trade.confirmedAt = new Date();
        return trade;
    }

    failTrade(tradeId: string, reason: string): Trade {
        const trade = this.trades.get(tradeId);
        if (!trade) throw new Error('Trade not found');
        trade.status = 'failed';
        trade.failureReason = reason;
        return trade;
    }
}
