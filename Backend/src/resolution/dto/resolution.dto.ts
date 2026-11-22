import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsOptional,
  IsInt,
  Matches,
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
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{64}$/)
  txHash: string;

  @IsOptional()
  @IsInt()
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
