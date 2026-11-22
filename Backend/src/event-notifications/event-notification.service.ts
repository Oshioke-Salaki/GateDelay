import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import {
  BlockchainEventType,
  EventFilter,
  EventNotificationRecord,
} from './event-notification.entity';
import { CreateEventFilterDto } from './dto/event-notification.dto';
import { NotificationService } from '../notifications/notification.service';
import OnChainTrade from '../../models/OnChainTrade';
import { MarketReferrerMapping } from '../../models/MarketReferrerMapping';

// Minimal ABI fragments covering all tracked events
const TRACKED_EVENTS_ABI = [
  'event TradeExecuted(address indexed trader, uint256 indexed marketId, uint256 outcome, bool isBuy, uint256 shares, uint256 collateralAmount, uint256 fee, uint256 rebate, address indexed referrer)',
  'event MarketCreated(address indexed market, address indexed creator, address indexed collateralToken, uint256 resolutionDeadline)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event LiquidityAdded(address indexed provider, uint256 indexed marketId, uint256 amount)',
  'event LiquidityRemoved(address indexed provider, uint256 indexed marketId, uint256 amount)',
  'event MarketReferrerSet(address indexed trader, address indexed referrer)',
];

@Injectable()
export class EventNotificationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventNotificationService.name);
  private provider: ethers.JsonRpcProvider;
  private listeners: Map<string, ethers.Contract> = new Map();

  // In-memory stores — swap for DB in production
  private readonly filters = new Map<string, EventFilter>();
  private readonly notifications = new Map<string, EventNotificationRecord>();

  constructor(
    private readonly config: ConfigService,
    private readonly notificationService: NotificationService,
  ) {}

  onModuleInit() {
    const rpcUrl = this.config.get<string>(
      'BLOCKCHAIN_RPC_URL',
      'https://rpc.mantle.xyz',
    );
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.startListening();
  }

  onModuleDestroy() {
    this.stopListening();
  }

  // ── Filter management ──────────────────────────────────────────────────────

  createFilter(dto: CreateEventFilterDto): EventFilter {
    const filter: EventFilter = {
      id: uuidv4(),
      userId: dto.userId,
      eventTypes: dto.eventTypes,
      contractAddress: dto.contractAddress,
      minAmount: dto.minAmount,
      createdAt: new Date(),
    };
    this.filters.set(filter.id, filter);
    this.logger.log(`Created event filter ${filter.id} for user ${dto.userId}`);
    return filter;
  }

  getFiltersForUser(userId: string): EventFilter[] {
    return [...this.filters.values()].filter((f) => f.userId === userId);
  }

  removeFilter(filterId: string, userId: string): void {
    const filter = this.filters.get(filterId);
    if (!filter || filter.userId !== userId) {
      throw new NotFoundException('Filter not found');
    }
    this.filters.delete(filterId);
  }

  // ── Notification queries ───────────────────────────────────────────────────

  getNotificationsForUser(
    userId: string,
    status?: string,
  ): EventNotificationRecord[] {
    return [...this.notifications.values()]
      .filter(
        (n) => n.userId === userId && (status ? n.status === status : true),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  markDelivered(notificationId: string): EventNotificationRecord {
    const n = this.notifications.get(notificationId);
    if (!n) throw new NotFoundException('Notification not found');
    n.status = 'delivered';
    n.deliveredAt = new Date();
    return n;
  }

  // ── Blockchain listener ────────────────────────────────────────────────────

  private startListening() {
    const contractAddresses = this.config
      .get<string>('TRACKED_CONTRACT_ADDRESSES', '')
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);

    if (contractAddresses.length === 0) {
      this.logger.warn(
        'No TRACKED_CONTRACT_ADDRESSES configured — event listener idle',
      );
      return;
    }

    for (const address of contractAddresses) {
      const contract = new ethers.Contract(
        address,
        TRACKED_EVENTS_ABI,
        this.provider,
      );
      this.attachListeners(contract, address);
      this.listeners.set(address, contract);
      this.logger.log(`Listening to contract ${address}`);
    }
  }

  private stopListening() {
    for (const contract of this.listeners.values()) {
      contract.removeAllListeners();
    }
    this.listeners.clear();
  }

  private attachListeners(contract: ethers.Contract, address: string) {
    contract.on('TradeExecuted', (...args) =>
      this.handleEvent('TradeExecuted', address, args),
    );
    contract.on('MarketCreated', (...args) =>
      this.handleEvent('MarketCreated', address, args),
    );
    contract.on('LiquidityAdded', (...args) =>
      this.handleEvent('LiquidityAdded', address, args),
    );
    contract.on('LiquidityRemoved', (...args) =>
      this.handleEvent('LiquidityRemoved', address, args),
    );
    contract.on('MarketReferrerSet', (...args) =>
      this.handleEvent('MarketReferrerSet', address, args),
    );
  }

  private async handleEvent(
    eventType: BlockchainEventType,
    contractAddress: string,
    args: unknown[],
  ) {
    const log = args[args.length - 1] as ethers.EventLog;
    const payload = this.parseEventArgs(eventType, args);

    this.logger.log(
      `Event ${eventType} from ${contractAddress} tx:${log.transactionHash}`,
    );

    // Persist on-chain trade data for rebate attribution
    if (eventType === 'TradeExecuted') {
      await this.persistTradeExecuted(contractAddress, log, payload);
    }
    if (eventType === 'MarketReferrerSet') {
      await this.persistMarketReferrerSet(payload);
    }

    // Find matching filters
    const matchingFilters = [...this.filters.values()].filter(
      (f) =>
        f.eventTypes.includes(eventType) &&
        (!f.contractAddress ||
          f.contractAddress.toLowerCase() === contractAddress.toLowerCase()),
    );

    for (const filter of matchingFilters) {
      const record: EventNotificationRecord = {
        id: uuidv4(),
        userId: filter.userId,
        eventType,
        contractAddress,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        payload,
        status: 'pending',
        attempts: 0,
        createdAt: new Date(),
      };
      this.notifications.set(record.id, record);

      await this.deliver(record);
    }
  }

  private async deliver(record: EventNotificationRecord) {
    try {
      record.attempts += 1;
      if (record.userId) {
        await this.notificationService.send({
          userId: record.userId,
          type: 'market_update',
          title: `Blockchain event: ${record.eventType}`,
          body: `Transaction ${record.txHash} on block ${record.blockNumber}`,
          data: record.payload,
        });
      }
      record.status = 'delivered';
      record.deliveredAt = new Date();
    } catch (err) {
      record.status = 'failed';
      record.error = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to deliver notification ${record.id}`,
        record.error,
      );
    }
  }

  private async persistTradeExecuted(
    contractAddress: string,
    log: ethers.EventLog,
    payload: Record<string, unknown>,
  ) {
    try {
      const fee = String(payload.fee || '0');
      const rebate = String(payload.rebate || '0');
      const feeNum = parseFloat(fee) || 0;
      const rebateNum = parseFloat(rebate) || 0;
      const commission = String(feeNum - rebateNum);

      const trade = new OnChainTrade({
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        contractAddress,
        trader: payload.trader,
        marketId: payload.marketId,
        outcome: payload.outcome,
        isBuy: payload.isBuy,
        shares: payload.shares,
        collateralAmount: payload.collateralAmount,
        fee,
        rebate,
        commission,
        referrer:
          payload.referrer && payload.referrer !== ethers.ZeroAddress
            ? payload.referrer
            : null,
      });
      await trade.save();
      this.logger.log(
        `Persisted on-chain trade: tx=${log.transactionHash} rebate=${trade.rebate} referrer=${trade.referrer || 'none'}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to persist TradeExecuted for tx ${log.transactionHash}`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  private async persistMarketReferrerSet(payload: Record<string, unknown>) {
    try {
      const trader = payload.trader as string;
      const referrer = payload.referrer as string;
      if (!trader || !referrer) return;

      await MarketReferrerMapping.findOneAndUpdate(
        { trader },
        { trader, referrer, setAt: new Date() },
        { upsert: true, new: true },
      );
      this.logger.log(`Persisted referrer mapping: ${trader} -> ${referrer}`);
    } catch (err) {
      this.logger.error(
        'Failed to persist MarketReferrerSet',
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  private parseEventArgs(
    eventType: BlockchainEventType,
    args: unknown[],
  ): Record<string, unknown> {
    switch (eventType) {
      case 'TradeExecuted':
        return {
          trader: args[0],
          marketId: String(args[1]),
          outcome: String(args[2]),
          isBuy: args[3],
          shares: String(args[4]),
          collateralAmount: String(args[5]),
          fee: String(args[6]),
          rebate: String(args[7]),
          referrer: args[8],
        };
      case 'MarketCreated':
        return {
          market: args[0],
          creator: args[1],
          collateralToken: args[2],
          resolutionDeadline: String(args[3]),
        };
      case 'LiquidityAdded':
      case 'LiquidityRemoved':
        return {
          provider: args[0],
          marketId: String(args[1]),
          amount: String(args[2]),
        };
      case 'MarketReferrerSet':
        return {
          trader: args[0],
          referrer: args[1],
        };
      default:
        return { raw: args.slice(0, -1) };
    }
  }

  // ── Manual event injection (for testing / webhooks) ────────────────────────

  async processManualEvent(
    eventType: BlockchainEventType,
    contractAddress: string,
    txHash: string,
    blockNumber: number,
    payload: Record<string, unknown>,
  ): Promise<EventNotificationRecord[]> {
    // Persist trade/referrer events from manual injection too
    if (eventType === 'TradeExecuted') {
      const fakeLog = {
        transactionHash: txHash,
        blockNumber,
      } as ethers.EventLog;
      await this.persistTradeExecuted(contractAddress, fakeLog, payload);
    }
    if (eventType === 'MarketReferrerSet') {
      await this.persistMarketReferrerSet(payload);
    }

    const matchingFilters = [...this.filters.values()].filter(
      (f) =>
        f.eventTypes.includes(eventType) &&
        (!f.contractAddress ||
          f.contractAddress.toLowerCase() === contractAddress.toLowerCase()),
    );

    const records: EventNotificationRecord[] = [];
    for (const filter of matchingFilters) {
      const record: EventNotificationRecord = {
        id: uuidv4(),
        userId: filter.userId,
        eventType,
        contractAddress,
        txHash,
        blockNumber,
        payload,
        status: 'pending',
        attempts: 0,
        createdAt: new Date(),
      };
      this.notifications.set(record.id, record);
      await this.deliver(record);
      records.push(record);
    }
    return records;
  }
}
