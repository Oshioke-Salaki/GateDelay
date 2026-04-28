import { Test, TestingModule } from '@nestjs/testing';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { WalletService } from '../wallet.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { HttpStatus, StreamableFile } from '@nestjs/common';

describe('BackupController', () => {
  let controller: BackupController;
  let service: BackupService;
  let walletService: WalletService;

  const mockBackup = { data: 'mock-data', checksum: 'mock-checksum' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BackupController],
      providers: [
        {
          provide: BackupService,
          useValue: {
            generateBackup: jest.fn().mockResolvedValue(mockBackup),
            verifyBackup: jest.fn().mockResolvedValue(true),
            restoreFromBackup: jest.fn().mockResolvedValue({ address: '0x123' }),
          },
        },
        {
          provide: WalletService,
          useValue: {
            registerRecoveredWallet: jest.fn().mockResolvedValue({ address: '0x123', userId: 'user1' }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BackupController>(BackupController);
    service = module.get<BackupService>(BackupService);
    walletService = module.get<WalletService>(WalletService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generate', () => {
    it('should return a backup', async () => {
      const result = await controller.generate({ password: 'password123' });
      expect(result).toEqual(mockBackup);
    });
  });

  describe('verify', () => {
    it('should return isValid true', async () => {
      const result = await controller.verify({ encryptedData: 'data', password: 'pass' });
      expect(result).toEqual({ isValid: true });
    });
  });

  describe('restore', () => {
    it('should register the recovered wallet', async () => {
      const req = { user: { userId: 'user1' } };
      const result = await controller.restore(req, { encryptedData: 'data', password: 'pass' });
      expect(walletService.registerRecoveredWallet).toHaveBeenCalledWith('user1', '0x123');
      expect(result.address).toBe('0x123');
    });
  });

  describe('download', () => {
    it('should return a StreamableFile', async () => {
      const result = await controller.download({ password: 'password123' });
      expect(result).toBeInstanceOf(StreamableFile);
    });
  });
});
