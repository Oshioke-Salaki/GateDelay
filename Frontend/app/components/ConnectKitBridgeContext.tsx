"use client";

import { createContext, useContext, type ReactNode } from "react";

export type ConnectKitBridgeValue = {
  /** ConnectKit provider is mounted and hooks are available */
  isAvailable: boolean;
  /** Stable connection resolution state for shell and wallet UI. */
  resolutionStatus: "unavailable" | "disconnected" | "resolving" | "connected";
  /** Human-readable setup/runtime failure, when the wallet path is unavailable. */
  error: string | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  address: string | undefined;
  /** Opens Particle ConnectKit modal; no-op when unavailable */
  openConnectKit: () => void;
  disconnect: () => void;
};

export const defaultConnectKitBridge: ConnectKitBridgeValue = {
  isAvailable: false,
  resolutionStatus: "unavailable",
  error: "Wallet connection is not configured. Add the NEXT_PUBLIC_PROJECT_ID, NEXT_PUBLIC_CLIENT_KEY, and NEXT_PUBLIC_APP_ID variables to Frontend/.env.local.",
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
