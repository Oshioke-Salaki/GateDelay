import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEthereumAddress,
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
}

export class WalletQueryDto {
  @IsOptional()
  @IsString()
  network?: string;
}
