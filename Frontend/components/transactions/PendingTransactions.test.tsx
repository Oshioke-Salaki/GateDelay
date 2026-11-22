import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PendingTransactions from "./PendingTransactions";

const state = vi.hoisted(() => ({
  isConnected: true,
  transactions: [] as Array<{ hash: `0x${string}`; description: string; timestamp: number }>,
}));

vi.mock("wagmi", () => ({ useAccount: () => ({ isConnected: state.isConnected }) }));
vi.mock("../../hooks/useTransactionTracker", () => ({
  useTransactionTracker: () => ({
    transactions: state.transactions,
    removeTransaction: vi.fn(),
  }),
}));
vi.mock("./TransactionItem", () => ({
  TransactionItem: ({ tx }: { tx: { description: string } }) => <div>{tx.description}</div>,
}));

describe("PendingTransactions", () => {
  beforeEach(() => {
    state.isConnected = true;
    state.transactions = [];
  });

  it("opens an empty drawer and closes it with Escape", () => {
    render(<PendingTransactions />);
    fireEvent.click(screen.getByRole("button", { name: "Open transactions" }));

    expect(screen.getByRole("dialog", { name: "Transactions" })).toBeInTheDocument();
    expect(screen.getByText("No transactions yet.")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows tracked transactions in the open drawer", () => {
    state.transactions = [{
      hash: `0x${"b".repeat(64)}` as `0x${string}`,
      description: "Governance vote",
      timestamp: Date.now(),
    }];
    render(<PendingTransactions />);
    fireEvent.click(screen.getByRole("button", { name: /Open transactions/ }));

    expect(screen.getByText("Governance vote")).toBeInTheDocument();
    expect(screen.getByText("1 tracked")).toBeInTheDocument();
  });
});