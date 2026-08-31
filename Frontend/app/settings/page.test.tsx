import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "../components/ThemeProvider";
import { ToastProvider } from "../components/ToastProvider";
import { settingsService } from "@/lib/settings";
import SettingsPage from "./page";

function mockMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderSettings() {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <SettingsPage />
      </ToastProvider>
    </ThemeProvider>,
  );
}

describe("/settings first paint", () => {
  beforeEach(() => {
    localStorage.clear();
    settingsService.resetSettings();
    mockMatchMedia();
  });

  it("renders the heading and category tabs instead of a blank screen", () => {
    renderSettings();

    expect(
      screen.getByRole("heading", { name: /^settings$/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /appearance/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /notifications/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /trading/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /privacy/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /display/i })).toBeInTheDocument();
    expect(screen.getByText("Theme")).toBeInTheDocument();
  });

  it("switches tabs without unmounting the page chrome", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("button", { name: /trading/i }));

    expect(
      screen.getByRole("heading", { name: /^settings$/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/default slippage/i)).toBeInTheDocument();
  });
});
