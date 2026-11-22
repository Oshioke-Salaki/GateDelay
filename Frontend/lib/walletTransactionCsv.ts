interface WalletTransactionCsvRow {
  hash: string;
  description: string;
  timestamp: number;
}

function escapeCsvCell(value: string): string {
  // Quote every cell; prefix formula-like text after leading whitespace/control characters.
  const safeValue = /^[\u0000-\u0020]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

export function convertWalletTransactionsToCSV(
  transactions: WalletTransactionCsvRow[],
  walletAddress: string,
): string {
  const header = ["Hash", "Description", "Timestamp", "WalletAddress"];
  const rows = transactions.map((transaction) => [
    transaction.hash,
    transaction.description,
    new Date(transaction.timestamp).toISOString(),
    walletAddress,
  ]);

  return [header, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}