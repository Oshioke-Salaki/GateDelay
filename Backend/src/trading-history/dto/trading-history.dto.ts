import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { TradeType, TradeStatus } from '../trading-history.entity';

export class GetTradingHistoryDto {
  @IsOptional()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsEnum(['buy', 'sell', 'redeem', 'deposit', 'withdraw'])
  type?: TradeType;

  @IsOptional()
  @IsEnum(['pending', 'confirmed', 'failed'])
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
  @IsEnum(['buy', 'sell', 'redeem', 'deposit', 'withdraw'])
  type?: TradeType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
