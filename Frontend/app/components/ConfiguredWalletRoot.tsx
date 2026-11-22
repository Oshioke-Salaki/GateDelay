"use client";

import { type ReactNode } from "react";
import { ParticleProvider } from "./ParticleProvider";

/**
 * App shell when Particle ConnectKit credentials are present.
 * Kept in a separate module so the unconfigured first-load path never
 * imports `@particle-network/connectkit` (or its AWS/Node transitive deps).
 */
export function ConfiguredWalletRoot({ children }: { children: ReactNode }) {
  return <ParticleProvider>{children}</ParticleProvider>;
}
