import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WalletRuntimeFeatures } from "./WalletRuntimeFeatures";

const bridge = vi.hoisted(() => ({
  isAvailable: false,
}));

vi.mock("./ConnectKitBridgeContext", () => ({
  useConnectKitBridge: () => bridge,
}));

describe("WalletRuntimeFeatures", () => {
  it("does not mount wallet-only widgets before ConnectKit is available", () => {
    bridge.isAvailable = false;
    render(
      <WalletRuntimeFeatures>
        <div data-testid="wallet-widget">backup</div>
      </WalletRuntimeFeatures>,
    );
    expect(screen.queryByTestId("wallet-widget")).not.toBeInTheDocument();
  });

  it("renders children once ConnectKit is available", () => {
    bridge.isAvailable = true;
    render(
      <WalletRuntimeFeatures>
        <div data-testid="wallet-widget">backup</div>
      </WalletRuntimeFeatures>,
    );
    expect(screen.getByTestId("wallet-widget")).toBeInTheDocument();
  });
});
