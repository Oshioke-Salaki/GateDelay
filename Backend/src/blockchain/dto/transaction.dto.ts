import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class BroadcastTransactionDto {
  @IsString()
  @IsNotEmpty()
  signedTransaction: string;

  @IsString()
  @IsOptional()
  network?: string;
}

export class TransactionStatusDto {
  @IsString()
  @IsNotEmpty()
  txHash: string;
}
