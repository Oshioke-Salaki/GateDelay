import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ParticleClientWrapper } from "./ParticleClientWrapper";

vi.mock("./ParticleProvider", () => ({
  ParticleProvider: ({ children }: { children: import("react").ReactNode }) => (
    <div data-testid="particle-provider">{children}</div>
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

  it("wraps children with ParticleProvider after the client module loads", async () => {
    render(
      <ParticleClientWrapper>
        <span>shell</span>
      </ParticleClientWrapper>,
    );

    expect(screen.getByText("shell")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("particle-provider")).toBeInTheDocument();
    });
  });
});
