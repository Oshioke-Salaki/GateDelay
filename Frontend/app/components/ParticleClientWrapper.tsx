"use client";

import { type ReactNode } from "react";
import { ConnectKitBridgePassthrough } from "./ConnectKitBridgeContext";
import { WagmiShell } from "./WagmiShell";

/**
 * When Particle ConnectKit credentials are absent (the common dev case),
 * provides a minimal Wagmi provider + no-op ConnectKit bridge so wagmi hooks
 * in page components (governance, trade, portfolio, etc.) do not crash.
 *
 * When Particle IS configured in .env.local, the layout should import
 * ParticleClientWrapper.particle instead of this file.
 */
export function ParticleClientWrapper({ children }: { children: ReactNode }) {
  return (
    <WagmiShell>
      <ConnectKitBridgePassthrough>{children}</ConnectKitBridgePassthrough>
    </WagmiShell>
  );
}
