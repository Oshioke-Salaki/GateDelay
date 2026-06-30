"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Vote,
  Wallet,
  BarChart3,
  Users,
  Shield,
  Zap,
} from "lucide-react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useToast } from "@/hooks/useToast";

// ── Contract ABIs ──────────────────────────────────────────────────────────────

const VOTING_ABI = [
  {
    name: "getProposal",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "description", type: "string" },
          { name: "startTime", type: "uint256" },
          { name: "endTime", type: "uint256" },
          { name: "forVotes", type: "uint256" },
          { name: "againstVotes", type: "uint256" },
          { name: "abstainVotes", type: "uint256" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "getVotingPower",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getVote",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "proposalId", type: "uint256" },
      { name: "voter", type: "address" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "choice", type: "uint8" },
          { name: "weight", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "castVote",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proposalId", type: "uint256" },
      { name: "choice", type: "uint8" },
    ],
    outputs: [],
  },
  {
    name: "proposalCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "governanceToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const GOVERNANCE_ABI = [
  {
    name: "getProposal",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "votingProposalId", type: "uint256" },
          { name: "proposer", type: "address" },
          { name: "target", type: "address" },
          { name: "callData", type: "bytes" },
          { name: "createdAt", type: "uint256" },
          { name: "executedAt", type: "uint256" },
          { name: "state", type: "uint8" },
          { name: "description", type: "string" },
        ],
      },
    ],
  },
  {
    name: "getProposalHistory",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "quorum",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "proposalCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ── Contract Addresses (from env) ──────────────────────────────────────────────

const VOTING_CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_VOTING_CONTRACT_ADDRESS as `0x${string}`) ??
  "0x0000000000000000000000000000000000000000";

const GOVERNANCE_CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_GOVERNANCE_CONTRACT_ADDRESS as `0x${string}`) ??
  "0x0000000000000000000000000000000000000000";

const GOVERNANCE_TOKEN_ADDRESS =
  (process.env.NEXT_PUBLIC_GOVERNANCE_TOKEN_ADDRESS as `0x${string}`) ??
  "0x0000000000000000000000000000000000000000";

// ── Vote choices (matching Solidity enum: NONE=0, FOR=1, AGAINST=2, ABSTAIN=3) ─

const VOTE_CHOICE = { NONE: 0, FOR: 1, AGAINST: 2, ABSTAIN: 3 } as const;
type VoteChoiceValue = (typeof VOTE_CHOICE)[keyof typeof VOTE_CHOICE];

// ── Governance state enum (matching Solidity: PENDING=0, ACTIVE=1, DEFEATED=2,
//    SUCCEEDED=3, EXECUTED=4, CANCELLED=5) ────────────────────────────────────

const PROPOSAL_STATE: Record<number, string> = {
  0: "Pending",
  1: "Active",
  2: "Defeated",
  3: "Succeeded",
  4: "Executed",
  5: "Cancelled",
};

// ── Mock data for when contracts are not deployed ─────────────────────────────

const MOCK_PROPOSALS = [
  {
    id: 1n,
    votingProposalId: 1n,
    description: "Increase quorum threshold from 100 to 150 tokens",
    state: 1,
    createdAt: BigInt(Math.floor(Date.now() / 1000) - 86400),
    executedAt: 0n,
    forVotes: 1250n,
    againstVotes: 340n,
    abstainVotes: 80n,
    endTime: BigInt(Math.floor(Date.now() / 1000) + 86400 * 3),
    active: true,
    proposer: "0xabcd1234abcd1234abcd1234abcd1234abcd1234" as `0x${string}`,
  },
  {
    id: 2n,
    votingProposalId: 2n,
    description: "Add support for new prediction market category: Weather Events",
    state: 1,
    createdAt: BigInt(Math.floor(Date.now() / 1000) - 43200),
    executedAt: 0n,
    forVotes: 890n,
    againstVotes: 1100n,
    abstainVotes: 200n,
    endTime: BigInt(Math.floor(Date.now() / 1000) + 86400 * 5),
    active: true,
    proposer: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef" as `0x${string}`,
  },
  {
    id: 3n,
    votingProposalId: 3n,
    description: "Reduce protocol fee from 2% to 1.5% for market makers",
    state: 4,
    createdAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 10),
    executedAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 2),
    forVotes: 2000n,
    againstVotes: 300n,
    abstainVotes: 100n,
    endTime: BigInt(Math.floor(Date.now() / 1000) - 86400 * 3),
    active: false,
    proposer: "0x1234abcd1234abcd1234abcd1234abcd1234abcd" as `0x${string}`,
  },
  {
    id: 4n,
    votingProposalId: 4n,
    description: "Integrate Chainlink VRF for random dispute resolver selection",
    state: 2,
    createdAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 8),
    executedAt: 0n,
    forVotes: 400n,
    againstVotes: 1800n,
    abstainVotes: 50n,
    endTime: BigInt(Math.floor(Date.now() / 1000) - 86400 * 1),
    active: false,
    proposer: "0xfeedcafe1234feedcafe1234feedcafe1234feed" as `0x${string}`,
  },
];

const MOCK_QUORUM = 1000n;
const MOCK_VOTING_POWER = 1250n;

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProposalData {
  id: bigint;
  votingProposalId: bigint;
  description: string;
  state: number;
  createdAt: bigint;
  executedAt: bigint;
  forVotes: bigint;
  againstVotes: bigint;
  abstainVotes: bigint;
  endTime: bigint;
  active: boolean;
  proposer: `0x${string}`;
}

type FilterStatus = "all" | "active" | "concluded";

// ── Helper functions ───────────────────────────────────────────────────────────

function formatTokenAmount(amount: bigint, decimals = 18): string {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  if (fraction === 0n) return whole.toLocaleString();
  const frac = fraction.toString().padStart(decimals, "0").slice(0, 2);
  return `${whole.toLocaleString()}.${frac}`;
}

function formatBigIntSimple(n: bigint): string {
  return n.toLocaleString();
}

function timeRemaining(endTime: bigint): string {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (endTime <= now) return "Ended";
  const diff = Number(endTime - now);
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

function getStateConfig(state: number) {
  switch (state) {
    case 0:
      return { label: "Pending", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", icon: Clock };
    case 1:
      return { label: "Active", color: "#667eea", bg: "rgba(102,126,234,0.12)", icon: Vote };
    case 2:
      return { label: "Defeated", color: "#ef4444", bg: "rgba(239,68,68,0.12)", icon: XCircle };
    case 3:
      return { label: "Succeeded", color: "#10b981", bg: "rgba(16,185,129,0.12)", icon: CheckCircle2 };
    case 4:
      return { label: "Executed", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)", icon: Zap };
    case 5:
      return { label: "Cancelled", color: "#6b7280", bg: "rgba(107,114,128,0.12)", icon: XCircle };
    default:
      return { label: "Unknown", color: "#6b7280", bg: "rgba(107,114,128,0.12)", icon: AlertCircle };
  }
}

function calcPercent(part: bigint, total: bigint): number {
  if (total === 0n) return 0;
  return Number((part * 10000n) / total) / 100;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface QuorumBarProps {
  totalVotes: bigint;
  quorum: bigint;
}

function QuorumBar({ totalVotes, quorum }: QuorumBarProps) {
  const pct = quorum === 0n ? 100 : Math.min(100, calcPercent(totalVotes, quorum));
  const met = totalVotes >= quorum;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          Quorum progress
        </span>
        <span
          className="text-xs font-semibold"
          style={{ color: met ? "#10b981" : "#f59e0b" }}
        >
          {formatBigIntSimple(totalVotes)} / {formatBigIntSimple(quorum)}{" "}
          {met ? "✓ Met" : ""}
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: "var(--background)" }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{
            background: met
              ? "linear-gradient(90deg,#10b981,#34d399)"
              : "linear-gradient(90deg,#f59e0b,#fbbf24)",
          }}
        />
      </div>
    </div>
  );
}

interface VoteBarProps {
  label: string;
  votes: bigint;
  total: bigint;
  color: string;
}

function VoteBar({ label, votes, total, color }: VoteBarProps) {
  const pct = calcPercent(votes, total);
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {label}
        </span>
        <span className="text-xs font-bold" style={{ color }}>
          {formatBigIntSimple(votes)} ({pct.toFixed(1)}%)
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full"
        style={{ background: "var(--background)" }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
    </div>
  );
}

// ── Voting Power Card ─────────────────────────────────────────────────────────

interface VotingPowerCardProps {
  address: `0x${string}` | undefined;
  votingPower: bigint;
  tokenBalance: bigint;
  isConnected: boolean;
}

function VotingPowerCard({
  address,
  votingPower,
  tokenBalance,
  isConnected,
}: VotingPowerCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl p-5"
      style={{
        background: "linear-gradient(135deg, rgba(102,126,234,0.15) 0%, rgba(139,92,246,0.15) 100%)",
        border: "1px solid rgba(102,126,234,0.3)",
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Voting Power */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="rounded-lg p-1.5"
              style={{ background: "rgba(102,126,234,0.2)" }}
            >
              <Vote size={14} style={{ color: "#667eea" }} />
            </div>
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              Voting Power
            </span>
          </div>
          <p
            className="text-3xl font-bold"
            style={{ color: "var(--foreground)" }}
          >
            {isConnected ? formatBigIntSimple(votingPower) : "—"}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            {isConnected
              ? "Based on your governance token balance + delegations"
              : "Connect wallet to see your voting power"}
          </p>
        </div>

        {/* Divider */}
        <div
          className="hidden sm:block w-px self-stretch"
          style={{ background: "rgba(102,126,234,0.25)" }}
        />

        {/* Token Balance */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="rounded-lg p-1.5"
              style={{ background: "rgba(139,92,246,0.2)" }}
            >
              <Wallet size={14} style={{ color: "#8b5cf6" }} />
            </div>
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              Token Balance
            </span>
          </div>
          <p
            className="text-3xl font-bold"
            style={{ color: "var(--foreground)" }}
          >
            {isConnected ? formatBigIntSimple(tokenBalance) : "—"}
          </p>
          {isConnected && address && (
            <p
              className="text-xs mt-0.5 font-mono truncate"
              style={{ color: "var(--muted)" }}
            >
              {address.slice(0, 8)}…{address.slice(-6)}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Vote Modal ────────────────────────────────────────────────────────────────

interface VoteModalProps {
  proposal: ProposalData;
  votingPower: bigint;
  userVoteChoice: number;
  isVoting: boolean;
  onVote: (choice: VoteChoiceValue) => void;
  onClose: () => void;
}

function VoteModal({
  proposal,
  votingPower,
  userVoteChoice,
  isVoting,
  onVote,
  onClose,
}: VoteModalProps) {
  const totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
  const stateConf = getStateConfig(proposal.state);
  const hasVoted = userVoteChoice !== VOTE_CHOICE.NONE;
  const canVote = proposal.state === 1 && !hasVoted && votingPower > 0n;

  const voteOptions = [
    { label: "Vote For", choice: VOTE_CHOICE.FOR as VoteChoiceValue, color: "#10b981", bg: "rgba(16,185,129,0.1)", icon: CheckCircle2 },
    { label: "Vote Against", choice: VOTE_CHOICE.AGAINST as VoteChoiceValue, color: "#ef4444", bg: "rgba(239,68,68,0.1)", icon: XCircle },
    { label: "Abstain", choice: VOTE_CHOICE.ABSTAIN as VoteChoiceValue, color: "#6b7280", bg: "rgba(107,114,128,0.1)", icon: Shield },
  ];

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="gov-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <motion.div
        key="gov-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Vote on proposal"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.22 }}
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-2xl overflow-y-auto"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          maxHeight: "90vh",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={{ background: stateConf.bg, color: stateConf.color }}
              >
                {stateConf.label}
              </span>
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                Proposal #{proposal.id.toString()}
              </span>
            </div>
            <h2 className="text-base font-semibold leading-snug" style={{ color: "var(--foreground)" }}>
              {proposal.description}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-opacity hover:opacity-60"
            style={{ color: "var(--muted)" }}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Vote bars */}
        <div className="space-y-2 mb-4">
          <VoteBar label="For" votes={proposal.forVotes} total={totalVotes} color="#10b981" />
          <VoteBar label="Against" votes={proposal.againstVotes} total={totalVotes} color="#ef4444" />
          <VoteBar label="Abstain" votes={proposal.abstainVotes} total={totalVotes} color="#6b7280" />
        </div>

        {/* Metadata */}
        <div
          className="rounded-xl p-3 mb-4 space-y-1.5 text-sm"
          style={{ background: "var(--background)", border: "1px solid var(--border)" }}
        >
          <div className="flex justify-between">
            <span style={{ color: "var(--muted)" }}>Total votes</span>
            <span style={{ color: "var(--foreground)" }}>{formatBigIntSimple(totalVotes)}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: "var(--muted)" }}>Time</span>
            <span style={{ color: "var(--foreground)" }}>{timeRemaining(proposal.endTime)}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: "var(--muted)" }}>Your voting power</span>
            <span
              style={{ color: votingPower > 0n ? "#667eea" : "#ef4444" }}
              className="font-semibold"
            >
              {formatBigIntSimple(votingPower)}
            </span>
          </div>
        </div>

        {/* Already voted */}
        {hasVoted && (
          <div
            className="rounded-xl px-4 py-3 text-sm font-medium text-center mb-4"
            style={{
              background:
                userVoteChoice === VOTE_CHOICE.FOR
                  ? "rgba(16,185,129,0.12)"
                  : userVoteChoice === VOTE_CHOICE.AGAINST
                  ? "rgba(239,68,68,0.12)"
                  : "rgba(107,114,128,0.12)",
              color:
                userVoteChoice === VOTE_CHOICE.FOR
                  ? "#10b981"
                  : userVoteChoice === VOTE_CHOICE.AGAINST
                  ? "#ef4444"
                  : "#9ca3af",
              border: "1px solid currentColor",
            }}
          >
            ✓ You voted{" "}
            {userVoteChoice === VOTE_CHOICE.FOR
              ? "For"
              : userVoteChoice === VOTE_CHOICE.AGAINST
              ? "Against"
              : "Abstain"}
          </div>
        )}

        {/* No voting power warning */}
        {proposal.state === 1 && !hasVoted && votingPower === 0n && (
          <div
            className="rounded-xl px-4 py-3 text-sm mb-4 flex items-center gap-2"
            style={{
              background: "rgba(245,158,11,0.1)",
              border: "1px solid rgba(245,158,11,0.3)",
              color: "#f59e0b",
            }}
          >
            <AlertCircle size={14} />
            You have no voting power. Acquire governance tokens to vote.
          </div>
        )}

        {/* Vote buttons */}
        {canVote && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {voteOptions.map(({ label, choice, color, bg, icon: Icon }) => (
              <button
                key={label}
                id={`vote-btn-${label.toLowerCase().replace(/\s/g, "-")}-${proposal.id}`}
                onClick={() => onVote(choice)}
                disabled={isVoting}
                className="flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-semibold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                style={{ background: bg, color, border: `1px solid ${color}40` }}
              >
                {isVoting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Icon size={16} />
                )}
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Close */}
        <button
          onClick={onClose}
          className="w-full rounded-xl px-4 py-2.5 text-sm font-medium transition-all hover:opacity-80"
          style={{
            background: "var(--background)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
          }}
        >
          Close
        </button>
      </motion.div>
    </>
  );
}

// ── Proposal Card ─────────────────────────────────────────────────────────────

interface ProposalCardProps {
  proposal: ProposalData;
  quorum: bigint;
  index: number;
  onOpen: (p: ProposalData) => void;
}

function ProposalCard({ proposal, quorum, index, onOpen }: ProposalCardProps) {
  const totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
  const stateConf = getStateConfig(proposal.state);
  const StateIcon = stateConf.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      onClick={() => onOpen(proposal)}
      className="group cursor-pointer rounded-2xl p-5 transition-all"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
      }}
      whileHover={{ y: -2, boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs mb-1.5" style={{ color: "var(--muted)" }}>
            Proposal #{proposal.id.toString()}
          </p>
          <h3
            className="font-semibold text-sm leading-snug line-clamp-2"
            style={{ color: "var(--foreground)" }}
          >
            {proposal.description}
          </h3>
        </div>
        <span
          className="shrink-0 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ background: stateConf.bg, color: stateConf.color }}
        >
          <StateIcon size={11} />
          {stateConf.label}
        </span>
      </div>

      {/* Vote bars (compact) */}
      <div className="space-y-1.5 mb-4">
        <VoteBar label="For" votes={proposal.forVotes} total={totalVotes} color="#10b981" />
        <VoteBar label="Against" votes={proposal.againstVotes} total={totalVotes} color="#ef4444" />
      </div>

      {/* Quorum */}
      <QuorumBar totalVotes={totalVotes} quorum={quorum} />

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex items-center gap-1 text-xs" style={{ color: "var(--muted)" }}>
          <Users size={12} />
          <span>{formatBigIntSimple(totalVotes)} votes cast</span>
        </div>
        <div className="flex items-center gap-1 text-xs" style={{ color: "var(--muted)" }}>
          <Clock size={12} />
          <span>{timeRemaining(proposal.endTime)}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main GovernanceUI Component ────────────────────────────────────────────────

export default function GovernanceUI() {
  const { address, isConnected } = useAccount();
  const { success, error: toastError, info } = useToast();

  const [selectedProposal, setSelectedProposal] = useState<ProposalData | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [votingProposalId, setVotingProposalId] = useState<bigint | null>(null);

  // ── Contract reads ──────────────────────────────────────────────────────────

  // Governance quorum
  const { data: quorumData } = useReadContract({
    address: GOVERNANCE_CONTRACT_ADDRESS,
    abi: GOVERNANCE_ABI,
    functionName: "quorum",
  });

  // Governance proposal count
  const { data: proposalCountData } = useReadContract({
    address: GOVERNANCE_CONTRACT_ADDRESS,
    abi: GOVERNANCE_ABI,
    functionName: "proposalCount",
  });

  // Voting power for current user
  const { data: votingPowerData } = useReadContract({
    address: VOTING_CONTRACT_ADDRESS,
    abi: VOTING_ABI,
    functionName: "getVotingPower",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Token balance for current user
  const { data: tokenBalanceData } = useReadContract({
    address: GOVERNANCE_TOKEN_ADDRESS,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // ── Write contract (cast vote) ──────────────────────────────────────────────

  const {
    writeContract,
    data: txHash,
    isPending: isSigning,
    reset: resetWrite,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: voteSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  const isVoting = isSigning || isConfirming;

  // Notify on success
  if (voteSuccess && votingProposalId !== null) {
    success("Vote submitted!", "Your vote has been recorded on-chain.");
    setVotingProposalId(null);
    resetWrite();
  }

  // ── Derived state ───────────────────────────────────────────────────────────

  // Use mock data when contracts are at zero address (not deployed)
  const useMock =
    VOTING_CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000" ||
    GOVERNANCE_CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000";

  const quorum = useMock ? MOCK_QUORUM : (quorumData ?? 0n);
  const votingPower = useMock
    ? MOCK_VOTING_POWER
    : (votingPowerData ?? 0n);
  const tokenBalance = useMock
    ? MOCK_VOTING_POWER
    : (tokenBalanceData ?? 0n);

  // For mock mode, build proposals list directly
  const proposals: ProposalData[] = useMock
    ? MOCK_PROPOSALS
    : [];

  const filteredProposals = useMemo(() => {
    if (filter === "active") return proposals.filter((p) => p.state === 1);
    if (filter === "concluded") return proposals.filter((p) => p.state !== 1 && p.state !== 0);
    return proposals;
  }, [proposals, filter]);

  // ── Vote handler ────────────────────────────────────────────────────────────

  const handleVote = useCallback(
    async (choice: VoteChoiceValue) => {
      if (!selectedProposal) return;
      if (!isConnected) {
        info("Connect wallet", "Please connect your wallet to cast a vote.");
        return;
      }
      if (votingPower === 0n) {
        toastError("No voting power", "You need governance tokens to vote.");
        return;
      }

      if (useMock) {
        success(
          "Vote recorded (demo)",
          `Your ${
            choice === VOTE_CHOICE.FOR
              ? "For"
              : choice === VOTE_CHOICE.AGAINST
              ? "Against"
              : "Abstain"
          } vote has been registered in demo mode.`,
        );
        return;
      }

      try {
        setVotingProposalId(selectedProposal.votingProposalId);
        writeContract({
          address: VOTING_CONTRACT_ADDRESS,
          abi: VOTING_ABI,
          functionName: "castVote",
          args: [selectedProposal.votingProposalId, choice],
        });
      } catch (err) {
        toastError("Vote failed", (err as Error).message ?? "Transaction rejected.");
        setVotingProposalId(null);
      }
    },
    [
      selectedProposal,
      isConnected,
      votingPower,
      useMock,
      writeContract,
      success,
      toastError,
      info,
    ],
  );

  // ── Stats ───────────────────────────────────────────────────────────────────

  const activeCount = proposals.filter((p) => p.state === 1).length;
  const passedCount = proposals.filter((p) => p.state === 3 || p.state === 4).length;
  const defeatedCount = proposals.filter((p) => p.state === 2).length;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Demo banner */}
      {useMock && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl px-4 py-3 text-sm flex items-center gap-2"
          style={{
            background: "rgba(102,126,234,0.08)",
            border: "1px solid rgba(102,126,234,0.25)",
            color: "#667eea",
          }}
        >
          <AlertCircle size={14} />
          <span>
            <strong>Demo mode:</strong> Contract addresses not configured. Showing sample data.
            Set <code>NEXT_PUBLIC_VOTING_CONTRACT_ADDRESS</code>,{" "}
            <code>NEXT_PUBLIC_GOVERNANCE_CONTRACT_ADDRESS</code>, and{" "}
            <code>NEXT_PUBLIC_GOVERNANCE_TOKEN_ADDRESS</code> to use live data.
          </span>
        </motion.div>
      )}

      {/* Voting power card */}
      <VotingPowerCard
        address={address}
        votingPower={votingPower}
        tokenBalance={tokenBalance}
        isConnected={isConnected || useMock}
      />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active", value: activeCount, color: "#667eea", icon: Vote },
          { label: "Passed", value: passedCount, color: "#10b981", icon: CheckCircle2 },
          { label: "Defeated", value: defeatedCount, color: "#ef4444", icon: XCircle },
        ].map(({ label, value, color, icon: Icon }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-4 text-center"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <Icon size={20} className="mx-auto mb-1" style={{ color }} />
            <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
              {value}
            </p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {label}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Filter tabs */}
      <div
        className="flex rounded-xl overflow-hidden text-sm font-medium"
        style={{ border: "1px solid var(--border)", background: "var(--card)" }}
      >
        {(
          [
            { key: "all", label: "All Proposals" },
            { key: "active", label: "Active" },
            { key: "concluded", label: "Concluded" },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            id={`gov-filter-${key}`}
            onClick={() => setFilter(key)}
            className="flex-1 px-4 py-2.5 transition-all"
            style={{
              background: filter === key ? "rgba(102,126,234,0.15)" : "transparent",
              color: filter === key ? "#667eea" : "var(--muted)",
              fontWeight: filter === key ? 600 : 400,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Proposal list */}
      <div className="space-y-4">
        {filteredProposals.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl p-10 text-center"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <BarChart3 size={36} className="mx-auto mb-3" style={{ color: "var(--muted)" }} />
            <p className="font-medium" style={{ color: "var(--foreground)" }}>
              No proposals found
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              {filter === "active"
                ? "There are no active proposals at the moment."
                : "No proposals match the selected filter."}
            </p>
          </motion.div>
        ) : (
          filteredProposals.map((proposal, idx) => (
            <ProposalCard
              key={proposal.id.toString()}
              proposal={proposal}
              quorum={quorum}
              index={idx}
              onOpen={setSelectedProposal}
            />
          ))
        )}
      </div>

      {/* Vote Modal */}
      <AnimatePresence>
        {selectedProposal && (
          <VoteModal
            proposal={selectedProposal}
            votingPower={votingPower}
            userVoteChoice={VOTE_CHOICE.NONE}
            isVoting={isVoting}
            onVote={handleVote}
            onClose={() => {
              setSelectedProposal(null);
              resetWrite();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
