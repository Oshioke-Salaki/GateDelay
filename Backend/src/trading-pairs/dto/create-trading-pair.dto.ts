import { IsString, IsNumber, IsEnum, IsOptional, Min } from 'class-validator';
import { TradingPairStatus } from '../schemas/trading-pair.schema';

export class CreateTradingPairDto {
  @IsString()
  baseAsset: string;

  @IsString()
  quoteAsset: string;

  @IsNumber()
  @Min(0)
  minTradeSize: number;

  @IsNumber()
  @Min(0)
  maxTradeSize: number;

  @IsNumber()
  @Min(0)
  tickSize: number;

  @IsNumber()
  @Min(0)
  pricePrecision: number;

  @IsNumber()
  @Min(0)
  amountPrecision: number;

  @IsOptional()
  @IsEnum(TradingPairStatus)
  status?: TradingPairStatus;
}
