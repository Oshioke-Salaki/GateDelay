import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  UserSettings,
  SettingCategory,
  SettingValue,
  DEFAULT_SETTINGS,
} from './user-settings.entity';
import {
  UpdateSettingDto,
  UpdateCategoryDto,
  BulkUpdateSettingsDto,
  SyncSettingsDto,
} from './dto/user-settings.dto';

const VALID_CATEGORIES: SettingCategory[] = [
  'notifications',
  'privacy',
  'trading',
  'display',
  'security',
];

type AllowedSettingValue = string | number | boolean;

const SETTING_VALIDATORS: Record<
  SettingCategory,
  Record<string, (v: AllowedSettingValue) => boolean>
> = {
  notifications: {
    emailAlerts: (v) => typeof v === 'boolean',
    pushAlerts: (v) => typeof v === 'boolean',
    tradeConfirmations: (v) => typeof v === 'boolean',
    marketUpdates: (v) => typeof v === 'boolean',
    weeklyDigest: (v) => typeof v === 'boolean',
  },
  privacy: {
    profileVisible: (v) => typeof v === 'boolean',
    showTradingHistory: (v) => typeof v === 'boolean',
    allowDataCollection: (v) => typeof v === 'boolean',
  },
  trading: {
    defaultSlippage: (v) => typeof v === 'number' && v >= 0 && v <= 50,
    autoApprove: (v) => typeof v === 'boolean',
    confirmLargeTrades: (v) => typeof v === 'boolean',
    largeTradeThreshold: (v) => typeof v === 'number' && v > 0,
  },
  display: {
    theme: (v) => typeof v === 'string' && ['light', 'dark', 'system'].includes(v as string),
    currency: (v) => typeof v === 'string' && /^[A-Z]{3}$/.test(v as string),
    language: (v) => typeof v === 'string' && /^[a-z]{2}(-[A-Z]{2})?$/.test(v as string),
    decimalPlaces: (v) => typeof v === 'number' && [0, 1, 2, 4, 6].includes(v as number),
  },
  security: {
    twoFactorEnabled: (v) => typeof v === 'boolean',
    sessionTimeout: (v) => typeof v === 'number' && v >= 5 && v <= 1440,
    loginNotifications: (v) => typeof v === 'boolean',
  },
};

@Injectable()
export class UserSettingsService {
  private readonly logger = new Logger(UserSettingsService.name);
  private readonly store = new Map<string, UserSettings>();

  getOrCreate(userId: string): UserSettings {
    if (!this.store.has(userId)) {
      const now = new Date();
      const categories = {} as UserSettings['categories'];

      for (const cat of VALID_CATEGORIES) {
        categories[cat] = {};
        for (const [key, value] of Object.entries(DEFAULT_SETTINGS[cat])) {
          categories[cat][key] = { key, value, updatedAt: now };
        }
      }

      const settings: UserSettings = {
        userId,
        categories,
        syncToken: uuidv4(),
        createdAt: now,
        updatedAt: now,
      };

      this.store.set(userId, settings);
      this.logger.log(`Initialised settings for user ${userId}`);
    }

    return this.store.get(userId)!;
  }

  getAll(userId: string): UserSettings {
    return this.getOrCreate(userId);
  }

  getCategory(userId: string, category: SettingCategory): Record<string, SettingValue> {
    this.assertValidCategory(category);
    return this.getOrCreate(userId).categories[category];
  }

  getSetting(userId: string, category: SettingCategory, key: string): SettingValue {
    this.assertValidCategory(category);
    const settings = this.getOrCreate(userId);
    const entry = settings.categories[category][key];
    if (!entry) {
      throw new NotFoundException(`Setting '${key}' not found in category '${category}'`);
    }
    return entry;
  }

  updateSetting(
    userId: string,
    category: SettingCategory,
    dto: UpdateSettingDto,
  ): SettingValue {
    this.assertValidCategory(category);
    this.validateSettingValue(category, dto.key, dto.value);

    const settings = this.getOrCreate(userId);
    const now = new Date();
    const entry: SettingValue = { key: dto.key, value: dto.value, updatedAt: now };

    settings.categories[category][dto.key] = entry;
    settings.syncToken = uuidv4();
    settings.updatedAt = now;
    this.store.set(userId, settings);

    return entry;
  }

  updateCategory(userId: string, dto: UpdateCategoryDto): Record<string, SettingValue> {
    this.assertValidCategory(dto.category);

    const settings = this.getOrCreate(userId);
    const now = new Date();

    for (const [key, value] of Object.entries(dto.settings)) {
      this.validateSettingValue(dto.category, key, value);
      settings.categories[dto.category][key] = { key, value, updatedAt: now };
    }

    settings.syncToken = uuidv4();
    settings.updatedAt = now;
    this.store.set(userId, settings);

    this.logger.log(`Updated category '${dto.category}' for user ${userId}`);
    return settings.categories[dto.category];
  }

  bulkUpdate(userId: string, dto: BulkUpdateSettingsDto): UserSettings {
    const categories = Object.keys(dto.updates) as SettingCategory[];

    for (const cat of categories) {
      this.assertValidCategory(cat);
      for (const [key, value] of Object.entries(dto.updates[cat]!)) {
        this.validateSettingValue(cat, key, value);
      }
    }

    const settings = this.getOrCreate(userId);
    const now = new Date();

    for (const cat of categories) {
      for (const [key, value] of Object.entries(dto.updates[cat]!)) {
        settings.categories[cat][key] = { key, value, updatedAt: now };
      }
    }

    settings.syncToken = uuidv4();
    settings.updatedAt = now;
    this.store.set(userId, settings);

    this.logger.log(`Bulk updated ${categories.length} categories for user ${userId}`);
    return settings;
  }

  deleteSetting(userId: string, category: SettingCategory, key: string): void {
    this.assertValidCategory(category);

    const settings = this.getOrCreate(userId);
    const defaults = DEFAULT_SETTINGS[category];

    if (!(key in defaults)) {
      throw new NotFoundException(`Setting '${key}' not found in category '${category}'`);
    }

    const now = new Date();
    settings.categories[category][key] = {
      key,
      value: defaults[key],
      updatedAt: now,
    };
    settings.syncToken = uuidv4();
    settings.updatedAt = now;
    this.store.set(userId, settings);
  }

  resetCategory(userId: string, category: SettingCategory): Record<string, SettingValue> {
    this.assertValidCategory(category);

    const settings = this.getOrCreate(userId);
    const now = new Date();

    settings.categories[category] = {};
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS[category])) {
      settings.categories[category][key] = { key, value, updatedAt: now };
    }

    settings.syncToken = uuidv4();
    settings.updatedAt = now;
    this.store.set(userId, settings);

    this.logger.log(`Reset category '${category}' for user ${userId}`);
    return settings.categories[category];
  }

  resetAll(userId: string): UserSettings {
    this.store.delete(userId);
    return this.getOrCreate(userId);
  }

  sync(userId: string, dto: SyncSettingsDto): UserSettings {
    const settings = this.getOrCreate(userId);

    if (settings.syncToken !== dto.syncToken) {
      throw new ConflictException({
        message: 'Sync token mismatch — client is out of date',
        serverSyncToken: settings.syncToken,
        serverUpdatedAt: settings.updatedAt,
      });
    }

    return this.bulkUpdate(userId, { updates: dto.snapshot });
  }

  private assertValidCategory(category: string): asserts category is SettingCategory {
    if (!VALID_CATEGORIES.includes(category as SettingCategory)) {
      throw new BadRequestException(
        `Invalid category '${category}'. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
      );
    }
  }

  private validateSettingValue(
    category: SettingCategory,
    key: string,
    value: AllowedSettingValue,
  ): void {
    const validators = SETTING_VALIDATORS[category];
    const validator = validators[key];

    if (!validator) {
      throw new BadRequestException(
        `Unknown setting key '${key}' in category '${category}'`,
      );
    }

    if (!validator(value)) {
      throw new BadRequestException(
        `Invalid value '${value}' for setting '${category}.${key}'`,
      );
    }
  }
}
