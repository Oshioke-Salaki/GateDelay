import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { DepositService } from './deposit.service';
import { DepositController } from './deposit.controller';
import { DepositMonitorService } from './deposit-monitor.service';
import { Deposit, DepositSchema } from './schemas/deposit.schema';
import { NotificationModule } from '../notifications/notification.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Deposit.name, schema: DepositSchema }]),
    ScheduleModule.forRoot(),
    NotificationModule,
    WalletModule,
  ],
  controllers: [DepositController],
  providers: [DepositService, DepositMonitorService],
  exports: [DepositService],
})
export class DepositModule {}
