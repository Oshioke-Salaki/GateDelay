"use client";

import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useModal, useConnect } from "@particle-network/connectkit";

// ─── Wallet option definitions ───────────────────────────────────────────────

interface WalletOption {
  id: string;
  name: string;
  icon: string;
  description: string;
  installUrl: string;
  /** Returns true when the wallet extension is detected in the browser */
  isInstalled: () => boolean;
}

const WALLET_OPTIONS: WalletOption[] = [
  {
    id: "metamask",
    name: "MetaMask",
    icon: "🦊",
    description: "Connect using the MetaMask browser extension",
    installUrl: "https://metamask.io/download/",
    isInstalled: () =>
      typeof window !== "undefined" &&
      typeof (window as Window & { ethereum?: { isMetaMask?: boolean } }).ethereum !== "undefined" &&
      !!((window as Window & { ethereum?: { isMetaMask?: boolean } }).ethereum?.isMetaMask),
  },
  {
    id: "walletconnect",
    name: "WalletConnect",
    icon: "🔗",
    description: "Scan with any WalletConnect-compatible wallet",
    installUrl: "https://walletconnect.com/explorer",
    isInstalled: () => true, // QR-code based — always available
  },
  {
    id: "google",
    name: "Google",
    icon: "G",
    description: "Sign in with your Google account",
    installUrl: "",
    isInstalled: () => true,
  },
  {
    id: "twitter",
    name: "Twitter / X",
    icon: "𝕏",
    description: "Sign in with your Twitter account",
    installUrl: "",
    isInstalled: () => true,
  },
  {
    id: "email",
    name: "Email",
    icon: "✉",
    description: "Sign in with a magic link sent to your email",
    installUrl: "",
    isInstalled: () => true,
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConnectModal({ isOpen, onClose }: ConnectModalProps) {
  const { isConnected } = useAccount();
  const { setOpen } = useModal();

  // Close automatically once the user successfully connects
  useEffect(() => {
    if (isConnected && isOpen) onClose();
  }, [isConnected, isOpen, onClose]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const handleWalletClick = useCallback(
    (wallet: WalletOption) => {
      if (!wallet.isInstalled() && wallet.installUrl) {
        window.open(wallet.installUrl, "_blank", "noopener,noreferrer");
        return;
      }
      // Delegate to Particle ConnectKit's built-in modal which handles
      // the actual connection flow for all wallet types
      setOpen(true);
      onClose();
    },
    [setOpen, onClose],
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
              <button
                onClick={onClose}
                aria-label="Close modal"
                className="rounded-lg p-1.5 transition-colors hover:opacity-70"
                style={{ color: "var(--muted)" }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Wallet list */}
            <ul className="space-y-2" role="list">
              {WALLET_OPTIONS.map((wallet) => {
                const installed = wallet.isInstalled();
                return (
                  <li key={wallet.id}>
                    <button
                      onClick={() => handleWalletClick(wallet)}
                      className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all hover:opacity-80 active:scale-[0.98]"
                      style={{
                        background: "var(--background)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {/* Icon */}
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl font-bold"
                        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                        aria-hidden="true"
                      >
                        {wallet.icon}
                      </span>

                      {/* Text */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                          {wallet.name}
                        </p>
                        <p className="truncate text-xs" style={{ color: "var(--muted)" }}>
                          {wallet.description}
                        </p>
                      </div>

                      {/* Status badge */}
                      {!installed && wallet.installUrl ? (
                        <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-500">
                          Install
                        </span>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
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

            {/* Footer note */}
            <p className="mt-4 text-center text-xs" style={{ color: "var(--muted)" }}>
              By connecting, you agree to our{" "}
              <a
                href="#"
                className="underline underline-offset-2 hover:opacity-80"
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
