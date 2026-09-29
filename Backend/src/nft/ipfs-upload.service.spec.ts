import { NotFoundException } from '@nestjs/common';
import { ClipStore } from './clip.store';
import { IpfsUploadService } from './ipfs-upload.service';

describe('IpfsUploadService', () => {
  let service: IpfsUploadService;
  let clips: ClipStore;

  const fakeConfig = {
    get: (_key: string, _fallback: string) => _fallback,
  } as any;

  beforeEach(() => {
    clips = new ClipStore();
    service = new IpfsUploadService(fakeConfig, clips);
  });

  it('uploads metadata and returns metadataUri + CID', async () => {
    const result = await service.uploadMetadataToIPFS({
      clipId: 'clip_01HZX9K2M3N4P5Q6R7S8T9',
      title: 'GateDelay Highlight',
    });

    expect(result.cid).toMatch(/^bafybei[0-9a-f]{64}$/);
    expect(result.metadataUri).toBe(`ipfs://${result.cid}`);
    expect(result.gatewayUrl).toContain(result.cid);
    expect(result.clipId).toBe('clip_01HZX9K2M3N4P5Q6R7S8T9');
  });

  it('persists metadataUri back to ClipStore', async () => {
    const result = await service.uploadMetadataToIPFS({
      clipId: 'clip_01HZX9K2M3N4P5Q6R7S8T9',
      title: 'GateDelay Highlight',
    });

    const clip = clips.findById('clip_01HZX9K2M3N4P5Q6R7S8T9');
    expect(clip?.metadataUri).toBe(result.metadataUri);
  });

  it('is deterministic for identical inputs', async () => {
    const a = await service.uploadMetadataToIPFS({
      clipId: 'clip_01HZX9K2M3N4P5Q6R7S8T9',
      title: 'Same Title',
      royaltyBps: 500,
    });
    const b = await service.uploadMetadataToIPFS({
      clipId: 'clip_01HZX9K2M3N4P5Q6R7S8T9',
      title: 'Same Title',
      royaltyBps: 500,
    });

    expect(a.cid).toBe(b.cid);
  });

  it('throws NotFoundException for unknown clip', async () => {
    await expect(
      service.uploadMetadataToIPFS({
        clipId: 'clip_unknown',
        title: 'Unknown',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
