import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEthereumAddress,
  IsNumber,
} from 'class-validator';

export class ConnectWalletDto {
  @IsEthereumAddress()
  address: string;

  /** EIP-191 personal_sign signature of `message` */
  @IsString()
  @IsNotEmpty()
  signature: string;

  /** The plaintext message that was signed */
  @IsString()
  @IsNotEmpty()
  message: string;

  /** Unique nonce to prevent replay attacks */
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  nonce?: string;

  /** Unix timestamp in milliseconds when the request was signed */
  @IsNumber()
  @IsOptional()
  timestamp?: number;
}

export class WalletQueryDto {
  @IsOptional()
  @IsString()
  network?: string;
}
