import { describe, expect, it } from "vitest";
import { convertWalletTransactionsToCSV } from "./walletTransactionCsv";

describe("convertWalletTransactionsToCSV", () => {
  it.each(["=SUM(1,1)", "+1+1", "-1+1", "@SUM(1,1)", "  =SUM(1,1)"])(
    "neutralizes formula-like descriptions beginning with %s",
    (description) => {
      const csv = convertWalletTransactionsToCSV(
        [{ hash: "0xabc", description, timestamp: Date.UTC(2024, 0, 1) }],
        "0xwallet",
      );

      expect(csv).toContain(`,"'${description.replace(/"/g, '""')}",`);
    },
  );

  it("preserves ordinary text and correctly quotes commas, quotes, and newlines", () => {
    const description = 'Ordinary, "quoted" text\nwith another line';
    const csv = convertWalletTransactionsToCSV(
      [{ hash: "0xabc", description, timestamp: Date.UTC(2024, 0, 1) }],
      "0xwallet",
    );

    expect(csv).toBe(
      '"Hash","Description","Timestamp","WalletAddress"\r\n' +
        '"0xabc","Ordinary, ""quoted"" text\nwith another line","2024-01-01T00:00:00.000Z","0xwallet"',
    );
  });
});