import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { DepositService } from './deposit.service';
import { Deposit, DepositStatus, ConfirmationLevel } from './schemas/deposit.schema';

describe('DepositService', () => {
  let service: DepositService;
  let depositModel: any;

  const mockDeposit = {
    id: '507f1f77bcf86cd799439011',
    userId: 'user123',
    txHash: '0x1234567890abcdef',
    fromAddress: '0xfrom',
    toAddress: '0xto',
    amount: '1000000000000000000',
    currency: 'ETH',
    network: 'ethereum',
    status: DepositStatus.PENDING,
    confirmations: 0,
    requiredConfirmations: ConfirmationLevel.STANDARD,
    balanceUpdated: false,
    notificationSent: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn().mockResolvedValue(this),
  };

  const mockDepositModelFn = jest.fn().mockImplementation((dto) => {
    return {
      ...mockDeposit,
      ...dto,
      save: jest.fn().mockResolvedValue({
        ...mockDeposit,
        ...dto,
      }),
    };
  });

  const mockDepositModel = Object.assign(mockDepositModelFn, {
    new: jest.fn().mockResolvedValue(mockDeposit),
    constructor: jest.fn().mockResolvedValue(mockDeposit),
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    updateMany: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    exec: jest.fn(),
  });

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      if (key === 'BLOCKCHAIN_RPC_URL') return 'https://rpc.test.com';
      if (key === 'REDIS_URL') return 'redis://localhost:6379';
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepositService,
        {
          provide: getModelToken(Deposit.name),
          useValue: mockDepositModel,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<DepositService>(DepositService);
    depositModel = module.get(getModelToken(Deposit.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createDeposit', () => {
    it('should create a new deposit', async () => {
      const dto = {
        userId: 'user123',
        txHash: '0xnew',
        fromAddress: '0xfrom',
        toAddress: '0xto',
        amount: '1000000000000000000',
        currency: 'ETH',
        network: 'ethereum',
      };

      mockDepositModel.findOne.mockResolvedValue(null);
      mockDepositModel.new.mockReturnValue({
        ...mockDeposit,
        save: jest.fn().mockResolvedValue(mockDeposit),
      });

      // Mock provider methods
      (service as any).provider = {
        getTransaction: jest.fn().mockResolvedValue({
          from: '0xfrom',
          to: '0xto',
          value: '1000000000000000000',
        }),
      };

      // Mock redis
      (service as any).redis = {
        setex: jest.fn().mockResolvedValue('OK'),
      };

      const result = await service.createDeposit(dto);

      expect(result).toBeDefined();
      expect(result.userId).toBe(dto.userId);
    });

    it('should throw error if deposit already exists', async () => {
      const dto = {
        userId: 'user123',
        txHash: '0xexisting',
        fromAddress: '0xfrom',
        toAddress: '0xto',
        amount: '1000000000000000000',
        currency: 'ETH',
        network: 'ethereum',
      };

      mockDepositModel.findOne.mockResolvedValue(mockDeposit);

      await expect(service.createDeposit(dto)).rejects.toThrow();
    });
  });

  describe('getDepositById', () => {
    it('should return deposit by ID', async () => {
      mockDepositModel.findById.mockResolvedValue(mockDeposit);

      // Mock redis
      (service as any).redis = {
        get: jest.fn().mockResolvedValue(null),
        setex: jest.fn().mockResolvedValue('OK'),
      };

      const result = await service.getDepositById('507f1f77bcf86cd799439011');

      expect(result).toBeDefined();
      expect(result.id).toBe(mockDeposit.id);
    });

    it('should throw error if deposit not found', async () => {
      mockDepositModel.findById.mockResolvedValue(null);

      // Mock redis
      (service as any).redis = {
        get: jest.fn().mockResolvedValue(null),
      };

      await expect(service.getDepositById('nonexistent')).rejects.toThrow();
    });
  });

  describe('updateConfirmations', () => {
    it('should update deposit confirmations', async () => {
      const deposit = {
        ...mockDeposit,
        save: jest.fn().mockResolvedValue(mockDeposit),
      };

      mockDepositModel.findById.mockResolvedValue(deposit);

      // Mock redis
      (service as any).redis = {
        del: jest.fn().mockResolvedValue(1),
      };

      await service.updateConfirmations('507f1f77bcf86cd799439011', 3, 12345, '0xblockhash');

      expect(deposit.confirmations).toBe(3);
      expect(deposit.save).toHaveBeenCalled();
    });

    it('should update status to CONFIRMING when confirmations > 0', async () => {
      const deposit = {
        ...mockDeposit,
        status: DepositStatus.PENDING,
        save: jest.fn().mockResolvedValue(mockDeposit),
      };

      mockDepositModel.findById.mockResolvedValue(deposit);

      // Mock redis
      (service as any).redis = {
        del: jest.fn().mockResolvedValue(1),
      };

      await service.updateConfirmations('507f1f77bcf86cd799439011', 1);

      expect(deposit.status).toBe(DepositStatus.CONFIRMING);
    });

    it('should update status to CONFIRMED when required confirmations reached', async () => {
      const deposit = {
        ...mockDeposit,
        status: DepositStatus.CONFIRMING,
        requiredConfirmations: ConfirmationLevel.STANDARD,
        save: jest.fn().mockResolvedValue(mockDeposit),
      };

      mockDepositModel.findById.mockResolvedValue(deposit);

      // Mock redis
      (service as any).redis = {
        del: jest.fn().mockResolvedValue(1),
      };

      await service.updateConfirmations('507f1f77bcf86cd799439011', 3);

      expect(deposit.status).toBe(DepositStatus.CONFIRMED);
      expect(deposit.confirmedAt).toBeDefined();
    });
  });

  describe('getPendingDeposits', () => {
    it('should return pending deposits', async () => {
      const pendingDeposits = [mockDeposit, { ...mockDeposit, id: 'another' }];

      mockDepositModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(pendingDeposits),
      });

      const result = await service.getPendingDeposits();

      expect(result).toHaveLength(2);
      expect(mockDepositModel.find).toHaveBeenCalledWith({
        status: { $in: [DepositStatus.PENDING, DepositStatus.CONFIRMING] },
        expiresAt: { $gt: expect.any(Date) },
      });
    });
  });

  describe('getStatistics', () => {
    it('should return deposit statistics', async () => {
      mockDepositModel.aggregate.mockResolvedValueOnce([
        { _id: DepositStatus.PENDING, count: 5 },
        { _id: DepositStatus.CONFIRMED, count: 10 },
      ]);

      mockDepositModel.aggregate.mockResolvedValueOnce([{ _id: null, total: 1000 }]);

      const result = await service.getStatistics();

      expect(result.total).toBe(15);
      expect(result.pending).toBe(5);
      expect(result.confirmed).toBe(10);
      expect(result.totalAmount).toBe('1000');
    });
  });

  describe('expireOldDeposits', () => {
    it('should expire old deposits', async () => {
      mockDepositModel.updateMany.mockResolvedValue({ modifiedCount: 3 });

      const result = await service.expireOldDeposits();

      expect(result).toBe(3);
      expect(mockDepositModel.updateMany).toHaveBeenCalledWith(
        {
          status: { $in: [DepositStatus.PENDING, DepositStatus.CONFIRMING] },
          expiresAt: { $lt: expect.any(Date) },
        },
        {
          status: DepositStatus.EXPIRED,
        },
      );
    });
  });
});
