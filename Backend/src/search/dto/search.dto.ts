import { IsOptional, IsString, IsNumber, IsIn, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchQueryDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional()
  @IsIn(['active', 'landed', 'cancelled', 'incident', 'diverted'])
  status?: string;
  @IsOptional() @IsString() airline?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minVolume?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxVolume?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minLiquidity?: number;
  @IsOptional() @IsIn(['relevance', 'volume', 'date']) sortBy?:
    | 'relevance'
    | 'volume'
    | 'date';
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) limit?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) offset?: number;
}
