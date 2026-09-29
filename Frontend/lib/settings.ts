"use client";

export interface UserSettings {
  theme: "light" | "dark" | "system";
  language: string;
  currency: string;
  dateFormat: string;
  timeFormat: "12h" | "24h";
  notifications: {
    email: boolean;
    push: boolean;
    priceAlerts: boolean;
    marketUpdates: boolean;
    tradeConfirmations: boolean;
    newsletter: boolean;
  };
  trading: {
    defaultSlippage: number;
    confirmTransactions: boolean;
    showAdvancedOptions: boolean;
    autoApprove: boolean;
    gasPreference: "slow" | "standard" | "fast";
  };
  privacy: {
    showProfile: boolean;
    showPortfolio: boolean;
    showActivity: boolean;
    analyticsEnabled: boolean;
  };
  display: {
    compactMode: boolean;
    showBalances: boolean;
    animationsEnabled: boolean;
    soundEnabled: boolean;
  };
}

export const DEFAULT_SETTINGS: UserSettings = {
  theme: "system",
  language: "en",
  currency: "USD",
  dateFormat: "MM/DD/YYYY",
  timeFormat: "12h",
  notifications: {
    email: true,
    push: true,
    priceAlerts: true,
    marketUpdates: true,
    tradeConfirmations: true,
    newsletter: false,
  },
  trading: {
    defaultSlippage: 0.5,
    confirmTransactions: true,
    showAdvancedOptions: false,
    autoApprove: false,
    gasPreference: "standard",
  },
  privacy: {
    showProfile: false,
    showPortfolio: false,
    showActivity: false,
    analyticsEnabled: true,
  },
  display: {
    compactMode: false,
    showBalances: true,
    animationsEnabled: true,
    soundEnabled: true,
  },
};

const STORAGE_KEY = "gate_delay_user_settings";

class SettingsService {
  private settings: UserSettings = DEFAULT_SETTINGS;
  private listeners: Set<(settings: UserSettings) => void> = new Set();

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
        }
      } catch (e) {
        console.error("Failed to load settings from localStorage", e);
      }
    }
  }

  getSettings(): UserSettings {
    return this.settings;
  }

  getSetting<K extends keyof UserSettings>(key: K): UserSettings[K] {
    return this.settings[key];
  }

  updateSettings(updates: Partial<UserSettings>): void {
    this.settings = { ...this.settings, ...updates };
    this.saveAndNotify();
  }

  updateNestedSetting<K extends keyof UserSettings>(
    category: K,
    updates: Partial<UserSettings[K]>
  ): void {
    this.settings = {
      ...this.settings,
      [category]: {
        ...(this.settings[category] as any),
        ...(updates as any),
      },
    };
    this.saveAndNotify();
  }

  resetSettings(): void {
    this.settings = DEFAULT_SETTINGS;
    this.saveAndNotify();
  }

  resetCategory<K extends keyof UserSettings>(category: K): void {
    this.settings = {
      ...this.settings,
      [category]: DEFAULT_SETTINGS[category],
    };
    this.saveAndNotify();
  }

  exportSettings(): string {
    return JSON.stringify(this.settings, null, 2);
  }

  importSettings(json: string): boolean {
    try {
      const parsed = JSON.parse(json);
      // Basic structural validation
      if (parsed && typeof parsed === "object") {
        this.settings = { ...DEFAULT_SETTINGS, ...parsed };
        this.saveAndNotify();
        return true;
      }
      return false;
    } catch (e) {
      console.error("Failed to import settings", e);
      return false;
    }
  }

  subscribe(listener: (settings: UserSettings) => void): () => void {
    this.listeners.add(listener);
    // Emit initial value
    listener(this.settings);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private saveAndNotify(): void {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      } catch (e) {
        console.error("Failed to save settings to localStorage", e);
      }
    }
    this.listeners.forEach((listener) => listener(this.settings));
  }
}

export const settingsService = new SettingsService();

export const settingsValidation = {
  slippage: (value: number): true | string => {
    if (isNaN(value)) return "Slippage must be a number";
    if (value < 0.1 || value > 50) {
      return "Slippage must be between 0.1% and 50%";
    }
    return true;
  },
  language: (value: string): true | string => {
    const validLanguages = ["en", "es", "fr", "de", "zh", "ja"];
    if (!validLanguages.includes(value)) {
      return "Unsupported language";
    }
    return true;
  },
  currency: (value: string): true | string => {
    const validCurrencies = ["USD", "EUR", "GBP", "JPY", "CNY"];
    if (!validCurrencies.includes(value)) {
      return "Unsupported currency";
    }
    return true;
  },
};
