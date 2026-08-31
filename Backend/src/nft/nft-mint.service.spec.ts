import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ClipStore } from './clip.store';
import { NftMintService } from './nft-mint.service';
import { SorobanNftClient } from './soroban/soroban-nft.client';

describe('NftMintService', () => {
  const wallet = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOPQRS';

  let service: NftMintService;
  let clips: ClipStore;
  let soroban: jest.Mocked<Pick<SorobanNftClient, 'prepareMintTx'>>;

  beforeEach(() => {
    clips = new ClipStore();
    soroban = {
      prepareMintTx: jest.fn().mockResolvedValue({
        xdr: 'AAAAAgAAAABjbGlwX21pbnRfdGVzdAAAAAAAAAAAAQ==',
        networkPassphrase: 'Test SDF Network ; September 2015',
      }),
    };
    service = new NftMintService(clips, soroban as unknown as SorobanNftClient);
  });

  it('prepareMintTx builds XDR with metadata URI and royalty', async () => {
    const result = await service.prepareMintTx({
      walletAddress: wallet,
      clipId: 'clip_01HZX9K2M3N4P5Q6R7S8T9',
    });

    expect(result.xdr).toBeTruthy();
    expect(result.metadataUri).toMatch(/^ipfs:\/\//);
    expect(result.royaltyBps).toBe(1000);
    expect(result.walletAddress).toBe(wallet);
    expect(soroban.prepareMintTx).toHaveBeenCalledWith(
      expect.objectContaining({
        walletAddress: wallet,
        clipId: 'clip_01HZX9K2M3N4P5Q6R7S8T9',
        royaltyBps: 1000,
      }),
    );
  });

  it('returns 404 when clip is missing', async () => {
    await expect(
      service.prepareMintTx({
        walletAddress: wallet,
        clipId: 'clip_missing',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 409 when clip is already minted', async () => {
    await expect(
      service.prepareMintTx({
        walletAddress: wallet,
        clipId: 'clip_already_minted',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns 400 for invalid wallet address', async () => {
    await expect(
      service.prepareMintTx({
        walletAddress: 'not-a-stellar-address',
        clipId: 'clip_01HZX9K2M3N4P5Q6R7S8T9',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 400 when metadata URI is missing', async () => {
    clips.seed('clip_no_meta', {
      title: 'No Meta',
      royaltyBps: 1000,
      minted: false,
    });

    await expect(
      service.prepareMintTx({
        walletAddress: wallet,
        clipId: 'clip_no_meta',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
