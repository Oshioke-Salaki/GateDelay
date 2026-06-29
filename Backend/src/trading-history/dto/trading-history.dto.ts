import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

const TRADE_TYPES = ['buy', 'sell', 'redeem', 'deposit', 'withdraw'] as const;
const TRADE_STATUSES = ['pending', 'confirmed', 'failed'] as const;
type TradeType = (typeof TRADE_TYPES)[number];
type TradeStatus = (typeof TRADE_STATUSES)[number];

export class GetTradingHistoryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsEnum(TRADE_TYPES)
  type?: TradeType;

  @IsOptional()
  @IsEnum(TRADE_STATUSES)
  status?: TradeStatus;

  @IsOptional()
  @IsString()
  marketId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(['date', 'amount', 'pnl', 'type'])
  sortBy?: string = 'date';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class ExportTradingHistoryDto {
  @IsOptional()
  @IsEnum(['csv', 'json'])
  format?: 'csv' | 'json' = 'csv';

  @IsOptional()
  @IsEnum(TRADE_TYPES)
  type?: TradeType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
