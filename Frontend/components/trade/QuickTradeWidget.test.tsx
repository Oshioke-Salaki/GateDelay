import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import QuickTradeWidget from "./QuickTradeWidget";

describe("QuickTradeWidget", () => {
  it("shows a wallet-provider diagnostic instead of crashing when Particle env is missing", () => {
    render(<QuickTradeWidget />);
    expect(screen.getByTestId("quick-trade-wallet-required")).toBeInTheDocument();
    expect(screen.getByText(/Quick trade needs a wallet provider/i)).toBeInTheDocument();
  });
});
