import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { WithdrawalService } from './withdrawal.service';
import { ethers } from 'ethers';

// ── helpers ───────────────────────────────────────────────────────────────────

function mockConfigService(overrides: Record<string, string> = {}): Partial<ConfigService> {
  return {
    get: jest.fn((key: string, def?: unknown) => overrides[key] ?? def),
  };
}

/** Produce a real 65-byte personal-sign signature for `msg` using `wallet`. */
async function sign(wallet: { signMessage(msg: string): Promise<string> }, msg: string): Promise<string> {
  return wallet.signMessage(msg);
}

const AMOUNT = '1000000000000000000'; // 1 ETH in wei
const USER_ID = 'user-abc';
const OTHER_USER = 'user-xyz';

// Use real deterministic wallets so checksum addresses are always valid.
const walletA = ethers.Wallet.createRandom();
const walletB = ethers.Wallet.createRandom();
const walletC = ethers.Wallet.createRandom();

const FROM = walletA.address; // checksummed
const TO = walletB.address;
const TOKEN = '0x' + '1'.repeat(40); // valid-looking ERC-20 address

// ── test suite ────────────────────────────────────────────────────────────────

describe('WithdrawalService', () => {
  let service: WithdrawalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawalService,
        { provide: ConfigService, useValue: mockConfigService() },
      ],
    }).compile();

    service = module.get<WithdrawalService>(WithdrawalService);
  });

  // ── initiation ────────────────────────────────────────────────────────────

  describe('initiateWithdrawal', () => {
    it('should create a pending withdrawal record for native transfer', () => {
      const result = service.initiateWithdrawal(USER_ID, {
        fromAddress: FROM,
        toAddress: TO,
        tokenAddress: 'NATIVE',
        amount: AMOUNT,
      });

      expect(result.withdrawalId).toBeDefined();
      expect(result.record.status).toBe('pending');
      expect(result.record.tokenAddress).toBe('NATIVE');
      expect(result.txData).toMatchObject({ from: FROM, to: TO });
    });

    it('should create a pending withdrawal record for ERC-20 transfer', () => {
      const result = service.initiateWithdrawal(USER_ID, {
        fromAddress: FROM,
        toAddress: TO,
        tokenAddress: TOKEN,
        amount: AMOUNT,
      });

      expect(result.record.tokenAddress).toBe(ethers.getAddress(TOKEN));
      const tx = result.txData as { to: string; data: string };
      expect(tx.to).toBe(ethers.getAddress(TOKEN));
      expect(tx.data).toMatch(/^0x/);
    });

    it('should reject self-transfers', () => {
      expect(() =>
        service.initiateWithdrawal(USER_ID, {
          fromAddress: FROM,
          toAddress: FROM,
          tokenAddress: 'NATIVE',
          amount: AMOUNT,
        }),
      ).toThrow(BadRequestException);
    });

    it('should reject zero or negative amounts', () => {
      expect(() =>
        service.initiateWithdrawal(USER_ID, {
          fromAddress: FROM,
          toAddress: TO,
          tokenAddress: 'NATIVE',
          amount: '0',
        }),
      ).toThrow(BadRequestException);
    });

    it('should reject non-numeric amounts', () => {
      expect(() =>
        service.initiateWithdrawal(USER_ID, {
          fromAddress: FROM,
          toAddress: TO,
          tokenAddress: 'NATIVE',
          amount: 'not-a-number',
        }),
      ).toThrow(BadRequestException);
    });

    it('should reject invalid from-address', () => {
      expect(() =>
        service.initiateWithdrawal(USER_ID, {
          fromAddress: 'bad-address',
          toAddress: TO,
          tokenAddress: 'NATIVE',
          amount: AMOUNT,
        }),
      ).toThrow(BadRequestException);
    });
  });

  // ── listing ───────────────────────────────────────────────────────────────

  describe('listWithdrawals', () => {
    it('should return only withdrawals belonging to the user', () => {
      service.initiateWithdrawal(USER_ID, {
        fromAddress: FROM,
        toAddress: TO,
        tokenAddress: 'NATIVE',
        amount: AMOUNT,
      });
      service.initiateWithdrawal(OTHER_USER, {
        fromAddress: FROM,
        toAddress: TO,
        tokenAddress: 'NATIVE',
        amount: AMOUNT,
      });

      const list = service.listWithdrawals(USER_ID, {});
      expect(list).toHaveLength(1);
      expect(list[0].userId).toBe(USER_ID);
    });

    it('should filter by status when provided', () => {
      service.initiateWithdrawal(USER_ID, {
        fromAddress: FROM,
        toAddress: TO,
        tokenAddress: 'NATIVE',
        amount: AMOUNT,
      });

      const pending = service.listWithdrawals(USER_ID, { status: 'pending' });
      const confirmed = service.listWithdrawals(USER_ID, { status: 'confirmed' });
      expect(pending).toHaveLength(1);
      expect(confirmed).toHaveLength(0);
    });
  });

  // ── cancellation ──────────────────────────────────────────────────────────

  describe('cancelWithdrawal', () => {
    it('should cancel a pending withdrawal', () => {
      const { withdrawalId } = service.initiateWithdrawal(USER_ID, {
        fromAddress: FROM,
        toAddress: TO,
        tokenAddress: 'NATIVE',
        amount: AMOUNT,
      });

      const cancelled = service.cancelWithdrawal(withdrawalId, USER_ID);
      expect(cancelled.status).toBe('cancelled');
    });

    it('should throw when another user tries to cancel', () => {
      const { withdrawalId } = service.initiateWithdrawal(USER_ID, {
        fromAddress: FROM,
        toAddress: TO,
        tokenAddress: 'NATIVE',
        amount: AMOUNT,
      });

      expect(() =>
        service.cancelWithdrawal(withdrawalId, OTHER_USER),
      ).toThrow(ForbiddenException);
    });

    it('should throw when cancelling an already cancelled withdrawal', () => {
      const { withdrawalId } = service.initiateWithdrawal(USER_ID, {
        fromAddress: FROM,
        toAddress: TO,
        tokenAddress: 'NATIVE',
        amount: AMOUNT,
      });
      service.cancelWithdrawal(withdrawalId, USER_ID);

      expect(() =>
        service.cancelWithdrawal(withdrawalId, USER_ID),
      ).toThrow(BadRequestException);
    });

    it('should throw when withdrawal id does not exist', () => {
      expect(() =>
        service.cancelWithdrawal('non-existent-id', USER_ID),
      ).toThrow(NotFoundException);
    });
  });

  // ── tx hash submission ────────────────────────────────────────────────────

  describe('submitTxHash', () => {
    it('should update status to submitted and set txHash', async () => {
      const { withdrawalId } = service.initiateWithdrawal(USER_ID, {
        fromAddress: FROM,
        toAddress: TO,
        tokenAddress: 'NATIVE',
        amount: AMOUNT,
      });

      // Mock provider so trackConfirmations doesn't resolve synchronously and
      // overwrite the 'submitted' status before the assertion runs.
      (service as any).provider = {
        waitForTransaction: jest.fn().mockReturnValue(new Promise(() => {})),
      };

      const updated = await service.submitTxHash(withdrawalId, USER_ID, {
        txHash: '0x' + 'a'.repeat(64),
      });

      expect(updated.status).toBe('submitted');
      expect(updated.txHash).toBe('0x' + 'a'.repeat(64));
    });

    it('should throw when the withdrawal is not in pending state', async () => {
      const { withdrawalId } = service.initiateWithdrawal(USER_ID, {
        fromAddress: FROM,
        toAddress: TO,
        tokenAddress: 'NATIVE',
        amount: AMOUNT,
      });
      service.cancelWithdrawal(withdrawalId, USER_ID);

      await expect(
        service.submitTxHash(withdrawalId, USER_ID, {
          txHash: '0x' + 'b'.repeat(64),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── multi-sig ─────────────────────────────────────────────────────────────

  describe('multi-sig withdrawals', () => {
    it('should create a multi-sig record and require threshold signatures before submission', async () => {
      const signers = [walletA.address, walletB.address, walletC.address];

      const { withdrawalId, multiSigId } = service.initiateWithdrawal(USER_ID, {
        fromAddress: walletA.address,
        toAddress: walletB.address,
        tokenAddress: 'NATIVE',
        amount: AMOUNT,
        multiSigThreshold: 2,
        multiSigSigners: signers,
      });

      expect(multiSigId).toBeDefined();

      // Only one signature so far — should NOT be ready
      const sigA = await sign(walletA, `GateDelay withdrawal ${withdrawalId}`);
      const msAfterFirst = service.addMultiSigSignature(
        withdrawalId,
        USER_ID,
        { signerAddress: walletA.address, signature: sigA },
      );
      expect(msAfterFirst.status).toBe('pending');

      // Second signature — threshold reached → ready
      const sigB = await sign(walletB, `GateDelay withdrawal ${withdrawalId}`);
      const msAfterSecond = service.addMultiSigSignature(
        withdrawalId,
        USER_ID,
        { signerAddress: walletB.address, signature: sigB },
      );
      expect(msAfterSecond.status).toBe('ready');
    });

    it('should block submission when multi-sig threshold not yet reached', async () => {
      const signers = [walletA.address, walletB.address];

      const { withdrawalId } = service.initiateWithdrawal(USER_ID, {
        fromAddress: walletA.address,
        toAddress: walletC.address,
        tokenAddress: 'NATIVE',
        amount: AMOUNT,
        multiSigThreshold: 2,
        multiSigSigners: signers,
      });

      await expect(
        service.submitTxHash(withdrawalId, USER_ID, {
          txHash: '0x' + 'c'.repeat(64),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject a duplicate signature from the same signer', async () => {
      const signers = [walletA.address, walletB.address];

      const { withdrawalId } = service.initiateWithdrawal(USER_ID, {
        fromAddress: walletA.address,
        toAddress: walletC.address,
        tokenAddress: 'NATIVE',
        amount: AMOUNT,
        multiSigThreshold: 2,
        multiSigSigners: signers,
      });

      const sigA = await sign(walletA, `GateDelay withdrawal ${withdrawalId}`);
      service.addMultiSigSignature(withdrawalId, USER_ID, {
        signerAddress: walletA.address,
        signature: sigA,
      });

      // Same signer again
      expect(() =>
        service.addMultiSigSignature(withdrawalId, USER_ID, {
          signerAddress: walletA.address,
          signature: sigA,
        }),
      ).toThrow(BadRequestException);
    });

    it('should reject a signature from an address that is not a registered signer', async () => {
      const nonSigner = ethers.Wallet.createRandom();
      const signers = [walletA.address, walletB.address];

      const { withdrawalId } = service.initiateWithdrawal(USER_ID, {
        fromAddress: walletA.address,
        toAddress: walletC.address,
        tokenAddress: 'NATIVE',
        amount: AMOUNT,
        multiSigThreshold: 2,
        multiSigSigners: signers,
      });

      const sig = await sign(nonSigner, `GateDelay withdrawal ${withdrawalId}`);
      expect(() =>
        service.addMultiSigSignature(withdrawalId, USER_ID, {
          signerAddress: nonSigner.address,
          signature: sig,
        }),
      ).toThrow(ForbiddenException);
    });

    it('should reject when threshold exceeds number of signers', () => {
      expect(() =>
        service.initiateWithdrawal(USER_ID, {
          fromAddress: walletA.address,
          toAddress: walletC.address,
          tokenAddress: 'NATIVE',
          amount: AMOUNT,
          multiSigThreshold: 3,
          multiSigSigners: [walletA.address, walletB.address],
        }),
      ).toThrow(BadRequestException);
    });
  });
});
