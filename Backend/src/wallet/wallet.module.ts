import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { BackupModule } from './backup/backup.module';
import { ReplayProtectionService } from '../common/services/replay-protection.service';
import { WalletOwnership, WalletOwnershipSchema } from './wallet.schema';

@Module({
  imports: [
    forwardRef(() => BackupModule),
    MongooseModule.forFeature([
      { name: WalletOwnership.name, schema: WalletOwnershipSchema },
    ]),
  ],
  controllers: [WalletController],
  providers: [WalletService, ReplayProtectionService],
  exports: [WalletService, ReplayProtectionService],
})
export class WalletModule {}
