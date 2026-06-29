"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { settingsService } from "@/lib/settings";

type Theme = "light" | "dark" | "system";
const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "system",
  toggle: () => { },
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    // Load theme from settings
    const settings = settingsService.getSettings();
    const initialTheme = settings.theme;
    setTheme(initialTheme);
    applyTheme(initialTheme);

    // Subscribe to settings changes
    const unsubscribe = settingsService.subscribe((newSettings) => {
      setTheme(newSettings.theme);
      applyTheme(newSettings.theme);
    });

    return unsubscribe;
  }, []);

  const applyTheme = (themeValue: Theme) => {
    if (themeValue === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", prefersDark);
    } else {
      document.documentElement.classList.toggle("dark", themeValue === "dark");
    }
  };

  const toggle = () => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : prev === "dark" ? "system" : "light";
      settingsService.updateSettings({ theme: next });
      applyTheme(next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
