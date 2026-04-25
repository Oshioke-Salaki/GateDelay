import { IsString, IsOptional, IsIn } from 'class-validator';

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
}
