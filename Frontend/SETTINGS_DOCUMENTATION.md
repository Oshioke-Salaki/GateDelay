# Settings System Documentation

## Overview

The GateDelay Frontend includes a comprehensive settings system that allows users to customize their experience across multiple categories. Settings are persisted to localStorage and can be synced with the backend.

## Architecture

### Core Components

1. **Settings Service** (`lib/settings.ts`)
   - Centralized settings management
   - LocalStorage persistence
   - Backend sync ready
   - Change notifications
   - Import/export functionality

2. **Settings Hooks** (`hooks/useSettings.ts`)
   - `useSettings` - Access all settings
   - `useSettingCategory` - Access specific category
   - `useSetting` - Access individual setting

3. **Settings UI Components**
   - `SettingsSection` - Section container
   - `SettingsRow` - Individual setting row
   - Input components (Toggle, Select, Number, Radio, etc.)

4. **Settings Page** (`app/settings/page.tsx`)
   - Tabbed interface
   - Organized by category
   - Immediate feedback
   - Validation

## Settings Categories

### 1. Appearance
- **Theme**: Light, Dark, or System
- **Language**: English, Spanish, French, German, Chinese, Japanese
- **Currency**: USD, EUR, GBP, JPY, CNY
- **Date Format**: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD
- **Time Format**: 12-hour or 24-hour

### 2. Notifications
- **Email Notifications**: Receive updates via email
- **Push Notifications**: Browser push notifications
- **Price Alerts**: Notifications for price targets
- **Market Updates**: Market change notifications
- **Trade Confirmations**: Trade execution notifications
- **Newsletter**: Weekly newsletter subscription

### 3. Trading
- **Default Slippage**: Maximum price slippage (0.1% - 50%)
- **Confirm Transactions**: Require confirmation before trades
- **Show Advanced Options**: Display advanced features
- **Auto-Approve**: Automatically approve small transactions
- **Gas Preference**: Slow, Standard, or Fast

### 4. Privacy
- **Show Profile**: Make profile visible to others
- **Show Portfolio**: Display portfolio publicly
- **Show Activity**: Make trading activity visible
- **Analytics**: Share anonymous usage data

### 5. Display
- **Compact Mode**: Use condensed layout
- **Show Balances**: Display account balances
- **Animations**: Enable smooth animations
- **Sound Effects**: Play notification sounds

## Usage

### Basic Usage

```tsx
import { useSettings } from "@/hooks/useSettings";

function MyComponent() {
  const { settings, updateSettings } = useSettings();

  return (
    <div>
      <p>Current theme: {settings.theme}</p>
      <button onClick={() => updateSettings({ theme: "dark" })}>
        Switch to Dark
      </button>
    </div>
  );
}
```

### Category-Specific Usage

```tsx
import { useSettingCategory } from "@/hooks/useSettings";

function NotificationSettings() {
  const { settings, updateCategory } = useSettingCategory("notifications");

  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={settings.email}
          onChange={(e) => updateCategory({ email: e.target.checked })}
        />
        Email Notifications
      </label>
    </div>
  );
}
```

### Single Setting Usage

```tsx
import { useSetting } from "@/hooks/useSettings";

function ThemeToggle() {
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

### Direct Service Usage

```tsx
import { settingsService } from "@/lib/settings";

// Get all settings
const settings = settingsService.getSettings();

// Get specific setting
const theme = settingsService.getSetting("theme");

// Update settings
settingsService.updateSettings({ theme: "dark" });

// Update nested setting
settingsService.updateNestedSetting("notifications", { email: true });

// Reset settings
settingsService.resetSettings();

// Reset category
settingsService.resetCategory("notifications");

// Subscribe to changes
const unsubscribe = settingsService.subscribe((newSettings) => {
  console.log("Settings changed:", newSettings);
});
```

## Validation

Settings include built-in validation:

```typescript
import { settingsValidation } from "@/lib/settings";

// Validate slippage
const result = settingsValidation.slippage(0.5);
if (result === true) {
  // Valid
} else {
  // Invalid - result contains error message
  console.error(result);
}

// Validate language
const langResult = settingsValidation.language("en");

// Validate currency
const currResult = settingsValidation.currency("USD");
```

## Import/Export

### Export Settings

```tsx
import { useSettings } from "@/hooks/useSettings";

function ExportButton() {
  const { exportSettings } = useSettings();

  const handleExport = () => {
    const json = exportSettings();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "settings.json";
    a.click();
  };

  return <button onClick={handleExport}>Export Settings</button>;
}
```

### Import Settings

```tsx
import { useSettings } from "@/hooks/useSettings";

function ImportButton() {
  const { importSettings } = useSettings();

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const json = e.target?.result as string;
      const success = importSettings(json);
      if (success) {
        alert("Settings imported successfully");
      } else {
        alert("Failed to import settings");
      }
    };
    reader.readAsText(file);
  };

  return (
    <input
      type="file"
      accept="application/json"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handleImport(file);
      }}
    />
  );
}
```

## Backend Sync

The settings service is ready for backend synchronization:

```typescript
import { settingsService } from "@/lib/settings";

// Sync settings to backend
await settingsService.syncWithBackend(userId);

// Load settings from backend
await settingsService.loadFromBackend(userId);
```

### Backend API Endpoints (To Implement)

```
GET    /api/users/:userId/settings     - Get user settings
PUT    /api/users/:userId/settings     - Update user settings
POST   /api/users/:userId/settings     - Create user settings
DELETE /api/users/:userId/settings     - Reset user settings
```

### Example Backend Implementation

```typescript
// Backend: GET /api/users/:userId/settings
export async function GET(req: Request, { params }: { params: { userId: string } }) {
  const settings = await db.userSettings.findUnique({
    where: { userId: params.userId },
  });
  return Response.json(settings || DEFAULT_SETTINGS);
}

// Backend: PUT /api/users/:userId/settings
export async function PUT(req: Request, { params }: { params: { userId: string } }) {
  const settings = await req.json();
  const updated = await db.userSettings.upsert({
    where: { userId: params.userId },
    update: settings,
    create: { userId: params.userId, ...settings },
  });
  return Response.json(updated);
}
```

## Immediate Application

Settings are applied immediately when changed:

### Theme Changes
Theme changes are applied instantly to the DOM:

```typescript
// In settings page
const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
  updateSettings({ theme: newTheme });
  
  if (newTheme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", prefersDark);
  } else {
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  }
};
```

### Notification Changes
Notification settings trigger toast notifications:

```typescript
const handleNotificationToggle = (key: string, value: boolean) => {
  updateNestedSetting("notifications", { [key]: value });
  toast.success(
    "Notification Updated",
    `${key} notifications ${value ? "enabled" : "disabled"}`
  );
};
```

### Display Changes
Display settings can be applied immediately:

```typescript
// Check if animations are enabled
const { settings } = useSettings();

<motion.div
  animate={settings.display.animationsEnabled ? { opacity: 1 } : {}}
>
  Content
</motion.div>
```

## Custom Settings Components

### Creating a Custom Toggle

```tsx
import { SettingsRow } from "@/app/components/settings/SettingsSection";
import { ToggleSwitch } from "@/app/components/settings/SettingsInputs";
import { useSettingCategory } from "@/hooks/useSettings";

function CustomNotificationToggle() {
  const { settings, updateCategory } = useSettingCategory("notifications");

  return (
    <SettingsRow
      label="Custom Notification"
      description="Enable custom notifications"
    >
      <ToggleSwitch
        checked={settings.email}
        onChange={(value) => updateCategory({ email: value })}
      />
    </SettingsRow>
  );
}
```

### Creating a Custom Input

```tsx
import { SettingsRow } from "@/app/components/settings/SettingsSection";
import { NumberInput } from "@/app/components/settings/SettingsInputs";
import { useSettingCategory } from "@/hooks/useSettings";

function SlippageInput() {
  const { settings, updateCategory } = useSettingCategory("trading");
  const [error, setError] = useState("");

  const handleChange = (value: number) => {
    if (value < 0.1 || value > 50) {
      setError("Slippage must be between 0.1% and 50%");
    } else {
      setError("");
      updateCategory({ defaultSlippage: value });
    }
  };

  return (
    <SettingsRow
      label="Default Slippage"
      description="Maximum price slippage tolerance"
      error={error}
    >
      <NumberInput
        value={settings.defaultSlippage}
        onChange={handleChange}
        min={0.1}
        max={50}
        step={0.1}
        suffix="%"
      />
    </SettingsRow>
  );
}
```

## Adding New Settings

### 1. Update Settings Type

```typescript
// lib/settings.ts
export interface UserSettings {
  // ... existing settings
  
  // Add new category
  advanced: {
    debugMode: boolean;
    apiTimeout: number;
    cacheEnabled: boolean;
  };
}

export const DEFAULT_SETTINGS: UserSettings = {
  // ... existing defaults
  
  advanced: {
    debugMode: false,
    apiTimeout: 30000,
    cacheEnabled: true,
  },
};
```

### 2. Add Validation (Optional)

```typescript
// lib/settings.ts
export const settingsValidation = {
  // ... existing validation
  
  apiTimeout: (value: number) => {
    if (value < 1000 || value > 60000) {
      return "API timeout must be between 1 and 60 seconds";
    }
    return true;
  },
};
```

### 3. Add UI in Settings Page

```tsx
// app/settings/page.tsx
{activeTab === "advanced" && (
  <SettingsSection
    title="Advanced"
    description="Advanced configuration options"
    icon="⚙️"
  >
    <SettingsRow
      label="Debug Mode"
      description="Enable debug logging"
    >
      <ToggleSwitch
        checked={settings.advanced.debugMode}
        onChange={(value) => updateNestedSetting("advanced", { debugMode: value })}
      />
    </SettingsRow>

    <SettingsRow
      label="API Timeout"
      description="Request timeout in milliseconds"
    >
      <NumberInput
        value={settings.advanced.apiTimeout}
        onChange={(value) => updateNestedSetting("advanced", { apiTimeout: value })}
        min={1000}
        max={60000}
        step={1000}
        suffix="ms"
      />
    </SettingsRow>
  </SettingsSection>
)}
```

## Best Practices

1. **Use Hooks**: Always use the provided hooks for accessing settings
2. **Validate Input**: Validate settings before saving
3. **Provide Feedback**: Show toast notifications for setting changes
4. **Apply Immediately**: Apply settings immediately when possible
5. **Persist Changes**: Settings are automatically persisted to localStorage
6. **Sync with Backend**: Implement backend sync for multi-device support
7. **Handle Errors**: Gracefully handle validation and save errors
8. **Document Settings**: Document new settings in this file

## Troubleshooting

### Settings Not Persisting

**Problem**: Settings reset on page reload

**Solution**: Check localStorage is enabled and not full

```typescript
// Check localStorage availability
try {
  localStorage.setItem("test", "test");
  localStorage.removeItem("test");
  console.log("LocalStorage is available");
} catch (e) {
  console.error("LocalStorage is not available:", e);
}
```

### Settings Not Applying

**Problem**: Settings change but don't take effect

**Solution**: Ensure components are subscribed to settings changes

```typescript
const { settings } = useSettings();

useEffect(() => {
  // Apply setting
  applyTheme(settings.theme);
}, [settings.theme]);
```

### Validation Errors

**Problem**: Invalid settings are saved

**Solution**: Add validation before saving

```typescript
const handleChange = (value: number) => {
  const validation = settingsValidation.slippage(value);
  if (validation === true) {
    updateSettings({ slippage: value });
  } else {
    setError(validation);
  }
};
```

## Performance Considerations

- Settings are loaded once on mount
- Changes trigger minimal re-renders
- LocalStorage operations are synchronous but fast
- Backend sync is asynchronous and non-blocking
- Listeners are cleaned up automatically

## Security Considerations

- Settings are stored in localStorage (client-side only)
- Sensitive settings should be stored on backend
- Validate all settings before applying
- Sanitize imported settings
- Use HTTPS for backend sync

## Future Enhancements

1. **Cloud Sync**: Sync settings across devices
2. **Profiles**: Multiple setting profiles
3. **Presets**: Pre-configured setting presets
4. **Sharing**: Share settings with other users
5. **Version Control**: Track setting changes over time
6. **Backup**: Automatic setting backups
7. **Migration**: Automatic migration for setting schema changes

---

**Implementation Date**: April 26, 2026
**Status**: ✅ Complete
**Version**: 1.0.0
