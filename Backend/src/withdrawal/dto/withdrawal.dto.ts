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
  Max,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

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
   * EIP-155 chain id.  Required for multi-sig withdrawals so that approval
   * messages are chain-scoped and cannot be replayed on a different network.
   * For single-owner withdrawals it defaults to 0 (no chain binding).
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  chainId?: number;

  /**
   * Unix timestamp (seconds) after which approval signatures will be rejected.
   * Required for multi-sig withdrawals so stale approvals cannot be submitted
   * after the intent has expired.  Omit for single-owner withdrawals.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  expiry?: number;

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

const VALID_STATUSES = [
  'pending',
  'submitted',
  'confirmed',
  'failed',
  'cancelled',
] as const;

export class WithdrawalQueryDto {
  /**
   * Optional status filter. Must be one of the known WithdrawalStatus values.
   */
  @IsOptional()
  @IsString()
  @IsIn(VALID_STATUSES)
  status?: string;

  /**
   * Opaque cursor returned by the previous page. Encodes `createdAt|id`.
   */
  @IsOptional()
  @IsString()
  cursor?: string;

  /**
   * Maximum records to return per page (1–100, default 20).
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
