import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsObject,
  ValidateNested,
  IsDefined,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { SettingCategory } from '../user-settings.entity';

const VALID_CATEGORIES: SettingCategory[] = [
  'notifications',
  'privacy',
  'trading',
  'display',
  'security',
];

export class UpdateSettingDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsDefined()
  value: string | number | boolean;
}

export class UpdateCategoryDto {
  @IsIn(VALID_CATEGORIES)
  category: SettingCategory;

  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  settings: Record<string, string | number | boolean>;
}

export class BulkUpdateSettingsDto {
  @IsObject()
  updates: Partial<Record<SettingCategory, Record<string, string | number | boolean>>>;
}

export class SyncSettingsDto {
  @IsString()
  @IsNotEmpty()
  syncToken: string;

  @IsObject()
  snapshot: Partial<Record<SettingCategory, Record<string, string | number | boolean>>>;
}
