"use client";

import { SETTINGS_STORAGE_KEY, DEFAULT_THEME, normalizeTheme, type Theme } from "./theme";

export type PersistenceStatus = "not-saved" | "persisted" | "session-only";

function reportError(message: string, error: unknown): void {
  try { console.error(message, error); } catch { /* Logging must not interrupt delivery. */ }
}

export interface UserSettings {
  theme: Theme;
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
  theme: DEFAULT_THEME,
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

const STORAGE_KEY = SETTINGS_STORAGE_KEY;

const SUPPORTED_THEMES: readonly Theme[] = ["light", "dark", "system"];
const SUPPORTED_LANGUAGES = ["en", "es", "fr", "de", "zh", "ja"];
const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CNY"];
const SUPPORTED_DATE_FORMATS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"];
const SUPPORTED_TIME_FORMATS = ["12h", "24h"];
const SUPPORTED_GAS_PREFERENCES = ["slow", "standard", "fast"];
const MIN_SLIPPAGE = 0.1;
const MAX_SLIPPAGE = 50;

type FieldValidator = (value: unknown) => boolean;

const isBoolean: FieldValidator = (value) => typeof value === "boolean";
const oneOf = (allowed: readonly string[]): FieldValidator => (value) =>
  typeof value === "string" && allowed.includes(value);
const isSlippage: FieldValidator = (value) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= MIN_SLIPPAGE &&
  value <= MAX_SLIPPAGE;

const TOP_LEVEL_VALIDATORS: Record<string, FieldValidator> = {
  theme: oneOf(SUPPORTED_THEMES),
  language: oneOf(SUPPORTED_LANGUAGES),
  currency: oneOf(SUPPORTED_CURRENCIES),
  dateFormat: oneOf(SUPPORTED_DATE_FORMATS),
  timeFormat: oneOf(SUPPORTED_TIME_FORMATS),
};

const CATEGORY_VALIDATORS: Record<string, Record<string, FieldValidator>> = {
  notifications: {
    email: isBoolean,
    push: isBoolean,
    priceAlerts: isBoolean,
    marketUpdates: isBoolean,
    tradeConfirmations: isBoolean,
    newsletter: isBoolean,
  },
  trading: {
    defaultSlippage: isSlippage,
    confirmTransactions: isBoolean,
    showAdvancedOptions: isBoolean,
    autoApprove: isBoolean,
    gasPreference: oneOf(SUPPORTED_GAS_PREFERENCES),
  },
  privacy: {
    showProfile: isBoolean,
    showPortfolio: isBoolean,
    showActivity: isBoolean,
    analyticsEnabled: isBoolean,
  },
  display: {
    compactMode: isBoolean,
    showBalances: isBoolean,
    animationsEnabled: isBoolean,
    soundEnabled: isBoolean,
  },
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function hasOwn(source: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(source, key);
}

/**
 * Strict validation for user-supplied import documents (FE-012). Every key
 * must be supported and every present value must match its type, enum, and
 * range; omitted keys fall back to DEFAULT_SETTINGS. Returns null on any
 * violation so callers can reject the whole document without mutating state.
 */
export function parseImportedSettings(parsed: unknown): UserSettings | null {
  if (!isPlainObject(parsed)) return null;

  const next: Record<string, unknown> = {};
  for (const key of Object.keys(parsed)) {
    const value = parsed[key];
    const validate = hasOwn(TOP_LEVEL_VALIDATORS, key) ? TOP_LEVEL_VALIDATORS[key] : undefined;
    if (validate) {
      if (!validate(value)) return null;
      next[key] = value;
      continue;
    }

    const fields = hasOwn(CATEGORY_VALIDATORS, key) ? CATEGORY_VALIDATORS[key] : undefined;
    if (!fields || !isPlainObject(value)) return null;
    const category: Record<string, unknown> = {
      ...(DEFAULT_SETTINGS[key as keyof UserSettings] as object),
    };
    for (const field of Object.keys(value)) {
      const validateField = hasOwn(fields, field) ? fields[field] : undefined;
      if (!validateField || !validateField(value[field])) return null;
      category[field] = value[field];
    }
    next[key] = category;
  }

  return { ...DEFAULT_SETTINGS, ...next } as UserSettings;
}

/**
 * Single merge point for settings coming from persistence, so the initial
 * load, JSON import, and cross-tab `storage` events all reuse the same
 * validation and merging before any subscriber is notified.
 */
function mergePersistedSettings(parsed: unknown): UserSettings {
  const source: Record<string, unknown> =
    parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  return { ...DEFAULT_SETTINGS, ...source, theme: normalizeTheme(source.theme) };
}

export class SettingsService {
  private persistenceStatus: PersistenceStatus = "not-saved";
  private persistenceListeners = new Set<(status: PersistenceStatus) => void>();
  private settings: UserSettings = DEFAULT_SETTINGS;
  private listeners: Set<(settings: UserSettings) => void> = new Set();
  private storageListener: ((event: StorageEvent) => void) | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          this.settings = mergePersistedSettings(JSON.parse(stored));
          this.persistenceStatus = "persisted";
        }
      } catch (e) {
        this.persistenceStatus = "session-only";
        reportError("Failed to load settings from localStorage", e);
      }
      this.registerStorageListener();
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
      // Validate the whole document before touching state so a rejected
      // import leaves both in-memory settings and localStorage unchanged.
      const next = parseImportedSettings(JSON.parse(json));
      if (!next) {
        reportError("Failed to import settings", new Error("Unsupported or invalid settings document"));
        return false;
      }
      this.settings = next;
      this.saveAndNotify();
      return true;
    } catch (e) {
      reportError("Failed to import settings", e);
      return false;
    }
  }

  subscribe(listener: (settings: UserSettings) => void): () => void {
    this.listeners.add(listener);
    // Emit initial value
    this.notify(listener, this.settings);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getPersistenceStatus(): PersistenceStatus {
    return this.persistenceStatus;
  }

  subscribePersistence(listener: (status: PersistenceStatus) => void): () => void {
    this.persistenceListeners.add(listener);
    this.notify(listener, this.persistenceStatus);
    return () => { this.persistenceListeners.delete(listener); };
  }

  private notify<T>(listener: (value: T) => void, value: T): void {
    try { listener(value); }
    catch (error) { reportError("Settings subscriber failed", error); }
  }

  private saveAndNotify(): void {
    let status: PersistenceStatus = "session-only";
    try {
      if (typeof window === "undefined") throw new Error("Browser storage is unavailable");
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      status = "persisted";
    } catch (error) {
      reportError("Failed to save settings to localStorage", error);
    }
    if (status !== this.persistenceStatus) {
      this.persistenceStatus = status;
      this.persistenceListeners.forEach((listener) => this.notify(listener, status));
    }
    this.listeners.forEach((listener) => this.notify(listener, this.settings));
  }

  /**
   * Cross-tab synchronization (FE-014): the browser fires a `storage` event in
   * every *other* tab whenever this tab's localStorage entry is written, and it
   * never fires in the tab that performed the write. Listening here lets each
   * tab apply the remote value without re-saving it, which is what keeps the
   * propagation free of echo loops and duplicate saves.
   */
  private registerStorageListener(): void {
    if (typeof window.addEventListener !== "function") return;
    this.storageListener = (event: StorageEvent) => this.handleStorageEvent(event);
    try {
      window.addEventListener("storage", this.storageListener);
    } catch (error) {
      reportError("Failed to register the cross-tab settings listener", error);
      this.storageListener = null;
    }
  }

  private handleStorageEvent(event: StorageEvent): void {
    try {
      // Unrelated keys and non-localStorage areas (e.g. sessionStorage or
      // synthetic events without a storage area) must not trigger updates.
      if (event.key !== STORAGE_KEY) return;
      if (event.storageArea !== window.localStorage) return;

      let next: UserSettings;
      if (event.newValue === null) {
        // Another tab removed the key; fall back to the defaults like a fresh load.
        next = { ...DEFAULT_SETTINGS };
      } else {
        next = mergePersistedSettings(JSON.parse(event.newValue));
      }
      this.applyRemoteSettings(next);
    } catch (error) {
      // A malformed remote payload must never corrupt local state.
      reportError("Failed to apply cross-tab settings update", error);
    }
  }

  /**
   * Applies a value persisted by another tab. Deliberately does NOT write back
   * to localStorage (the value is already there) and does not touch the
   * persistence status, which tracks this tab's own save capability.
   */
  private applyRemoteSettings(next: UserSettings): void {
    if (JSON.stringify(next) === JSON.stringify(this.settings)) return;
    this.settings = next;
    this.listeners.forEach((listener) => this.notify(listener, this.settings));
  }
}

export const settingsService = new SettingsService();

/**
 * Fee policy applied to transaction execution (FE-1338). `tradingFeeBps` is the
 * venue fee in basis points and `gasEstimateMultiplier` scales the raw gas
 * estimate to account for volatility before confirmation.
 */
export interface FeePolicy {
  tradingFeeBps: number;
  gasEstimateMultiplier: number;
}

export const DEFAULT_FEE_POLICY: FeePolicy = {
  tradingFeeBps: 30,
  gasEstimateMultiplier: 1.2,
};

/**
 * Execution venues the trading form can target. Only venues listed here may
 * expose advanced controls (limit orders, leverage) in the UI (FE-1337).
 */
export type SupportedVenue = "marketmaker" | "limit" | "leverage";

export interface VenueCapabilities {
  limitOrders: boolean;
  leverage: boolean;
  feePolicy: FeePolicy;
}

export const VENUE_CAPABILITIES: Record<SupportedVenue, VenueCapabilities> = {
  marketmaker: {
    limitOrders: false,
    leverage: false,
    feePolicy: DEFAULT_FEE_POLICY,
  },
  limit: {
    limitOrders: true,
    leverage: false,
    feePolicy: { tradingFeeBps: 20, gasEstimateMultiplier: 1.1 },
  },
  leverage: {
    limitOrders: true,
    leverage: true,
    feePolicy: { tradingFeeBps: 50, gasEstimateMultiplier: 1.35 },
  },
};

export function getFeePolicy(venue: SupportedVenue): FeePolicy {
  return VENUE_CAPABILITIES[venue]?.feePolicy ?? DEFAULT_FEE_POLICY;
}

export function venueSupports(
  venue: SupportedVenue,
  feature: "limitOrders" | "leverage"
): boolean {
  return VENUE_CAPABILITIES[venue]?.[feature] === true;
}

export type OrderSide = "buy" | "sell";

export interface SlippageBounds {
  minProceeds: number;
  maxCost: number;
}

/**
 * Converts a slippage tolerance (in percent) into executable cost/proceeds
 * limits for a quote (FE-1335). Buys cap the maximum cost; sells floor the
 * minimum proceeds. The opposite bound is left at the quote value so callers
 * can pass both to the execution path unconditionally.
 */
export function slippageBounds(
  quotePrice: number,
  side: OrderSide,
  slippagePercent: number
): SlippageBounds {
  const safePrice = Number.isFinite(quotePrice) && quotePrice > 0 ? quotePrice : 0;
  const safeSlippage =
    Number.isFinite(slippagePercent) && slippagePercent > 0 ? slippagePercent : 0;
  const factor = safeSlippage / 100;
  if (side === "buy") {
    return { minProceeds: safePrice, maxCost: safePrice * (1 + factor) };
  }
  return { minProceeds: safePrice * (1 - factor), maxCost: safePrice };
}

export const settingsValidation = {
  slippage: (value: number): true | string => {
    if (isNaN(value)) return "Slippage must be a number";
    if (value < MIN_SLIPPAGE || value > MAX_SLIPPAGE) {
      return "Slippage must be between 0.1% and 50%";
    }
    return true;
  },
  language: (value: string): true | string => {
    if (!SUPPORTED_LANGUAGES.includes(value)) {
      return "Unsupported language";
    }
    return true;
  },
  currency: (value: string): true | string => {
    if (!SUPPORTED_CURRENCIES.includes(value)) {
      return "Unsupported currency";
    }
    return true;
  },
};
