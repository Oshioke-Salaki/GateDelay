"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRightLeft } from "lucide-react";
import { useAccount, useSwitchChain } from "wagmi";
import { mantle } from "viem/chains";

export function NetworkMismatchBanner() {
  const { chainId, connector, isConnected } = useAccount();
  const { chains, isPending, switchChainAsync } = useSwitchChain();
  const [switchError, setSwitchError] = useState("");
  const expectedNetwork = chains.find((chain) => chain.id === mantle.id);

  if (!isConnected || !chainId || !expectedNetwork || chainId === expectedNetwork.id) {
    return null;
  }

  const currentNetwork = chains.find((chain) => chain.id === chainId);
  const canSwitch = typeof connector?.switchChain === "function";
  const targetChainId = expectedNetwork.id;

  async function handleSwitch() {
    setSwitchError("");
    try {
      await switchChainAsync({ chainId: targetChainId });
    } catch {
      setSwitchError("Network switch failed. Change networks in your wallet and try again.");
    }
  }

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6"
      style={{ background: "#fff4d6", color: "#5c3b00", borderBottom: "1px solid #e9ce88" }}
    >
      <div className="flex min-w-0 items-start gap-3">
        <AlertTriangle size={20} aria-hidden="true" className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">Wrong network</p>
          <p className="text-sm">
            Your wallet is connected to {currentNetwork?.name ?? `Chain ${chainId}`}. Switch to{" "}
            {expectedNetwork.name} to use GateDelay.
          </p>
          {switchError && <p className="mt-1 text-sm font-medium" role="status">{switchError}</p>}
        </div>
      </div>
      {canSwitch && (
        <button
          type="button"
          onClick={handleSwitch}
          disabled={isPending}
          className="inline-flex shrink-0 items-center gap-2 rounded px-3 py-2 text-sm font-semibold transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current disabled:cursor-wait disabled:opacity-60"
          style={{ background: "#5c3b00", color: "#fff" }}
        >
          <ArrowRightLeft size={16} aria-hidden="true" />
          {isPending ? "Switching..." : `Switch to ${expectedNetwork.name}`}
        </button>
      )}
    </div>
  );
}