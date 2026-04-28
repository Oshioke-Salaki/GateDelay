export type SettingCategory =
  | 'notifications'
  | 'privacy'
  | 'trading'
  | 'display'
  | 'security';

export interface SettingValue {
  key: string;
  value: string | number | boolean;
  updatedAt: Date;
}

export interface UserSettings {
  userId: string;
  categories: Record<SettingCategory, Record<string, SettingValue>>;
  syncToken: string;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_SETTINGS: Record<SettingCategory, Record<string, string | number | boolean>> = {
  notifications: {
    emailAlerts: true,
    pushAlerts: true,
    tradeConfirmations: true,
    marketUpdates: false,
    weeklyDigest: true,
  },
  privacy: {
    profileVisible: true,
    showTradingHistory: false,
    allowDataCollection: true,
  },
  trading: {
    defaultSlippage: 0.5,
    autoApprove: false,
    confirmLargeTrades: true,
    largeTradeThreshold: 1000,
  },
  display: {
    theme: 'light',
    currency: 'USD',
    language: 'en',
    decimalPlaces: 2,
  },
  security: {
    twoFactorEnabled: false,
    sessionTimeout: 30,
    loginNotifications: true,
  },
};
