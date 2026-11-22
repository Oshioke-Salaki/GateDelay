export type ExportFormat = "json" | "csv";

export interface ExportHistoryRecord {
  id: string;
  timestamp: string;
  format: ExportFormat;
  status: "success" | "failure";
  address: string;
  chainId: number;
  error?: string;
}

const HISTORY_STORAGE_KEY = "gd_export_history";
const LEGACY_HISTORY_STORAGE_KEY = `${HISTORY_STORAGE_KEY}_legacy_unscoped`;

export function getWalletExportHistoryKey(address: string, chainId: number): string {
  return `${HISTORY_STORAGE_KEY}_${chainId}_${address.toLowerCase()}`;
}

export function archiveUnscopedExportHistory(storage: Storage): void {
  const legacyData = storage.getItem(HISTORY_STORAGE_KEY);
  if (legacyData === null) return;

  const archivedData = storage.getItem(LEGACY_HISTORY_STORAGE_KEY);
  const archivedValues: string[] = archivedData
    ? (() => {
        try {
          const parsed: unknown = JSON.parse(archivedData);
          return Array.isArray(parsed) && parsed.every((value) => typeof value === "string")
            ? parsed
            : [archivedData];
        } catch {
          return [archivedData];
        }
      })()
    : [];

  storage.setItem(LEGACY_HISTORY_STORAGE_KEY, JSON.stringify([...archivedValues, legacyData]));
  storage.removeItem(HISTORY_STORAGE_KEY);
}

export function readWalletExportHistory(
  storage: Storage,
  address: string,
  chainId: number,
): ExportHistoryRecord[] {
  try {
    const stored = storage.getItem(getWalletExportHistoryKey(address, chainId));
    if (!stored) return [];

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (record): record is ExportHistoryRecord =>
        typeof record === "object" &&
        record !== null &&
        "address" in record &&
        typeof record.address === "string" &&
        record.address.toLowerCase() === address.toLowerCase() &&
        "chainId" in record &&
        record.chainId === chainId,
    );
  } catch {
    return [];
  }
}

export function appendWalletExportHistory(
  storage: Storage,
  record: ExportHistoryRecord,
): ExportHistoryRecord[] {
  const next = [
    record,
    ...readWalletExportHistory(storage, record.address, record.chainId),
  ].slice(0, 10);
  storage.setItem(getWalletExportHistoryKey(record.address, record.chainId), JSON.stringify(next));
  return next;
}