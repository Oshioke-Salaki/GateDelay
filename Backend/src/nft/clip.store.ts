import { Injectable } from '@nestjs/common';

export interface ClipRecord {
  id: string;
  title: string;
  metadataUri?: string;
  royaltyBps: number;
  minted: boolean;
  mintAddress?: string;
  ownerWallet?: string;
}

const DEFAULT_ROYALTY_BPS = 1000;

/**
 * In-memory clip registry used by NFT mint flows until a persistent Clip
 * model is wired. Seeded with deterministic samples for local / test use.
 */
@Injectable()
export class ClipStore {
  private readonly clips = new Map<string, ClipRecord>();

  constructor() {
    this.seed('clip_01HZX9K2M3N4P5Q6R7S8T9', {
      title: 'Sample GateDelay Highlight',
      metadataUri:
        'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
      royaltyBps: DEFAULT_ROYALTY_BPS,
      minted: false,
    });
    this.seed('clip_already_minted', {
      title: 'Already Minted Clip',
      metadataUri: 'ipfs://bafybeialreadymintedcid0000000000000000000000000000',
      royaltyBps: 500,
      minted: true,
      mintAddress: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHK3M',
      ownerWallet: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOPQRS',
    });
  }

  seed(
    id: string,
    data: Omit<ClipRecord, 'id'> & Partial<Pick<ClipRecord, 'id'>>,
  ): ClipRecord {
    const record: ClipRecord = {
      id,
      title: data.title,
      metadataUri: data.metadataUri,
      royaltyBps: data.royaltyBps ?? DEFAULT_ROYALTY_BPS,
      minted: data.minted ?? false,
      mintAddress: data.mintAddress,
      ownerWallet: data.ownerWallet,
    };
    this.clips.set(id, record);
    return record;
  }

  findById(id: string): ClipRecord | undefined {
    return this.clips.get(id);
  }

  markMinted(
    id: string,
    mintAddress: string,
    ownerWallet: string,
  ): ClipRecord | undefined {
    const clip = this.clips.get(id);
    if (!clip) {
      return undefined;
    }
    clip.minted = true;
    clip.mintAddress = mintAddress;
    clip.ownerWallet = ownerWallet;
    this.clips.set(id, clip);
    return clip;
  }

  upsertMetadata(id: string, metadataUri: string): ClipRecord | undefined {
    const clip = this.clips.get(id);
    if (!clip) {
      return undefined;
    }
    clip.metadataUri = metadataUri;
    this.clips.set(id, clip);
    return clip;
  }
}
