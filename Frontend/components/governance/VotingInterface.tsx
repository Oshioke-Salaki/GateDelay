"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/useToast";

interface Proposal {
  id: string;
  title: string;
  description: string;
  status: "active" | "passed" | "failed" | "pending";
  votesFor: number;
  votesAgainst: number;
  totalVotes: number;
  quorumRequired: number;
  endTime: Date;
  userVote?: "for" | "against" | null;
  votingPower: number;
}

interface VotingInterfaceProps {
  proposals?: Proposal[];
  userVotingPower?: number;
  onVote?: (proposalId: string, vote: "for" | "against") => Promise<void>;
}

export default function VotingInterface({
  proposals = [],
  userVotingPower = 1000,
  onVote,
}: VotingInterfaceProps) {
  const { success, error } = useToast();
  const [voting, setVoting] = useState<string | null>(null);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);

  const handleVote = useCallback(
    async (proposalId: string, vote: "for" | "against") => {
      if (!onVote) {
        success("Vote recorded", `Your vote for "${vote}" has been recorded`);
        return;
      }

      setVoting(proposalId);
      try {
        await onVote(proposalId, vote);
        success("Vote submitted", "Your vote has been submitted successfully");
      } catch (err) {
        error("Vote failed", (err as Error).message || "Could not submit vote");
      } finally {
        setVoting(null);
      }
    },
    [onVote, success, error],
  );

  const getProposalStatus = (proposal: Proposal) => {
    const quorumMet = proposal.totalVotes >= proposal.quorumRequired;
    const passed = proposal.votesFor > proposal.votesAgainst;

    if (proposal.status === "active") return "Active";
    if (proposal.status === "pending") return "Pending";
    if (proposal.status === "passed") return "Passed";
    if (proposal.status === "failed") return "Failed";
    return "Unknown";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "#667eea";
      case "Passed":
        return "#10b981";
      case "Failed":
        return "#ef4444";
      case "Pending":
        return "#f59e0b";
      default:
        return "#6b7280";
    }
  };

  const calculateVotePercentage = (votes: number, total: number) => {
    return total > 0 ? ((votes / total) * 100).toFixed(1) : "0";
  };

  return (
    <div className="space-y-6">
      {/* Voting Power Display */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-lg p-4"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Your Voting Power
            </p>
            <p className="mt-1 text-2xl font-bold" style={{ color: "var(--foreground)" }}>
              {userVotingPower.toLocaleString()}
            </p>
          </div>
          <div
            className="rounded-full p-3"
            style={{
              background: "rgba(102, 126, 234, 0.1)",
            }}
          >
            <CheckCircle2 size={24} style={{ color: "#667eea" }} />
          </div>
        </div>
      </motion.div>

      {/* Proposals List */}
      <div className="space-y-4">
        {proposals.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-lg p-8 text-center"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
            <AlertCircle
              size={32}
              className="mx-auto mb-3"
              style={{ color: "var(--muted)" }}
            />
            <p style={{ color: "var(--muted)" }}>No active proposals at the moment</p>
          </motion.div>
        ) : (
          proposals.map((proposal, idx) => {
            const status = getProposalStatus(proposal);
            const forPercentage = calculateVotePercentage(proposal.votesFor, proposal.totalVotes);
            const againstPercentage = calculateVotePercentage(
              proposal.votesAgainst,
              proposal.totalVotes,
            );
            const quorumMet = proposal.totalVotes >= proposal.quorumRequired;

            return (
              <motion.div
                key={proposal.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className="cursor-pointer rounded-lg p-5 transition-all hover:opacity-90"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                }}
                onClick={() => setSelectedProposal(proposal)}
              >
                {/* Header */}
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>
                      {proposal.title}
                    </h3>
                    <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                      {proposal.description}
                    </p>
                  </div>
                  <span
                    className="ml-3 shrink-0 rounded-full px-3 py-1 text-xs font-medium"
                    style={{
                      background: `${getStatusColor(status)}20`,
                      color: getStatusColor(status),
                    }}
                  >
                    {status}
                  </span>
                </div>

                {/* Vote Bars */}
                <div className="mb-4 space-y-2">
                  {/* For */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                        For
                      </span>
                      <span className="text-xs font-bold" style={{ color: "#10b981" }}>
                        {proposal.votesFor} ({forPercentage}%)
                      </span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full"
                      style={{ background: "var(--background)" }}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${forPercentage}%` }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="h-full"
                        style={{ background: "#10b981" }}
                      />
                    </div>
                  </div>

                  {/* Against */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                        Against
                      </span>
                      <span className="text-xs font-bold" style={{ color: "#ef4444" }}>
                        {proposal.votesAgainst} ({againstPercentage}%)
                      </span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full"
                      style={{ background: "var(--background)" }}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${againstPercentage}%` }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="h-full"
                        style={{ background: "#ef4444" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Quorum Info */}
                <div className="mb-4 flex items-center justify-between text-xs">
                  <span style={{ color: "var(--muted)" }}>
                    Total Votes: {proposal.totalVotes} / {proposal.quorumRequired}
                  </span>
                  <span
                    style={{
                      color: quorumMet ? "#10b981" : "#ef4444",
                    }}
                  >
                    {quorumMet ? "✓ Quorum met" : "✗ Quorum not met"}
                  </span>
                </div>

                {/* Vote Buttons */}
                {proposal.status === "active" && !proposal.userVote && (
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVote(proposal.id, "for");
                      }}
                      disabled={voting === proposal.id}
                      className="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                      style={{
                        background: "#10b981",
                        color: "white",
                      }}
                    >
                      {voting === proposal.id ? "Voting..." : "Vote For"}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVote(proposal.id, "against");
                      }}
                      disabled={voting === proposal.id}
                      className="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                      style={{
                        background: "#ef4444",
                        color: "white",
                      }}
                    >
                      {voting === proposal.id ? "Voting..." : "Vote Against"}
                    </button>
                  </div>
                )}

                {proposal.userVote && (
                  <div
                    className="rounded-lg px-3 py-2 text-center text-sm font-medium"
                    style={{
                      background:
                        proposal.userVote === "for"
                          ? "rgba(16, 185, 129, 0.1)"
                          : "rgba(239, 68, 68, 0.1)",
                      color: proposal.userVote === "for" ? "#10b981" : "#ef4444",
                    }}
                  >
                    ✓ You voted {proposal.userVote === "for" ? "For" : "Against"}
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* Proposal Detail Modal */}
      <AnimatePresence>
        {selectedProposal && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setSelectedProposal(null)}
              aria-hidden="true"
            />

            <motion.div
              key="modal"
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.2 }}
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-2xl"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="mb-4 flex items-start justify-between">
                <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                  {selectedProposal.title}
                </h2>
                <button
                  onClick={() => setSelectedProposal(null)}
                  className="rounded-lg p-1 transition-colors hover:opacity-70"
                  style={{ color: "var(--muted)" }}
                >
                  ✕
                </button>
              </div>

              <p className="mb-4 text-sm" style={{ color: "var(--muted)" }}>
                {selectedProposal.description}
              </p>

              <div className="mb-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: "var(--muted)" }}>Status:</span>
                  <span style={{ color: "var(--foreground)" }}>
                    {getProposalStatus(selectedProposal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--muted)" }}>Total Votes:</span>
                  <span style={{ color: "var(--foreground)" }}>
                    {selectedProposal.totalVotes} / {selectedProposal.quorumRequired}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--muted)" }}>Ends:</span>
                  <span style={{ color: "var(--foreground)" }}>
                    {selectedProposal.endTime.toLocaleDateString()}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedProposal(null)}
                className="w-full rounded-lg px-4 py-2 font-medium transition-all hover:opacity-90"
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
        )}
      </AnimatePresence>
    </div>
  );
}
