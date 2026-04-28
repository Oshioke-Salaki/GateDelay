import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bip39 from 'bip39';
import * as crypto from 'crypto';
import { ethers } from 'ethers';

export interface EncryptedBackup {
  data: string; // Hex string: IV (16 bytes) + Salt (16 bytes) + Encrypted Data
  checksum: string;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly algorithm = 'aes-256-cbc';

  constructor(private readonly config: ConfigService) {}

  /**
   * Generates a new mnemonic and returns it encrypted with the provided password.
   */
  async generateBackup(password: string): Promise<EncryptedBackup> {
    try {
      const mnemonic = bip39.generateMnemonic();
      return this.encrypt(mnemonic, password);
    } catch (error) {
      this.logger.error('Failed to generate backup', error);
      throw new InternalServerErrorException('Backup generation failed');
    }
  }

  /**
   * Verifies if the encrypted data can be decrypted with the given password.
   */
  async verifyBackup(encryptedData: string, password: string): Promise<boolean> {
    try {
      const decrypted = this.decrypt(encryptedData, password);
      return bip39.validateMnemonic(decrypted);
    } catch (error) {
      return false;
    }
  }

  /**
   * Decrypts the backup and returns the mnemonic and derived address.
   */
  async restoreFromBackup(encryptedData: string, password: string): Promise<{ mnemonic: string; address: string }> {
    try {
      const mnemonic = this.decrypt(encryptedData, password);
      if (!bip39.validateMnemonic(mnemonic)) {
        throw new BadRequestException('Invalid mnemonic after decryption');
      }

      const wallet = ethers.Wallet.fromPhrase(mnemonic);
      return {
        mnemonic,
        address: wallet.address,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Restoration failed', error);
      throw new BadRequestException('Failed to restore from backup. Check your password.');
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private encrypt(text: string, password: string): EncryptedBackup {
    const iv = crypto.randomBytes(16);
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(password, salt, 32);

    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Format: IV (32 hex) + Salt (32 hex) + Data
    const combinedData = iv.toString('hex') + salt.toString('hex') + encrypted;
    const checksum = crypto.createHash('sha256').update(combinedData).digest('hex');

    return {
      data: combinedData,
      checksum,
    };
  }

  private decrypt(combinedHex: string, password: string): string {
    try {
      const iv = Buffer.from(combinedHex.substring(0, 32), 'hex');
      const salt = Buffer.from(combinedHex.substring(32, 64), 'hex');
      const encryptedData = combinedHex.substring(64);

      const key = crypto.scryptSync(password, salt, 32);
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);

      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error('Decryption failed');
    }
  }
}
