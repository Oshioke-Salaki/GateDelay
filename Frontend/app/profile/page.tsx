"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useConnectKitBridge } from "../components/ConnectKitBridgeContext";
import { useTransactionTracker } from "@/hooks/useTransactionTracker";

type ProfileForm = {
  displayName: string;
  email: string;
  bio: string;
  notifyTrades: boolean;
  notifyResolutions: boolean;
};

const STATS = [
  { label: "Total Trades", value: 42 },
  { label: "Win Rate", value: "61%" },
  { label: "Volume", value: "$12,400" },
  { label: "Markets Joined", value: 18 },
];

const BACKUP_STORAGE_KEY = "wallet_backup_status";

type BackupStatus = "pending" | "dismissed" | "completed";

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div
      className="h-20 w-20 rounded-full flex items-center justify-center text-2xl font-bold text-white"
      style={{ background: "#3b82f6" }}
      aria-label={`Avatar for ${name}`}
    >
      {initials || "?"}
    </div>
  );
}

export default function ProfilePage() {
  const { address, isConnected } = useConnectKitBridge();
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [backupStatus, setBackupStatus] = useState<BackupStatus>("pending");

  const { transactions } = useTransactionTracker();

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(BACKUP_STORAGE_KEY) as BackupStatus | null;
    if (stored) setBackupStatus(stored);
  }, []);

  const { register, handleSubmit, reset, formState: { isDirty } } = useForm<ProfileForm>({
    defaultValues: {
      displayName: "Trader Joe",
      email: "",
      bio: "",
      notifyTrades: true,
      notifyResolutions: true,
    },
  });

  function onSubmit(data: ProfileForm) {
    console.log("Saved profile:", data);
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 3000);
  }

  function handleCancel() {
    reset();
    setEditing(false);
  }

  function markBackupDone() {
    localStorage.setItem(BACKUP_STORAGE_KEY, "completed");
    setBackupStatus("completed");
  }

  const recentActivity = transactions.slice(0, 5);

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
        Profile
      </h1>

      {/* Identity card */}
      <section
        className="rounded-xl p-6 flex items-center gap-5"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <Avatar name="Trader Joe" />
        <div className="min-w-0">
          <p className="font-semibold text-lg leading-tight" style={{ color: "var(--foreground)" }}>
            Trader Joe
          </p>
          {isConnected && address ? (
            <p
              className="text-sm mt-1 font-mono truncate"
              style={{ color: "var(--muted)" }}
              title={address}
            >
              {truncate(address)}
            </p>
          ) : (
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              No wallet connected
            </p>
          )}
        </div>
      </section>

      {/* Stats */}
      <section>
        <p className="text-xs font-semibold mb-3" style={{ color: "var(--muted)" }}>
          ACCOUNT STATS
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-xl px-4 py-3"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>{s.label}</p>
              <p className="text-xl font-bold" style={{ color: "var(--foreground)" }}>{s.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recent wallet activity */}
      <section
        className="rounded-xl p-6 space-y-4"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
          RECENT WALLET ACTIVITY
        </p>
        {!isConnected ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Connect your wallet to see recent activity.
          </p>
        ) : !mounted || recentActivity.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            No recent transactions in the last 24 hours.
          </p>
        ) : (
          <ul className="space-y-2">
            {recentActivity.map((tx) => (
              <li
                key={tx.hash}
                className="flex items-center justify-between text-sm gap-2"
              >
                <span
                  className="font-mono truncate max-w-[140px]"
                  style={{ color: "#3b82f6" }}
                  title={tx.hash}
                >
                  <a
                    href={`https://etherscan.io/tx/${tx.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {tx.hash.slice(0, 8)}…{tx.hash.slice(-6)}
                  </a>
                </span>
                <span className="flex-1 truncate" style={{ color: "var(--foreground)" }}>
                  {tx.description || "Contract interaction"}
                </span>
                <span className="shrink-0 text-xs" style={{ color: "var(--muted)" }}>
                  {timeAgo(tx.timestamp)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Account safety */}
      <section
        className="rounded-xl p-6 space-y-4"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
          ACCOUNT SAFETY
        </p>

        {/* Backup status */}
        {mounted && isConnected && (
          <div
            className="rounded-lg px-4 py-3 flex items-start justify-between gap-3"
            style={
              backupStatus === "completed"
                ? { background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }
                : { background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }
            }
          >
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-medium"
                style={{ color: backupStatus === "completed" ? "#10b981" : "#f59e0b" }}
              >
                {backupStatus === "completed" ? "✓ Wallet backed up" : "Wallet backup not confirmed"}
              </p>
              {backupStatus !== "completed" && (
                <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                  Save your seed phrase in a safe, offline location. Without it you cannot
                  recover your wallet if your device is lost.
                </p>
              )}
            </div>
            {backupStatus !== "completed" && (
              <button
                onClick={markBackupDone}
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: "#f59e0b" }}
              >
                Mark done
              </button>
            )}
          </div>
        )}

        {/* Safety reminders */}
        <ul className="space-y-3">
          {[
            {
              icon: "🔑",
              title: "Never share your seed phrase",
              description: "No legitimate service will ever ask for your secret recovery phrase.",
            },
            {
              icon: "🔍",
              title: "Verify contract addresses before signing",
              description: "Always confirm you are interacting with the correct contract address.",
            },
            {
              icon: "🔒",
              title: "Use a hardware wallet for large holdings",
              description: "Hardware wallets keep private keys offline and protect against phishing.",
            },
            {
              icon: "🌐",
              title: "Check the URL before connecting",
              description: "Bookmark the official site and always verify the domain before approving transactions.",
            },
          ].map(({ icon, title, description }) => (
            <li key={title} className="flex items-start gap-3">
              <span className="text-base shrink-0" aria-hidden="true">{icon}</span>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{title}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{description}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Edit form */}
      <section
        className="rounded-xl p-6 space-y-5"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
            PROFILE INFO
          </p>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-sm font-medium"
              style={{ color: "#3b82f6" }}
            >
              Edit
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Display Name">
            <input
              {...register("displayName", { required: true })}
              disabled={!editing}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-60"
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
          </Field>

          <Field label="Email">
            <input
              {...register("email")}
              type="email"
              disabled={!editing}
              placeholder="you@example.com"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-60"
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
          </Field>

          <Field label="Bio">
            <textarea
              {...register("bio")}
              disabled={!editing}
              rows={3}
              placeholder="A short bio…"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none disabled:opacity-60"
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
          </Field>

          {editing && (
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={!isDirty}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ background: "#3b82f6" }}
              >
                Save changes
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
                style={{
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  color: "var(--muted)",
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {saved && (
            <p className="text-sm" style={{ color: "#22c55e" }}>
              Profile saved.
            </p>
          )}
        </form>
      </section>

      {/* Notifications */}
      <section
        className="rounded-xl p-6 space-y-4"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
          NOTIFICATIONS
        </p>
        <Toggle label="Trade confirmations" description="Get notified when a trade executes" name="notifyTrades" register={register} />
        <Toggle label="Market resolutions" description="Get notified when a market resolves" name="notifyResolutions" register={register} />
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  description,
  name,
  register,
}: {
  label: string;
  description: string;
  name: keyof ProfileForm;
  register: ReturnType<typeof useForm<ProfileForm>>["register"];
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{description}</p>
      </div>
      <input type="checkbox" {...register(name)} className="h-4 w-4 accent-blue-500" />
    </div>
  );
}
