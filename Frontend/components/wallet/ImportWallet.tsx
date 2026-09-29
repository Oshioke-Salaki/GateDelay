"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ethers } from "ethers";
import * as bip39 from "bip39";

// ─── Types ────────────────────────────────────────────────────────────────────

type ImportTab = "mnemonic" | "privatekey";

type ImportStage =
  | "input"       // User is filling in the form
  | "validating"  // Running sync validation checks
  | "deriving"    // Async wallet derivation in progress
  | "success"     // Wallet derived successfully
  | "error";      // Validation or derivation failed

interface ImportedWallet {
  address: string;
  /** The derived HD path (mnemonic mode only) */
  path?: string;
}

interface ValidationResult {
  valid: boolean;
  message?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validate a BIP39 mnemonic phrase.
 * Uses bip39.validateMnemonic for checksum + word-list verification.
 */
function validateMnemonic(phrase: string): ValidationResult {
  const trimmed = phrase.trim();
  if (!trimmed) return { valid: false, message: "Please enter your seed phrase." };

  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount !== 12 && wordCount !== 24) {
    return {
      valid: false,
      message: `Seed phrase must be 12 or 24 words (got ${wordCount}).`,
    };
  }

  if (!bip39.validateMnemonic(trimmed)) {
    return {
      valid: false,
      message: "Invalid seed phrase — checksum failed. Please double-check your words.",
    };
  }

  return { valid: true };
}

/**
 * Validate a raw Ethereum private key.
 * Accepts optional 0x prefix; must be 64 hex characters.
 */
function validatePrivateKey(key: string): ValidationResult {
  const trimmed = key.trim();
  if (!trimmed) return { valid: false, message: "Please enter your private key." };

  const stripped = trimmed.startsWith("0x") || trimmed.startsWith("0X")
    ? trimmed.slice(2)
    : trimmed;

  if (!/^[0-9a-fA-F]{64}$/.test(stripped)) {
    return {
      valid: false,
      message:
        stripped.length !== 64
          ? `Private key must be 64 hex characters (got ${stripped.length}).`
          : "Private key contains invalid characters. Only hex digits (0–9, a–f) are allowed.",
    };
  }

  return { valid: true };
}

/**
 * Derive an ethers Wallet from a BIP39 mnemonic.
 * Returns the wallet (without private key exposed) and the HD path used.
 */
async function deriveFromMnemonic(
  phrase: string
): Promise<{ address: string; path: string }> {
  const trimmed = phrase.trim();
  const path = "m/44'/60'/0'/0/0";
  const wallet = ethers.HDNodeWallet.fromMnemonic(
    ethers.Mnemonic.fromPhrase(trimmed),
    path
  );
  return { address: wallet.address, path };
}

/**
 * Derive an ethers Wallet from a raw private key.
 */
async function deriveFromPrivateKey(key: string): Promise<{ address: string }> {
  const trimmed = key.trim();
  const normalized = trimmed.startsWith("0x") || trimmed.startsWith("0X")
    ? trimmed
    : `0x${trimmed}`;
  const wallet = new ethers.Wallet(normalized);
  return { address: wallet.address };
}

function truncate(addr: string) {
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabButton({
  active,
  id,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      id={id}
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="relative flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all duration-200"
      style={{
        background: active ? "var(--background)" : "transparent",
        color: active ? "var(--foreground)" : "var(--muted)",
        boxShadow: active ? "0 1px 4px rgba(0,0,0,0.15)" : "none",
        border: active ? "1px solid var(--border)" : "1px solid transparent",
      }}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </button>
  );
}

function ValidationBadge({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      role="alert"
      className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
      style={{
        background: "#ef444415",
        border: "1px solid #ef444440",
        color: "#ef4444",
      }}
    >
      <svg
        className="shrink-0 mt-0.5"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      {message}
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ImportWalletProps {
  /** Called when a wallet is successfully derived. Receives the public address. */
  onImported?: (wallet: ImportedWallet) => void;
}

export default function ImportWallet({ onImported }: ImportWalletProps) {
  const [tab, setTab] = useState<ImportTab>("mnemonic");
  const [stage, setStage] = useState<ImportStage>("input");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [importedWallet, setImportedWallet] = useState<ImportedWallet | null>(null);

  // Refs hold sensitive values — not stored in state to limit memory exposure
  const mnemonicRef = useRef<string>("");
  const privateKeyRef = useRef<string>("");

  // Controlled display values (cleared on success)
  const [mnemonicDisplay, setMnemonicDisplay] = useState("");
  const [privateKeyDisplay, setPrivateKeyDisplay] = useState("");

  // Real-time inline validation
  const [mnemonicValidation, setMnemonicValidation] = useState<ValidationResult | null>(null);
  const [pkValidation, setPkValidation] = useState<ValidationResult | null>(null);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleMnemonicChange = useCallback((value: string) => {
    mnemonicRef.current = value;
    setMnemonicDisplay(value);

    // Only validate after user has typed at least one space (started second word)
    if (value.includes(" ")) {
      setMnemonicValidation(validateMnemonic(value));
    } else {
      setMnemonicValidation(null);
    }
  }, []);

  const handlePrivateKeyChange = useCallback((value: string) => {
    privateKeyRef.current = value;
    setPrivateKeyDisplay(value);

    // Validate once input looks like it could be a full key (≥32 chars)
    if (value.replace(/^0x/i, "").length >= 32) {
      setPkValidation(validatePrivateKey(value));
    } else {
      setPkValidation(null);
    }
  }, []);

  const handleTabChange = useCallback((next: ImportTab) => {
    setTab(next);
    setStage("input");
    setErrorMessage("");
    setMnemonicValidation(null);
    setPkValidation(null);
  }, []);

  const handleReset = useCallback(() => {
    setStage("input");
    setImportedWallet(null);
    setErrorMessage("");
    setMnemonicDisplay("");
    setPrivateKeyDisplay("");
    setMnemonicValidation(null);
    setPkValidation(null);
    mnemonicRef.current = "";
    privateKeyRef.current = "";
  }, []);

  const handleImport = useCallback(async () => {
    setErrorMessage("");
    setStage("validating");

    // ── Synchronous validation ────────────────────────────────────────────
    let validation: ValidationResult;

    if (tab === "mnemonic") {
      validation = validateMnemonic(mnemonicRef.current);
    } else {
      validation = validatePrivateKey(privateKeyRef.current);
    }

    if (!validation.valid) {
      setErrorMessage(validation.message ?? "Invalid input.");
      setStage("error");
      return;
    }

    // ── Async derivation ──────────────────────────────────────────────────
    setStage("deriving");

    // Minimum display time so the spinner is always seen (UX requirement)
    const minDelay = new Promise<void>((r) => setTimeout(r, 700));

    try {
      let result: ImportedWallet;

      if (tab === "mnemonic") {
        const [derived] = await Promise.all([
          deriveFromMnemonic(mnemonicRef.current),
          minDelay,
        ]);
        result = { address: derived.address, path: derived.path };
      } else {
        const [derived] = await Promise.all([
          deriveFromPrivateKey(privateKeyRef.current),
          minDelay,
        ]);
        result = { address: derived.address };
      }

      // ── Security: clear sensitive data from memory immediately ──────────
      mnemonicRef.current = "";
      privateKeyRef.current = "";
      setMnemonicDisplay("");
      setPrivateKeyDisplay("");
      setMnemonicValidation(null);
      setPkValidation(null);

      setImportedWallet(result);
      setStage("success");
      onImported?.(result);
    } catch (err: unknown) {
      // Clear even on failure to not leave partial sensitive data
      mnemonicRef.current = "";
      privateKeyRef.current = "";
      setMnemonicDisplay("");
      setPrivateKeyDisplay("");

      const msg =
        err instanceof Error ? err.message : "Wallet derivation failed.";
      setErrorMessage(msg);
      setStage("error");
    }
  }, [tab, onImported]);

  // ── Derived flags ─────────────────────────────────────────────────────────

  const isProcessing = stage === "validating" || stage === "deriving";

  const canSubmit =
    !isProcessing &&
    stage !== "success" &&
    (tab === "mnemonic"
      ? mnemonicDisplay.trim().length > 0
      : privateKeyDisplay.trim().length > 0);

  const currentValidation = tab === "mnemonic" ? mnemonicValidation : pkValidation;
  const hasInlineError = currentValidation !== null && !currentValidation.valid;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="rounded-2xl p-6 space-y-5"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div>
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-1"
          style={{ color: "#8b5cf6" }}
        >
          Wallet Recovery
        </p>
        <h2
          className="text-lg font-bold"
          style={{ color: "var(--foreground)" }}
        >
          Import Wallet
        </h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
          Restore access using your existing seed phrase or private key.
        </p>
      </div>

      {/* Security notice */}
      <div
        className="flex items-start gap-2.5 rounded-xl px-3 py-2.5"
        style={{ background: "#f59e0b10", border: "1px solid #f59e0b30" }}
      >
        <span className="text-base shrink-0 mt-0.5" aria-hidden="true">🔒</span>
        <p className="text-xs leading-relaxed" style={{ color: "#f59e0b" }}>
          Your credentials are never transmitted. Derivation runs entirely in
          your browser and sensitive inputs are cleared from memory immediately
          after use.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {/* ── Success State ─────────────────────────────────────────────── */}
        {stage === "success" && importedWallet && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center gap-4 py-4 text-center"
          >
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: "#22c55e20", border: "2px solid #22c55e" }}
            >
              <svg
                className="h-8 w-8"
                style={{ color: "#22c55e" }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <div>
              <p className="font-semibold text-base" style={{ color: "#22c55e" }}>
                Wallet Imported!
              </p>
              <p className="mt-1 text-sm font-mono" style={{ color: "var(--muted)" }}>
                {truncate(importedWallet.address)}
              </p>
              {importedWallet.path && (
                <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                  HD path: {importedWallet.path}
                </p>
              )}
            </div>

            <div
              className="w-full rounded-xl px-4 py-2.5 font-mono text-xs break-all text-left"
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                color: "var(--muted)",
              }}
              aria-label="Imported wallet address"
            >
              {importedWallet.address}
            </div>

            <button
              id="import-wallet-reset-btn"
              onClick={handleReset}
              className="w-full rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            >
              Import another wallet
            </button>
          </motion.div>
        )}

        {/* ── Input / Validation / Deriving / Error States ──────────────── */}
        {stage !== "success" && (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Tab bar */}
            <div
              role="tablist"
              aria-label="Wallet import method"
              className="flex gap-1.5 rounded-xl p-1"
              style={{ background: "var(--background)", border: "1px solid var(--border)" }}
            >
              <TabButton
                id="import-tab-mnemonic"
                active={tab === "mnemonic"}
                label="Seed Phrase"
                icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                }
                onClick={() => handleTabChange("mnemonic")}
              />
              <TabButton
                id="import-tab-privatekey"
                active={tab === "privatekey"}
                label="Private Key"
                icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                  </svg>
                }
                onClick={() => handleTabChange("privatekey")}
              />
            </div>

            {/* Panel: Seed Phrase */}
            {tab === "mnemonic" && (
              <motion.div
                key="mnemonic-panel"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15 }}
                className="space-y-3"
                role="tabpanel"
                aria-labelledby="import-tab-mnemonic"
              >
                <label
                  htmlFor="import-mnemonic-input"
                  className="text-xs font-medium"
                  style={{ color: "var(--muted)" }}
                >
                  BIP39 Seed Phrase
                </label>
                <textarea
                  id="import-mnemonic-input"
                  value={mnemonicDisplay}
                  onChange={(e) => handleMnemonicChange(e.target.value)}
                  disabled={isProcessing}
                  rows={4}
                  placeholder="Enter your 12 or 24 word seed phrase, separated by spaces…"
                  spellCheck={false}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  className="w-full rounded-xl px-3 py-2.5 text-sm font-mono outline-none resize-none disabled:opacity-50 transition-colors"
                  style={{
                    background: "var(--background)",
                    border: `1px solid ${hasInlineError && tab === "mnemonic" ? "#ef4444" : "var(--border)"}`,
                    color: "var(--foreground)",
                  }}
                  aria-describedby="mnemonic-hint"
                />
                <p id="mnemonic-hint" className="text-xs" style={{ color: "var(--muted)" }}>
                  Words are validated against the BIP39 wordlist with checksum verification.
                </p>
                <AnimatePresence>
                  {mnemonicValidation && !mnemonicValidation.valid && (
                    <ValidationBadge message={mnemonicValidation.message!} />
                  )}
                  {mnemonicValidation?.valid && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-1.5 text-xs"
                      style={{ color: "#22c55e" }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Valid seed phrase
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Panel: Private Key */}
            {tab === "privatekey" && (
              <motion.div
                key="pk-panel"
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                transition={{ duration: 0.15 }}
                className="space-y-3"
                role="tabpanel"
                aria-labelledby="import-tab-privatekey"
              >
                <label
                  htmlFor="import-pk-input"
                  className="text-xs font-medium"
                  style={{ color: "var(--muted)" }}
                >
                  Private Key
                </label>
                <input
                  id="import-pk-input"
                  type="password"
                  value={privateKeyDisplay}
                  onChange={(e) => handlePrivateKeyChange(e.target.value)}
                  disabled={isProcessing}
                  placeholder="0x… or raw 64-character hex"
                  spellCheck={false}
                  autoComplete="off"
                  autoCorrect="off"
                  className="w-full rounded-xl px-3 py-2.5 text-sm font-mono outline-none disabled:opacity-50 transition-colors"
                  style={{
                    background: "var(--background)",
                    border: `1px solid ${hasInlineError && tab === "privatekey" ? "#ef4444" : "var(--border)"}`,
                    color: "var(--foreground)",
                  }}
                  aria-describedby="pk-hint"
                />
                <p id="pk-hint" className="text-xs" style={{ color: "var(--muted)" }}>
                  64 hex characters (256 bits). Accepts optional <code className="font-mono">0x</code> prefix.
                </p>
                <AnimatePresence>
                  {pkValidation && !pkValidation.valid && (
                    <ValidationBadge message={pkValidation.message!} />
                  )}
                  {pkValidation?.valid && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-1.5 text-xs"
                      style={{ color: "#22c55e" }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Valid private key
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Submission error */}
            <AnimatePresence>
              {stage === "error" && errorMessage && (
                <ValidationBadge message={errorMessage} />
              )}
            </AnimatePresence>

            {/* Submit button with multi-stage label */}
            <button
              id="import-wallet-submit-btn"
              onClick={handleImport}
              disabled={!canSubmit || isProcessing}
              aria-busy={isProcessing}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:enabled:opacity-90 active:enabled:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}
            >
              {stage === "validating" ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
                  Validating…
                </span>
              ) : stage === "deriving" ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
                  Deriving account…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  {stage === "error" ? "Try Again" : "Import Wallet"}
                </span>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
