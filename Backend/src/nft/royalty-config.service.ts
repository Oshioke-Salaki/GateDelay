import { Injectable, NotFoundException } from '@nestjs/common';
import { ClipStore } from './clip.store';
import {
  RoyaltyConfigResponseDto,
  SetRoyaltyBpsDto,
} from './dto/royalty-config.dto';

const DEFAULT_ROYALTY_BPS = 1000;
const MIN_ROYALTY_BPS = 0;
const MAX_ROYALTY_BPS = 1500;

@Injectable()
export class RoyaltyConfigService {
  constructor(private readonly clips: ClipStore) {}

  /**
   * Get the royaltyBps configured for a clip.
   * Returns the default (1000) if the clip exists but has none set.
   */
  getRoyaltyBps(clipId: string): RoyaltyConfigResponseDto {
    const clip = this.clips.findById(clipId);
    if (!clip) {
      throw new NotFoundException(`Clip ${clipId} not found`);
    }
    return { clipId, royaltyBps: clip.royaltyBps ?? DEFAULT_ROYALTY_BPS };
  }

  /**
   * Set / update royaltyBps for a clip.
   * Validated by class-validator in the DTO (0–1500).
   */
  setRoyaltyBps(dto: SetRoyaltyBpsDto): RoyaltyConfigResponseDto {
    const clip = this.clips.findById(dto.clipId);
    if (!clip) {
      throw new NotFoundException(`Clip ${dto.clipId} not found`);
    }

    // Belt-and-suspenders guard even though DTO class-validator covers this.
    const bps = Math.max(
      MIN_ROYALTY_BPS,
      Math.min(MAX_ROYALTY_BPS, dto.royaltyBps),
    );
    clip.royaltyBps = bps;

    return { clipId: dto.clipId, royaltyBps: bps };
  }
}
