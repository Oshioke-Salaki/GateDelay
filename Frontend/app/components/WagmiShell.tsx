"use client";

import { type ReactNode, useState } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { mantle } from "viem/chains";

/**
 * Minimal Wagmi shell used when Particle ConnectKit credentials are absent.
 * Layout widgets (`PendingTransactions`, home `QuickTradeWidget`, etc.) call
 * wagmi hooks; without a provider they throw and blank every page.
 *
 * When Particle IS configured, ConnectKit mounts its own Wagmi provider and
 * this shell is not used.
 */
const config = createConfig({
  chains: [mantle],
  transports: {
    [mantle.id]: http(),
  },
  ssr: true,
});

export function WagmiShell({ children }: { children: ReactNode }) {
  // Stable config identity across remounts.
  const [wagmiConfig] = useState(() => config);
  return <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>;
}
