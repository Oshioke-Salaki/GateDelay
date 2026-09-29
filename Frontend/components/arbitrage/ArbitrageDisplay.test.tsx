import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ArbitrageDisplay from "./ArbitrageDisplay";
import mockMarkets from "@/data/mockMarkets";

// ArbitrageDisplay fires a best-effort `fetch('/api/markets')` on mount and keeps
// the markets it was given if that fails. The demo page (`pages/arbitrage-demo`)
// runs outside the app shell with no backend, so this is the real happy path:
// stub fetch as unavailable and assert the component still works from props.
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("no backend in tests")),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ArbitrageDisplay — arbitrage demo happy path", () => {
  it("mounts, scans the bundled mock markets, and lists a profitable opportunity", () => {
    render(<ArbitrageDisplay markets={mockMarkets} defaultAmount={0.5} />);

    expect(
      screen.getByRole("heading", { name: "Arbitrage Opportunities" }),
    ).toBeInTheDocument();

    // All four mock markets are scanned.
    expect(screen.getByText(/Markets scanned:/).parentElement).toHaveTextContent(
      `Markets scanned: ${mockMarkets.length}`,
    );

    // The ETH pair spread clears its fees, so exactly one row is offered.
    expect(
      screen.getByText(/Buy: Binance ETH-USDT.*Sell: Uniswap ETH-USDT/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Execute" })).toBeEnabled();
  });

  it("shows a clear empty state instead of a blank screen when nothing is profitable", () => {
    render(
      <ArbitrageDisplay
        markets={[
          { id: "a", name: "A", asset: "X", price: 100 },
          { id: "b", name: "B", asset: "X", price: 100 },
        ]}
        defaultAmount={1}
      />,
    );

    expect(
      screen.getByText("No profitable opportunities found."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Execute" }),
    ).not.toBeInTheDocument();
  });

  it("runs the execute flow and reports success", async () => {
    const user = userEvent.setup();
    const onExecute = vi.fn().mockResolvedValue(undefined);

    render(
      <ArbitrageDisplay
        markets={mockMarkets}
        defaultAmount={0.5}
        onExecute={onExecute}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Execute" }));

    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(onExecute.mock.calls[0][0]).toMatchObject({
      buy: expect.objectContaining({ name: "Binance ETH-USDT" }),
      sell: expect.objectContaining({ name: "Uniswap ETH-USDT" }),
    });

    expect(await screen.findByText(/success/)).toBeInTheDocument();
  });
});
