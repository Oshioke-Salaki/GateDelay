import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsEthereumAddress,
  Min,
  Max,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BridgeProtocol, BridgeStatus } from '../schemas/bridge-transaction.schema';

export class InitiateBridgeDto {
  @IsEnum(BridgeProtocol)
  protocol: BridgeProtocol;

  @IsNumber()
  @IsPositive()
  fromChainId: number;

  @IsNumber()
  @IsPositive()
  toChainId: number;

  @IsString()
  tokenSymbol: string;

  @IsString()
  tokenAddress: string;

  /** Amount as string to preserve precision */
  @IsString()
  amount: string;

  @IsEthereumAddress()
  senderAddress: string;

  @IsEthereumAddress()
  recipientAddress: string;

  /** Slippage tolerance in basis points (default 50 = 0.5%) */
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(1000)
  slippageBps?: number;

  /** Maximum acceptable fee in USD */
  @IsString()
  @IsOptional()
  maxFeeUsd?: string;
}

export class UpdateBridgeTxDto {
  @IsEnum(BridgeStatus)
  @IsOptional()
  status?: BridgeStatus;

  @IsString()
  @IsOptional()
  sourceTxHash?: string;

  @IsString()
  @IsOptional()
  destinationTxHash?: string;

  @IsString()
  @IsOptional()
  bridgeTransferId?: string;

  @IsNumber()
  @IsOptional()
  sourceConfirmations?: number;

  @IsNumber()
  @IsOptional()
  destinationConfirmations?: number;

  @IsString()
  @IsOptional()
  receivedAmount?: string;

  @IsString()
  @IsOptional()
  errorMessage?: string;
}

export class GetBridgeTransactionsDto {
  @IsString()
  @IsOptional()
  userId?: string;

  @IsEnum(BridgeStatus)
  @IsOptional()
  status?: BridgeStatus;

  @IsEnum(BridgeProtocol)
  @IsOptional()
  protocol?: BridgeProtocol;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  fromChainId?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  toChainId?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}
