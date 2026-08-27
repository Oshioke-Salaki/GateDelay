import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class UploadClipMetadataDto {
  @ApiProperty({
    description: 'Clip identifier whose metadata will be uploaded to IPFS',
    example: 'clip_01HZX9K2M3N4P5Q6R7S8T9',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  clipId: string;

  @ApiProperty({
    description: 'Human-readable clip title for the NFT metadata',
    example: 'GateDelay Flight Highlight #1',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  title: string;

  @ApiPropertyOptional({
    description: 'Clip description for the NFT metadata',
    example: 'A highlight from the GateDelay flight prediction market.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'HTTP or IPFS URL pointing to the clip media asset',
    example: 'https://media.gatedelay.io/clips/clip_01HZX9K2M3N4P5Q6R7S8T9.mp4',
  })
  @IsOptional()
  @IsString()
  animationUrl?: string;

  @ApiPropertyOptional({
    description: 'HTTP or IPFS URL pointing to the clip thumbnail image',
    example: 'https://media.gatedelay.io/clips/clip_01HZX9K2M3N4P5Q6R7S8T9.jpg',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Royalty in basis points (1000 = 10%). Defaults to 1000.',
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

export class UploadClipMetadataResponseDto {
  @ApiProperty({
    description: 'Metadata URI stored on IPFS (ipfs://CID)',
    example:
      'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
  })
  metadataUri: string;

  @ApiProperty({
    description: 'IPFS CID of the uploaded metadata',
    example: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
  })
  cid: string;

  @ApiProperty({
    description: 'Clip ID the metadata is bound to',
    example: 'clip_01HZX9K2M3N4P5Q6R7S8T9',
  })
  clipId: string;

  @ApiProperty({
    description: 'Example HTTP gateway URL for the uploaded metadata',
    example:
      'https://gateway.pinata.cloud/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
  })
  gatewayUrl: string;
}
