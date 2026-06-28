"use client";

import { createContext, useContext } from "react";
import { useConnectivity, type ConnectivityState } from "../../hooks/useConnectivity";

// ─── Context ──────────────────────────────────────────────────────────────────

const ConnectivityContext = createContext<ConnectivityState | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * ConnectivityProvider
 *
 * Wraps the application with a shared connectivity context so every descendant
 * can access `useConnectivityContext()` without creating separate hook instances.
 */
export function ConnectivityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const connectivity = useConnectivity();

  return (
    <ConnectivityContext.Provider value={connectivity}>
      {children}
    </ConnectivityContext.Provider>
  );
}

// ─── Consumer hook ────────────────────────────────────────────────────────────

/**
 * useConnectivityContext
 *
 * Returns the shared {@link ConnectivityState} from the nearest
 * {@link ConnectivityProvider}.
 *
 * @throws if called outside of a `ConnectivityProvider`.
 */
export function useConnectivityContext(): ConnectivityState {
  const ctx = useContext(ConnectivityContext);
  if (!ctx) {
    throw new Error(
      "useConnectivityContext must be used within a <ConnectivityProvider>."
    );
  }
  return ctx;
}
