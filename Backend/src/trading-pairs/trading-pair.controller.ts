import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TradingPairService } from './trading-pair.service';
import { CreateTradingPairDto } from './dto/create-trading-pair.dto';
import { UpdateTradingPairDto } from './dto/update-trading-pair.dto';
import { TradingPairStatus } from './schemas/trading-pair.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('trading-pairs')
export class TradingPairController {
  constructor(private readonly tradingPairService: TradingPairService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createTradingPairDto: CreateTradingPairDto) {
    return this.tradingPairService.create(createTradingPairDto);
  }

  @Get()
  findAll(@Query('status') status?: TradingPairStatus) {
    return this.tradingPairService.findAll(status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tradingPairService.findOne(id);
  }

  @Get('by-assets/:base/:quote')
  findByAssets(@Param('base') base: string, @Param('quote') quote: string) {
    return this.tradingPairService.findByAssets(base, quote);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateTradingPairDto: UpdateTradingPairDto,
  ) {
    return this.tradingPairService.update(id, updateTradingPairDto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: TradingPairStatus,
  ) {
    return this.tradingPairService.updateStatus(id, status);
  }
}
