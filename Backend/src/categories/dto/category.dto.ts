import { IsString, IsOptional, IsMongoId } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsMongoId()
  parentId?: string;
}

export class AssignMarketDto {
  @IsString()
  marketId: string;
}
