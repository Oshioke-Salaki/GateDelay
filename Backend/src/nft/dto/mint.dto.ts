import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class PrepareMintTxDto {
  @ApiProperty({
    description: 'Stellar wallet address that will own the minted NFT',
    example: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOPQRS',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^G[A-Z0-9]{55}$/, {
    message: 'walletAddress must be a valid Stellar G... address',
  })
  walletAddress: string;

  @ApiProperty({
    description: 'Clip identifier to mint as an NFT',
    example: 'clip_01HZX9K2M3N4P5Q6R7S8T9',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  clipId: string;

  @ApiPropertyOptional({
    description:
      'IPFS metadata URI for the clip (ipfs://CID or https gateway URL)',
    example:
      'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
  })
  @IsOptional()
  @IsString()
  metadataUri?: string;

  @ApiPropertyOptional({
    description:
      'Royalty fee in basis points (1000 = 10%). Defaults to clip config or 1000.',
    example: 1000,
    minimum: 0,
    maximum: 1500,
    default: 1000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1500)
  royaltyBps?: number;
}

export class PrepareMintTxResponseDto {
  @ApiProperty({
    description: 'Unsigned Soroban mint transaction XDR for wallet signing',
    example:
      'AAAAAgAAAABjbGlwXzAxSFpYOUsyTTNONFA1UTZSN1M4VDl3YWxsZXQAAAAAAAAAAQAAAAAAAAAYAAAA...',
  })
  xdr: string;

  @ApiProperty({
    description: 'Clip ID included in the mint transaction',
    example: 'clip_01HZX9K2M3N4P5Q6R7S8T9',
  })
  clipId: string;

  @ApiProperty({
    description: 'Wallet address that will receive the NFT',
    example: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOPQRS',
  })
  walletAddress: string;

  @ApiProperty({
    description: 'Metadata URI attached to the mint',
    example:
      'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
  })
  metadataUri: string;

  @ApiProperty({
    description: 'Royalty BPS attached via royalty extension',
    example: 1000,
  })
  royaltyBps: number;

  @ApiProperty({
    description: 'Network passphrase used when building the transaction',
    example: 'Test SDF Network ; September 2015',
  })
  networkPassphrase: string;
}

export class MintBadRequestDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({
    example: 'walletAddress must be a valid Stellar G... address',
  })
  message: string | string[];

  @ApiProperty({ example: 'Bad Request' })
  error: string;
}

export class MintNotFoundDto {
  @ApiProperty({ example: 404 })
  statusCode: number;

  @ApiProperty({ example: 'Clip clip_missing not found' })
  message: string;

  @ApiProperty({ example: 'Not Found' })
  error: string;
}

export class MintConflictDto {
  @ApiProperty({ example: 409 })
  statusCode: number;

  @ApiProperty({
    example: 'Clip clip_01HZX9K2M3N4P5Q6R7S8T9 has already been minted',
  })
  message: string;

  @ApiProperty({ example: 'Conflict' })
  error: string;
}
