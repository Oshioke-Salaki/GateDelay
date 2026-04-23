"use client";
import dynamic from "next/dynamic";

const ParticleProviderInner = dynamic(
  () => import("./ParticleProvider").then((m) => m.ParticleProvider),
  { ssr: false, loading: () => null }
);

export function ParticleClientWrapper({ children }: { children: React.ReactNode }) {
  return <ParticleProviderInner>{children}</ParticleProviderInner>;
}
