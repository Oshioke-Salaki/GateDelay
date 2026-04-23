"use client";
import { useTheme } from "./ThemeProvider";

export default function DarkModeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      style={{ backgroundColor: isDark ? "#3b82f6" : "#d1d5db" }}
    >
      <span
        className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
        style={{ transform: isDark ? "translateX(1.375rem)" : "translateX(0.125rem)" }}
      />
    </button>
  );
}
