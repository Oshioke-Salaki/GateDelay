"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "@particle-network/connectkit";
import { useToast } from "../../hooks/useToast";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – @types/qrcode may not be installed in all environments
import QRCode from "qrcode";

// ─── Types ────────────────────────────────────────────────────────────────────

export type QRConnectionStatus =
  | "idle"
  | "generating"
  | "ready"
  | "scanning"
  | "connected"
  | "timeout"
  | "error";

interface QRDisplayProps {
  /** Override the address shown in the QR code (defaults to connected address) */
  addressOverride?: string;
  /** Timeout in seconds before the QR code expires (default: 300 = 5 min) */
  timeoutSeconds?: number;
  /** Called when a connection is detected */
  onConnected?: (address: string) => void;
  /** Called when the timeout expires */
  onTimeout?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(addr: string) {
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function formatTimeLeft(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── QR Canvas ────────────────────────────────────────────────────────────────

function QRCanvas({ data, size = 220 }: { data: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !data) return;
    QRCode.toCanvas(canvasRef.current, data, {
      width: size,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    }).catch(() => {
      /* ignore canvas errors */
    });
  }, [data, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="rounded-xl"
      aria-label="QR code for wallet address"
    />
  );
}

// ─── Countdown ring ───────────────────────────────────────────────────────────

function CountdownRing({
  total,
  remaining,
  size = 244,
}: {
  total: number;
  remaining: number;
  size?: number;
}) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = remaining / total;
  const strokeDashoffset = circumference * (1 - progress);
  const color =
    progress > 0.4 ? "#3b82f6" : progress > 0.15 ? "#f59e0b" : "#ef4444";

  return (
    <svg
      width={size}
      height={size}
      className="absolute inset-0"
      style={{ transform: "rotate(-90deg)" }}
      aria-hidden="true"
    >
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--border)"
        strokeWidth={4}
      />
      {/* Progress */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s" }}
      />
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function QRDisplay({
  addressOverride,
  timeoutSeconds = 300,
  onConnected,
  onTimeout,
}: QRDisplayProps) {
  const { address: connectedAddress, isConnected } = useAccount();
  const { success, info, error: toastError } = useToast();

  const address = addressOverride ?? connectedAddress ?? null;

  const [status, setStatus] = useState<QRConnectionStatus>("idle");
  const [timeLeft, setTimeLeft] = useState(timeoutSeconds);
  const [copied, setCopied] = useState(false);
  const [qrValue, setQrValue] = useState<string>("");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunning = status === "ready" || status === "scanning";

  // Build QR code data: EIP-681 URI for Ethereum addresses
  const buildQrValue = useCallback((addr: string) => {
    return `ethereum:${addr}`;
  }, []);

  // Start / restart the QR session
  const start = useCallback(() => {
    if (!address) {
      setStatus("error");
      toastError("No address", "Connect your wallet first to generate a QR code.");
      return;
    }
    setStatus("generating");
    setTimeLeft(timeoutSeconds);
    setQrValue(buildQrValue(address));

    // Small delay to show "generating" state before rendering canvas
    setTimeout(() => setStatus("ready"), 400);
  }, [address, timeoutSeconds, buildQrValue, toastError]);

  // Countdown timer
  useEffect(() => {
    if (!isRunning) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setStatus("timeout");
          onTimeout?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, onTimeout]);

  // Detect connection while QR is shown
  useEffect(() => {
    if ((status === "ready" || status === "scanning") && isConnected && address) {
      setStatus("connected");
      if (timerRef.current) clearInterval(timerRef.current);
      success("Wallet connected", `Address: ${truncate(address)}`);
      onConnected?.(address);
    }
  }, [isConnected, address, status, success, onConnected]);

  // Copy address to clipboard
  const handleCopy = useCallback(async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      info("Copied", "Address copied to clipboard.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toastError("Copy failed", "Could not access clipboard.");
    }
  }, [address, info, toastError]);

  // ── Renders ────────────────────────────────────────────────────────────────

  return (
    <div
      className="mx-auto w-full max-w-sm rounded-3xl p-6 shadow-xl"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="mb-5">
        <p
          className="text-xs uppercase font-semibold tracking-widest"
          style={{ color: "#3b82f6" }}
        >
          Wallet QR
        </p>
        <h2
          className="mt-1 text-xl font-bold"
          style={{ color: "var(--foreground)" }}
        >
          Scan to connect
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Scan this code with any wallet app to connect or send funds.
        </p>
      </div>

      {/* QR area */}
      <AnimatePresence mode="wait">
        {/* Idle */}
        {status === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 py-4"
          >
            <div
              className="flex h-[220px] w-[220px] items-center justify-center rounded-xl"
              style={{
                background: "var(--background)",
                border: "2px dashed var(--border)",
              }}
            >
              <svg
                className="h-16 w-16 opacity-30"
                style={{ color: "var(--muted)" }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <path d="M14 14h3v3h-3zM17 17h3v3h-3zM14 20h3" />
              </svg>
            </div>
            <button
              onClick={start}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "#3b82f6" }}
            >
              Generate QR code
            </button>
          </motion.div>
        )}

        {/* Generating */}
        {status === "generating" && (
          <motion.div
            key="generating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex h-[220px] w-[220px] mx-auto items-center justify-center rounded-xl"
            style={{ background: "var(--background)", border: "1px solid var(--border)" }}
          >
            <span className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          </motion.div>
        )}

        {/* Ready / Scanning */}
        {(status === "ready" || status === "scanning") && (
          <motion.div
            key="ready"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center gap-4"
          >
            {/* QR + countdown ring */}
            <div className="relative" style={{ width: 244, height: 244 }}>
              <CountdownRing
                total={timeoutSeconds}
                remaining={timeLeft}
                size={244}
              />
              <div
                className="absolute"
                style={{ inset: 12, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <QRCanvas data={qrValue} size={220} />
              </div>
            </div>

            {/* Timer */}
            <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
              Expires in{" "}
              <span
                style={{
                  color:
                    timeLeft > timeoutSeconds * 0.4
                      ? "#3b82f6"
                      : timeLeft > timeoutSeconds * 0.15
                      ? "#f59e0b"
                      : "#ef4444",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatTimeLeft(timeLeft)}
              </span>
            </p>

            {/* Status badge */}
            <div
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
              style={{
                background: status === "scanning" ? "#3b82f620" : "var(--background)",
                border: `1px solid ${status === "scanning" ? "#3b82f6" : "var(--border)"}`,
                color: status === "scanning" ? "#3b82f6" : "var(--muted)",
              }}
            >
              <span
                className={`h-2 w-2 rounded-full ${status === "scanning" ? "animate-pulse" : ""}`}
                style={{ background: status === "scanning" ? "#3b82f6" : "var(--muted)" }}
              />
              {status === "scanning" ? "Scan detected — connecting…" : "Waiting for scan…"}
            </div>
          </motion.div>
        )}

        {/* Connected */}
        {status === "connected" && (
          <motion.div
            key="connected"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4 py-4"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500">
              <svg
                className="h-10 w-10 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-semibold text-green-500">Connected!</p>
              <p className="mt-1 text-sm font-mono" style={{ color: "var(--muted)" }}>
                {address ? truncate(address) : ""}
              </p>
            </div>
            <button
              onClick={start}
              className="w-full rounded-xl border py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
              style={{
                borderColor: "var(--border)",
                background: "var(--background)",
                color: "var(--foreground)",
              }}
            >
              Generate new code
            </button>
          </motion.div>
        )}

        {/* Timeout */}
        {status === "timeout" && (
          <motion.div
            key="timeout"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4 py-4"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-500">
              <svg
                className="h-10 w-10 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-semibold text-amber-500">QR code expired</p>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                For security, QR codes expire after {Math.round(timeoutSeconds / 60)} minutes.
              </p>
            </div>
            <button
              onClick={start}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "#3b82f6" }}
            >
              Refresh QR code
            </button>
          </motion.div>
        )}

        {/* Error */}
        {status === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4 py-4"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500">
              <svg
                className="h-10 w-10 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-semibold text-red-500">No wallet connected</p>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                Connect your wallet before generating a QR code.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Address display + copy */}
      {address && status !== "idle" && status !== "error" && (
        <div
          className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2.5"
          style={{
            background: "var(--background)",
            border: "1px solid var(--border)",
          }}
        >
          <p
            className="flex-1 truncate font-mono text-xs"
            style={{ color: "var(--muted)" }}
            title={address}
          >
            {address}
          </p>
          <button
            onClick={handleCopy}
            aria-label="Copy wallet address"
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all hover:opacity-80"
            style={{
              background: copied ? "#22c55e20" : "var(--card)",
              border: `1px solid ${copied ? "#22c55e" : "var(--border)"}`,
              color: copied ? "#22c55e" : "var(--foreground)",
            }}
          >
            {copied ? (
              <>
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Copied
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
      )}

      {/* Footer note */}
      <p className="mt-4 text-center text-xs" style={{ color: "var(--muted)" }}>
        Only share this code with trusted wallets. QR codes expire for your security.
      </p>
    </div>
  );
}
