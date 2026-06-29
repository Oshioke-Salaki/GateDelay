"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Copy, Share2, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/useToast";

interface ReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  totalEarned: number;
  pendingRewards: number;
}

interface ReferralSystemProps {
  referralCode?: string;
  stats?: ReferralStats;
  onShareClick?: () => void;
}

export default function ReferralSystem({
  referralCode = "GATE2024ABC",
  stats = {
    totalReferrals: 12,
    activeReferrals: 8,
    totalEarned: 245.5,
    pendingRewards: 32.75,
  },
  onShareClick,
}: ReferralSystemProps) {
  const { success, error } = useToast();
  const [copied, setCopied] = useState(false);

  const referralLink = `https://gatedelay.com/ref/${referralCode}`;

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    success("Copied!", "Referral code copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }, [referralCode, success]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    success("Copied!", "Referral link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }, [referralLink, success]);

  const handleShare = useCallback(async () => {
    if (onShareClick) {
      onShareClick();
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join GateDelay",
          text: "Join me on GateDelay - the decentralized flight prediction market",
          url: referralLink,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          error("Share failed", "Could not share referral link");
        }
      }
    } else {
      handleCopyLink();
    }
  }, [referralLink, onShareClick, handleCopyLink, error]);

  return (
    <div className="space-y-6">
      {/* Referral Code Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-xl p-6"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        <h3 className="mb-4 text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          Your Referral Code
        </h3>

        <div className="space-y-3">
          {/* Code Display */}
          <div
            className="flex items-center justify-between rounded-lg p-4"
            style={{
              background: "var(--background)",
              border: "1px solid var(--border)",
            }}
          >
            <code
              className="font-mono text-lg font-bold tracking-wider"
              style={{ color: "var(--foreground)" }}
            >
              {referralCode}
            </code>
            <button
              onClick={handleCopyCode}
              className="rounded-lg p-2 transition-all hover:opacity-70 active:scale-95"
              style={{
                background: "var(--background)",
                color: "var(--muted)",
              }}
              aria-label="Copy referral code"
            >
              <Copy size={18} />
            </button>
          </div>

          {/* Referral Link */}
          <div
            className="flex items-center justify-between rounded-lg p-4"
            style={{
              background: "var(--background)",
              border: "1px solid var(--border)",
            }}
          >
            <span
              className="truncate text-sm"
              style={{ color: "var(--muted)" }}
              title={referralLink}
            >
              {referralLink}
            </span>
            <button
              onClick={handleCopyLink}
              className="ml-2 shrink-0 rounded-lg p-2 transition-all hover:opacity-70 active:scale-95"
              style={{
                background: "var(--background)",
                color: "var(--muted)",
              }}
              aria-label="Copy referral link"
            >
              <Copy size={18} />
            </button>
          </div>

          {/* Share Button */}
          <button
            onClick={handleShare}
            className="w-full rounded-lg px-4 py-3 font-medium transition-all hover:opacity-90 active:scale-95"
            style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
            }}
          >
            <Share2 className="mr-2 inline-block" size={18} />
            Share Referral Link
          </button>
        </div>
      </motion.div>

      {/* Statistics Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="grid grid-cols-2 gap-4 md:grid-cols-4"
      >
        {[
          {
            label: "Total Referrals",
            value: stats.totalReferrals,
            icon: "👥",
          },
          {
            label: "Active Referrals",
            value: stats.activeReferrals,
            icon: "✓",
          },
          {
            label: "Total Earned",
            value: `$${stats.totalEarned.toFixed(2)}`,
            icon: "💰",
          },
          {
            label: "Pending Rewards",
            value: `$${stats.pendingRewards.toFixed(2)}`,
            icon: "⏳",
          },
        ].map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.15 + idx * 0.05 }}
            className="rounded-lg p-4"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="mb-2 text-2xl">{stat.icon}</div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {stat.label}
            </p>
            <p
              className="mt-1 text-lg font-bold"
              style={{ color: "var(--foreground)" }}
            >
              {stat.value}
            </p>
          </motion.div>
        ))}
      </motion.div>

      {/* Info Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="rounded-lg p-4"
        style={{
          background: "rgba(102, 126, 234, 0.1)",
          border: "1px solid rgba(102, 126, 234, 0.2)",
        }}
      >
        <div className="flex gap-3">
          <TrendingUp size={20} style={{ color: "#667eea", flexShrink: 0 }} />
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              Earn rewards for every referral
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
              Get 10% commission on trading fees from your referrals. Rewards are credited
              weekly to your account.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
