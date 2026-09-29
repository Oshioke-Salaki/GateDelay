import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

describe("/settings notification preferences", () => {
  beforeEach(() => {
    localStorage.clear();
    settingsService.resetSettings();
    mockMatchMedia();
    localStorage.setItem("accessToken", "test-access-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads preferences and saves event-category changes through the API", async () => {
    const user = userEvent.setup();
    const initialPreferences = {
      email: true,
      push: false,
      inApp: true,
      optedOutTypes: ["dispute_opened"],
    };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return new Response(JSON.stringify({
          ...initialPreferences,
          optedOutTypes: ["dispute_opened", "trade_confirmation", "trade_filled"],
        }), { status: 200 });
      }
      return new Response(JSON.stringify(initialPreferences), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderSettings();
    await user.click(screen.getByRole("button", { name: /notifications/i }));

    const tradeSwitch = await screen.findByRole("switch", { name: "Trade notifications" });
    expect(tradeSwitch).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: "Dispute notifications" })).toHaveAttribute("aria-checked", "false");

    await user.click(tradeSwitch);

    expect(await screen.findByText("Your choices were updated.")).toBeInTheDocument();
    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(patchCall?.[0]).toBe("http://localhost:3000/api/notifications/preferences");
    expect(patchCall?.[1]?.headers).toMatchObject({ Authorization: "Bearer test-access-token" });
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({
      optedOutTypes: ["dispute_opened", "trade_confirmation", "trade_filled"],
    });
  });

  it("shows a sign-in message when there is no backend auth token", async () => {
    localStorage.removeItem("accessToken");
    renderSettings();
    await userEvent.setup().click(screen.getByRole("button", { name: /notifications/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Sign in to load and update notification preferences.");
  });
});
