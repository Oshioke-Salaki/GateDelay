"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { settingsService } from "@/lib/settings";
import { normalizeTheme, resolveDark, type Theme } from "@/lib/theme";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "system",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    // All side effects (DOM mutation, media-query subscription, persistence) are
    // performed here — never inside a state-updater function — so they run
    // exactly once per settings change even under React Strict Mode's
    // double-invocation of updaters. (#1181)
    let cleanupMedia = () => {};
    let activeTheme: Theme | undefined;

    const unsubscribe = settingsService.subscribe((settings) => {
      const next = normalizeTheme(settings.theme);
      if (next === activeTheme) return;

      // Tear down any existing media listener before switching themes.
      cleanupMedia();
      cleanupMedia = () => {};
      activeTheme = next;

      // Update React state (pure — no side effects inside this call).
      setTheme(next);

      // Resolve and apply the correct dark/light class to the document.
      const media =
        typeof window.matchMedia === "function"
          ? window.matchMedia("(prefers-color-scheme: dark)")
          : undefined;

      const applyDarkClass = () =>
        document.documentElement.classList.toggle(
          "dark",
          resolveDark(next, media?.matches ?? false),
        );

      applyDarkClass();

      // For "system" theme, keep the class in sync with OS preference changes.
      if (next !== "system" || !media) return;

      if (
        typeof media.addEventListener === "function" &&
        typeof media.removeEventListener === "function"
      ) {
        media.addEventListener("change", applyDarkClass);
        cleanupMedia = () => media.removeEventListener("change", applyDarkClass);
      } else if (
        typeof media.addListener === "function" &&
        typeof media.removeListener === "function"
      ) {
        media.addListener(applyDarkClass);
        cleanupMedia = () => media.removeListener(applyDarkClass);
      }
    });

    return () => {
      unsubscribe();
      cleanupMedia();
    };
  }, []);

  // toggle() computes the next theme and writes it through settingsService so
  // the subscriber above handles every downstream effect in one place.
  const toggle = () => {
    const current = normalizeTheme(settingsService.getSetting("theme"));
    settingsService.updateSettings({
      theme: current === "light" ? "dark" : current === "dark" ? "system" : "light",
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
