import { IsString, Matches, IsInt, Min } from 'class-validator';

/** No client supplied accounting values are accepted. */
export class ExecutionPositionDto {
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{64}$/)
  txHash: string;

  @IsInt()
  @Min(0)
  logIndex: number;

  @IsString()
  @Matches(/^0x[0-9a-fA-F]+$/)
  signature: string;
}

export class OpenPositionDto extends ExecutionPositionDto {}
export class ClosePositionDto extends ExecutionPositionDto {}
