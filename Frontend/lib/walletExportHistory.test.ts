import { afterEach, describe, expect, it } from "vitest";
import {
  appendWalletExportHistory,
  archiveUnscopedExportHistory,
  getWalletExportHistoryKey,
  readWalletExportHistory,
} from "./walletExportHistory";

describe("wallet export history storage", () => {
  afterEach(() => localStorage.clear());

  it("isolates records by wallet and chain across reloads", () => {
    const firstRecord = {
      id: "one",
      timestamp: "2026-10-19T00:00:00.000Z",
      format: "json" as const,
      status: "success" as const,
      address: "0xWalletA",
      chainId: 1,
    };
    const otherWallet = { ...firstRecord, id: "two", address: "0xWalletB" };
    const otherChain = { ...firstRecord, id: "three", chainId: 10 };

    appendWalletExportHistory(localStorage, firstRecord);
    appendWalletExportHistory(localStorage, otherWallet);
    appendWalletExportHistory(localStorage, otherChain);

    expect(getWalletExportHistoryKey("0xwalleta", 1)).toBe("gd_export_history_1_0xwalleta");
    expect(readWalletExportHistory(localStorage, "0xwalleta", 1)).toMatchObject([{ id: "one" }]);
    expect(readWalletExportHistory(localStorage, "0xWalletB", 1)).toMatchObject([{ id: "two" }]);
    expect(readWalletExportHistory(localStorage, "0xWalletA", 10)).toMatchObject([{ id: "three" }]);
  });

  it("archives unscoped legacy entries without exposing them as wallet history", () => {
    localStorage.setItem("gd_export_history", JSON.stringify([{ id: "legacy" }]));

    archiveUnscopedExportHistory(localStorage);

    expect(localStorage.getItem("gd_export_history")).toBeNull();
    expect(JSON.parse(localStorage.getItem("gd_export_history_legacy_unscoped")!)).toEqual([
      JSON.stringify([{ id: "legacy" }]),
    ]);
    expect(readWalletExportHistory(localStorage, "0xWalletA", 1)).toEqual([]);
  });
});