"use client";

import { useState, useEffect, useCallback } from "react";
import { settingsService, UserSettings } from "@/lib/settings";

// ─── useSettings Hook ─────────────────────────────────────────────────────────

export function useSettings() {
    const [settings, setSettings] = useState<UserSettings>(settingsService.getSettings());

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
