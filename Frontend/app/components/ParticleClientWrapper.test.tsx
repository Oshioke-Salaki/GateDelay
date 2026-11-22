import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ParticleClientWrapper } from "./ParticleClientWrapper";

vi.mock("./WagmiShell", () => ({
  WagmiShell: ({ children }: { children: import("react").ReactNode }) => (
    <div data-testid="wagmi-shell">{children}</div>
  ),
}));

describe("ParticleClientWrapper", () => {
  it("renders navbar and wallet chrome on first paint instead of a blank screen", () => {
    render(
      <ParticleClientWrapper>
        <nav>Markets</nav>
        <button type="button">Connect Wallet</button>
      </ParticleClientWrapper>,
    );

    expect(screen.getByText("Markets")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect Wallet" })).toBeInTheDocument();
    expect(screen.queryByTestId("wallet-provider-error")).not.toBeInTheDocument();
  });

  it("wraps children with WagmiShell and ConnectKitBridgePassthrough", () => {
    render(
      <ParticleClientWrapper>
        <span>shell</span>
      </ParticleClientWrapper>,
    );

    expect(screen.getByText("shell")).toBeInTheDocument();
    expect(screen.getByTestId("wagmi-shell")).toBeInTheDocument();
  });
});
