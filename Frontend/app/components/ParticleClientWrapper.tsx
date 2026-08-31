"use client";

const ParticleProviderInner = dynamic(
  () => import("./ParticleProvider").then((m) => m.ParticleProvider),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
        <span className="text-sm" style={{ color: "var(--muted)" }}>
          Resolving wallet connection…
        </span>
      </div>
    ),
  },
);
import { useEffect, useState, type ComponentType, type ReactNode } from "react";

type WalletProviderComponent = ComponentType<{ children: ReactNode }>;

/**
 * Loads Particle ConnectKit on the client without blanking the app shell.
 * `next/dynamic` with `loading: () => null` hid Navbar, wallet, and routes
 * until the provider chunk arrived — first paint was an empty screen.
 */
export function ParticleClientWrapper({ children }: { children: ReactNode }) {
  const [Provider, setProvider] = useState<WalletProviderComponent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    import("./ParticleProvider")
      .then((mod) => {
        if (!cancelled) {
          setProvider(() => mod.ParticleProvider);
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[ParticleClientWrapper] Failed to load wallet provider:", err);
        if (!cancelled) {
          setLoadError(message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const shell = (
    <>
      {loadError ? (
        <div
          role="alert"
          data-testid="wallet-provider-error"
          className="px-4 py-2 text-sm"
          style={{
            background: "#fef2f2",
            color: "#991b1b",
            borderBottom: "1px solid #fecaca",
          }}
        >
          Wallet provider failed to load: {loadError}. Navigation still works; set
          Particle ConnectKit variables in <code>Frontend/.env.local</code> (see{" "}
          <code>CONTRIBUTING.md</code>) and reload.
        </div>
      ) : null}
      {children}
    </>
  );

  if (!Provider) {
    return shell;
  }

  return <Provider>{shell}</Provider>;
import { UnconfiguredWalletRoot } from "./UnconfiguredWalletRoot";

/**
 * Default layout wallet shell.
 *
 * Always mounts Wagmi + a no-op ConnectKit bridge so first load never imports
 * `@particle-network/connectkit` (AWS → `node:fs`) into the Turbopack client
 * graph. Navbar, Connect Wallet, and route children render on first paint.
 * graph. A previous merge left this file concatenated with a second
 * `ParticleClientWrapper` export, which broke `npm run dev` and blanked every
 * route including `/settings`.
 *
 * To enable Particle ConnectKit when credentials are present, point
 * `app/layout.tsx` at `./components/ParticleClientWrapper.particle` and prefer
 * `npm run dev:webpack` over global `node:*` stubs.
 */
export function ParticleClientWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <UnconfiguredWalletRoot>{children}</UnconfiguredWalletRoot>;
}
