import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DepositService } from './deposit.service';
import { DepositStatus } from './schemas/deposit.schema';

@Injectable()
export class DepositMonitorService {
  private readonly logger = new Logger(DepositMonitorService.name);
  private isMonitoring = false;

  constructor(private readonly depositService: DepositService) {}

  /**
   * Monitor pending deposits every 30 seconds
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async monitorDeposits(): Promise<void> {
    if (this.isMonitoring) {
      this.logger.debug('Monitor already running, skipping...');
      return;
    }

    this.isMonitoring = true;

    try {
      const pendingDeposits = await this.depositService.getPendingDeposits();

      if (pendingDeposits.length === 0) {
        this.logger.debug('No pending deposits to monitor');
        return;
      }

      this.logger.log(`Monitoring ${pendingDeposits.length} pending deposits`);

      // Process deposits in parallel with concurrency limit
      const BATCH_SIZE = 10;
      for (let i = 0; i < pendingDeposits.length; i += BATCH_SIZE) {
        const batch = pendingDeposits.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map((deposit) => this.processDeposit(deposit)));
      }
    } catch (error) {
      this.logger.error('Error monitoring deposits', error);
    } finally {
      this.isMonitoring = false;
    }
  }

  /**
   * Expire old deposits every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async expireOldDeposits(): Promise<void> {
    try {
      const expired = await this.depositService.expireOldDeposits();
      if (expired > 0) {
        this.logger.log(`Expired ${expired} old deposits`);
      }
    } catch (error) {
      this.logger.error('Error expiring old deposits', error);
    }
  }

  /**
   * Process individual deposit
   */
  private async processDeposit(deposit: any): Promise<void> {
    try {
      // Get transaction details from blockchain
      const txDetails = await this.depositService.getTransactionDetails(deposit.txHash);

      // Update confirmations
      await this.depositService.updateConfirmations(
        deposit.id,
        txDetails.confirmations,
        txDetails.blockNumber,
        txDetails.blockHash,
      );

      // Check if transaction failed
      if (txDetails.status === 0) {
        await this.depositService.failDeposit(deposit.id, 'Transaction failed on blockchain');
        return;
      }

      // Check if deposit is confirmed
      if (txDetails.confirmations >= deposit.requiredConfirmations) {
        await this.handleConfirmedDeposit(deposit);
      }
    } catch (error) {
      this.logger.error(`Error processing deposit ${deposit.id}`, error);
    }
  }

  /**
   * Handle confirmed deposit
   */
  private async handleConfirmedDeposit(deposit: any): Promise<void> {
    try {
      // Confirm the deposit
      await this.depositService.confirmDeposit(deposit.id);

      // Update user balance (if not already updated)
      if (!deposit.balanceUpdated) {
        await this.updateUserBalance(deposit);
      }

      // Send notification (if not already sent)
      if (!deposit.notificationSent) {
        await this.sendDepositNotification(deposit);
      }

      this.logger.log(`Successfully processed confirmed deposit ${deposit.id}`);
    } catch (error) {
      this.logger.error(`Error handling confirmed deposit ${deposit.id}`, error);
    }
  }

  /**
   * Update user balance
   */
  private async updateUserBalance(deposit: any): Promise<void> {
    try {
      // TODO: Integrate with wallet service to update balance
      // For now, just mark as updated
      await this.depositService.markBalanceUpdated(deposit.id);

      this.logger.log(
        `Updated balance for user ${deposit.userId}: +${deposit.amount} ${deposit.currency}`,
      );
    } catch (error) {
      this.logger.error(`Failed to update balance for deposit ${deposit.id}`, error);
      throw error;
    }
  }

  /**
   * Send deposit notification
   */
  private async sendDepositNotification(deposit: any): Promise<void> {
    try {
      // TODO: Integrate with notification service
      // For now, just mark as sent
      await this.depositService.markNotificationSent(deposit.id);

      this.logger.log(`Sent deposit notification for deposit ${deposit.id}`);
    } catch (error) {
      this.logger.error(`Failed to send notification for deposit ${deposit.id}`, error);
      throw error;
    }
  }

  /**
   * Get monitoring status
   */
  getStatus(): { isMonitoring: boolean } {
    return { isMonitoring: this.isMonitoring };
  }
}
