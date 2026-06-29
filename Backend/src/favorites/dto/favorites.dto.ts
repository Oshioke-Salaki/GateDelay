import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ArrayMaxSize,
  MaxLength,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class AddFavoriteDto {
  @IsString()
  @IsNotEmpty()
  marketId: string;

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @MaxLength(500)
  @IsOptional()
  notes?: string;
}

export class UpdateFavoriteDto {
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @MaxLength(500)
  @IsOptional()
  notes?: string;
}

export class SyncFavoritesDto {
  @IsString()
  @IsNotEmpty()
  syncToken: string;

  @IsArray()
  @IsString({ each: true })
  marketIds: string[];
}

export class RecommendationsQueryDto {
  @IsNumber()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number;
}
