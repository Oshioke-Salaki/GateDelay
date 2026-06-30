import {
  IsString,
  IsOptional,
  IsIn,
  IsNumber,
  IsDateString,
} from 'class-validator';

export class AnalysisRequestDto {
  @IsString()
  marketId: string;

  @IsString()
  marketTitle: string;

  @IsOptional()
  @IsString()
  marketDescription?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  riskTolerance?: 'low' | 'medium' | 'high';

  /** ISO deadline timestamp — enriches the Groq prompt with time context */
  @IsOptional()
  @IsDateString()
  deadline?: string;

  /** Current implied probability 0–1 (e.g. 0.65 = 65 % YES) */
  @IsOptional()
  @IsNumber()
  currentOdds?: number;

  /** Optional social media sentiment inputs (already aggregated upstream). */
  @IsOptional()
  @IsString()
  socialSignals?: string;

  /** Optional news sentiment inputs (already aggregated upstream). */
  @IsOptional()
  @IsString()
  newsSignals?: string;

  /** Optional trading/market microstructure inputs (already aggregated upstream). */
  @IsOptional()
  @IsString()
  tradingSignals?: string;
}

