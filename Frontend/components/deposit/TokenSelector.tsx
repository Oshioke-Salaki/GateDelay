"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Check, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/useToast";

interface Token {
  id: string;
  symbol: string;
  name: string;
  icon: string;
  balance: number;
  decimals: number;
  approved?: boolean;
  approvalAmount?: number;
}

interface TokenSelectorProps {
  tokens?: Token[];
  selectedToken?: Token | null;
  onSelect?: (token: Token) => void;
  onApprove?: (tokenId: string) => Promise<void>;
  showBalance?: boolean;
}

export default function TokenSelector({
  tokens = [
    {
      id: "usdc",
      symbol: "USDC",
      name: "USD Coin",
      icon: "💵",
      balance: 5000,
      decimals: 6,
      approved: true,
    },
    {
      id: "usdt",
      symbol: "USDT",
      name: "Tether",
      icon: "🔗",
      balance: 2500,
      decimals: 6,
      approved: false,
    },
    {
      id: "eth",
      symbol: "ETH",
      name: "Ethereum",
      icon: "Ξ",
      balance: 1.5,
      decimals: 18,
      approved: true,
    },
    {
      id: "dai",
      symbol: "DAI",
      name: "Dai Stablecoin",
      icon: "◆",
      balance: 3200,
      decimals: 18,
      approved: false,
    },
  ],
  selectedToken = null,
  onSelect,
  onApprove,
  showBalance = true,
}: TokenSelectorProps) {
  const { success, error } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);

  const filteredTokens = useMemo(() => {
    return tokens.filter(
      (token) =>
        token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [tokens, searchQuery]);

  const handleSelectToken = useCallback(
    (token: Token) => {
      if (onSelect) {
        onSelect(token);
      }
      setIsOpen(false);
      setSearchQuery("");
    },
    [onSelect],
  );

  const handleApprove = useCallback(
    async (e: React.MouseEvent, tokenId: string) => {
      e.stopPropagation();

      if (!onApprove) {
        success("Approved", "Token approval confirmed");
        return;
      }

      setApproving(tokenId);
      try {
        await onApprove(tokenId);
        success("Approved", "Token has been approved for trading");
      } catch (err) {
        error("Approval failed", (err as Error).message || "Could not approve token");
      } finally {
        setApproving(null);
      }
    },
    [onApprove, success, error],
  );

  const formatBalance = (balance: number, decimals: number) => {
    if (balance === 0) return "0";
    if (balance < 0.0001) return "< 0.0001";
    return balance.toFixed(Math.min(4, decimals));
  };

  return (
    <div className="space-y-4">
      {/* Token Selector Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full rounded-lg p-4 text-left transition-all hover:opacity-90"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {selectedToken ? (
                <>
                  <span className="text-2xl">{selectedToken.icon}</span>
                  <div>
                    <p className="font-semibold" style={{ color: "var(--foreground)" }}>
                      {selectedToken.symbol}
                    </p>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>
                      {selectedToken.name}
                    </p>
                  </div>
                </>
              ) : (
                <div>
                  <p className="font-semibold" style={{ color: "var(--foreground)" }}>
                    Select Token
                  </p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    Choose a token to deposit
                  </p>
                </div>
              )}
            </div>
            <svg
              className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ color: "var(--muted)" }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {selectedToken && showBalance && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <span style={{ color: "var(--muted)" }}>Balance:</span>
              <span className="font-semibold" style={{ color: "var(--foreground)" }}>
                {formatBalance(selectedToken.balance, selectedToken.decimals)} {selectedToken.symbol}
              </span>
            </div>
          )}
        </button>
      </motion.div>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute left-0 right-0 z-50 mt-2 rounded-lg shadow-lg"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
            {/* Search Input */}
            <div className="border-b p-3" style={{ borderColor: "var(--border)" }}>
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--muted)" }}
                />
                <input
                  type="text"
                  placeholder="Search tokens..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border bg-transparent py-2 pl-9 pr-3 text-sm transition-colors focus:outline-none focus:ring-2"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                    "--tw-ring-color": "#667eea",
                  } as React.CSSProperties}
                  autoFocus
                />
              </div>
            </div>

            {/* Token List */}
            <div className="max-h-64 overflow-y-auto">
              {filteredTokens.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
                  <AlertCircle size={24} style={{ color: "var(--muted)" }} />
                  <p style={{ color: "var(--muted)" }}>No tokens found</p>
                </div>
              ) : (
                <ul className="space-y-1 p-2" role="listbox">
                  {filteredTokens.map((token) => (
                    <li key={token.id}>
                      <button
                        onClick={() => handleSelectToken(token)}
                        className="w-full rounded-lg px-3 py-3 text-left transition-all hover:opacity-80 active:scale-95"
                        style={{
                          background:
                            selectedToken?.id === token.id
                              ? "rgba(102, 126, 234, 0.1)"
                              : "transparent",
                        }}
                        role="option"
                        aria-selected={selectedToken?.id === token.id}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{token.icon}</span>
                            <div>
                              <p
                                className="font-semibold"
                                style={{ color: "var(--foreground)" }}
                              >
                                {token.symbol}
                              </p>
                              <p className="text-xs" style={{ color: "var(--muted)" }}>
                                {token.name}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {showBalance && (
                              <div className="text-right">
                                <p
                                  className="text-sm font-semibold"
                                  style={{ color: "var(--foreground)" }}
                                >
                                  {formatBalance(token.balance, token.decimals)}
                                </p>
                                <p className="text-xs" style={{ color: "var(--muted)" }}>
                                  {token.symbol}
                                </p>
                              </div>
                            )}

                            {selectedToken?.id === token.id && (
                              <Check
                                size={20}
                                style={{ color: "#667eea", flexShrink: 0 }}
                              />
                            )}
                          </div>
                        </div>

                        {/* Approval Status */}
                        {!token.approved && (
                          <motion.button
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            onClick={(e) => handleApprove(e, token.id)}
                            disabled={approving === token.id}
                            className="mt-2 w-full rounded-lg px-2 py-1.5 text-xs font-medium transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                            style={{
                              background: "rgba(239, 68, 68, 0.1)",
                              color: "#ef4444",
                            }}
                          >
                            {approving === token.id ? "Approving..." : "Approve Token"}
                          </motion.button>
                        )}

                        {token.approved && (
                          <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: "#10b981" }}>
                            <Check size={14} />
                            <span>Approved</span>
                          </div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected Token Info */}
      {selectedToken && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-lg p-4"
          style={{
            background: "var(--background)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span style={{ color: "var(--muted)" }}>Token:</span>
              <span style={{ color: "var(--foreground)" }}>{selectedToken.name}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: "var(--muted)" }}>Symbol:</span>
              <span className="font-mono" style={{ color: "var(--foreground)" }}>
                {selectedToken.symbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: "var(--muted)" }}>Available Balance:</span>
              <span className="font-semibold" style={{ color: "var(--foreground)" }}>
                {formatBalance(selectedToken.balance, selectedToken.decimals)} {selectedToken.symbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: "var(--muted)" }}>Status:</span>
              <span
                style={{
                  color: selectedToken.approved ? "#10b981" : "#ef4444",
                }}
              >
                {selectedToken.approved ? "✓ Approved" : "✗ Not Approved"}
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
