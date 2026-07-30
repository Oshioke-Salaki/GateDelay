import { ApiProperty } from '@nestjs/swagger';

export class RoyaltyQueryResponseDto {
  @ApiProperty({
    description: 'Royalty fee in basis points (1000 = 10%)',
    example: 1000,
    minimum: 0,
    maximum: 1500,
  })
  royaltyBps: number;

  @ApiProperty({
    description: 'Stellar account that receives royalty payments',
    example: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOPQRS',
  })
  recipient: string;

  @ApiProperty({
    description: 'NFT mint / contract token address queried on-chain',
    example: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHK3M',
  })
  mintAddress: string;

  @ApiProperty({
    description: 'Whether the response was served from cache',
    example: false,
  })
  cached: boolean;
}

export class RoyaltyNotFoundDto {
  @ApiProperty({ example: 404 })
  statusCode: number;

  @ApiProperty({ example: 'Royalty data not found for mint address' })
  message: string;

  @ApiProperty({ example: 'Not Found' })
  error: string;
}

export class RoyaltyUnauthorizedDto {
  @ApiProperty({ example: 401 })
  statusCode: number;

  @ApiProperty({ example: 'Unauthorized' })
  message: string;
}
