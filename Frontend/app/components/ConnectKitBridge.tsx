"use client";

import { useMemo, type ReactNode } from "react";
import { useAccount, useModal, useDisconnect } from "@particle-network/connectkit";
import { ConnectKitBridgeContext, type ConnectKitBridgeValue } from "./ConnectKitBridgeContext";

/**
 * Must render inside ConnectKitProvider. Exposes connection actions to
 * components that must not call ConnectKit hooks directly (e.g. ConnectModal
 * when providers may be absent).
 *
 * Kept separate from `ConnectKitBridgeContext` so the app shell can import the
 * context/hook without pulling `@particle-network/connectkit` (and its AWS SDK
 * Node built-ins) into every page bundle.
 */
export function ConnectKitBridge({ children }: { children: ReactNode }) {
  const { isConnected, address, isConnecting } = useAccount();
  const { setOpen } = useModal();
  const { disconnect } = useDisconnect();

  const value = useMemo<ConnectKitBridgeValue>(
    () => ({
      isAvailable: true,
      isConnected,
      isConnecting,
      address,
      openConnectKit: () => setOpen(true),
      disconnect: () => disconnect(),
    }),
    [isConnected, isConnecting, address, setOpen, disconnect],
  );

  return (
    <ConnectKitBridgeContext.Provider value={value}>{children}</ConnectKitBridgeContext.Provider>
  );
}

export { useConnectKitBridge } from "./ConnectKitBridgeContext";
