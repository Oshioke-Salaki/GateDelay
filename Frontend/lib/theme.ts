export const SETTINGS_STORAGE_KEY = "gate_delay_user_settings";
export const DEFAULT_THEME = "system";
export type Theme = "light" | "dark" | "system";

export function normalizeTheme(value: unknown): Theme {
  return value === "light" || value === "dark" ? value : "system";
}

// Self-contained so the same rule can run in the pre-paint script.
export function resolveDark(theme: Theme, prefersDark: boolean): boolean {
  return theme === "dark" || (theme === "system" && prefersDark);
}

export function initializeTheme(key: string, fallback: Theme,
  normalize: typeof normalizeTheme, resolve: typeof resolveDark) {
  let theme = fallback;
  try {
    const stored = window.localStorage.getItem(key);
    if (stored) theme = normalize(JSON.parse(stored)?.theme);
  } catch (error) {
    console.error("Failed to load initial theme; using system preference", error);
  }
  const prefersDark = typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", resolve(theme, prefersDark));
}

export const themeInitializationScript = `(${initializeTheme.toString()})(${JSON.stringify(SETTINGS_STORAGE_KEY)},${JSON.stringify(DEFAULT_THEME)},${normalizeTheme.toString()},${resolveDark.toString()});`;
