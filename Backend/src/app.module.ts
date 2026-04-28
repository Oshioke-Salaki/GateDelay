import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { MarketDataModule } from './market-data/market-data.module';
import { WebsocketModule } from './websocket/websocket.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { PositionsModule } from './positions/positions.module';
import { SearchModule } from './search/search.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { AiModule } from './ai/ai.module';
import { MarketsModule } from './markets/markets.module';
import { WalletModule } from './wallet/wallet.module';
import { GasModule } from './gas/gas.module';
import { TradingHistoryModule } from './trading-history/trading-history.module';
import { OrderMatcherModule } from './order-matcher/order-matcher.module';
import { LiquidityModule } from './liquidity/liquidity.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { WebhooksModule } from './webhooks/webhook.module';
import { ReceiptsModule } from './receipts/receipt.module';
import { NetworkModule } from './network/network.module';
import { ResolutionModule } from './resolution/resolution.module';
import { UserSettingsModule } from './user-settings/user-settings.module';
import { FavoritesModule } from './favorites/favorites.module';
import { RateLimiterModule } from './rate-limiter/rate-limiter.module';
import { ApprovalModule } from './approval/approval.module';
import { createKeyv } from '@keyv/redis';
import { CategoriesModule } from './categories/categories.module';
import { TradingPairModule } from './trading-pairs/trading-pair.module';
import { WithdrawalModule } from './withdrawal/withdrawal.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisHost = config.get('REDIS_HOST', 'localhost');
        const redisPort = config.get<number>('REDIS_PORT', 6379);
        return {
          stores: [createKeyv(`redis://${redisHost}:${redisPort}`)],
        };
      },
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>(
          'MONGODB_URI',
          'mongodb://localhost:27017/gatedelay',
        ),
      }),
    }),
    AuthModule,
    MarketDataModule,
    WebsocketModule,
    BlockchainModule,
    PositionsModule,
    SearchModule,
    PortfolioModule,
    AiModule,
    MarketsModule,
    WalletModule,
    GasModule,
    TradingHistoryModule,
    OrderMatcherModule,
    LiquidityModule,
    AnalyticsModule,
    WebhooksModule,
    ReceiptsModule,
    NetworkModule,
    ResolutionModule,
    UserSettingsModule,
    FavoritesModule,
    RateLimiterModule,
    ApprovalModule,
    CategoriesModule,
    TradingPairModule,
    WithdrawalModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
