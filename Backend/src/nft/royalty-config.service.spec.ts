import { NotFoundException } from '@nestjs/common';
import { ClipStore } from './clip.store';
import { RoyaltyConfigService } from './royalty-config.service';

describe('RoyaltyConfigService', () => {
  let service: RoyaltyConfigService;
  let clips: ClipStore;

  beforeEach(() => {
    clips = new ClipStore();
    service = new RoyaltyConfigService(clips);
  });

  describe('getRoyaltyBps', () => {
    it('returns the default royalty (1000) for a seeded clip', () => {
      const result = service.getRoyaltyBps('clip_01HZX9K2M3N4P5Q6R7S8T9');
      expect(result.royaltyBps).toBe(1000);
      expect(result.clipId).toBe('clip_01HZX9K2M3N4P5Q6R7S8T9');
    });

    it('throws NotFoundException for unknown clip', () => {
      expect(() => service.getRoyaltyBps('clip_unknown')).toThrow(
        NotFoundException,
      );
    });
  });

  describe('setRoyaltyBps', () => {
    it('persists royaltyBps on the clip', () => {
      const result = service.setRoyaltyBps({
        clipId: 'clip_01HZX9K2M3N4P5Q6R7S8T9',
        royaltyBps: 750,
      });

      expect(result.royaltyBps).toBe(750);
      expect(clips.findById('clip_01HZX9K2M3N4P5Q6R7S8T9')?.royaltyBps).toBe(
        750,
      );
    });

    it('allows 0 BPS (no royalty)', () => {
      const result = service.setRoyaltyBps({
        clipId: 'clip_01HZX9K2M3N4P5Q6R7S8T9',
        royaltyBps: 0,
      });
      expect(result.royaltyBps).toBe(0);
    });

    it('allows maximum 1500 BPS', () => {
      const result = service.setRoyaltyBps({
        clipId: 'clip_01HZX9K2M3N4P5Q6R7S8T9',
        royaltyBps: 1500,
      });
      expect(result.royaltyBps).toBe(1500);
    });

    it('throws NotFoundException for unknown clip', () => {
      expect(() =>
        service.setRoyaltyBps({ clipId: 'clip_unknown', royaltyBps: 500 }),
      ).toThrow(NotFoundException);
    });
  });
});
