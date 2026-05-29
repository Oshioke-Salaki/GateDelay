import { IsArray, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class SourceTradeDto {
  @IsString()
  tradeId: string;

  @IsString()
  marketId: string;

  @IsNumber()
  amount: number;

  @IsIn(['pending', 'confirmed', 'failed'])
  status: 'pending' | 'confirmed' | 'failed';

  @IsOptional()
  @IsString()
  txHash?: string;
}

export class IngestSourceTradesDto {
  @IsArray()
  trades: SourceTradeDto[];
}

export class RunReconciliationDto {
  @IsOptional()
  @IsArray()
  sources?: string[];
}
