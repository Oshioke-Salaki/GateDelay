import { Module } from '@nestjs/common';
import { PriceGateway } from './price.gateway';
import { PriceGatewayMetrics } from './price-gateway.metrics';
import { PriceGatewayMetricsController } from './price-gateway-metrics.controller';
import { AuthModule } from '../auth/auth.module';
import { PositionsModule } from '../positions/positions.module';
import { PortfolioModule } from '../portfolio/portfolio.module';

@Module({
  imports: [AuthModule, PositionsModule, PortfolioModule],
  providers: [PriceGateway, PriceGatewayMetrics],
  controllers: [PriceGatewayMetricsController],
  exports: [PriceGateway, PriceGatewayMetrics],
})
export class WebsocketModule {}
