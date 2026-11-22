import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  BeforeApplicationShutdown,
  Logger,
} from '@nestjs/common';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const gracefulShutdownManager = require('../../services/gracefulShutdown');

@Injectable()
export class GracefulShutdownService
  implements OnModuleInit, OnModuleDestroy, BeforeApplicationShutdown
{
  private readonly logger = new Logger(GracefulShutdownService.name);

  onModuleInit(): void {
    this.logger.log('GracefulShutdownService initialized in NestJS');
  }

  beforeApplicationShutdown(signal?: string): void {
    this.logger.log(
      `NestJS application beforeApplicationShutdown hook called with signal: ${signal ?? 'N/A'}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log(
      'NestJS application onModuleDestroy hook called — draining remaining NestJS resources',
    );
  }
}
