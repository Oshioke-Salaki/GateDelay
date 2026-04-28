import { Module } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { BlockchainController } from './blockchain.controller';
import { NonceManagerService } from './nonce-manager.service';

@Module({
  controllers: [BlockchainController],
  providers: [BlockchainService, NonceManagerService],
  exports: [BlockchainService, NonceManagerService],
})
export class BlockchainModule {}
