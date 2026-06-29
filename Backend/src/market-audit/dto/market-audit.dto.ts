import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateAuditLogDto {
  @IsString()
  marketId: string;

  @IsString()
  operation: string;

  @IsString()
  actor: string;

  @IsString()
  details: string;

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class AuditQueryDto {
  @IsOptional()
  @IsString()
  marketId?: string;

  @IsOptional()
  @IsString()
  operation?: string;

  @IsOptional()
  @IsString()
  actor?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}

export class RetentionPolicyDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  retentionDays?: number;
}
