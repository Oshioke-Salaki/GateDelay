import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsNumber,
  IsInt,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

const TRADE_TYPES = ['buy', 'sell', 'redeem', 'deposit', 'withdraw'] as const;
const TRADE_STATUSES = ['pending', 'confirmed', 'failed'] as const;
type TradeType = (typeof TRADE_TYPES)[number];
type TradeStatus = (typeof TRADE_STATUSES)[number];

/** Upper bound on a single trade-history page. */
export const MAX_TRADING_HISTORY_PAGE_SIZE = 100;

export class GetTradingHistoryDto {
  /**
   * 1-based page number (#916). Ignored when `offset` is supplied, so existing
   * offset-based callers keep byte-for-byte identical results.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(MAX_TRADING_HISTORY_PAGE_SIZE)
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
