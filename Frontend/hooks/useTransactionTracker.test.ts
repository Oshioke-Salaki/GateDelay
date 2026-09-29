import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useTrackTransaction } from "./useTransactionTracker";

vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: "0x0000000000000000000000000000000000000001",
    chainId: 5000,
  }),
}));

describe("useTrackTransaction", () => {
  afterEach(() => localStorage.clear());

  it("persists a submitted hash with its description and chain", async () => {
    const hash = `0x${"a".repeat(64)}` as `0x${string}`;
    renderHook(() => useTrackTransaction(hash, "Quick trade"));

    await waitFor(() => {
      const stored = localStorage.getItem("gate_delay_txs_5000_0x0000000000000000000000000000000000000001");
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!)).toMatchObject([
        { hash, description: "Quick trade", chainId: 5000 },
      ]);
    });
  });
});