"use client";

import { createContext, useContext, type ReactNode } from "react";

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

export const defaultConnectKitBridge: ConnectKitBridgeValue = {
  isAvailable: false,
  isConnected: false,
  isConnecting: false,
  address: undefined,
  openConnectKit: () => {},
  disconnect: () => {},
};

export const ConnectKitBridgeContext =
  createContext<ConnectKitBridgeValue>(defaultConnectKitBridge);

export function useConnectKitBridge(): ConnectKitBridgeValue {
  return useContext(ConnectKitBridgeContext);
}

/** Passthrough when Particle/ConnectKit is not mounted. */
export function ConnectKitBridgePassthrough({ children }: { children: ReactNode }) {
  return (
    <ConnectKitBridgeContext.Provider value={defaultConnectKitBridge}>
      {children}
    </ConnectKitBridgeContext.Provider>
  );
}
