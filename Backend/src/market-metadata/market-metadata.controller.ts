import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MarketMetadataService } from './market-metadata.service';
import {
  CreateMarketMetadataDto,
  UpdateMarketMetadataDto,
  SearchMarketMetadataDto,
} from './dto/market-metadata.dto';

@Controller('market-metadata')
export class MarketMetadataController {
  constructor(private readonly service: MarketMetadataService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateMarketMetadataDto) {
    return this.service.create(dto);
  }

  @Get('search')
  search(@Query() dto: SearchMarketMetadataDto) {
    return this.service.search(dto);
  }

  @Get(':marketId')
  findOne(@Param('marketId') marketId: string) {
    return this.service.findByMarketId(marketId);
  }

  @Get(':marketId/versions')
  findVersions(@Param('marketId') marketId: string) {
    return this.service.findVersions(marketId);
  }

  @Put(':marketId')
  update(
    @Param('marketId') marketId: string,
    @Body() dto: UpdateMarketMetadataDto,
  ) {
    return this.service.update(marketId, dto);
  }

  @Delete(':marketId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('marketId') marketId: string) {
    return this.service.remove(marketId);
  }

  @Post(':marketId/validate')
  validate(
    @Param('marketId') marketId: string,
    @Body() schema: Record<string, unknown>,
  ) {
    return this.service.validateSchema(marketId, schema);
  }
}
