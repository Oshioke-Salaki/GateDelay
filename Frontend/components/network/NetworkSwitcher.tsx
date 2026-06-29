"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccount, useSwitchChain } from "wagmi";

export interface Network {
  id: number;
  name: string;
  logo?: string;
  rpcUrl?: string;
  blockExplorer?: string;
  nativeCurrency?: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

interface NetworkSwitcherProps {
  networks?: Network[];
  onNetworkChange?: (networkId: number) => void;
  showStatus?: boolean;
  compact?: boolean;
}

const DEFAULT_NETWORKS: Network[] = [
  {
    id: 1,
    name: "Ethereum",
    logo: "🔷",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
  {
    id: 137,
    name: "Polygon",
    logo: "🟣",
    nativeCurrency: { name: "Matic", symbol: "MATIC", decimals: 18 },
  },
  {
    id: 5000,
    name: "Mantle",
    logo: "🔶",
    nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
  },
  {
    id: 11155111,
    name: "Sepolia",
    logo: "🧪",
    nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
  },
];

export default function NetworkSwitcher({
  networks = DEFAULT_NETWORKS,
  onNetworkChange,
  showStatus = true,
  compact = false,
}: NetworkSwitcherProps) {
  const { chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const [isOpen, setIsOpen] = useState(false);
  const [warning, setWarning] = useState<string>("");

  const currentNetwork = networks.find((n) => n.id === chainId);
  const unsupportedNetwork = chainId && !currentNetwork;

  const handleNetworkSwitch = useCallback(
    async (networkId: number) => {
      if (networkId === chainId) {
        setIsOpen(false);
        return;
      }

      setWarning("");

      try {
        switchChain({ chainId: networkId });
        onNetworkChange?.(networkId);
        setIsOpen(false);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to switch network";
        setWarning(errorMessage);
      }
    },
    [chainId, switchChain, onNetworkChange]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-network-switcher]")) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [isOpen]);

  if (compact) {
    return (
      <div data-network-switcher className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Switch network"
          aria-expanded={isOpen}
        >
          {currentNetwork?.logo && <span className="text-lg">{currentNetwork.logo}</span>}
          <span className="text-sm font-medium">{currentNetwork?.name || "Unknown"}</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
          >
            <polyline points="4 6 8 10 12 6" />
          </svg>
        </button>

        {isOpen && (
          <div
            className="absolute top-full right-0 mt-2 w-48 rounded-lg shadow-lg z-50 overflow-hidden"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="p-2 space-y-1">
              {networks.map((network) => (
                <button
                  key={network.id}
                  onClick={() => handleNetworkSwitch(network.id)}
                  disabled={isPending}
                  className={[
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
                    "text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                    chainId === network.id
                      ? "bg-blue-500/10 text-blue-600 font-medium"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800",
                    isPending ? "opacity-50 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  {network.logo && <span className="text-lg">{network.logo}</span>}
                  <span>{network.name}</span>
                  {chainId === network.id && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="ml-auto"
                    >
                      <circle cx="8" cy="8" r="3" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div data-network-switcher className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          Network
        </h3>
        {showStatus && (
          <div
            className="text-xs px-2 py-1 rounded-full"
            style={{
              background: unsupportedNetwork ? "#ef444418" : "#22c55e18",
              color: unsupportedNetwork ? "#ef4444" : "#22c55e",
            }}
          >
            {unsupportedNetwork ? "Unsupported" : "Connected"}
          </div>
        )}
      </div>

      {/* Current Network Display */}
      {currentNetwork && (
        <div
          className="mb-4 p-4 rounded-lg"
          style={{ background: "var(--border)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3">
            {currentNetwork.logo && <span className="text-2xl">{currentNetwork.logo}</span>}
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                {currentNetwork.name}
              </p>
              {currentNetwork.nativeCurrency && (
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {currentNetwork.nativeCurrency.symbol}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Warning Message */}
      {unsupportedNetwork && (
        <div
          className="mb-4 p-3 rounded-lg text-sm"
          style={{ background: "#ef444418", color: "#ef4444", border: "1px solid #ef444444" }}
        >
          ⚠️ Your current network is not supported. Please switch to a supported network.
        </div>
      )}

      {warning && (
        <div
          className="mb-4 p-3 rounded-lg text-sm"
          style={{ background: "#ef444418", color: "#ef4444", border: "1px solid #ef444444" }}
        >
          {warning}
        </div>
      )}

      {/* Network List */}
      <div className="space-y-2">
        <p className="text-xs font-medium" style={{ color: "var(--muted)" }}>
          Available Networks
        </p>
        <div className="grid grid-cols-2 gap-2">
          {networks.map((network) => (
            <button
              key={network.id}
              onClick={() => handleNetworkSwitch(network.id)}
              disabled={isPending}
              className={[
                "flex flex-col items-center gap-2 p-3 rounded-lg transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                chainId === network.id
                  ? "ring-2 ring-blue-500 bg-blue-500/10"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800",
                isPending ? "opacity-50 cursor-not-allowed" : "",
              ].join(" ")}
              style={{
                background:
                  chainId === network.id ? "var(--card)" : "var(--border)",
                border: "1px solid var(--border)",
              }}
            >
              {network.logo && <span className="text-2xl">{network.logo}</span>}
              <span className="text-xs font-medium text-center">{network.name}</span>
              {chainId === network.id && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-600">
                  Active
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {isPending && (
        <div className="mt-4 p-3 rounded-lg text-sm text-center" style={{ color: "var(--muted)" }}>
          Switching network...
        </div>
      )}
    </div>
  );
}
