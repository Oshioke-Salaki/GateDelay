"use client";

import { type ReactNode } from "react";
import { ConnectKitBridgePassthrough } from "./ConnectKitBridgeContext";
import { WagmiShell } from "./WagmiShell";

/**
 * App shell when Particle ConnectKit credentials are absent.
 * Provides Wagmi + a no-op ConnectKit bridge so layout widgets do not crash.
 */
export function UnconfiguredWalletRoot({ children }: { children: ReactNode }) {
  return (
    <WagmiShell>
      <ConnectKitBridgePassthrough>{children}</ConnectKitBridgePassthrough>
    </WagmiShell>
  );
}
