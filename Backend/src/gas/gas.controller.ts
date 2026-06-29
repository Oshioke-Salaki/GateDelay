import { Controller, Get, Param } from '@nestjs/common';
import { GasService } from './gas.service';

@Controller('gas')
export class GasController {
  constructor(private readonly gasService: GasService) {}

  /** GET /gas/estimate — gas tiers for the default network */
  @Get('estimate')
  getEstimate() {
    return this.gasService.getEstimate();
  }

  /** GET /gas/estimate/:network — gas tiers for a named network */
  @Get('estimate/:network')
  getEstimateForNetwork(@Param('network') network: string) {
    return this.gasService.getEstimate(network);
  }
}
