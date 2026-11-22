"use client";

import { useState, useEffect, useCallback } from "react";
import { settingsService, UserSettings, type PersistenceStatus } from "@/lib/settings";

// ─── Venue Capabilities & Fee Policy Types ─────────────────────────────────────

export interface VenueCapabilities {
    /** Whether the venue supports limit orders. */
    supportsLimitOrders: boolean;
    /** Whether the venue supports leverage. */
    supportsLeverage: boolean;
    /** Maximum leverage multiplier supported by the venue (1 when unsupported). */
    maxLeverage: number;
}

export interface FeePolicy {
    /** Trading fee rate applied to the selected venue (as a decimal, e.g. 0.001 = 0.1%). */
    tradingFeeRate: number;
    /** Fixed gas fee estimate for the selected transaction, in the venue's native unit. */
    estimatedGasFee: number;
    /** Symbol/unit in which the gas fee is denominated. */
    gasFeeSymbol: string;
}

const DEFAULT_VENUE_CAPABILITIES: VenueCapabilities = {
    supportsLimitOrders: false,
    supportsLeverage: false,
    maxLeverage: 1,
};

const DEFAULT_FEE_POLICY: FeePolicy = {
    tradingFeeRate: 0,
    estimatedGasFee: 0,
    gasFeeSymbol: "",
};

// ─── useSettings Hook ─────────────────────────────────────────────────────────

export function useSettings() {
    const [settings, setSettings] = useState<UserSettings>(settingsService.getSettings());

    const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>(settingsService.getPersistenceStatus());

    useEffect(() => {
        return settingsService.subscribePersistence(setPersistenceStatus);
    }, []);

    useEffect(() => {
        // Subscribe to settings changes
        const unsubscribe = settingsService.subscribe((newSettings) => {
            setSettings(newSettings);
        });

        return unsubscribe;
    }, []);

    const updateSettings = useCallback((updates: Partial<UserSettings>) => {
        settingsService.updateSettings(updates);
    }, []);

    const updateNestedSetting = useCallback(
        <K extends keyof UserSettings>(category: K, updates: Partial<UserSettings[K]>) => {
            settingsService.updateNestedSetting(category, updates);
        },
        []
    );

    const resetSettings = useCallback(() => {
        settingsService.resetSettings();
    }, []);

    const resetCategory = useCallback(<K extends keyof UserSettings>(category: K) => {
        settingsService.resetCategory(category);
    }, []);

    const exportSettings = useCallback(() => {
        return settingsService.exportSettings();
    }, []);

    const importSettings = useCallback((json: string) => {
        return settingsService.importSettings(json);
    }, []);

    return {
        settings,
        persistenceStatus,
        updateSettings,
        updateNestedSetting,
        resetSettings,
        resetCategory,
        exportSettings,
        importSettings,
    };
}

// ─── useSettingCategory Hook ──────────────────────────────────────────────────

export function useSettingCategory<K extends keyof UserSettings>(category: K) {
    const { settings, updateNestedSetting, resetCategory } = useSettings();

    const updateCategory = useCallback(
        (updates: Partial<UserSettings[K]>) => {
            updateNestedSetting(category, updates);
        },
        [category, updateNestedSetting]
    );

    const reset = useCallback(() => {
        resetCategory(category);
    }, [category, resetCategory]);

    return {
        settings: settings[category],
        updateCategory,
        reset,
    };
}

// ─── useSetting Hook ──────────────────────────────────────────────────────────

export function useSetting<K extends keyof UserSettings>(key: K) {
    const { settings, updateSettings } = useSettings();

    const updateSetting = useCallback(
        (value: UserSettings[K]) => {
            updateSettings({ [key]: value } as Partial<UserSettings>);
        },
        [key, updateSettings]
    );

    return [settings[key], updateSetting] as const;
}

// ─── useVenueCapabilities Hook ────────────────────────────────────────────────

/**
 * Returns the supported-feature flags for the currently selected execution venue.
 * Re-renders whenever settings change (e.g. the active venue is switched).
 */
export function useVenueCapabilities(): VenueCapabilities {
    const [capabilities, setCapabilities] = useState<VenueCapabilities>(() =>
        settingsService.getVenueCapabilities?.() ?? DEFAULT_VENUE_CAPABILITIES
    );

    useEffect(() => {
        const read = () =>
            setCapabilities(settingsService.getVenueCapabilities?.() ?? DEFAULT_VENUE_CAPABILITIES);

        read();
        return settingsService.subscribe(() => read());
    }, []);

    return capabilities;
}

// ─── useFeePolicy Hook ────────────────────────────────────────────────────────

/**
 * Returns the fee policy applicable to the currently selected execution venue.
 * Re-renders whenever settings change (e.g. the fee policy or active venue changes).
 */
export function useFeePolicy(): FeePolicy {
    const [feePolicy, setFeePolicy] = useState<FeePolicy>(() =>
        settingsService.getFeePolicy?.() ?? DEFAULT_FEE_POLICY
    );

    useEffect(() => {
        const read = () => setFeePolicy(settingsService.getFeePolicy?.() ?? DEFAULT_FEE_POLICY);

        read();
        return settingsService.subscribe(() => read());
    }, []);

    return feePolicy;
}
