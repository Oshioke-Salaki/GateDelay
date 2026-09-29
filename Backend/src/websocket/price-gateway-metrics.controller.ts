import { Controller, Get } from '@nestjs/common';
import { PriceGatewayMetrics } from './price-gateway.metrics';

/**
 * Read-only view of the price gateway connection metrics, so operators can
 * watch socket churn, heartbeat health and subscription depth without tailing
 * logs (see Backend/src/websocket/price-gateway.metrics.ts).
 */
@Controller('price-gateway')
export class PriceGatewayMetricsController {
  constructor(private readonly metrics: PriceGatewayMetrics) {}

  @Get('metrics')
  getMetrics() {
    return this.metrics.getSnapshot();
  }
}
