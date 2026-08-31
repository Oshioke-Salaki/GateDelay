"use client";

import type { ReactNode } from "react";
import { useConnectKitBridge } from "./ConnectKitBridgeContext";

/**
 * Layout widgets that call ConnectKit or wagmi hooks (BackupReminder,
 * PendingTransactions) must not mount until ConnectKitProvider is present.
 * Otherwise first load throws and PageErrorBoundary replaces the whole shell.
 */
export function WalletRuntimeFeatures({ children }: { children: ReactNode }) {
  const { isAvailable } = useConnectKitBridge();
  if (!isAvailable) {
    return null;
  }
  return <>{children}</>;
}