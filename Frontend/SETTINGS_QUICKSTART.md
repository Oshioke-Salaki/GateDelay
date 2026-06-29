# Settings System Quick Start Guide

## 🚀 Quick Setup

The settings system is already integrated and ready to use!

## 📦 Available Hooks

### 1. useSettings
Access all settings and update functions.

```tsx
import { useSettings } from "@/hooks/useSettings";

function MyComponent() {
  const { settings, updateSettings } = useSettings();

  return (
    <div>
      <p>Theme: {settings.theme}</p>
      <button onClick={() => updateSettings({ theme: "dark" })}>
        Dark Mode
      </button>
    </div>
  );
}
```

### 2. useSettingCategory
Access a specific settings category.

```tsx
import { useSettingCategory } from "@/hooks/useSettings";

function NotificationSettings() {
  const { settings, updateCategory } = useSettingCategory("notifications");

  return (
    <label>
      <input
        type="checkbox"
        checked={settings.email}
        onChange={(e) => updateCategory({ email: e.target.checked })}
      />
      Email Notifications
    </label>
  );
}
```

### 3. useSetting
Access a single setting.

```tsx
import { useSetting } from "@/hooks/useSettings";

function ThemeSelector() {
  const [theme, setTheme] = useSetting("theme");

  return (
    <select value={theme} onChange={(e) => setTheme(e.target.value as any)}>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
      <option value="system">System</option>
    </select>
  );
}
```

## 🎯 Common Use Cases

### Use Case 1: Theme Toggle

```tsx
import { useSetting } from "@/hooks/useSettings";

function ThemeToggle() {
  const [theme, setTheme] = useSetting("theme");

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
  };

  return (
    <button onClick={toggleTheme}>
      {theme === "light" ? "🌞" : theme === "dark" ? "🌙" : "💻"}
    </button>
  );
}
```

### Use Case 2: Notification Preferences

```tsx
import { useSettingCategory } from "@/hooks/useSettings";

function NotificationPreferences() {
  const { settings, updateCategory } = useSettingCategory("notifications");

  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={settings.priceAlerts}
          onChange={(e) => updateCategory({ priceAlerts: e.target.checked })}
        />
        Price Alerts
      </label>
      <label>
        <input
          type="checkbox"
          checked={settings.tradeConfirmations}
          onChange={(e) => updateCategory({ tradeConfirmations: e.target.checked })}
        />
        Trade Confirmations
      </label>
    </div>
  );
}
```

### Use Case 3: Trading Settings

```tsx
import { useSettingCategory } from "@/hooks/useSettings";

function TradingSettings() {
  const { settings, updateCategory } = useSettingCategory("trading");

  return (
    <div>
      <label>
        Slippage Tolerance:
        <input
          type="number"
          value={settings.defaultSlippage}
          onChange={(e) => updateCategory({ defaultSlippage: parseFloat(e.target.value) })}
          min={0.1}
          max={50}
          step={0.1}
        />
        %
      </label>
    </div>
  );
}
```

### Use Case 4: Display Preferences

```tsx
import { useSettingCategory } from "@/hooks/useSettings";

function DisplaySettings() {
  const { settings, updateCategory } = useSettingCategory("display");

  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={settings.animationsEnabled}
          onChange={(e) => updateCategory({ animationsEnabled: e.target.checked })}
        />
        Enable Animations
      </label>
      <label>
        <input
          type="checkbox"
          checked={settings.soundEnabled}
          onChange={(e) => updateCategory({ soundEnabled: e.target.checked })}
        />
        Enable Sound
      </label>
    </div>
  );
}
```

### Use Case 5: Conditional Rendering

```tsx
import { useSettings } from "@/hooks/useSettings";

function ConditionalFeature() {
  const { settings } = useSettings();

  if (!settings.trading.showAdvancedOptions) {
    return <SimpleView />;
  }

  return <AdvancedView />;
}
```

### Use Case 6: Export/Import Settings

```tsx
import { useSettings } from "@/hooks/useSettings";

function SettingsBackup() {
  const { exportSettings, importSettings } = useSettings();

  const handleExport = () => {
    const json = exportSettings();
    // Download or save json
    console.log(json);
  };

  const handleImport = (json: string) => {
    const success = importSettings(json);
    if (success) {
      alert("Settings imported!");
    }
  };

  return (
    <div>
      <button onClick={handleExport}>Export</button>
      <button onClick={() => handleImport(/* json */)}>Import</button>
    </div>
  );
}
```

## 🎨 Using Settings Components

### Pre-built Components

```tsx
import { SettingsSection, SettingsRow } from "@/app/components/settings/SettingsSection";
import { ToggleSwitch, SelectInput, NumberInput } from "@/app/components/settings/SettingsInputs";
import { useSettingCategory } from "@/hooks/useSettings";

function MySettings() {
  const { settings, updateCategory } = useSettingCategory("notifications");

  return (
    <SettingsSection
      title="Notifications"
      description="Manage your notification preferences"
      icon="🔔"
    >
      <SettingsRow
        label="Email Notifications"
        description="Receive updates via email"
      >
        <ToggleSwitch
          checked={settings.email}
          onChange={(value) => updateCategory({ email: value })}
        />
      </SettingsRow>

      <SettingsRow
        label="Push Notifications"
        description="Browser push notifications"
      >
        <ToggleSwitch
          checked={settings.push}
          onChange={(value) => updateCategory({ push: value })}
        />
      </SettingsRow>
    </SettingsSection>
  );
}
```

## 📊 Settings Categories

| Category | Settings | Description |
|----------|----------|-------------|
| **Appearance** | Theme, Language, Currency, Date/Time Format | Visual preferences |
| **Notifications** | Email, Push, Alerts, Updates | Notification preferences |
| **Trading** | Slippage, Confirmations, Gas | Trading preferences |
| **Privacy** | Profile, Portfolio, Activity, Analytics | Privacy settings |
| **Display** | Compact Mode, Balances, Animations, Sound | Display options |

## ✅ Validation

Settings include built-in validation:

```tsx
import { settingsValidation } from "@/lib/settings";

const handleSlippageChange = (value: number) => {
  const validation = settingsValidation.slippage(value);
  
  if (validation === true) {
    // Valid - save setting
    updateCategory({ defaultSlippage: value });
  } else {
    // Invalid - show error
    setError(validation);
  }
};
```

## 🔄 Immediate Application

Settings are applied immediately:

```tsx
// Theme changes apply instantly
const handleThemeChange = (theme: "light" | "dark" | "system") => {
  updateSettings({ theme });
  // Theme is applied automatically via ThemeProvider
};

// Display settings apply instantly
const { settings } = useSettings();

<motion.div
  animate={settings.display.animationsEnabled ? { opacity: 1 } : {}}
>
  Content
</motion.div>
```

## 💾 Persistence

Settings are automatically persisted to localStorage:

```tsx
// Settings are saved automatically
updateSettings({ theme: "dark" });

// Settings persist across page reloads
const { settings } = useSettings();
console.log(settings.theme); // "dark"
```

## 🔧 Direct Service Access

For advanced use cases:

```tsx
import { settingsService } from "@/lib/settings";

// Get settings
const settings = settingsService.getSettings();

// Update settings
settingsService.updateSettings({ theme: "dark" });

// Subscribe to changes
const unsubscribe = settingsService.subscribe((newSettings) => {
  console.log("Settings changed:", newSettings);
});

// Cleanup
unsubscribe();
```

## 🚨 Common Patterns

### Pattern 1: Settings-Based Feature Flag

```tsx
const { settings } = useSettings();

{settings.trading.showAdvancedOptions && (
  <AdvancedTradingPanel />
)}
```

### Pattern 2: Settings-Based Styling

```tsx
const { settings } = useSettings();

<div className={settings.display.compactMode ? "compact" : "normal"}>
  Content
</div>
```

### Pattern 3: Settings-Based Behavior

```tsx
const { settings } = useSettings();

const handleTrade = async () => {
  if (settings.trading.confirmTransactions) {
    const confirmed = await showConfirmDialog();
    if (!confirmed) return;
  }
  
  executeTrade();
};
```

## 📚 Documentation

- **Full Documentation**: `SETTINGS_DOCUMENTATION.md`
- **Settings Page**: `/settings`
- **API Reference**: See full documentation

## 🎯 Testing Checklist

- [ ] Visit `/settings` page
- [ ] Change theme - verify immediate application
- [ ] Toggle notifications - verify toast feedback
- [ ] Change slippage - verify validation
- [ ] Export settings - verify download
- [ ] Import settings - verify restoration
- [ ] Reset settings - verify defaults restored
- [ ] Reload page - verify settings persist

---

**Ready to use!** The settings system is fully integrated and ready for production.
