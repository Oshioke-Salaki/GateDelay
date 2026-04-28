import { IsEnum, IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { TradingPairStatus } from '../schemas/trading-pair.schema';

export class UpdateTradingPairDto {
  @IsOptional()
  @IsString()
  baseAsset?: string;

  @IsOptional()
  @IsString()
  quoteAsset?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minTradeSize?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxTradeSize?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tickSize?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePrecision?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amountPrecision?: number;

  @IsOptional()
  @IsEnum(TradingPairStatus)
  status?: TradingPairStatus;

  @IsOptional()
  @IsString()
  volume24h?: string;

  @IsOptional()
  @IsString()
  priceChangePercent24h?: string;

  @IsOptional()
  @IsString()
  high24h?: string;

  @IsOptional()
  @IsString()
  low24h?: string;

  @IsOptional()
  @IsString()
  lastPrice?: string;

  @IsOptional()
  @IsString()
  openPrice24h?: string;
}
