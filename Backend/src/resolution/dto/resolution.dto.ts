import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsOptional,
  IsNumber,
  IsPositive,
  MaxLength,
} from 'class-validator';

export class RequestResolutionDto {
  @IsString()
  @IsNotEmpty()
  marketId: string;

  @IsIn(['YES', 'NO', 'INVALID'])
  outcome: 'YES' | 'NO' | 'INVALID';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  evidence?: string;
}

export class ConfirmResolutionDto {
  @IsOptional()
  @IsString()
  txHash?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  blockNumber?: number;
}

export class DisputeResolutionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;
}

export class ReviewDisputeDto {
  @IsIn(['upheld', 'rejected'])
  decision: 'upheld' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewNotes?: string;
}
