import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { TransactionItem } from "./TransactionItem";

const walletState = vi.hoisted(() => ({
  receipt: undefined as { status: "success" | "reverted"; blockNumber: bigint } | undefined,
  receiptError: false,
  blockNumber: undefined as bigint | undefined,
  transaction: undefined as Record<string, unknown> | undefined,
  call: vi.fn(),
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ chainId: 5000 }),
  useWaitForTransactionReceipt: () => ({ data: walletState.receipt, isError: walletState.receiptError }),
  useTransaction: () => ({ data: walletState.transaction }),
  useBlockNumber: () => ({ data: walletState.blockNumber }),
  usePublicClient: () => ({ call: walletState.call }),
  useSendTransaction: () => ({ data: undefined, sendTransaction: vi.fn(), isPending: false }),
}));

vi.mock("../../hooks/useTransactionTracker", () => ({
  useTransactionTracker: () => ({ addTransaction: vi.fn() }),
  useTrackTransaction: vi.fn(),
}));

const tx = {
  hash: `0x${"a".repeat(64)}` as `0x${string}`,
  description: "Quick trade",
  timestamp: Date.now(),
  chainId: 5000,
};

describe("TransactionItem", () => {
  beforeEach(() => {
    walletState.receipt = undefined;
    walletState.receiptError = false;
    walletState.blockNumber = undefined;
    walletState.transaction = undefined;
    walletState.call.mockReset();
  });

  it("reports receipt lookup errors without marking the transaction failed", () => {
    walletState.receiptError = true;
    render(<TransactionItem tx={tx} onRemove={vi.fn()} />);

    expect(screen.getByText("Receipt lookup unavailable; checking again.")).toBeInTheDocument();
    expect(screen.queryByText("Failure reason:")).not.toBeInTheDocument();
  });

  it("shows live confirmations and the included block for a confirmed transaction", () => {
    walletState.receipt = { status: "success", blockNumber: 100n };
    walletState.blockNumber = 102n;
    render(<TransactionItem tx={tx} onRemove={vi.fn()} />);

    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("3 confirmations · Block 100")).toBeInTheDocument();
  });

  it("shows the decoded revert reason when the previous-block call reverts", async () => {
    walletState.receipt = { status: "reverted", blockNumber: 100n };
    walletState.transaction = {
      from: "0x0000000000000000000000000000000000000001",
      to: "0x0000000000000000000000000000000000000002",
      input: "0x1234",
      value: 0n,
    };
    walletState.call.mockRejectedValue({ shortMessage: "Insufficient allowance" });
    render(<TransactionItem tx={tx} onRemove={vi.fn()} />);

    expect(screen.getByText("failed", { exact: false })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Insufficient allowance")).toBeInTheDocument());
  });
});