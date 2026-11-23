import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { BackupModule } from './backup/backup.module';
import {
  ReplayProtectionService,
  REPLAY_PROTECTION_REDIS,
} from '../common/services/replay-protection.service';
import { WalletOwnership, WalletOwnershipSchema } from './wallet.schema';

@Module({
  imports: [
    forwardRef(() => BackupModule),
    ConfigModule,
    MongooseModule.forFeature([
      { name: WalletOwnership.name, schema: WalletOwnershipSchema },
    ]),
  ],
  controllers: [WalletController],
  providers: [
    {
      provide: REPLAY_PROTECTION_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const url = config.get<string>('REDIS_URL');
        return url
          ? new Redis(url)
          : new Redis({
              host: config.get<string>('REDIS_HOST', 'localhost'),
              port: config.get<number>('REDIS_PORT', 6379),
              db: config.get<number>('REDIS_DB', 0),
            });
      },
    },
    WalletService,
    ReplayProtectionService,
  ],
  exports: [WalletService, ReplayProtectionService],
})
export class WalletModule {}
