import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ClipStore } from './clip.store';
import { PrepareMintTxDto, PrepareMintTxResponseDto } from './dto/mint.dto';
import { SorobanNftClient } from './soroban/soroban-nft.client';

@Injectable()
export class NftMintService {
  private readonly logger = new Logger(NftMintService.name);

  constructor(
    private readonly clips: ClipStore,
    private readonly soroban: SorobanNftClient,
  ) {}

  /**
   * Build an unsigned Soroban NFT mint transaction (XDR) for wallet signing.
   */
  async prepareMintTx(
    dto: PrepareMintTxDto,
  ): Promise<PrepareMintTxResponseDto> {
    const walletAddress = dto.walletAddress?.trim();
    const clipId = dto.clipId?.trim();

    if (!walletAddress || !clipId) {
      throw new BadRequestException('walletAddress and clipId are required');
    }

    if (!/^G[A-Z0-9]{55}$/.test(walletAddress)) {
      throw new BadRequestException(
        'walletAddress must be a valid Stellar G... address',
      );
    }

    const clip = this.clips.findById(clipId);
    if (!clip) {
      throw new NotFoundException(`Clip ${clipId} not found`);
    }

    if (clip.minted) {
      throw new ConflictException(`Clip ${clipId} has already been minted`);
    }

    const metadataUri = (dto.metadataUri ?? clip.metadataUri)?.trim();
    if (!metadataUri) {
      throw new BadRequestException(
        `Clip ${clipId} has no metadata URI; upload metadata to IPFS before minting`,
      );
    }

    const royaltyBps = dto.royaltyBps ?? clip.royaltyBps ?? 1000;
    if (royaltyBps < 0 || royaltyBps > 1500) {
      throw new BadRequestException(
        'royaltyBps must be between 0 and 1500 inclusive',
      );
    }

    const built = await this.soroban.prepareMintTx({
      walletAddress,
      clipId,
      metadataUri,
      royaltyBps,
    });

    this.logger.log(
      `Prepared mint XDR for clip=${clipId} wallet=${walletAddress}`,
    );

    return {
      xdr: built.xdr,
      clipId,
      walletAddress,
      metadataUri,
      royaltyBps,
      networkPassphrase: built.networkPassphrase,
    };
  }
}
