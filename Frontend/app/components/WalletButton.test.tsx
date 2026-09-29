import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WalletButton from "./WalletButton";

const bridge = vi.hoisted(() => ({
  isAvailable: false,
  isConnected: false,
  address: undefined,
  isConnecting: false,
  disconnect: vi.fn(),
}));

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

vi.mock("./ConnectKitBridgeContext", () => ({
  useConnectKitBridge: () => bridge,
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ success: vi.fn(), info: vi.fn() }),
}));

describe("WalletButton", () => {
  it("labels the wallet action unavailable when the wallet provider is missing", () => {
    render(<WalletButton />);

    expect(screen.getByRole("button", { name: /wallet signing unavailable/i })).toHaveTextContent(
      "Signing unavailable",
    );
  });
});