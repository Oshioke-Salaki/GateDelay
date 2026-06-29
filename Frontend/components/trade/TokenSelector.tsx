"use client";
import { useState, useMemo } from "react";
import { Search, ChevronDown, CheckCircle, AlertCircle } from "lucide-react";

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: number;
  allowance: number;
  icon?: string;
}

interface TokenSelectorProps {
  tokens?: Token[];
  selectedToken?: Token;
  onSelectToken?: (token: Token) => void;
  onApprove?: (token: Token, amount: number) => Promise<void>;
  isApproving?: boolean;
}

export default function TokenSelector({
  tokens = [
    {
      address: "0x1234567890123456789012345678901234567890",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      balance: 5000,
      allowance: 1000,
      icon: "💵",
    },
    {
      address: "0x0987654321098765432109876543210987654321",
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
      balance: 3500,
      allowance: 0,
      icon: "💴",
    },
    {
      address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      symbol: "DAI",
      name: "Dai Stablecoin",
      decimals: 18,
      balance: 2000,
      allowance: 2000,
      icon: "🔴",
    },
    {
      address: "0xfedcbafedcbafedcbafedcbafedcbafedcbafed",
      symbol: "STELLAR",
      name: "Stellar Lumens",
      decimals: 7,
      balance: 10000,
      allowance: 5000,
      icon: "⭐",
    },
  ],
  selectedToken = tokens[0],
  onSelectToken,
  onApprove,
  isApproving = false,
}: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [approvalAmount, setApprovalAmount] = useState<number | null>(null);

  const filtered = useMemo(() => {
    return tokens.filter(
      (token) =>
        token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        token.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [tokens, searchTerm]);

  const handleApprove = async () => {
    if (!selectedToken || !approvalAmount || !onApprove) return;
    try {
      await onApprove(selectedToken, approvalAmount);
      setApprovalAmount(null);
    } catch (error) {
      console.error("Approval failed:", error);
    }
  };

  const needsApproval = selectedToken && selectedToken.allowance < 1000;

  return (
    <div className="space-y-4">
      {/* Token Selector Dropdown */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full rounded-lg p-4 flex items-center justify-between transition-colors"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          }}
        >
          <div className="flex items-center gap-3">
            {selectedToken?.icon && (
              <span className="text-2xl">{selectedToken.icon}</span>
            )}
            <div className="text-left">
              <p className="font-semibold text-sm">{selectedToken?.symbol}</p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {selectedToken?.name}
              </p>
            </div>
          </div>
          <ChevronDown
            size={20}
            style={{
              color: "var(--muted)",
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
            }}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div
            className="absolute top-full left-0 right-0 mt-2 rounded-lg shadow-lg z-10 overflow-hidden"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            {/* Search */}
            <div className="p-3 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--muted)" }}
                />
                <input
                  type="text"
                  placeholder="Search tokens..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded text-sm"
                  style={{
                    background: "var(--background)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              </div>
            </div>

            {/* Token List */}
            <div className="max-h-64 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="p-4 text-center text-sm" style={{ color: "var(--muted)" }}>
                  No tokens found
                </div>
              ) : (
                filtered.map((token) => (
                  <button
                    key={token.address}
                    onClick={() => {
                      onSelectToken?.(token);
                      setIsOpen(false);
                      setSearchTerm("");
                    }}
                    className="w-full px-4 py-3 flex items-center justify-between hover:opacity-80 transition-opacity border-b last:border-b-0"
                    style={{
                      background:
                        selectedToken?.address === token.address
                          ? "var(--background)"
                          : "transparent",
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                    }}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {token.icon && <span className="text-xl">{token.icon}</span>}
                      <div className="text-left">
                        <p className="font-semibold text-sm">{token.symbol}</p>
                        <p className="text-xs" style={{ color: "var(--muted)" }}>
                          {token.name}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">
                        {token.balance.toLocaleString()}
                      </p>
                      <p className="text-xs" style={{ color: "var(--muted)" }}>
                        {token.symbol}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Token Info */}
      {selectedToken && (
        <div
          className="rounded-lg p-4 space-y-3"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Balance
              </p>
              <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                {selectedToken.balance.toLocaleString()}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                {selectedToken.symbol}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Allowance
              </p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                  {selectedToken.allowance.toLocaleString()}
                </p>
                {selectedToken.allowance > 0 ? (
                  <CheckCircle size={16} style={{ color: "#22c55e" }} />
                ) : (
                  <AlertCircle size={16} style={{ color: "#ef4444" }} />
                )}
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                {selectedToken.symbol}
              </p>
            </div>
          </div>

          {/* Approval Section */}
          {needsApproval && (
            <div
              className="rounded p-3"
              style={{
                background: "#ef444420",
                border: "1px solid #ef4444",
              }}
            >
              <p className="text-xs font-semibold mb-3" style={{ color: "#ef4444" }}>
                Token Approval Required
              </p>
              <div className="space-y-2">
                <div>
                  <label className="text-xs" style={{ color: "var(--muted)" }}>
                    Approval Amount
                  </label>
                  <input
                    type="number"
                    value={approvalAmount ?? ""}
                    onChange={(e) =>
                      setApprovalAmount(
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    placeholder="Enter amount"
                    className="w-full mt-1 px-3 py-2 rounded text-sm"
                    style={{
                      background: "var(--background)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>
                <button
                  onClick={handleApprove}
                  disabled={!approvalAmount || isApproving}
                  className="w-full px-4 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
                  style={{
                    background: "#ef4444",
                    color: "white",
                  }}
                >
                  {isApproving ? "Approving..." : "Approve Token"}
                </button>
              </div>
            </div>
          )}

          {/* Token Address */}
          <div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Contract Address
            </p>
            <p
              className="text-xs font-mono mt-1 break-all"
              style={{ color: "var(--foreground)" }}
            >
              {selectedToken.address}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
