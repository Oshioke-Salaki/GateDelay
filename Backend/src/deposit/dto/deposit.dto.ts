import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber, Min } from 'class-validator';
import { ConfirmationLevel } from '../schemas/deposit.schema';

export class CreateDepositDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  txHash: string;

  @IsString()
  @IsNotEmpty()
  fromAddress: string;

  @IsString()
  @IsNotEmpty()
  toAddress: string;

  @IsString()
  @IsNotEmpty()
  amount: string;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsString()
  @IsNotEmpty()
  network: string;

  @IsEnum(ConfirmationLevel)
  @IsOptional()
  requiredConfirmations?: ConfirmationLevel;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class GetDepositsDto {
  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}

export class DepositResponseDto {
  id: string;
  userId: string;
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  currency: string;
  network: string;
  status: string;
  confirmations: number;
  requiredConfirmations: number;
  blockNumber?: number;
  balanceUpdated: boolean;
  notificationSent: boolean;
  confirmedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
