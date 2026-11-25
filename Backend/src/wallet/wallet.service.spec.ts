import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletOwnership } from './wallet.schema';
import { ReplayProtectionService } from '../common/services/replay-protection.service';

const CHECKSUM_ADDR = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
const LOWER_ADDR = CHECKSUM_ADDR.toLowerCase();
const USER_A = 'user-a';
const USER_B = 'user-b';

const mockDoc = (overrides: Partial<WalletOwnership> = {}) => ({
  address: CHECKSUM_ADDR,
  userId: USER_A,
  connectedAt: new Date('2024-01-01'),
  network: 'mantle',
  ...overrides,
});

describe('WalletService', () => {
  let service: WalletService;
  let walletModel: {
    findOne: jest.Mock;
    create: jest.Mock;
    find: jest.Mock;
    deleteOne: jest.Mock;
  };
  let replayProtection: { verifyRequest: jest.Mock; generateNonce: jest.Mock };

  beforeEach(async () => {
    walletModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      find: jest.fn(),
      deleteOne: jest.fn(),
    };

    // Chainable .lean().exec() pattern
    const chainable = (value: unknown) => ({
      lean: () => ({ exec: () => Promise.resolve(value) }),
    });
    walletModel.findOne.mockImplementation(() => chainable(null));
    walletModel.find.mockImplementation(() => chainable([]));
    walletModel.deleteOne.mockImplementation(() => ({
      exec: () => Promise.resolve({ deletedCount: 1 }),
    }));

    replayProtection = {
      verifyRequest: jest.fn().mockResolvedValue({ valid: true }),
      generateNonce: jest.fn().mockReturnValue('nonce-123'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: getModelToken(WalletOwnership.name),
          useValue: walletModel,
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('mantle') },
        },
        {
          provide: ReplayProtectionService,
          useValue: replayProtection,
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
  });

  // ─── Address normalisation ──────────────────────────────────────────────────

  it('normalises a lowercase address to EIP-55 checksum before lookup', async () => {
    walletModel.create.mockResolvedValue(mockDoc());

    const dto = {
      address: LOWER_ADDR,
      signature: '0xsig',
      message: 'msg',
      nonce: 'n1',
      timestamp: Date.now(),
    };

    await service.connectWallet(USER_A, dto);

    // findOne must be called with the checksummed form
    expect(walletModel.findOne).toHaveBeenCalledWith({ address: CHECKSUM_ADDR });
  });

  it('rejects an invalid address', async () => {
    const dto = {
      address: 'not-an-address',
      signature: '0xsig',
      message: 'msg',
      nonce: 'n1',
      timestamp: Date.now(),
    };
    await expect(service.connectWallet(USER_A, dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  // ─── Uniqueness enforcement ─────────────────────────────────────────────────

  it('returns existing entry idempotently when same user reconnects', async () => {
    const existing = mockDoc();
    walletModel.findOne.mockImplementation(() => ({
      lean: () => ({ exec: () => Promise.resolve(existing) }),
    }));

    const dto = {
      address: CHECKSUM_ADDR,
      signature: '0xsig',
      message: 'msg',
      nonce: 'n1',
      timestamp: Date.now(),
    };

    const result = await service.connectWallet(USER_A, dto);
    expect(result.address).toBe(CHECKSUM_ADDR);
    expect(walletModel.create).not.toHaveBeenCalled();
  });

  it('throws ConflictException when wallet is already owned by a different user', async () => {
    walletModel.findOne.mockImplementation(() => ({
      lean: () => ({ exec: () => Promise.resolve(mockDoc({ userId: USER_B })) }),
    }));

    const dto = {
      address: CHECKSUM_ADDR,
      signature: '0xsig',
      message: 'msg',
      nonce: 'n1',
      timestamp: Date.now(),
    };

    await expect(service.connectWallet(USER_A, dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('handles duplicate-key race (code 11000) and re-reads the winner', async () => {
    walletModel.create.mockRejectedValue({ code: 11000 });
    // After the race, the winning doc belongs to USER_A
    walletModel.findOne
      .mockImplementationOnce(() => ({
        lean: () => ({ exec: () => Promise.resolve(null) }),
      }))
      .mockImplementationOnce(() => ({
        lean: () => ({ exec: () => Promise.resolve(mockDoc()) }),
      }));

    const dto = {
      address: CHECKSUM_ADDR,
      signature: '0xsig',
      message: 'msg',
      nonce: 'n1',
      timestamp: Date.now(),
    };

    const result = await service.connectWallet(USER_A, dto);
    expect(result.userId).toBe(USER_A);
  });

  it('throws ConflictException on race when winning doc belongs to another user', async () => {
    walletModel.create.mockRejectedValue({ code: 11000 });
    walletModel.findOne
      .mockImplementationOnce(() => ({
        lean: () => ({ exec: () => Promise.resolve(null) }),
      }))
      .mockImplementationOnce(() => ({
        lean: () => ({
          exec: () => Promise.resolve(mockDoc({ userId: USER_B })),
        }),
      }));

    const dto = {
      address: CHECKSUM_ADDR,
      signature: '0xsig',
      message: 'msg',
      nonce: 'n1',
      timestamp: Date.now(),
    };

    await expect(service.connectWallet(USER_A, dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  // ─── Persistence (model delegation) ────────────────────────────────────────

  it('persists a new wallet entry via the model', async () => {
    walletModel.create.mockResolvedValue(mockDoc());

    const dto = {
      address: CHECKSUM_ADDR,
      signature: '0xsig',
      message: 'msg',
      nonce: 'n1',
      timestamp: Date.now(),
    };

    const entry = await service.connectWallet(USER_A, dto);
    expect(walletModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ address: CHECKSUM_ADDR, userId: USER_A }),
    );
    expect(entry.address).toBe(CHECKSUM_ADDR);
  });

  it('getUserWallets queries by userId', async () => {
    walletModel.find.mockImplementation(() => ({
      lean: () => ({ exec: () => Promise.resolve([mockDoc()]) }),
    }));

    const wallets = await service.getUserWallets(USER_A);
    expect(walletModel.find).toHaveBeenCalledWith({ userId: USER_A });
    expect(wallets).toHaveLength(1);
  });

  it('disconnectWallet deletes by address + userId', async () => {
    await service.disconnectWallet(USER_A, CHECKSUM_ADDR);
    expect(walletModel.deleteOne).toHaveBeenCalledWith({
      address: CHECKSUM_ADDR,
      userId: USER_A,
    });
  });

  it('disconnectWallet throws NotFoundException when no document deleted', async () => {
    walletModel.deleteOne.mockImplementation(() => ({
      exec: () => Promise.resolve({ deletedCount: 0 }),
    }));

    await expect(
      service.disconnectWallet(USER_A, CHECKSUM_ADDR),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  // ─── Replay protection ──────────────────────────────────────────────────────

  it('throws BadRequestException when nonce/timestamp are missing', async () => {
    const dto = {
      address: CHECKSUM_ADDR,
      signature: '0xsig',
      message: 'msg',
      nonce: '',
      timestamp: 0,
    };
    await expect(service.connectWallet(USER_A, dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('throws BadRequestException when replay protection fails', async () => {
    replayProtection.verifyRequest.mockResolvedValue({
      valid: false,
      error: 'Nonce already used',
    });

    const dto = {
      address: CHECKSUM_ADDR,
      signature: '0xsig',
      message: 'msg',
      nonce: 'used-nonce',
      timestamp: Date.now(),
    };

    await expect(service.connectWallet(USER_A, dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
