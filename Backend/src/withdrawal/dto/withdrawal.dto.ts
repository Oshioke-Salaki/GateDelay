import {
  IsEthereumAddress,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumberString,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsInt,
  Min,
} from 'class-validator';

export class InitiateWithdrawalDto {
  @IsEthereumAddress()
  fromAddress: string;

  @IsEthereumAddress()
  toAddress: string;

  /**
   * Token contract address, or the sentinel string "NATIVE" for the native
   * chain token (ETH, MNT, …).
   */
  @IsString()
  @IsNotEmpty()
  tokenAddress: string;

  @IsNumberString()
  @IsNotEmpty()
  amount: string;

  /**
   * Optional: when provided the withdrawal will be placed under a multi-sig
   * flow with this threshold.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  multiSigThreshold?: number;

  /** Required when multiSigThreshold > 0 */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsEthereumAddress({ each: true })
  multiSigSigners?: string[];
}

export class SubmitWithdrawalTxHashDto {
  @IsString()
  @IsNotEmpty()
  txHash: string;
}

export class MultiSigSignatureDto {
  @IsEthereumAddress()
  signerAddress: string;

  @IsString()
  @IsNotEmpty()
  signature: string;
}

export class WithdrawalQueryDto {
  @IsOptional()
  @IsString()
  status?: string;
}
