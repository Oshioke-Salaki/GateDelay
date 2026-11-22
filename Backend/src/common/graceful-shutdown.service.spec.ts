import { Test, TestingModule } from '@nestjs/testing';
import { GracefulShutdownService } from './graceful-shutdown.service';

describe('GracefulShutdownService', () => {
  let service: GracefulShutdownService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GracefulShutdownService],
    }).compile();

    service = module.get<GracefulShutdownService>(GracefulShutdownService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should trigger onModuleInit, beforeApplicationShutdown, and onModuleDestroy without throwing', async () => {
    expect(() => service.onModuleInit()).not.toThrow();
    expect(() => service.beforeApplicationShutdown('SIGTERM')).not.toThrow();
    await expect(service.onModuleDestroy()).resolves.not.toThrow();
  });
});
