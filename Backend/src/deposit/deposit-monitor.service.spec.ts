import { Test, TestingModule } from '@nestjs/testing';
import { DepositMonitorService } from './deposit-monitor.service';
import { DepositService } from './deposit.service';
import { DepositStatus, ConfirmationLevel } from './schemas/deposit.schema';

describe('DepositMonitorService', () => {
  let service: DepositMonitorService;
  let depositService: DepositService;

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
  };

  const mockDepositService = {
    getPendingDeposits: jest.fn(),
    getTransactionDetails: jest.fn(),
    updateConfirmations: jest.fn(),
    confirmDeposit: jest.fn(),
    failDeposit: jest.fn(),
    markBalanceUpdated: jest.fn(),
    markNotificationSent: jest.fn(),
    expireOldDeposits: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepositMonitorService,
        {
          provide: DepositService,
          useValue: mockDepositService,
        },
      ],
    }).compile();

    service = module.get<DepositMonitorService>(DepositMonitorService);
    depositService = module.get<DepositService>(DepositService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('monitorDeposits', () => {
    it('should monitor pending deposits', async () => {
      mockDepositService.getPendingDeposits.mockResolvedValue([mockDeposit]);
      mockDepositService.getTransactionDetails.mockResolvedValue({
        confirmations: 1,
        blockNumber: 12345,
        blockHash: '0xblockhash',
        status: 1,
      });

      await service.monitorDeposits();

      expect(mockDepositService.getPendingDeposits).toHaveBeenCalled();
      expect(mockDepositService.getTransactionDetails).toHaveBeenCalledWith(mockDeposit.txHash);
      expect(mockDepositService.updateConfirmations).toHaveBeenCalledWith(
        mockDeposit.id,
        1,
        12345,
        '0xblockhash',
      );
    });

    it('should skip if already monitoring', async () => {
      (service as any).isMonitoring = true;

      await service.monitorDeposits();

      expect(mockDepositService.getPendingDeposits).not.toHaveBeenCalled();
    });

    it('should handle confirmed deposits', async () => {
      const confirmedDeposit = {
        ...mockDeposit,
        confirmations: 3,
        requiredConfirmations: ConfirmationLevel.STANDARD,
      };

      mockDepositService.getPendingDeposits.mockResolvedValue([confirmedDeposit]);
      mockDepositService.getTransactionDetails.mockResolvedValue({
        confirmations: 3,
        blockNumber: 12345,
        blockHash: '0xblockhash',
        status: 1,
      });

      await service.monitorDeposits();

      expect(mockDepositService.confirmDeposit).toHaveBeenCalledWith(confirmedDeposit.id);
      expect(mockDepositService.markBalanceUpdated).toHaveBeenCalledWith(confirmedDeposit.id);
      expect(mockDepositService.markNotificationSent).toHaveBeenCalledWith(confirmedDeposit.id);
    });

    it('should handle failed transactions', async () => {
      mockDepositService.getPendingDeposits.mockResolvedValue([mockDeposit]);
      mockDepositService.getTransactionDetails.mockResolvedValue({
        confirmations: 1,
        blockNumber: 12345,
        blockHash: '0xblockhash',
        status: 0, // Failed
      });

      await service.monitorDeposits();

      expect(mockDepositService.failDeposit).toHaveBeenCalledWith(
        mockDeposit.id,
        'Transaction failed on blockchain',
      );
    });

    it('should process deposits in batches', async () => {
      const deposits = Array.from({ length: 25 }, (_, i) => ({
        ...mockDeposit,
        id: `deposit${i}`,
      }));

      mockDepositService.getPendingDeposits.mockResolvedValue(deposits);
      mockDepositService.getTransactionDetails.mockResolvedValue({
        confirmations: 1,
        blockNumber: 12345,
        status: 1,
      });

      await service.monitorDeposits();

      expect(mockDepositService.getTransactionDetails).toHaveBeenCalledTimes(25);
    });

    it('should handle errors gracefully', async () => {
      mockDepositService.getPendingDeposits.mockRejectedValue(new Error('Database error'));

      await expect(service.monitorDeposits()).resolves.not.toThrow();
    });
  });

  describe('expireOldDeposits', () => {
    it('should expire old deposits', async () => {
      mockDepositService.expireOldDeposits.mockResolvedValue(5);

      await service.expireOldDeposits();

      expect(mockDepositService.expireOldDeposits).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockDepositService.expireOldDeposits.mockRejectedValue(new Error('Database error'));

      await expect(service.expireOldDeposits()).resolves.not.toThrow();
    });
  });

  describe('getStatus', () => {
    it('should return monitoring status', () => {
      const status = service.getStatus();

      expect(status).toHaveProperty('isMonitoring');
      expect(typeof status.isMonitoring).toBe('boolean');
    });
  });
});
