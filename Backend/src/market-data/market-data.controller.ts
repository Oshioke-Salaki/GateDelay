import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('market-data')
@UseGuards(JwtAuthGuard)
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @Get('flights')
  getFlights(
    @Query('status') flightStatus?: string,
    @Query('airline') airline?: string,
    @Query('flight') flightNumber?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.marketDataService.getFlights({
      flightStatus,
      airline,
      flightNumber,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('flights/:iata')
  getFlightByIata(@Param('iata') iata: string) {
    return this.marketDataService.getFlightByIata(iata);
  }

  @Get('airlines')
  getAirlines(
    @Query('search') search?: string,
    @Query('limit') limit?: number,
  ) {
    return this.marketDataService.getAirlines({
      search,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
