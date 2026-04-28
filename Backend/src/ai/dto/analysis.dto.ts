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
}
