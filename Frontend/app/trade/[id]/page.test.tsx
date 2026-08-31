import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TradePage, { DEMO_TRADE_MARKET_IDS } from "./page";
import { ToastProvider } from "@/app/components/ToastProvider";

const bridge = vi.hoisted(() => ({
  isAvailable: false,
  isConnected: false,
  isConnecting: false,
  address: undefined as string | undefined,
  openConnectKit: () => {},
  disconnect: () => {},
}));

vi.mock("@/app/components/ConnectKitBridgeContext", () => ({
  useConnectKitBridge: () => bridge,
}));

vi.mock("@/hooks/usePriceUpdates", () => ({
  useSinglePriceUpdate: () => ({
    price: undefined,
    isLoading: false,
    isConnected: false,
    connectionStatus: "disconnected",
  }),
}));

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver;
}

function renderTrade(id: string) {
  return render(
    <ToastProvider>
      <TradePage params={{ id }} />
    </ToastProvider>,
  );
}

describe("TradePage (`/trade/[id]`)", () => {
  it("renders the known demo market and order panel without a fake wallet address", () => {
    bridge.address = undefined;
    bridge.isConnected = false;
    renderTrade("market-1");

    expect(screen.getByRole("heading", { name: /AA 1234 - JFK to LAX/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Connect Wallet/i })).toBeInTheDocument();
    expect(screen.queryByText(/0x1234567890abcdef1234567890abcdef12345678/i)).not.toBeInTheDocument();
    expect(screen.getByText(/OFFLINE/i)).toBeInTheDocument();
  });

  it("passes the connected wallet address into the trading shell", () => {
    bridge.address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    bridge.isConnected = true;
    renderTrade("market-1");

    expect(screen.getByRole("heading", { name: /Your Positions/i })).toBeInTheDocument();
    expect(screen.queryByText(/0x1234567890abcdef1234567890abcdef12345678/i)).not.toBeInTheDocument();
  });

  it("surfaces an unknown market id instead of substituting another row", () => {
    bridge.address = undefined;
    renderTrade("does-not-exist");

    expect(screen.getByRole("heading", { name: /Market not found/i })).toBeInTheDocument();
    expect(screen.getByText(/does-not-exist/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(DEMO_TRADE_MARKET_IDS.join(", ")))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open market-1/i })).toHaveAttribute(
      "href",
      "/trade/market-1",
    );
    expect(screen.getByRole("link", { name: /Back to Markets/i })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.queryByRole("heading", { name: /AA 1234/i })).not.toBeInTheDocument();
  });
});
