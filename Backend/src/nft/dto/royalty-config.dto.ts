import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class SetRoyaltyBpsDto {
  @ApiProperty({
    description: 'Clip identifier to configure royalty for',
    example: 'clip_01HZX9K2M3N4P5Q6R7S8T9',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  clipId: string;

  @ApiProperty({
    description:
      'Royalty fee in basis points. 1000 BPS = 10%. Minimum 0, maximum 1500.',
    example: 1000,
    default: 1000,
    minimum: 0,
    maximum: 1500,
  })
  @IsInt()
  @Min(0)
  @Max(1500)
  royaltyBps: number;
}

export class RoyaltyConfigResponseDto {
  @ApiProperty({
    description: 'Clip identifier the royalty is set on',
    example: 'clip_01HZX9K2M3N4P5Q6R7S8T9',
  })
  clipId: string;

  @ApiProperty({
    description: 'Royalty in basis points now set on the clip',
    example: 1000,
    minimum: 0,
    maximum: 1500,
  })
  royaltyBps: number;
}
