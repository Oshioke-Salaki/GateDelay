import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ParticleClientWrapper } from "./ParticleClientWrapper";

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ParticleClientWrapper } from "./ParticleClientWrapper";

vi.mock("./UnconfiguredWalletRoot", () => ({
  UnconfiguredWalletRoot: ({ children }: { children: import("react").ReactNode }) => (
    <div data-testid="unconfigured-wallet-root">{children}</div>
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

  it("keeps the app shell visible while the default wallet root mounts", () => {
  it("wraps children with UnconfiguredWalletRoot so Particle is not required on first load", () => {
    render(
      <ParticleClientWrapper>
        <span>shell</span>
      </ParticleClientWrapper>,
    );

    expect(screen.getByText("shell")).toBeInTheDocument();
    expect(screen.getByTestId("unconfigured-wallet-root")).toBeInTheDocument();
  });
});
