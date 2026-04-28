import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  scopes?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];

  @IsInt()
  @Min(1)
  @Max(10000)
  @IsOptional()
  rateLimitPerMinute?: number;
}

export class ListApiKeysQueryDto {
  @IsString()
  @IsOptional()
  status?: 'active' | 'revoked';
}

export class ValidateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  apiKey: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requiredScopes?: string[];

  @IsString()
  @IsOptional()
  endpoint?: string;
}

export class RotateApiKeyDto {
  @IsString()
  @IsOptional()
  newName?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  scopes?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];

  @IsInt()
  @Min(1)
  @Max(10000)
  @IsOptional()
  rateLimitPerMinute?: number;
}

export class RevokeApiKeyDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
