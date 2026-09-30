"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/hooks/useSettings";
import { useTheme } from "@/app/components/ThemeProvider";
import { useToast } from "@/hooks/useToast";
import { SettingsSection, SettingsRow } from "@/app/components/settings/SettingsSection";
import {
  ToggleSwitch,
  SelectInput,
  NumberInput,
  RadioGroup,
} from "@/app/components/settings/SettingsInputs";
import { PageErrorBoundary } from "@/app/components/ui/PageErrorBoundary";
import { settingsValidation } from "@/lib/settings";
import {
  getNotificationAuthToken,
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationEventType,
  type NotificationPreferences as ApiNotificationPreferences,
} from "@/lib/notificationPreferences";

// ─── Settings Page ────────────────────────────────────────────────────────────

function SettingsPageContent() {
  const { settings, updateSettings, updateNestedSetting, resetSettings, exportSettings, importSettings } = useSettings();
  const { theme, toggle: toggleTheme } = useTheme();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"appearance" | "notifications" | "trading" | "privacy" | "display">("appearance");
  const [slippageError, setSlippageError] = useState<string>("");
  const [notificationPreferences, setNotificationPreferences] = useState<ApiNotificationPreferences | null>(null);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [notificationReload, setNotificationReload] = useState(0);

  useEffect(() => {
    if (activeTab !== "notifications" || notificationPreferences || notificationLoading || notificationError) return;

    const token = getNotificationAuthToken();
    if (!token) {
      setNotificationError("Sign in to load and update notification preferences.");
      return;
    }

    let active = true;
    setNotificationLoading(true);
    setNotificationError(null);
    getNotificationPreferences(token)
      .then((preferences) => {
        if (active) setNotificationPreferences(preferences);
      })
      .catch((error: unknown) => {
        if (active) {
          setNotificationError(error instanceof Error ? error.message : "Could not load notification preferences.");
        }
      })
      .finally(() => {
        if (active) setNotificationLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeTab, notificationLoading, notificationPreferences, notificationReload]);

  // Apply theme changes immediately
  useEffect(() => {
    if (settings.theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", prefersDark);
    } else {
      document.documentElement.classList.toggle("dark", settings.theme === "dark");
    }
  }, [settings.theme]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    updateSettings({ theme: newTheme });

    if (newTheme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", prefersDark);
    } else {
      document.documentElement.classList.toggle("dark", newTheme === "dark");
    }

    toast.success("Theme Updated", `Theme changed to ${newTheme}`);
  };

  const handleSlippageChange = (value: number) => {
    const validation = settingsValidation.validateSlippage(value);
    if (validation.valid) {
      updateNestedSetting("trading", { defaultSlippage: value });
      setSlippageError("");
      toast.success("Slippage Updated", `Default slippage set to ${value}%`);
    } else {
      setSlippageError(validation.error || "Invalid slippage");
    }
  };

  const saveNotificationPreferences = async (updates: Partial<ApiNotificationPreferences>) => {
    const token = getNotificationAuthToken();
    if (!token || !notificationPreferences || notificationSaving) return;

    setNotificationSaving(true);
    setNotificationError(null);
    try {
      const updated = await updateNotificationPreferences(token, updates);
      setNotificationPreferences(updated);
      toast.success("Notification preferences saved", "Your choices were updated.");
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : "Could not save notification preferences.");
    } finally {
      setNotificationSaving(false);
    }
  };

  const handleNotificationTypeToggle = (types: NotificationEventType[], enabled: boolean) => {
    if (!notificationPreferences) return;
    const disabledTypes = new Set(notificationPreferences.optedOutTypes);
    for (const type of types) {
      if (enabled) disabledTypes.delete(type);
      else disabledTypes.add(type);
    }
    void saveNotificationPreferences({ optedOutTypes: [...disabledTypes] });
  };

  const handleTradingToggle = (key: keyof typeof settings.trading, value: boolean) => {
    updateNestedSetting("trading", { [key]: value });
    toast.success("Trading Setting Updated", `${key} ${value ? "enabled" : "disabled"}`);
  };

  const handlePrivacyToggle = (key: keyof typeof settings.privacy, value: boolean) => {
    updateNestedSetting("privacy", { [key]: value });
    toast.success("Privacy Setting Updated", `${key} ${value ? "enabled" : "disabled"}`);
  };

  const handleDisplayToggle = (key: keyof typeof settings.display, value: boolean) => {
    updateNestedSetting("display", { [key]: value });
    toast.success("Display Setting Updated", `${key} ${value ? "enabled" : "disabled"}`);
  };

  const handleResetSettings = () => {
    if (confirm("Are you sure you want to reset all settings to defaults?")) {
      resetSettings();
      toast.success("Settings Reset", "All settings have been reset to defaults");
    }
  };

  const handleExportSettings = () => {
    const json = exportSettings();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gatedelay-settings-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Settings Exported", "Your settings have been downloaded");
  };

  const handleImportSettings = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const json = event.target?.result as string;
          const success = importSettings(json);
          if (success) {
            toast.success("Settings Imported", "Your settings have been restored");
          } else {
            toast.error("Import Failed", "Failed to import settings file");
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  // ─── Tabs ─────────────────────────────────────────────────────────────────

  const tabs = [
    { id: "appearance" as const, label: "Appearance", icon: "🎨" },
    { id: "notifications" as const, label: "Notifications", icon: "🔔" },
    { id: "trading" as const, label: "Trading", icon: "💱" },
    { id: "privacy" as const, label: "Privacy", icon: "🔒" },
    { id: "display" as const, label: "Display", icon: "🖥️" },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Manage your account preferences and settings</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center space-x-2 px-6 py-4 font-medium text-sm whitespace-nowrap border-b-2 transition-colors
                  ${activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                  }
                `}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Appearance Settings */}
        {activeTab === "appearance" && (
          <>
            <SettingsSection
              title="Appearance"
              description="Customize how GateDelay looks and feels"
              icon="🎨"
            >
              <SettingsRow
                label="Theme"
                description="Choose your preferred color scheme"
              >
                <RadioGroup
                  value={settings.theme}
                  onChange={(value) => handleThemeChange(value as any)}
                  options={[
                    { value: "light", label: "Light", description: "Always use light theme" },
                    { value: "dark", label: "Dark", description: "Always use dark theme" },
                    { value: "system", label: "System", description: "Match system preference" },
                  ]}
                />
              </SettingsRow>

              <SettingsRow
                label="Language"
                description="Select your preferred language"
              >
                <SelectInput
                  value={settings.language}
                  onChange={(value) => updateSettings({ language: value })}
                  options={[
                    { value: "en", label: "English" },
                    { value: "es", label: "Español" },
                    { value: "fr", label: "Français" },
                    { value: "de", label: "Deutsch" },
                    { value: "zh", label: "中文" },
                    { value: "ja", label: "日本語" },
                  ]}
                />
              </SettingsRow>

              <SettingsRow
                label="Currency"
                description="Display prices in your preferred currency"
              >
                <SelectInput
                  value={settings.currency}
                  onChange={(value) => updateSettings({ currency: value })}
                  options={[
                    { value: "USD", label: "USD ($)" },
                    { value: "EUR", label: "EUR (€)" },
                    { value: "GBP", label: "GBP (£)" },
                    { value: "JPY", label: "JPY (¥)" },
                    { value: "CNY", label: "CNY (¥)" },
                  ]}
                />
              </SettingsRow>

              <SettingsRow
                label="Date Format"
                description="Choose how dates are displayed"
              >
                <SelectInput
                  value={settings.dateFormat}
                  onChange={(value) => updateSettings({ dateFormat: value })}
                  options={[
                    { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
                    { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
                    { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
                  ]}
                />
              </SettingsRow>

              <SettingsRow
                label="Time Format"
                description="Choose 12-hour or 24-hour time"
              >
                <SelectInput
                  value={settings.timeFormat}
                  onChange={(value) => updateSettings({ timeFormat: value as any })}
                  options={[
                    { value: "12h", label: "12-hour (AM/PM)" },
                    { value: "24h", label: "24-hour" },
                  ]}
                />
              </SettingsRow>
            </SettingsSection>
          </>
        )}

        {/* Notification Settings */}
        {activeTab === "notifications" && (
          <SettingsSection
            title="Notifications"
            description="Choose which account events reach each notification channel"
            icon="🔔"
          >
            {notificationLoading ? (
              <p className="py-5 text-sm text-gray-500" role="status">Loading notification preferences…</p>
            ) : notificationError && !notificationPreferences ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
                <span>{notificationError}</span>
                <button
                  type="button"
                  onClick={() => {
                    setNotificationError(null);
                    setNotificationReload((count) => count + 1);
                  }}
                  className="rounded-md border border-red-300 px-3 py-1.5 font-medium hover:bg-red-100"
                >
                  Retry
                </button>
              </div>
            ) : notificationPreferences ? (
              <>
                {notificationError && (
                  <p className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
                    {notificationError}
                  </p>
                )}
                {notificationSaving && (
                  <p className="mb-2 text-xs text-blue-700" role="status">Saving preferences…</p>
                )}
                <SettingsRow label="Email" description="Receive enabled event alerts by email">
                  <ToggleSwitch checked={notificationPreferences.email} disabled={notificationSaving} aria-label="Email notifications" onChange={(value) => void saveNotificationPreferences({ email: value })} />
                </SettingsRow>
                <SettingsRow label="Push" description="Receive enabled event alerts as push notifications">
                  <ToggleSwitch checked={notificationPreferences.push} disabled={notificationSaving} aria-label="Push notifications" onChange={(value) => void saveNotificationPreferences({ push: value })} />
                </SettingsRow>
                <SettingsRow label="In-app" description="Show enabled event alerts in your notification inbox">
                  <ToggleSwitch checked={notificationPreferences.inApp} disabled={notificationSaving} aria-label="In-app notifications" onChange={(value) => void saveNotificationPreferences({ inApp: value })} />
                </SettingsRow>
                <div className="my-3 border-t border-gray-200" />
                <SettingsRow label="Trade activity" description="Trade confirmations and filled orders">
                  <ToggleSwitch checked={!notificationPreferences.optedOutTypes.includes("trade_confirmation") && !notificationPreferences.optedOutTypes.includes("trade_filled")} disabled={notificationSaving} aria-label="Trade notifications" onChange={(value) => handleNotificationTypeToggle(["trade_confirmation", "trade_filled"], value)} />
                </SettingsRow>
                <SettingsRow label="Disputes" description="When a dispute is opened on a market">
                  <ToggleSwitch checked={!notificationPreferences.optedOutTypes.includes("dispute_opened")} disabled={notificationSaving} aria-label="Dispute notifications" onChange={(value) => handleNotificationTypeToggle(["dispute_opened"], value)} />
                </SettingsRow>
                <SettingsRow label="Market resolutions" description="When a market outcome is finalized">
                  <ToggleSwitch checked={!notificationPreferences.optedOutTypes.includes("market_resolved")} disabled={notificationSaving} aria-label="Market resolution notifications" onChange={(value) => handleNotificationTypeToggle(["market_resolved"], value)} />
                </SettingsRow>
                <SettingsRow label="Security alerts" description="Important account and security notices">
                  <ToggleSwitch checked={!notificationPreferences.optedOutTypes.includes("system")} disabled={notificationSaving} aria-label="Security notifications" onChange={(value) => handleNotificationTypeToggle(["system"], value)} />
                </SettingsRow>
              </>
            ) : null}
          </SettingsSection>
        )}

        {/* Trading Settings */}
        {activeTab === "trading" && (
          <SettingsSection
            title="Trading"
            description="Configure your trading preferences"
            icon="💱"
          >
            <SettingsRow
              label="Default Slippage"
              description="Maximum price slippage tolerance for trades"
              error={slippageError}
            >
              <NumberInput
                value={settings.trading.defaultSlippage}
                onChange={handleSlippageChange}
                min={0.1}
                max={50}
                step={0.1}
                suffix="%"
              />
            </SettingsRow>

            <SettingsRow
              label="Confirm Transactions"
              description="Require confirmation before executing trades"
            >
              <ToggleSwitch
                checked={settings.trading.confirmTransactions}
                aria-label="Toggle transaction confirmations"
                onChange={(value) => handleTradingToggle("confirmTransactions", value)}
              />
            </SettingsRow>

            <SettingsRow
              label="Show Advanced Options"
              description="Display advanced trading features"
            >
              <ToggleSwitch
                checked={settings.trading.showAdvancedOptions}
                aria-label="Toggle advanced trading options"
                onChange={(value) => handleTradingToggle("showAdvancedOptions", value)}
              />
            </SettingsRow>

            <SettingsRow
              label="Auto-Approve Transactions"
              description="Automatically approve small transactions"
            >
              <ToggleSwitch
                checked={settings.trading.autoApprove}
                aria-label="Toggle auto-approve transactions"
                onChange={(value) => handleTradingToggle("autoApprove", value)}
              />
            </SettingsRow>

            <SettingsRow
              label="Gas Preference"
              description="Choose your preferred gas speed"
            >
              <SelectInput
                value={settings.trading.gasPreference}
                onChange={(value) => updateNestedSetting("trading", { gasPreference: value as any })}
                options={[
                  { value: "slow", label: "Slow (Lower fees)" },
                  { value: "standard", label: "Standard" },
                  { value: "fast", label: "Fast (Higher fees)" },
                ]}
              />
            </SettingsRow>
          </SettingsSection>
        )}

        {/* Privacy Settings */}
        {activeTab === "privacy" && (
          <SettingsSection
            title="Privacy"
            description="Control your privacy and data sharing preferences"
            icon="🔒"
          >
            <SettingsRow
              label="Show Profile"
              description="Make your profile visible to other users"
            >
              <ToggleSwitch
                checked={settings.privacy.showProfile}
                aria-label="Toggle public profile visibility"
                onChange={(value) => handlePrivacyToggle("showProfile", value)}
              />
            </SettingsRow>

            <SettingsRow
              label="Show Portfolio"
              description="Display your portfolio publicly"
            >
              <ToggleSwitch
                checked={settings.privacy.showPortfolio}
                aria-label="Toggle public portfolio visibility"
                onChange={(value) => handlePrivacyToggle("showPortfolio", value)}
              />
            </SettingsRow>

            <SettingsRow
              label="Show Activity"
              description="Make your trading activity visible"
            >
              <ToggleSwitch
                checked={settings.privacy.showActivity}
                aria-label="Toggle public trading activity"
                onChange={(value) => handlePrivacyToggle("showActivity", value)}
              />
            </SettingsRow>

            <SettingsRow
              label="Analytics"
              description="Help us improve by sharing anonymous usage data"
            >
              <ToggleSwitch
                checked={settings.privacy.analyticsEnabled}
                aria-label="Toggle anonymous analytics"
                onChange={(value) => handlePrivacyToggle("analyticsEnabled", value)}
              />
            </SettingsRow>
          </SettingsSection>
        )}

        {/* Display Settings */}
        {activeTab === "display" && (
          <SettingsSection
            title="Display"
            description="Customize your viewing experience"
            icon="🖥️"
          >
            <SettingsRow
              label="Compact Mode"
              description="Use a more condensed layout"
            >
              <ToggleSwitch
                checked={settings.display.compactMode}
                aria-label="Toggle compact mode"
                onChange={(value) => handleDisplayToggle("compactMode", value)}
              />
            </SettingsRow>

            <SettingsRow
              label="Show Balances"
              description="Display account balances in the interface"
            >
              <ToggleSwitch
                checked={settings.display.showBalances}
                aria-label="Toggle balance visibility"
                onChange={(value) => handleDisplayToggle("showBalances", value)}
              />
            </SettingsRow>

            <SettingsRow
              label="Animations"
              description="Enable smooth animations and transitions"
            >
              <ToggleSwitch
                checked={settings.display.animationsEnabled}
                aria-label="Toggle animations"
                onChange={(value) => handleDisplayToggle("animationsEnabled", value)}
              />
            </SettingsRow>

            <SettingsRow
              label="Sound Effects"
              description="Play sounds for notifications and actions"
            >
              <ToggleSwitch
                checked={settings.display.soundEnabled}
                aria-label="Toggle sound effects"
                onChange={(value) => handleDisplayToggle("soundEnabled", value)}
              />
            </SettingsRow>
          </SettingsSection>
        )}

        {/* Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Advanced</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExportSettings}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Export Settings
            </button>
            <button
              onClick={handleImportSettings}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Import Settings
            </button>
            <button
              onClick={handleResetSettings}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <PageErrorBoundary>
      <SettingsPageContent />
    </PageErrorBoundary>
  );
}
