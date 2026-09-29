import { Module, forwardRef } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { BackupModule } from './backup/backup.module';
import { ReplayProtectionService } from '../common/services/replay-protection.service';

@Module({
  imports: [forwardRef(() => BackupModule)],
  controllers: [WalletController],
  providers: [WalletService, ReplayProtectionService],
  exports: [WalletService, ReplayProtectionService],
})
export class WalletModule {}
