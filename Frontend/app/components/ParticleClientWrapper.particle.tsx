"use client";

import { ConfiguredWalletRoot } from "./ConfiguredWalletRoot";

/**
 * Particle-enabled wallet shell (opt-in).
 * Point `app/layout.tsx` at this module and prefer `npm run dev:webpack`
 * when ConnectKit credentials are present — do not stub Node built-ins globally.
 */
export function ParticleClientWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ConfiguredWalletRoot>{children}</ConfiguredWalletRoot>;
}
