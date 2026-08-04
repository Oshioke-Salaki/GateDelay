"use client";
import { ConnectKitProvider, createConfig } from "@particle-network/connectkit";
import { authWalletConnectors } from "@particle-network/connectkit/auth";
import { evmWalletConnectors } from "@particle-network/connectkit/evm";
import { mantle } from "viem/chains";
import { ConnectKitBridge } from "./ConnectKitBridge";
import { isParticleConnectKitConfigured } from "../../lib/walletDetection";

// Config is created lazily to avoid SSR crashes when env vars are absent
let config: ReturnType<typeof createConfig> | null = null;

function getConfig() {
  if (!config) {
    config = createConfig({
      projectId: process.env.NEXT_PUBLIC_PROJECT_ID ?? "",
      clientKey: process.env.NEXT_PUBLIC_CLIENT_KEY ?? "",
      appId: process.env.NEXT_PUBLIC_APP_ID ?? "",
      chains: [mantle],
      walletConnectors: [
        authWalletConnectors({ authTypes: ["google", "twitter", "email"] }),
        evmWalletConnectors({
          metadata: { name: "GateDelay" },
          walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
        }),
      ],
    });
  }
  return config;
}

export function ParticleProvider({ children }: { children: React.ReactNode }) {
  // Mount ConnectKit only when credentials exist — avoids hook/runtime failures
  // when collaborators run the UI without wallet env vars.
  if (!isParticleConnectKitConfigured()) {
    return <>{children}</>;
  }

  return (
    <ConnectKitProvider config={getConfig()}>
      <ConnectKitBridge>{children}</ConnectKitBridge>
    </ConnectKitProvider>
  );
}
