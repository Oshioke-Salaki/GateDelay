import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTransactionTracker } from "./useTransactionTracker";
vi.mock("wagmi", () => ({ useAccount: () => ({ address: "0xabc", chainId: 1 }) }));
describe("transaction export retention", () => {
  beforeEach(() => localStorage.clear());
  it("keeps old records in the archive while filtering the tracker view", async () => {
    const recent = { hash: "0x01", description: "recent", timestamp: Date.now(), chainId: 1 };
    const old = { hash: "0x02", description: "old completed", timestamp: Date.now() - 25 * 60 * 60 * 1000, chainId: 1 };
    localStorage.setItem("gate_delay_txs_1_0xabc", JSON.stringify([recent, old]));
    const tracker = renderHook(() => useTransactionTracker());
    await waitFor(() => expect(tracker.result.current.transactions).toEqual([recent]));
    const archive = renderHook(() => useTransactionTracker(true));
    await waitFor(() => expect(archive.result.current.transactions).toEqual([recent, old]));
    act(() => tracker.result.current.removeTransaction("0x01"));
    act(() => archive.result.current.refresh());
    expect(archive.result.current.transactions).toEqual([recent, old]);
  });
});
