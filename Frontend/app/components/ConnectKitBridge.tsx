"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAccount, useModal, useDisconnect } from "@particle-network/connectkit";

export type ConnectKitBridgeValue = {
  /** ConnectKit provider is mounted and hooks are available */
  isAvailable: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  address: string | undefined;
  /** Opens Particle ConnectKit modal; no-op when unavailable */
  openConnectKit: () => void;
  disconnect: () => void;
};

const defaultBridge: ConnectKitBridgeValue = {
  isAvailable: false,
  isConnected: false,
  isConnecting: false,
  address: undefined,
  openConnectKit: () => {},
  disconnect: () => {},
};

const ConnectKitBridgeContext = createContext<ConnectKitBridgeValue>(defaultBridge);

/**
 * Must render inside ConnectKitProvider. Exposes connection actions to
 * components that must not call ConnectKit hooks directly (e.g. ConnectModal
 * when providers may be absent).
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

export function useConnectKitBridge(): ConnectKitBridgeValue {
  return useContext(ConnectKitBridgeContext);
}
