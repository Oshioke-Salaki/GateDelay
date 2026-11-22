import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WithdrawalService } from './withdrawal.service';
import { ethers } from 'ethers';

// ── helpers ───────────────────────────────────────────────────────────────────

function mockConfigService(
  overrides: Record<string, string> = {},
): Partial<ConfigService> {
  return {
    get: jest.fn((key: string, def?: unknown) => overrides[key] ?? def),
  };
}

/** Sign `msg` using `wallet` and return the EIP-191 personal_sign hex. */
async function sign(
  wallet: { signMessage(msg: string): Promise<string> },
  msg: string,
): Promise<string> {
  return wallet.signMessage(msg);
}

/**
 * Build the canonical approval message for a given withdrawal record using
 * the same logic as WithdrawalService.buildApprovalMessage so tests can
 * produce valid signatures without calling the service method directly.
 */
function buildApprovalMsg(fields: {
  domain: string;
  chainId: number;
  withdrawalId: string;
  fromAddress: string;
  toAddress: string;
  tokenAddress: string;
  amount: string;
  expiry: number;
}): string {
  const KEY_ORDER = [
    'amount',
    'chainId',
    'domain',
    'expiry',
    'fromAddress',
    'toAddress',
    'tokenAddress',
    'withdrawalId',
  ] as const;
  return JSON.stringify(fields, [...KEY_ORDER]);
}

const AMOUNT = '1000000000000000000'; // 1 ETH in wei
const USER_ID = 'user-abc';
const OTHER_USER = 'user-xyz';
const CHAIN_ID = 1;
const EXPIRY = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

const walletA = ethers.Wallet.createRandom();
const walletB = ethers.Wallet.createRandom();
const walletC = ethers.Wallet.createRandom();

const FROM = walletA.address;
const TO = walletB.address;
const TOKEN = ethers.getAddress('0x' + '1'.repeat(40));

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

  // ── Issue 1: Amount validation ────────────────────────────────────────────
  //
  // validateAmount must enforce a canonical uint256-range decimal integer:
  // no leading zeros, no sign, no decimal, no overflow.

  describe('amount validation (Issue 1)', () => {
    it('accepts a valid positive integer amount', () => {
      expect(() =>
        service.initiateWithdrawal(USER_ID, {
          fromAddress: FROM,
          toAddress: TO,
          tokenAddress: 'NATIVE',
          amount: AMOUNT,
        }),
      ).not.toThrow();
    });

    it('rejects zero', () => {
      expect(() =>
        service.initiateWithdrawal(USER_ID, {
          fromAddress: FROM,
          toAddress: TO,
          tokenAddress: 'NATIVE',
          amount: '0',
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects a negative amount string', () => {
      expect(() =>
        service.initiateWithdrawal(USER_ID, {
          fromAddress: FROM,
          toAddress: TO,
          tokenAddress: 'NATIVE',
          amount: '-1',
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects a fractional / decimal amount', () => {
      expect(() =>
        service.initiateWithdrawal(USER_ID, {
          fromAddress: FROM,
          toAddress: TO,
          tokenAddress: 'NATIVE',
          amount: '1.5',
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects a non-canonical leading-zero string', () => {
      expect(() =>
        service.initiateWithdrawal(USER_ID, {
          fromAddress: FROM,
          toAddress: TO,
          tokenAddress: 'NATIVE',
          amount: '01',
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects a hex-encoded amount', () => {
      expect(() =>
        service.initiateWithdrawal(USER_ID, {
          fromAddress: FROM,
          toAddress: TO,
          tokenAddress: 'NATIVE',
          amount: '0x1',
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects an octal-style leading-zero amount', () => {
      expect(() =>
        service.initiateWithdrawal(USER_ID, {
          fromAddress: FROM,
          toAddress: TO,
          tokenAddress: 'NATIVE',
          amount: '010',
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects a non-numeric string', () => {
      expect(() =>
        service.initiateWithdrawal(USER_ID, {
          fromAddress: FROM,
          toAddress: TO,
          tokenAddress: 'NATIVE',
          amount: 'not-a-number',
        }),
      ).toThrow(BadRequestException);
    });

    it('accepts uint256 max (2^256 - 1)', () => {
      const uint256Max = (2n ** 256n - 1n).toString();
      expect(() =>
        service.initiateWithdrawal(USER_ID, {
          fromAddress: FROM,
          toAddress: TO,
          tokenAddress: 'NATIVE',
          amount: uint256Max,
        }),
      ).not.toThrow();
    });

    it('rejects uint256 overflow (2^256)', () => {
      const overflow = (2n ** 256n).toString();
      expect(() =>
        service.initiateWithdrawal(USER_ID, {
          fromAddress: FROM,
          toAddress: TO,
          tokenAddress: 'NATIVE',
          amount: overflow,
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects uint256 overflow on the ERC-20 path', () => {
      const overflow = (2n ** 256n).toString();
      expect(() =>
        service.initiateWithdrawal(USER_ID, {
          fromAddress: FROM,
          toAddress: TO,
          tokenAddress: TOKEN,
          amount: overflow,
        }),
      ).toThrow(BadRequestException);
    });
  });

  // ── Issue 2: Structured approval message ─────────────────────────────────
  //
  // Approval signatures must bind destination, asset, amount, chain, and
  // expiry.  Mutating any field must invalidate the signature.

  describe('structured approval message (Issue 2)', () => {
    async function initiateMultiSig() {
      const { withdrawalId, record } = service.initiateWithdrawal(USER_ID, {
        fromAddress: walletA.address,
        toAddress: walletB.address,
        tokenAddress: 'NATIVE',
        amount: AMOUNT,
        chainId: CHAIN_ID,
        expiry: EXPIRY,
        multiSigThreshold: 2,
        multiSigSigners: [walletA.address, walletB.address, walletC.address],
      });
      return { withdrawalId, record };
    }

    it('buildApprovalMessage exposes all transfer/domain fields', async () => {
      const { record } = await initiateMultiSig();
      const { fields } = service.buildApprovalMessage(record);

      expect(fields.domain).toBe('GateDelay-withdrawal-v1');
      expect(fields.chainId).toBe(CHAIN_ID);
      expect(fields.withdrawalId).toBe(record.id);
      expect(fields.fromAddress).toBe(walletA.address);
      expect(fields.toAddress).toBe(walletB.address);
      expect(fields.tokenAddress).toBe('NATIVE');
      expect(fields.amount).toBe(AMOUNT);
      expect(fields.expiry).toBe(EXPIRY);
    });

    it('accepts a valid structured-message signature', async () => {
      const { withdrawalId, record } = await initiateMultiSig();
      const { message } = service.buildApprovalMessage(record);
      const sig = await sign(walletA, message);

      expect(() =>
        service.addMultiSigSignature(withdrawalId, USER_ID, {
          signerAddress: walletA.address,
          signature: sig,
        }),
      ).not.toThrow();
    });

    it('rejects a signature over the old bare withdrawalId message', async () => {
      const { withdrawalId } = await initiateMultiSig();
      // Old weak message — should now be rejected.
      const legacySig = await sign(walletA, `GateDelay withdrawal ${withdrawalId}`);

      expect(() =>
        service.addMultiSigSignature(withdrawalId, USER_ID, {
          signerAddress: walletA.address,
          signature: legacySig,
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects when the toAddress field is mutated', async () => {
      const { withdrawalId, record } = await initiateMultiSig();
      // Sign a message with a different destination.
      const mutated = buildApprovalMsg({
        domain: 'GateDelay-withdrawal-v1',
        chainId: CHAIN_ID,
        withdrawalId,
        fromAddress: record.fromAddress,
        toAddress: walletC.address, // ← wrong destination
        tokenAddress: record.tokenAddress,
        amount: record.amount,
        expiry: record.expiry,
      });
      const sig = await sign(walletA, mutated);

      expect(() =>
        service.addMultiSigSignature(withdrawalId, USER_ID, {
          signerAddress: walletA.address,
          signature: sig,
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects when the amount field is mutated', async () => {
      const { withdrawalId, record } = await initiateMultiSig();
      const mutated = buildApprovalMsg({
        domain: 'GateDelay-withdrawal-v1',
        chainId: CHAIN_ID,
        withdrawalId,
        fromAddress: record.fromAddress,
        toAddress: record.toAddress,
        tokenAddress: record.tokenAddress,
        amount: '1', // ← wrong amount
        expiry: record.expiry,
      });
      const sig = await sign(walletA, mutated);

      expect(() =>
        service.addMultiSigSignature(withdrawalId, USER_ID, {
          signerAddress: walletA.address,
          signature: sig,
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects when the chainId field is mutated', async () => {
      const { withdrawalId, record } = await initiateMultiSig();
      const mutated = buildApprovalMsg({
        domain: 'GateDelay-withdrawal-v1',
        chainId: 999, // ← wrong chain
        withdrawalId,
        fromAddress: record.fromAddress,
        toAddress: record.toAddress,
        tokenAddress: record.tokenAddress,
        amount: record.amount,
        expiry: record.expiry,
      });
      const sig = await sign(walletA, mutated);

      expect(() =>
        service.addMultiSigSignature(withdrawalId, USER_ID, {
          signerAddress: walletA.address,
          signature: sig,
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects when the tokenAddress field is mutated', async () => {
      const { withdrawalId, record } = await initiateMultiSig();
      const mutated = buildApprovalMsg({
        domain: 'GateDelay-withdrawal-v1',
        chainId: CHAIN_ID,
        withdrawalId,
        fromAddress: record.fromAddress,
        toAddress: record.toAddress,
        tokenAddress: TOKEN, // ← wrong token
        amount: record.amount,
        expiry: record.expiry,
      });
      const sig = await sign(walletA, mutated);

      expect(() =>
        service.addMultiSigSignature(withdrawalId, USER_ID, {
          signerAddress: walletA.address,
          signature: sig,
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects when the expiry field is mutated', async () => {
      const { withdrawalId, record } = await initiateMultiSig();
      const mutated = buildApprovalMsg({
        domain: 'GateDelay-withdrawal-v1',
        chainId: CHAIN_ID,
        withdrawalId,
        fromAddress: record.fromAddress,
        toAddress: record.toAddress,
        tokenAddress: record.tokenAddress,
        amount: record.amount,
        expiry: EXPIRY + 9999, // ← extended expiry
      });
      const sig = await sign(walletA, mutated);

      expect(() =>
        service.addMultiSigSignature(withdrawalId, USER_ID, {
          signerAddress: walletA.address,
          signature: sig,
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects a valid signature submitted after the expiry timestamp', async () => {
      // Create and sign a valid intent, then submit it after it expires.
      const expiry = Math.floor(Date.now() / 1000) + 60;
      const { withdrawalId, record } = service.initiateWithdrawal(USER_ID, {
        fromAddress: walletA.address,
        toAddress: walletB.address,
        tokenAddress: 'NATIVE',
        amount: AMOUNT,
        chainId: CHAIN_ID,
        expiry,
        multiSigThreshold: 1,
        multiSigSigners: [walletA.address, walletB.address],
      });

      const { message } = service.buildApprovalMessage(record);
      const sig = await sign(walletA, message);

      const clock = jest.spyOn(Date, 'now').mockReturnValue((expiry + 1) * 1000);
      try {
        expect(() =>
          service.addMultiSigSignature(withdrawalId, USER_ID, {
            signerAddress: walletA.address,
            signature: sig,
          }),
        ).toThrow(BadRequestException);
      } finally {
        clock.mockRestore();
      }
    });

    it('requires chainId for multi-sig withdrawals', () => {
      expect(() =>
        service.initiateWithdrawal(USER_ID, {
          fromAddress: walletA.address,
          toAddress: walletB.address,
          tokenAddress: 'NATIVE',
          amount: AMOUNT,
          expiry: EXPIRY,
          multiSigThreshold: 2,
          multiSigSigners: [walletA.address, walletB.address],
          // chainId omitted intentionally
        }),
      ).toThrow(BadRequestException);
    });

    it('requires a future expiry for multi-sig withdrawals', () => {
      expect(() =>
        service.initiateWithdrawal(USER_ID, {
          fromAddress: walletA.address,
          toAddress: walletB.address,
          tokenAddress: 'NATIVE',
          amount: AMOUNT,
          chainId: CHAIN_ID,
          // expiry omitted — should fail
          multiSigThreshold: 2,
          multiSigSigners: [walletA.address, walletB.address],
        }),
      ).toThrow(BadRequestException);
    });
  });

  // ── Issue 3: Multisig scope (off-chain approval workflow) ─────────────────
  //
  // The service is documented as an off-chain approval workflow.  The txData
  // it returns is a plain single-owner transfer; it does NOT route through an
  // on-chain multi-sig contract.  These tests confirm the scope boundaries.

  describe('multisig scope — off-chain workflow (Issue 3)', () => {
    it('buildApprovalMessage documents the off-chain scope', () => {
      // This test is a compile-time / API-shape check.  The method must exist
      // and return structured fields so the client can display them to signers.
      const { record } = service.initiateWithdrawal(USER_ID, {
        fromAddress: walletA.address,
        toAddress: walletB.address,
        tokenAddress: 'NATIVE',
        amount: AMOUNT,
        chainId: CHAIN_ID,
        expiry: EXPIRY,
        multiSigThreshold: 2,
        multiSigSigners: [walletA.address, walletB.address, walletC.address],
      });

      const result = service.buildApprovalMessage(record);
      // All binding fields must be present so the client can display them.
      expect(result.fields.fromAddress).toBeDefined();
      expect(result.fields.toAddress).toBeDefined();
      expect(result.fields.amount).toBeDefined();
      expect(result.fields.tokenAddress).toBeDefined();
      expect(result.fields.chainId).toBeDefined();
      expect(result.fields.expiry).toBeDefined();
      expect(result.message).toBe(
        JSON.stringify(
          result.fields,
          [
            'amount',
            'chainId',
            'domain',
            'expiry',
            'fromAddress',
            'toAddress',
            'tokenAddress',
            'withdrawalId',
          ],
        ),
      );
    });

    it('txData for a multisig withdrawal is a plain transfer (not a multisig-contract call)', () => {
      const { txData } = service.initiateWithdrawal(USER_ID, {
        fromAddress: walletA.address,
        toAddress: walletB.address,
        tokenAddress: 'NATIVE',
        amount: AMOUNT,
        chainId: CHAIN_ID,
        expiry: EXPIRY,
        multiSigThreshold: 2,
        multiSigSigners: [walletA.address, walletB.address, walletC.address],
      });

      // from is the EOA, not a contract address — this documents the off-chain
      // scope: callers must relay through a real multisig contract themselves.
      const tx = txData as { from: string; to: string };
      expect(tx.from).toBe(walletA.address);
      expect(tx.to).toBe(walletB.address);
    });

    it('submission is blocked until off-chain threshold is met', async () => {
      const { withdrawalId } = service.initiateWithdrawal(USER_ID, {
        fromAddress: walletA.address,
        toAddress: walletB.address,
        tokenAddress: 'NATIVE',
        amount: AMOUNT,
        chainId: CHAIN_ID,
        expiry: EXPIRY,
        multiSigThreshold: 2,
        multiSigSigners: [walletA.address, walletB.address],
      });

      await expect(
        service.submitTxHash(withdrawalId, USER_ID, {
          txHash: '0x' + 'c'.repeat(64),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── Issue 4: Cancellation lifecycle + multisig atomicity ─────────────────
  //
  // Cancelled/failed/confirmed withdrawals must reject new signatures.
  // cancelWithdrawal must atomically flip the linked multisig to 'rejected'.

  describe('cancellation lifecycle and multisig atomicity (Issue 4)', () => {
    async function pendingMultiSig() {
      const { withdrawalId, record } = service.initiateWithdrawal(USER_ID, {
        fromAddress: walletA.address,
        toAddress: walletB.address,
        tokenAddress: 'NATIVE',
        amount: AMOUNT,
        chainId: CHAIN_ID,
        expiry: EXPIRY,
        multiSigThreshold: 2,
        multiSigSigners: [walletA.address, walletB.address, walletC.address],
      });
      return { withdrawalId, record };
    }

    it('cancelling a multisig withdrawal atomically rejects the linked multisig', async () => {
      const { withdrawalId, record } = await pendingMultiSig();

      service.cancelWithdrawal(withdrawalId, USER_ID);

      const ms = service.getMultiSigStatus(withdrawalId, USER_ID);
      // The multisig must be rejected, not still pending.
      expect(ms.status).toBe('rejected');
      // The withdrawal record must be cancelled.
      expect(record.status).toBe('cancelled');
    });

    it('rejects a new signature on a cancelled withdrawal', async () => {
      const { withdrawalId, record } = await pendingMultiSig();
      service.cancelWithdrawal(withdrawalId, USER_ID);

      const { message } = service.buildApprovalMessage(record);
      const sig = await sign(walletA, message);

      expect(() =>
        service.addMultiSigSignature(withdrawalId, USER_ID, {
          signerAddress: walletA.address,
          signature: sig,
        }),
      ).toThrow(BadRequestException);
    });

    it('does not mutate signature count or readiness after cancellation', async () => {
      const { withdrawalId, record } = await pendingMultiSig();

      // Add one valid signature before cancelling.
      const { message } = service.buildApprovalMessage(record);
      const sigA = await sign(walletA, message);
      service.addMultiSigSignature(withdrawalId, USER_ID, {
        signerAddress: walletA.address,
        signature: sigA,
      });

      service.cancelWithdrawal(withdrawalId, USER_ID);

      // Attempt to add a second signature post-cancellation.
      const sigB = await sign(walletB, message);
      expect(() =>
        service.addMultiSigSignature(withdrawalId, USER_ID, {
          signerAddress: walletB.address,
          signature: sigB,
        }),
      ).toThrow(BadRequestException);

      // Count must remain at 1 — the rejected multisig must not have advanced.
      const ms = service.getMultiSigStatus(withdrawalId, USER_ID);
      expect(ms.signaturesCollected).toBe(1);
      expect(ms.status).toBe('rejected');
    });

    it('rejects a signature when the withdrawal is already submitted', async () => {
      const { withdrawalId, record } = service.initiateWithdrawal(USER_ID, {
        fromAddress: walletA.address,
        toAddress: walletB.address,
        tokenAddress: 'NATIVE',
        amount: AMOUNT,
        chainId: CHAIN_ID,
        expiry: EXPIRY,
        multiSigThreshold: 1,
        multiSigSigners: [walletA.address, walletB.address],
      });

      // Reach threshold so submission is allowed.
      const { message } = service.buildApprovalMessage(record);
      const sigA = await sign(walletA, message);
      service.addMultiSigSignature(withdrawalId, USER_ID, {
        signerAddress: walletA.address,
        signature: sigA,
      });

      // Mock provider so confirmation tracking doesn't interfere.
      (service as any).provider = {
        waitForTransaction: jest.fn().mockReturnValue(new Promise(() => {})),
      };

      await service.submitTxHash(withdrawalId, USER_ID, {
        txHash: '0x' + 'd'.repeat(64),
      });

      // Now in 'submitted' state — signature must be rejected.
      const sigB = await sign(walletB, message);
      expect(() =>
        service.addMultiSigSignature(withdrawalId, USER_ID, {
          signerAddress: walletB.address,
          signature: sigB,
        }),
      ).toThrow(BadRequestException);
    });
  });

  // ── Existing behaviour regression ─────────────────────────────────────────

  describe('initiateWithdrawal — core behaviour', () => {
    it('creates a pending native withdrawal record', () => {
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

    it('creates a pending ERC-20 withdrawal record', () => {
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

    it('rejects self-transfers', () => {
      expect(() =>
        service.initiateWithdrawal(USER_ID, {
          fromAddress: FROM,
          toAddress: FROM,
          tokenAddress: 'NATIVE',
          amount: AMOUNT,
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects an invalid from-address', () => {
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

  describe('listWithdrawals', () => {
    it('returns only withdrawals for the requesting user', () => {
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

      const page = service.listWithdrawals(USER_ID, {});
      expect(page.data).toHaveLength(1);
      expect(page.data[0].userId).toBe(USER_ID);
    });

    it('filters by status when provided', () => {
      service.initiateWithdrawal(USER_ID, {
        fromAddress: FROM,
        toAddress: TO,
        tokenAddress: 'NATIVE',
        amount: AMOUNT,
      });

      const pending = service.listWithdrawals(USER_ID, { status: 'pending' });
      const confirmed = service.listWithdrawals(USER_ID, {
        status: 'confirmed',
      });
      expect(pending.data).toHaveLength(1);
      expect(confirmed.data).toHaveLength(0);
    });

    it('should paginate and return a cursor when more records exist', () => {
      // Create 3 withdrawals for the same user
      for (let i = 0; i < 3; i++) {
        service.initiateWithdrawal(USER_ID, {
          fromAddress: FROM,
          toAddress: TO,
          tokenAddress: 'NATIVE',
          amount: AMOUNT,
        });
      }

      const page1 = service.listWithdrawals(USER_ID, { limit: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).not.toBeNull();

      const page2 = service.listWithdrawals(USER_ID, {
        limit: 2,
        cursor: page1.nextCursor!,
      });
      expect(page2.data).toHaveLength(1);
      expect(page2.hasMore).toBe(false);
      expect(page2.nextCursor).toBeNull();

      // No duplicate IDs across pages
      const allIds = [...page1.data, ...page2.data].map((w) => w.id);
      expect(new Set(allIds).size).toBe(3);
    });

    it('should reject an invalid cursor', () => {
      expect(() =>
        service.listWithdrawals(USER_ID, { cursor: '!!!not-base64url!!!' }),
      ).toThrow(BadRequestException);
    });
  });

  describe('cancelWithdrawal', () => {
    it('cancels a plain pending withdrawal', () => {
      const { withdrawalId } = service.initiateWithdrawal(USER_ID, {
        fromAddress: FROM,
        toAddress: TO,
        tokenAddress: 'NATIVE',
        amount: AMOUNT,
      });

      const cancelled = service.cancelWithdrawal(withdrawalId, USER_ID);
      expect(cancelled.status).toBe('cancelled');
    });

    it('throws when another user tries to cancel', () => {
      const { withdrawalId } = service.initiateWithdrawal(USER_ID, {
        fromAddress: FROM,
        toAddress: TO,
        tokenAddress: 'NATIVE',
        amount: AMOUNT,
      });

      expect(() => service.cancelWithdrawal(withdrawalId, OTHER_USER)).toThrow(
        ForbiddenException,
      );
    });

    it('throws when cancelling an already cancelled withdrawal', () => {
      const { withdrawalId } = service.initiateWithdrawal(USER_ID, {
        fromAddress: FROM,
        toAddress: TO,
        tokenAddress: 'NATIVE',
        amount: AMOUNT,
      });
      service.cancelWithdrawal(withdrawalId, USER_ID);

      expect(() => service.cancelWithdrawal(withdrawalId, USER_ID)).toThrow(
        BadRequestException,
      );
    });

    it('throws for a non-existent withdrawal id', () => {
      expect(() =>
        service.cancelWithdrawal('non-existent-id', USER_ID),
      ).toThrow(NotFoundException);
    });
  });

  describe('submitTxHash', () => {
    it('updates status to submitted and sets txHash', async () => {
      const { withdrawalId } = service.initiateWithdrawal(USER_ID, {
        fromAddress: FROM,
        toAddress: TO,
        tokenAddress: 'NATIVE',
        amount: AMOUNT,
      });

      (service as any).provider = {
        waitForTransaction: jest.fn().mockReturnValue(new Promise(() => {})),
      };

      const updated = await service.submitTxHash(withdrawalId, USER_ID, {
        txHash: '0x' + 'a'.repeat(64),
      });

      expect(updated.status).toBe('submitted');
      expect(updated.txHash).toBe('0x' + 'a'.repeat(64));
    });

    it('throws when the withdrawal is not in pending state', async () => {
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

  describe('multi-sig — threshold flow', () => {
    it('advances from pending to ready when threshold is reached', async () => {
      const signers = [walletA.address, walletB.address, walletC.address];

      const { withdrawalId, record } = service.initiateWithdrawal(USER_ID, {
        fromAddress: walletA.address,
        toAddress: walletB.address,
        tokenAddress: 'NATIVE',
        amount: AMOUNT,
        chainId: CHAIN_ID,
        expiry: EXPIRY,
        multiSigThreshold: 2,
        multiSigSigners: signers,
      });

      const { message } = service.buildApprovalMessage(record);

      const sigA = await sign(walletA, message);
      const msAfterFirst = service.addMultiSigSignature(withdrawalId, USER_ID, {
        signerAddress: walletA.address,
        signature: sigA,
      });
      expect(msAfterFirst.status).toBe('pending');

      const sigB = await sign(walletB, message);
      const msAfterSecond = service.addMultiSigSignature(withdrawalId, USER_ID, {
        signerAddress: walletB.address,
        signature: sigB,
      });
      expect(msAfterSecond.status).toBe('ready');
    });

    it('rejects a duplicate signature from the same signer', async () => {
      const signers = [walletA.address, walletB.address];

      const { withdrawalId, record } = service.initiateWithdrawal(USER_ID, {
        fromAddress: walletA.address,
        toAddress: walletC.address,
        tokenAddress: 'NATIVE',
        amount: AMOUNT,
        chainId: CHAIN_ID,
        expiry: EXPIRY,
        multiSigThreshold: 2,
        multiSigSigners: signers,
      });

      const { message } = service.buildApprovalMessage(record);
      const sigA = await sign(walletA, message);
      service.addMultiSigSignature(withdrawalId, USER_ID, {
        signerAddress: walletA.address,
        signature: sigA,
      });

      expect(() =>
        service.addMultiSigSignature(withdrawalId, USER_ID, {
          signerAddress: walletA.address,
          signature: sigA,
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects a signature from an address that is not a registered signer', async () => {
      const nonSigner = ethers.Wallet.createRandom();
      const signers = [walletA.address, walletB.address];

      const { withdrawalId, record } = service.initiateWithdrawal(USER_ID, {
        fromAddress: walletA.address,
        toAddress: walletC.address,
        tokenAddress: 'NATIVE',
        amount: AMOUNT,
        chainId: CHAIN_ID,
        expiry: EXPIRY,
        multiSigThreshold: 2,
        multiSigSigners: signers,
      });

      const { message } = service.buildApprovalMessage(record);
      const sig = await sign(nonSigner, message);
      expect(() =>
        service.addMultiSigSignature(withdrawalId, USER_ID, {
          signerAddress: nonSigner.address,
          signature: sig,
        }),
      ).toThrow(ForbiddenException);
    });

    it('rejects when threshold exceeds number of signers', () => {
      expect(() =>
        service.initiateWithdrawal(USER_ID, {
          fromAddress: walletA.address,
          toAddress: walletC.address,
          tokenAddress: 'NATIVE',
          amount: AMOUNT,
          chainId: CHAIN_ID,
          expiry: EXPIRY,
          multiSigThreshold: 3,
          multiSigSigners: [walletA.address, walletB.address],
        }),
      ).toThrow(BadRequestException);
    });
  });
});
