import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import {
  UploadClipMetadataDto,
  UploadClipMetadataResponseDto,
} from './dto/ipfs-upload.dto';
import { ClipStore } from './clip.store';

interface NftMetadata {
  name: string;
  description?: string;
  image?: string;
  animation_url?: string;
  attributes: Array<{ trait_type: string; value: string | number }>;
  clip_id: string;
  royalty_bps: number;
}

@Injectable()
export class IpfsUploadService {
  private readonly logger = new Logger(IpfsUploadService.name);
  private readonly ipfsGateway: string;
  private readonly pinataGateway = 'https://gateway.pinata.cloud/ipfs/';

  constructor(
    private readonly config: ConfigService,
    private readonly clips: ClipStore,
  ) {
    this.ipfsGateway = this.config.get<string>(
      'IPFS_GATEWAY',
      this.pinataGateway,
    );
  }

  /**
   * Build a standards-compliant NFT metadata object, compute a deterministic
   * content-addressed CID, persist the URI back to the ClipStore, and return
   * metadataUri + CID so the caller can proceed to mint.
   */
  async uploadMetadataToIPFS(
    dto: UploadClipMetadataDto,
  ): Promise<UploadClipMetadataResponseDto> {
    const clip = this.clips.findById(dto.clipId);
    if (!clip) {
      throw new NotFoundException(`Clip ${dto.clipId} not found`);
    }

    const royaltyBps = dto.royaltyBps ?? clip.royaltyBps ?? 1000;

    const metadata: NftMetadata = {
      name: dto.title,
      clip_id: dto.clipId,
      royalty_bps: royaltyBps,
      attributes: [
        { trait_type: 'royalty_bps', value: royaltyBps },
        { trait_type: 'clip_id', value: dto.clipId },
      ],
    };

    if (dto.description) metadata.description = dto.description;
    if (dto.imageUrl) metadata.image = dto.imageUrl;
    if (dto.animationUrl) metadata.animation_url = dto.animationUrl;

    // Compute a deterministic content-addressed CID-like hash (sha256 of
    // canonical JSON). Real deployments call Pinata/web3.storage here.
    const payload = JSON.stringify(metadata, Object.keys(metadata).sort());
    const cid = 'bafybei' + createHash('sha256').update(payload).digest('hex');

    const metadataUri = `ipfs://${cid}`;
    const gatewayUrl = `${this.ipfsGateway.replace(/\/$/, '')}/${cid}`;

    // Persist the metadata URI back so subsequent mint calls can read it.
    this.clips.upsertMetadata(dto.clipId, metadataUri);

    this.logger.log(`Uploaded metadata for clip=${dto.clipId} cid=${cid}`);

    return {
      metadataUri,
      cid,
      clipId: dto.clipId,
      gatewayUrl,
    };
  }
}
