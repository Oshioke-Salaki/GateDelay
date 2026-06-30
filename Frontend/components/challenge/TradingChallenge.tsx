"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Target,
  Clock,
  ChevronDown,
  ChevronUp,
  Users,
  TrendingUp,
  CheckCircle2,
  Loader2,
  Zap,
} from "lucide-react";
import { useToast } from "@/hooks/useToast";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChallengeStatus = "active" | "upcoming" | "completed";

export interface ChallengeRule {
  id: string;
  text: string;
}

export interface TradingChallengeData {
  id: string;
  title: string;
  description: string;
  status: ChallengeStatus;
  startDate: string;
  endDate: string;
  prizePool: number;
  participants: number;
  rules: ChallengeRule[];
  targetTrades: number;
  targetVolume: number;
  minWinRate?: number;
}

export interface ChallengeProgress {
  challengeId: string;
  joinedAt: string;
  tradesCompleted: number;
  volumeTraded: number;
  winRate: number;
}

interface TradingChallengeProps {
  userId?: string;
  challenges?: TradingChallengeData[];
  onJoin?: (challengeId: string) => Promise<void>;
}

// ─── Default challenges ─────────────────────────────────────────────────────────

const DEFAULT_CHALLENGES: TradingChallengeData[] = [
  {
    id: "weekly-volume",
    title: "Weekly Volume Sprint",
    description: "Trade the highest volume this week to win from the prize pool.",
    status: "active",
    startDate: "2026-06-23T00:00:00Z",
    endDate: "2026-06-30T23:59:59Z",
    prizePool: 5000,
    participants: 142,
    targetTrades: 10,
    targetVolume: 1000,
    rules: [
      { id: "r1", text: "Minimum 10 trades during the challenge period" },
      { id: "r2", text: "Minimum $1,000 total trading volume" },
      { id: "r3", text: "Only market orders count toward volume" },
      { id: "r4", text: "Top 3 traders by volume share the prize pool (50/30/20)" },
    ],
  },
  {
    id: "accuracy-master",
    title: "Accuracy Master",
    description: "Achieve the highest win rate with at least 20 trades.",
    status: "active",
    startDate: "2026-06-20T00:00:00Z",
    endDate: "2026-07-04T23:59:59Z",
    prizePool: 3000,
    participants: 89,
    targetTrades: 20,
    targetVolume: 500,
    minWinRate: 0.6,
    rules: [
      { id: "r1", text: "Minimum 20 completed trades required" },
      { id: "r2", text: "Win rate must exceed 60% to qualify" },
      { id: "r3", text: "Resolved markets only count toward win rate" },
      { id: "r4", text: "Ties broken by total profit" },
    ],
  },
  {
    id: "flight-specialist",
    title: "Flight Specialist Challenge",
    description: "Focus on flight delay markets and climb the leaderboard.",
    status: "upcoming",
    startDate: "2026-07-01T00:00:00Z",
    endDate: "2026-07-15T23:59:59Z",
    prizePool: 7500,
    participants: 0,
    targetTrades: 15,
    targetVolume: 2000,
    rules: [
      { id: "r1", text: "Only flight-related markets qualify" },
      { id: "r2", text: "Minimum 15 trades on flight markets" },
      { id: "r3", text: "Bonus points for correct delay predictions" },
    ],
  },
];

const STORAGE_KEY = "gate_delay_challenge_progress";

function loadProgress(userId: string): Record<string, ChallengeProgress> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveProgress(userId: string, progress: Record<string, ChallengeProgress>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(progress));
}

function formatDateRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${new Date(start).toLocaleDateString(undefined, opts)} – ${new Date(end).toLocaleDateString(undefined, opts)}`;
}

function calcOverallProgress(progress: ChallengeProgress, challenge: TradingChallengeData): number {
  const tradePct = Math.min(progress.tradesCompleted / challenge.targetTrades, 1);
  const volumePct = Math.min(progress.volumeTraded / challenge.targetVolume, 1);
  const winRateOk = challenge.minWinRate
    ? progress.winRate >= challenge.minWinRate
    : true;
  const base = ((tradePct + volumePct) / 2) * 100;
  return winRateOk ? base : base * 0.8;
}

// ─── TradingChallenge ───────────────────────────────────────────────────────────

export default function TradingChallenge({
  userId = "demo-user",
  challenges = DEFAULT_CHALLENGES,
  onJoin,
}: TradingChallengeProps) {
  const toast = useToast();
  const [expandedRules, setExpandedRules] = useState<string | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, ChallengeProgress>>({});
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setProgressMap(loadProgress(userId));
    setLoaded(true);
  }, [userId]);

  const activeChallenges = useMemo(
    () => challenges.filter((c) => c.status === "active"),
    [challenges]
  );

  const handleJoin = useCallback(
    async (challenge: TradingChallengeData) => {
      if (progressMap[challenge.id]) {
        toast.info("Already Joined", "You are already participating in this challenge");
        return;
      }

      setJoiningId(challenge.id);
      try {
        if (onJoin) await onJoin(challenge.id);

        const newProgress: ChallengeProgress = {
          challengeId: challenge.id,
          joinedAt: new Date().toISOString(),
          tradesCompleted: 0,
          volumeTraded: 0,
          winRate: 0,
        };

        const updated = { ...progressMap, [challenge.id]: newProgress };
        setProgressMap(updated);
        saveProgress(userId, updated);
        toast.success("Challenge Joined", `You joined "${challenge.title}"`);
      } catch (err) {
        toast.error("Join Failed", err instanceof Error ? err.message : "Could not join challenge");
      } finally {
        setJoiningId(null);
      }
    },
    [progressMap, userId, onJoin, toast]
  );

  const simulateProgress = useCallback(
    (challengeId: string) => {
      const challenge = challenges.find((c) => c.id === challengeId);
      const current = progressMap[challengeId];
      if (!challenge || !current) return;

      const updated: ChallengeProgress = {
        ...current,
        tradesCompleted: Math.min(current.tradesCompleted + 1, challenge.targetTrades),
        volumeTraded: Math.min(current.volumeTraded + 150, challenge.targetVolume),
        winRate: Math.min(current.winRate + 0.05, 0.95),
      };

      const newMap = { ...progressMap, [challengeId]: updated };
      setProgressMap(newMap);
      saveProgress(userId, newMap);
    },
    [challenges, progressMap, userId]
  );

  const STATUS_STYLES: Record<ChallengeStatus, { color: string; bg: string; label: string }> = {
    active: { color: "#22c55e", bg: "rgba(34, 197, 94, 0.12)", label: "Active" },
    upcoming: { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)", label: "Upcoming" },
    completed: { color: "#6b7280", bg: "rgba(107, 114, 128, 0.12)", label: "Completed" },
  };

  if (!loaded) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--muted)" }} />
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl p-6 space-y-5"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl" style={{ background: "rgba(245, 158, 11, 0.12)" }}>
          <Trophy className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            Trading Challenges
          </h2>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Compete, earn rewards, and track your progress
          </p>
        </div>
        <span
          className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full"
          style={{ background: "rgba(34, 197, 94, 0.12)", color: "#22c55e" }}
        >
          {activeChallenges.length} Active
        </span>
      </div>

      {/* Challenge cards */}
      <div className="space-y-4">
        {challenges.map((challenge) => {
          const statusStyle = STATUS_STYLES[challenge.status];
          const progress = progressMap[challenge.id];
          const isJoined = !!progress;
          const overallPct = progress ? calcOverallProgress(progress, challenge) : 0;
          const rulesExpanded = expandedRules === challenge.id;

          return (
            <motion.div
              key={challenge.id}
              layout
              className="rounded-xl p-4 space-y-3"
              style={{ background: "var(--background)", border: "1px solid var(--border)" }}
            >
              {/* Challenge header row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>
                      {challenge.title}
                    </h3>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: statusStyle.bg, color: statusStyle.color }}
                    >
                      {statusStyle.label}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    {challenge.description}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold" style={{ color: "#f59e0b" }}>
                    ${challenge.prizePool.toLocaleString()}
                  </p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>Prize Pool</p>
                </div>
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap gap-4 text-xs" style={{ color: "var(--muted)" }}>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDateRange(challenge.startDate, challenge.endDate)}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {challenge.participants + (isJoined ? 1 : 0)} participants
                </span>
                <span className="flex items-center gap-1">
                  <Target className="w-3.5 h-3.5" />
                  {challenge.targetTrades} trades · ${challenge.targetVolume} vol
                </span>
              </div>

              {/* Progress (if joined) */}
              {isJoined && progress && (
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between text-xs" style={{ color: "var(--muted)" }}>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" /> Your Progress
                    </span>
                    <span className="font-semibold" style={{ color: "var(--foreground)" }}>
                      {Math.round(overallPct)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--card)" }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: overallPct >= 100 ? "#22c55e" : "#3b82f6" }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(overallPct, 100)}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center p-2 rounded-lg" style={{ background: "var(--card)" }}>
                      <p className="font-bold" style={{ color: "var(--foreground)" }}>
                        {progress.tradesCompleted}/{challenge.targetTrades}
                      </p>
                      <p style={{ color: "var(--muted)" }}>Trades</p>
                    </div>
                    <div className="text-center p-2 rounded-lg" style={{ background: "var(--card)" }}>
                      <p className="font-bold" style={{ color: "var(--foreground)" }}>
                        ${progress.volumeTraded}
                      </p>
                      <p style={{ color: "var(--muted)" }}>Volume</p>
                    </div>
                    <div className="text-center p-2 rounded-lg" style={{ background: "var(--card)" }}>
                      <p className="font-bold" style={{ color: "var(--foreground)" }}>
                        {(progress.winRate * 100).toFixed(0)}%
                      </p>
                      <p style={{ color: "var(--muted)" }}>Win Rate</p>
                    </div>
                  </div>
                  {challenge.status === "active" && overallPct < 100 && (
                    <button
                      type="button"
                      onClick={() => simulateProgress(challenge.id)}
                      className="w-full py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1"
                      style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)" }}
                    >
                      <Zap className="w-3.5 h-3.5" /> Simulate Trade Progress
                    </button>
                  )}
                  {overallPct >= 100 && (
                    <div className="flex items-center gap-2 text-xs p-2 rounded-lg" style={{ background: "rgba(34, 197, 94, 0.08)", color: "#22c55e" }}>
                      <CheckCircle2 className="w-4 h-4" />
                      Challenge objectives complete!
                    </div>
                  )}
                </div>
              )}

              {/* Rules toggle */}
              <button
                type="button"
                onClick={() => setExpandedRules(rulesExpanded ? null : challenge.id)}
                className="flex items-center gap-1 text-xs font-medium transition-colors"
                style={{ color: "#3b82f6" }}
              >
                {rulesExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {rulesExpanded ? "Hide Rules" : "View Rules"}
              </button>

              <AnimatePresence>
                {rulesExpanded && (
                  <motion.ul
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-1.5 overflow-hidden"
                  >
                    {challenge.rules.map((rule, idx) => (
                      <li
                        key={rule.id}
                        className="flex items-start gap-2 text-xs p-2 rounded-lg"
                        style={{ background: "var(--card)", color: "var(--foreground)" }}
                      >
                        <span className="font-bold flex-shrink-0" style={{ color: "var(--muted)" }}>
                          {idx + 1}.
                        </span>
                        {rule.text}
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>

              {/* Join button */}
              {challenge.status === "active" && !isJoined && (
                <button
                  type="button"
                  onClick={() => handleJoin(challenge)}
                  disabled={joiningId === challenge.id}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {joiningId === challenge.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trophy className="w-4 h-4" />
                  )}
                  Join Challenge
                </button>
              )}

              {isJoined && (
                <div className="flex items-center gap-2 text-xs p-2 rounded-lg" style={{ background: "rgba(59, 130, 246, 0.08)", color: "#3b82f6" }}>
                  <CheckCircle2 className="w-4 h-4" />
                  Participating since {new Date(progress!.joinedAt).toLocaleDateString()}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
