"use client";

import { useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useConnectKitBridge } from "../../app/components/ConnectKitBridgeContext";
import {
  hasInjectedWalletProvider,
  isMetaMaskInstalled,
  isParticleConnectKitConfigured,
} from "../../lib/walletDetection";
import { useFocusTrap } from "../../hooks/useFocusTrap";

// ── Wallet option definitions ─────────────────────────────────────────────────

interface WalletOption {
  id: string;
  name: string;
  icon: string;
  description: string;
  installUrl: string;
  isInstalled: () => boolean;
}

const WALLET_OPTIONS: WalletOption[] = [
  {
    id: "metamask",
    name: "MetaMask",
    icon: "🦊",
    description: "Connect using the MetaMask browser extension",
    installUrl: "https://metamask.io/download/",
    isInstalled: isMetaMaskInstalled,
  },
  {
    id: "walletconnect",
    name: "WalletConnect",
    icon: "🔗",
    description: "Scan with any WalletConnect-compatible wallet",
    installUrl: "https://walletconnect.com/explorer",
    isInstalled: () => isParticleConnectKitConfigured(),
  },
  {
    id: "google",
    name: "Google",
    icon: "G",
    description: "Sign in with your Google account",
    installUrl: "",
    isInstalled: () => isParticleConnectKitConfigured(),
  },
  {
    id: "twitter",
    name: "Twitter / X",
    icon: "𝕏",
    description: "Sign in with your Twitter account",
    installUrl: "",
    isInstalled: () => isParticleConnectKitConfigured(),
  },
  {
    id: "email",
    name: "Email",
    icon: "✉",
    description: "Sign in with a magic link sent to your email",
    installUrl: "",
    isInstalled: () => isParticleConnectKitConfigured(),
  },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ConnectModal({ isOpen, onClose }: ConnectModalProps) {
  const {
    isConnected,
    openConnectKit,
    isAvailable,
    resolutionStatus,
    error,
  } = useConnectKitBridge();

  const particleReady  = isParticleConnectKitConfigured();
  const injectedReady  = hasInjectedWalletProvider();
  const showEmptyState = !particleReady && !injectedReady;

  const visibleOptions = WALLET_OPTIONS.filter((wallet) =>
    wallet.id !== "metamask" ? isParticleConnectKitConfigured() : true,
  );

  // Ref for the modal panel — used by focus trap and close-on-outside-click
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus trap: active while the modal is open
  useFocusTrap(panelRef, isOpen);

  // Close automatically once the user successfully connects
  useEffect(() => {
    if (isConnected && isOpen) onClose();
  }, [isConnected, isOpen, onClose]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [isOpen, onClose]);

  // Arrow-key navigation within the wallet list
  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLUListElement>) => {
      const items = Array.from(
        (e.currentTarget as HTMLUListElement).querySelectorAll<HTMLElement>("button[data-wallet]"),
      );
      const focused = document.activeElement as HTMLElement;
      const idx     = items.indexOf(focused);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        items[(idx + 1) % items.length]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        items[(idx - 1 + items.length) % items.length]?.focus();
      }
    },
    [],
  );

  const handleWalletClick = useCallback(
    (wallet: WalletOption) => {
      if (!wallet.isInstalled() && wallet.installUrl) {
        window.open(wallet.installUrl, "_blank", "noopener,noreferrer");
        return;
      }
      if (!isAvailable || !isParticleConnectKitConfigured()) return;
      openConnectKit();
      onClose();
    },
    [isAvailable, openConnectKit, onClose],
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal panel */}
          <motion.div
            ref={panelRef}
            key="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="connect-modal-title"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-2xl"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          >
            {/* Header */}
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2
                  id="connect-modal-title"
                  className="text-lg font-semibold"
                  style={{ color: "var(--foreground)" }}
                >
                  Connect Wallet
                </h2>
                <p className="mt-0.5 text-sm" style={{ color: "var(--muted)" }}>
                  Choose how you'd like to connect to GateDelay
                </p>
              </div>

              {/* Close button — receives initial focus via the trap */}
              <button
                onClick={onClose}
                aria-label="Close connect wallet modal"
                className="rounded-lg p-1.5 transition-colors hover:opacity-70 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ color: "var(--muted)" }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18" height="18" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Body */}
            {showEmptyState ? (
              <div
                className="rounded-xl px-4 py-6 text-center"
                style={{ background: "var(--background)", border: "1px solid var(--border)" }}
                data-testid="wallet-empty-state"
              >
                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                  No wallet providers detected
                </p>
                <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                  Install a browser wallet such as MetaMask, or add Particle ConnectKit
                  credentials to{" "}
                  <code className="text-[11px]">Frontend/.env.local</code> (see CONTRIBUTING.md).
                </p>
              </div>
            ) : (
              <ul
                role="list"
                aria-label="Wallet connection options"
                className="space-y-2"
                onKeyDown={handleListKeyDown}
              >
                {visibleOptions.map((wallet, i) => {
                  const installed = wallet.isInstalled();
                  return (
                    <li key={wallet.id}>
                      <button
                        type="button"
                        data-wallet={wallet.id}
                        /* First item gets tabIndex 0 so Tab lands here naturally;
                           arrow keys move between items without losing trap. */
                        tabIndex={i === 0 ? 0 : -1}
                        onClick={() => handleWalletClick(wallet)}
                        aria-label={
                          !installed && wallet.installUrl
                            ? `Install ${wallet.name}`
                            : `Connect with ${wallet.name}`
                        }
                        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all hover:opacity-80 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500"
                        style={{
                          background: "var(--background)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl font-bold"
                          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                          aria-hidden="true"
                        >
                          {wallet.icon}
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                            {wallet.name}
                          </p>
                          <p className="truncate text-xs" style={{ color: "var(--muted)" }}>
                            {wallet.description}
                          </p>
                        </div>

                        {!installed && wallet.installUrl ? (
                          <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-500">
                            Install
                          </span>
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16" height="16" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round"
                            style={{ color: "var(--muted)" }}
                            aria-hidden="true"
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Status messages */}
            {!particleReady && (
              <p
                className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600"
                role="status"
                data-testid="wallet-signing-unavailable"
              >
                Wallet signing is unavailable because Particle ConnectKit credentials are missing.
                Add <code>NEXT_PUBLIC_PROJECT_ID</code>, <code>NEXT_PUBLIC_CLIENT_KEY</code>, and{" "}
                <code>NEXT_PUBLIC_APP_ID</code> to <code>Frontend/.env.local</code>. Browsing and
                other non-wallet features remain available.
              </p>
            )}

            {particleReady && resolutionStatus === "unavailable" && error && (
              <p
                className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600"
                role="status"
              >
                {error}
              </p>
            )}

            {injectedReady && !particleReady && (
              <p className="mt-3 text-center text-xs" style={{ color: "var(--muted)" }}>
                Browser wallet detected — add Particle ConnectKit credentials to enable
                connection.
              </p>
            )}

            {!injectedReady && particleReady && (
              <p className="mt-3 text-center text-xs" style={{ color: "var(--muted)" }}>
                No injected browser wallet found — social and WalletConnect options use Particle.
              </p>
            )}

            {/* Keyboard hint */}
            <p className="mt-3 text-center text-xs" style={{ color: "var(--muted)" }}>
              Press{" "}
              <kbd
                className="rounded px-1 py-0.5 font-mono text-[10px]"
                style={{ background: "var(--background)", border: "1px solid var(--border)" }}
              >
                Esc
              </kbd>{" "}
              to close · use{" "}
              <kbd
                className="rounded px-1 py-0.5 font-mono text-[10px]"
                style={{ background: "var(--background)", border: "1px solid var(--border)" }}
              >
                ↑↓
              </kbd>{" "}
              to navigate options
            </p>

            {/* Footer */}
            <p className="mt-4 text-center text-xs" style={{ color: "var(--muted)" }}>
              By connecting, you agree to our{" "}
              <a
                href="#"
                className="underline underline-offset-2 hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                style={{ color: "var(--foreground)" }}
              >
                Terms of Service
              </a>
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
