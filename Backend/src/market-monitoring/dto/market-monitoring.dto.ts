import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class RecordMetricDto {
  @IsString()
  marketId: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  price: number;

  @IsNumber()
  @Min(0)
  volume: number;

  @IsNumber()
  @Min(0)
  spreadBps: number;

  @IsNumber()
  @Min(0)
  latencyMs: number;
}

export class HealthQueryDto {
  @IsOptional()
  @IsString()
  marketId?: string;
}
