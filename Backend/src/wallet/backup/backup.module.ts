import { Module } from '@nestjs/common';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { WalletModule } from '../wallet.module';
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [forwardRef(() => WalletModule)],
  providers: [BackupService],
  controllers: [BackupController],
  exports: [BackupService],
})
export class BackupModule {}
