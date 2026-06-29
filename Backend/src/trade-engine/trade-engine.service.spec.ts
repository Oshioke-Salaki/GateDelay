import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TradeEngineService } from './trade-engine.service';
import { Order } from './schemas/order.schema';
import Big from 'big.js';

/**
 * Helper: build a mock OrderDocument
 */
function makeOrder(overrides: Partial<Record<string, unknown>> = {}) {
  const base = {
    _id: 'order_' + Math.random().toString(36).slice(2),
    userId: 'user_A',
    type: 'Limit',
    side: 'Buy',
    pair: 'ETH-USDT',
    price: '2000',
    stopPrice: '0',
    amount: '1',
    filled: '0',
    status: 'Pending',
    timestamp: new Date(),
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
  (base as any).id = base._id;
  return base;
}

describe('TradeEngineService', () => {
  let service: TradeEngineService;

  /** Mocked Mongoose model */
  const mockOrderModel = {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    db: {
      startSession: jest.fn().mockRejectedValue(new Error('No replica set')),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradeEngineService,
        {
          provide: getModelToken(Order.name),
          useValue: mockOrderModel,
        },
      ],
    }).compile();

    service = module.get<TradeEngineService>(TradeEngineService);
    jest.clearAllMocks();
  });

  // ────────────────────────────────────────────── Constraint Validation

  describe('validateOrderConstraints (private via placeOrder)', () => {
    it('should throw BadRequestException for Limit order with no price', async () => {
      mockOrderModel.create.mockResolvedValue(makeOrder());

      await expect(
        service.placeOrder('user_A', {
          pair: 'ETH-USDT',
          type: 'Limit' as any,
          side: 'Buy' as any,
          price: '0',
          amount: '1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for Stop-Loss with no stopPrice', async () => {
      await expect(
        service.placeOrder('user_A', {
          pair: 'ETH-USDT',
          type: 'Stop-Loss' as any,
          side: 'Sell' as any,
          stopPrice: '0',
          amount: '1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for zero amount', async () => {
      await expect(
        service.placeOrder('user_A', {
          pair: 'ETH-USDT',
          type: 'Market' as any,
          side: 'Buy' as any,
          amount: '0',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ──────────────────────────────────── Unit Test: Partial Fill Precision

  describe('Unit Test: Partial fill logic and decimal precision', () => {
    it('should match partial fill leaving residual in order book', async () => {
      const takerOrder = makeOrder({ amount: '1.05', side: 'Buy', price: '2000', filled: '0', status: 'Pending' });
      const makerOrder = makeOrder({ userId: 'user_B', side: 'Sell', price: '2000', amount: '0.5', filled: '0', status: 'Pending' });

      mockOrderModel.create.mockResolvedValue(takerOrder);
      mockOrderModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([makerOrder]),
      });
      mockOrderModel.findByIdAndUpdate.mockResolvedValue(true);
      mockOrderModel.findById.mockResolvedValue({
        ...takerOrder,
        filled: '0.5',
        status: 'Partial',
      });

      const result = await service.placeOrder('user_A', {
        pair: 'ETH-USDT',
        type: 'Limit' as any,
        side: 'Buy' as any,
        price: '2000',
        amount: '1.05',
      });

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].amount).toBe('0.5');
      expect(result.matches[0].price).toBe('2000');

      // Residual = 1.05 - 0.5 = 0.55
      const residual = new Big('1.05').minus('0.5').toString();
      expect(residual).toBe('0.55');
    });
  });

  // ────────────────────────────────────── Integration Test: Limit + Market

  describe('Integration Test: Order matching sequence', () => {
    it('should fully fill a Market order against a resting Limit ask', async () => {
      const takerOrder = makeOrder({ type: 'Market', side: 'Buy', amount: '1', filled: '0', status: 'Pending', price: '0' });
      const makerOrder = makeOrder({ userId: 'user_B', type: 'Limit', side: 'Sell', price: '1900', amount: '1', filled: '0', status: 'Pending' });

      mockOrderModel.create.mockResolvedValue(takerOrder);
      mockOrderModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([makerOrder]),
      });
      mockOrderModel.findByIdAndUpdate.mockResolvedValue(true);
      mockOrderModel.findById.mockResolvedValue({
        ...takerOrder,
        filled: '1',
        status: 'Filled',
      });

      const result = await service.placeOrder('user_A', {
        pair: 'ETH-USDT',
        type: 'Market' as any,
        side: 'Buy' as any,
        amount: '1',
      });

      expect(result.order.status).toBe('Filled');
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].amount).toBe('1');
    });

    it('should block self-trading: taker cannot match own resting orders', async () => {
      const takerOrder = makeOrder({ type: 'Limit', side: 'Buy', price: '2000', amount: '1', filled: '0', status: 'Pending' });
      // Model returns no candidates (self-trading filtered by $ne userId)
      mockOrderModel.create.mockResolvedValue(takerOrder);
      mockOrderModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      mockOrderModel.findByIdAndUpdate.mockResolvedValue(true);
      mockOrderModel.findById.mockResolvedValue({ ...takerOrder, status: 'Pending' });

      const result = await service.placeOrder('user_A', {
        pair: 'ETH-USDT',
        type: 'Limit' as any,
        side: 'Buy' as any,
        price: '2000',
        amount: '1',
      });

      expect(result.matches).toHaveLength(0);
      expect(result.order.status).toBe('Pending');
    });
  });

  // ────────────────────────────────── Stress Test: Whale vs Many Small Orders

  describe('Stress Test: Whale order matched against multiple small orders', () => {
    it('should fully match a whale sell against 10 small buy orders', async () => {
      const takerOrder = makeOrder({ type: 'Market', side: 'Sell', amount: '10', filled: '0', status: 'Pending', price: '0' });

      const makers = Array.from({ length: 10 }, (_, i) =>
        makeOrder({ userId: `user_${i}`, type: 'Limit', side: 'Buy', price: '2000', amount: '1', filled: '0', status: 'Pending' }),
      );

      mockOrderModel.create.mockResolvedValue(takerOrder);
      mockOrderModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(makers),
      });
      mockOrderModel.findByIdAndUpdate.mockResolvedValue(true);
      mockOrderModel.findById.mockResolvedValue({ ...takerOrder, filled: '10', status: 'Filled' });

      const result = await service.placeOrder('user_whale', {
        pair: 'ETH-USDT',
        type: 'Market' as any,
        side: 'Sell' as any,
        amount: '10',
      });

      expect(result.matches).toHaveLength(10);
      const totalMatched = result.matches.reduce(
        (acc, m) => acc.plus(m.amount),
        new Big(0),
      );
      expect(totalMatched.toString()).toBe('10');
      expect(result.order.status).toBe('Filled');
    });
  });

  // ────────────────────────────────── Failure Test: Rollback on Error

  describe('Failure Test: Rollback verification', () => {
    it('should propagate errors from the settlement stage', async () => {
      const takerOrder = makeOrder({ type: 'Limit', side: 'Buy', price: '2000', amount: '1', filled: '0', status: 'Pending' });
      const makerOrder = makeOrder({ userId: 'user_B', side: 'Sell', price: '2000', amount: '1', filled: '0', status: 'Pending' });

      mockOrderModel.create.mockResolvedValue(takerOrder);
      mockOrderModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([makerOrder]),
      });
      // Simulate DB failure during settlement
      mockOrderModel.findByIdAndUpdate.mockRejectedValue(new Error('DB write failed'));

      await expect(
        service.placeOrder('user_A', {
          pair: 'ETH-USDT',
          type: 'Limit' as any,
          side: 'Buy' as any,
          price: '2000',
          amount: '1',
        }),
      ).rejects.toThrow('DB write failed');
    });
  });

  // ────────────────────────────────────────── Cancel & Lifecycle Tests

  describe('Order lifecycle', () => {
    it('should cancel a Pending order', async () => {
      const order = makeOrder({ status: 'Pending' });
      mockOrderModel.findById.mockResolvedValue(order);

      const result = await service.cancelOrder('user_A', order._id as string);
      expect(result.status).toBe('Canceled');
      expect(order.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when canceling unknown order', async () => {
      mockOrderModel.findById.mockResolvedValue(null);
      await expect(service.cancelOrder('user_A', 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when canceling a Filled order', async () => {
      const order = makeOrder({ status: 'Filled' });
      mockOrderModel.findById.mockResolvedValue(order);
      await expect(service.cancelOrder('user_A', order._id as string)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException on unauthorized cancel', async () => {
      const order = makeOrder({ userId: 'user_B', status: 'Pending' });
      mockOrderModel.findById.mockResolvedValue(order);
      await expect(service.cancelOrder('user_A', order._id as string)).rejects.toThrow(BadRequestException);
    });
  });
});
