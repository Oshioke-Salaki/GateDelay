import { Test, TestingModule } from '@nestjs/testing';
import { BackupService } from './backup.service';
import { ConfigService } from '@nestjs/config';
import * as bip39 from 'bip39';

describe('BackupService', () => {
  let service: BackupService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackupService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
      ],
    }).compile();

    service = module.get<BackupService>(BackupService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateBackup', () => {
    it('should generate an encrypted backup', async () => {
      const password = 'strong-password';
      const backup = await service.generateBackup(password);

      expect(backup).toBeDefined();
      expect(backup.data).toBeDefined();
      expect(backup.checksum).toBeDefined();
      expect(backup.data.length).toBeGreaterThan(64); // IV(32) + Salt(32) + Data
    });
  });

  describe('verifyBackup', () => {
    it('should return true for valid backup and password', async () => {
      const password = 'strong-password';
      const backup = await service.generateBackup(password);

      const isValid = await service.verifyBackup(backup.data, password);
      expect(isValid).toBe(true);
    });

    it('should return false for invalid password', async () => {
      const password = 'strong-password';
      const backup = await service.generateBackup(password);

      const isValid = await service.verifyBackup(backup.data, 'wrong-password');
      expect(isValid).toBe(false);
    });
  });

  describe('restoreFromBackup', () => {
    it('should restore mnemonic and address correctly', async () => {
      const password = 'strong-password';
      const backup = await service.generateBackup(password);

      const restored = await service.restoreFromBackup(backup.data, password);
      expect(restored.mnemonic).toBeDefined();
      expect(bip39.validateMnemonic(restored.mnemonic)).toBe(true);
      expect(restored.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should throw error for invalid data', async () => {
      await expect(
        service.restoreFromBackup('invalid-data', 'password'),
      ).rejects.toThrow();
    });
  });
});
