# P2-043: Reduce Frontend Settings Setup Friction

**Labels**: `phase-2`, `frontend`  
**Status**: Open  
**Priority**: High  
**Related**: `Frontend/SETTINGS_DOCUMENTATION.md`  

---

## Summary

Contributors encounter friction when implementing settings. They report blank screens, unclear localhost hardcoding, and missing happy-path documentation. This task surfaces clear errors and simplifies the setup process.

---

## Current State

**Frontend/SETTINGS_DOCUMENTATION.md**:
- Comprehensive architecture docs (Settings Service, Hooks, UI Components)
- Usage examples for each hook
- Validation system documented
- Import/export functionality described

**Issues**:
1. No quick-start section for new contributors
2. Happy path not tested (manual or automated)
3. Hardcoded localhost URLs in production code paths
4. Error handling unclear (should errors surface to UI?)
5. Contributors hit blank screens without console context

---

## Acceptance Criteria

### 1. Happy Path Covered ✓
- [ ] Either **Vitest test** or **manual checklist** proving basic flow works:
  - Load settings from localStorage
  - Update a setting
  - Verify setting persists on page reload
  - Verify UI updates immediately
- [ ] Document in: SETTINGS_DOCUMENTATION.md under "Testing" section OR add `tests/settings.happy-path.test.ts`

### 2. No Hardcoded localhost URLs ✓
- [ ] Grep for hardcoded `localhost` in production code paths:
  - Check: `lib/settings.ts`, `hooks/useSettings.ts`, any sync methods
  - Rule: No hardcoded `localhost:3000`, `localhost:4000` in non-dev code
  - Use: Environment variables (`VITE_BACKEND_URL`, `VITE_API_URL`)
- [ ] .env.example documents these vars with defaults

### 3. npm run dev Works Without Errors ✓
- [ ] `npm run dev` in `Frontend/` starts dev server successfully
- [ ] Settings page loads and renders without console errors
- [ ] No unhandled promise rejections related to settings
- [ ] All UI components render correctly

### 4. Error States Surface to UI ✓
- [ ] Failed backend sync: User sees toast or error message (not just console error)
- [ ] Missing env vars: Clear error message on page load
- [ ] Invalid settings data: Error boundary or fallback UI
- [ ] Network timeout: Retry logic or user-facing error

### 5. Quick-Start Section Added ✓
Add section to SETTINGS_DOCUMENTATION.md titled **"Quick Start for Contributors"** (under 10 steps):

```markdown
## Quick Start for Contributors

Getting started with the settings system takes 3 minutes:

### Step 1: Copy Environment File
\`\`\`bash
cd Frontend
cp .env.example .env.local
\`\`\`

### Step 2: Start Dev Server
\`\`\`bash
npm run dev
# Open http://localhost:3000/settings
\`\`\`

### Step 3: Test a Setting Change
- Open DevTools (F12) → Application → LocalStorage
- Change a setting (e.g., Theme to Dark)
- Verify the setting appears in localStorage as: `settings:theme=dark`
- Reload page (Cmd/Ctrl+R)
- Verify setting persists

### Step 4: Add Your Setting (Optional)
1. Define type in `lib/settings.ts` → `UserSettings` interface
2. Add default in `DEFAULT_SETTINGS`
3. Create UI in `app/settings/page.tsx` using `useSettingCategory()`
4. Test persistence: Change setting → Reload → Verify

### Troubleshooting

**Settings don't persist:**
- Check: Is localStorage enabled? (DevTools → Application → Storage → LocalStorage)
- Check: Are you using `updateSettings()` from the hook?

**Blank settings page:**
- Check: Console for errors (F12 → Console tab)
- Check: Is `VITE_BACKEND_URL` set in `.env.local`? (Can be empty for local)

**Error toasts not showing:**
- Check: Is error boundary wrapped around settings page?
- Check: Is toast provider included in app layout?

See "Troubleshooting" section below for more.
```

---

## Implementation Steps

### 1. Add .env.example (if missing)
Create: `Frontend/.env.example`
```env
# Backend API URL (for settings sync)
# Leave empty for localhost:4000 (default)
# Set to https://api.staging.example.com for staging
# Set to https://api.example.com for production
VITE_BACKEND_URL=http://localhost:4000

# Frontend URL (used by backend for redirects, etc.)
VITE_FRONTEND_URL=http://localhost:3000
```

### 2. Fix Hardcoded localhost in lib/settings.ts
```typescript
// lib/settings.ts

export const settingsService = {
  async syncWithBackend(userId: string) {
    // ❌ BAD:
    // const response = await fetch('http://localhost:4000/api/users/settings')
    
    // ✅ GOOD:
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'
    const response = await fetch(`${backendUrl}/api/users/settings`, { ... })
  }
}
```

### 3. Add Error Boundary for Settings
Create: `app/components/settings/SettingsErrorBoundary.tsx`
```typescript
import { useEffect, useState } from 'react'

export function SettingsErrorBoundary({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.message.includes('settings')) {
        setError(event.error)
      }
    }

    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [])

  if (error) {
    return (
      <div className="error-banner">
        <p>Settings Error: {error.message}</p>
        <button onClick={() => window.location.reload()}>Reload</button>
      </div>
    )
  }

  return <>{children}</>
}
```

### 4. Add Toast for Sync Errors
Update: `hooks/useSettings.ts`
```typescript
export function useSettings() {
  const syncWithBackend = async (userId: string) => {
    try {
      const response = await settingsService.syncWithBackend(userId)
      // Success - no toast needed
    } catch (error) {
      // Show error to user
      toast.error(`Settings sync failed: ${error.message}`)
      console.error('Settings sync error:', error)
    }
  }

  return {
    settings,
    updateSettings,
    syncWithBackend,
  }
}
```

### 5. Create Happy Path Test
Create: `tests/settings.happy-path.test.ts`
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { settingsService } from '@/lib/settings'

describe('Settings Happy Path', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should load default settings', () => {
    const settings = settingsService.getSettings()
    expect(settings.theme).toBe('light') // Or whatever default
  })

  it('should update and persist setting', () => {
    // 1. Update
    settingsService.updateSettings({ theme: 'dark' })

    // 2. Verify in-memory
    const settings = settingsService.getSettings()
    expect(settings.theme).toBe('dark')

    // 3. Verify persisted to localStorage
    const stored = localStorage.getItem('gd:settings')
    expect(stored).toContain('dark')

    // 4. Simulate page reload: new instance, should load from storage
    const newInstance = settingsService.getSettings()
    expect(newInstance.theme).toBe('dark')
  })

  it('should subscribe to changes', (done) => {
    let callCount = 0
    const unsubscribe = settingsService.subscribe((settings) => {
      callCount++
      if (callCount === 1) {
        expect(settings.theme).toBe('dark')
        unsubscribe()
        done()
      }
    })

    settingsService.updateSettings({ theme: 'dark' })
  })
})
```

### 6. Update SETTINGS_DOCUMENTATION.md
Add at top (after Overview):
```markdown
## Quick Start for Contributors

**New to the settings system? Start here:** [Quick Start](#quick-start-for-contributors)

[Rest of docs...]

## Quick Start for Contributors

[See implementation steps above - add full section]

## Testing

### Running Tests
\`\`\`bash
npm run test:settings
\`\`\`

### Manual Testing Checklist (Happy Path)
- [ ] Open http://localhost:3000/settings
- [ ] Change one setting (e.g., Theme)
- [ ] Verify change appears immediately on page
- [ ] Open DevTools → Application → LocalStorage → look for `gd:settings`
- [ ] Reload page (Cmd/Ctrl+R)
- [ ] Verify setting persisted (same theme shown)
- [ ] Change another setting
- [ ] No console errors
\`\`\`
```

### 7. Check for Hardcoded URLs
```bash
# Search in Frontend codebase
grep -r "localhost:4000" Frontend/src Frontend/app Frontend/lib Frontend/hooks --include="*.ts" --include="*.tsx"
grep -r "localhost:3000" Frontend/src Frontend/app Frontend/lib Frontend/hooks --include="*.ts" --include="*.tsx"
# Should return 0 results in production code paths
```

---

## Testing Checklist

- [ ] `npm run dev` in Frontend/ starts without errors
- [ ] Settings page (`/settings`) loads and renders
- [ ] Update a setting → verify persists to localStorage
- [ ] Reload page → setting still there
- [ ] No console errors or warnings
- [ ] `npm run test:settings` passes (if Vitest test added)
- [ ] Manual checklist items all pass
- [ ] Hardcoded localhost grep returns 0 results

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `Frontend/.env.example` | Create | Env vars documentation |
| `Frontend/lib/settings.ts` | Modify | Use VITE_BACKEND_URL instead of hardcoded |
| `Frontend/hooks/useSettings.ts` | Modify | Add error toast for sync failures |
| `Frontend/app/components/settings/SettingsErrorBoundary.tsx` | Create | Error boundary for settings errors |
| `tests/settings.happy-path.test.ts` | Create | Happy path Vitest tests |
| `Frontend/SETTINGS_DOCUMENTATION.md` | Modify | Add quick-start section, testing guide |

---

## Troubleshooting

### Settings Don't Persist
- Cause: localStorage disabled or full
- Fix: Check DevTools → Application → LocalStorage enabled
- Fix: Clear localStorage: `localStorage.clear()` in console

### npm run dev Fails
- Cause: Missing dependencies
- Fix: `npm install` in Frontend/
- Fix: Check Node version (should be 18+)

### Blank Settings Page
- Cause: Error in component, not caught by error boundary
- Fix: Check console (DevTools → Console tab)
- Fix: Add try-catch in component

### Settings Not Syncing to Backend
- Cause: VITE_BACKEND_URL not set or invalid
- Fix: Verify .env.local has `VITE_BACKEND_URL=http://localhost:4000`
- Fix: Verify backend is running on that port

---

## Related Links

- [Vitest Documentation](https://vitest.dev/)
- [localStorage MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
- [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)

---

## Success Criteria

✓ Happy path covered (test or manual checklist)  
✓ No hardcoded localhost URLs  
✓ npm run dev works without errors  
✓ Error states visible in UI  
✓ Quick-start added to docs  
✓ CI passes  

