// Boot Dependencies:
//   ConfigModule  — provides BLOCKCHAIN_RPC_URL and ETHERSCAN_API_KEY (ConfigService)
//   CacheModule   — provides CACHE_MANAGER token for 30s gas estimate caching
//   (Optional) HttpModule — if using @nestjs/axios for Etherscan fallback
// These modules MUST be imported in the parent AppModule before GasModule.

import { Module } from '@nestjs/common';
import { GasController } from './gas.controller';
import { GasService } from './gas.service';

@Module({
  controllers: [GasController],
  providers: [GasService],
  exports: [GasService],
})
export class GasModule {}
