"use client";

import {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
  useId,
} from "react";
import { Search, ChevronDown, CheckCircle, AlertCircle } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Default token list ────────────────────────────────────────────────────────

const DEFAULT_TOKENS: Token[] = [
  { address: "0x1234567890123456789012345678901234567890", symbol: "USDC",    name: "USD Coin",        decimals: 6,  balance: 5000,  allowance: 1000, icon: "💵" },
  { address: "0x0987654321098765432109876543210987654321", symbol: "USDT",    name: "Tether USD",      decimals: 6,  balance: 3500,  allowance: 0,    icon: "💴" },
  { address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd", symbol: "DAI",     name: "Dai Stablecoin",  decimals: 18, balance: 2000,  allowance: 2000, icon: "🔴" },
  { address: "0xfedcbafedcbafedcbafedcbafedcbafedcbafed", symbol: "STELLAR", name: "Stellar Lumens",  decimals: 7,  balance: 10000, allowance: 5000, icon: "⭐" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function TokenSelector({
  tokens        = DEFAULT_TOKENS,
  selectedToken = DEFAULT_TOKENS[0],
  onSelectToken,
  onApprove,
  isApproving   = false,
}: TokenSelectorProps) {
  const [isOpen, setIsOpen]             = useState(false);
  const [searchTerm, setSearchTerm]     = useState("");
  const [approvalAmount, setApprovalAmount] = useState<number | null>(null);
  const [activeIndex, setActiveIndex]   = useState(-1);

  const uid         = useId();
  const listboxId   = `${uid}-listbox`;
  const triggerId   = `${uid}-trigger`;

  const triggerRef  = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef   = useRef<HTMLInputElement>(null);
  const listRef     = useRef<HTMLDivElement>(null);

  // Focus trap while dropdown is open
  useFocusTrap(dropdownRef, isOpen);

  const filtered = useMemo(
    () =>
      tokens.filter(
        (t) =>
          t.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.name.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [tokens, searchTerm],
  );

  const needsApproval = selectedToken && selectedToken.allowance < 1000;

  // ── Open / close helpers ──────────────────────────────────────────────────

  const open = () => {
    setIsOpen(true);
    setActiveIndex(-1);
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  const close = useCallback(() => {
    setIsOpen(false);
    setSearchTerm("");
    setActiveIndex(-1);
    triggerRef.current?.focus();
  }, []);

  // ── Escape to close ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); close(); }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [isOpen, close]);

  // ── Click outside to close ────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current  && !triggerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, close]);

  // ── Arrow-key navigation ──────────────────────────────────────────────────

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((i) => {
            if (i <= 0) { searchRef.current?.focus(); return -1; }
            return i - 1;
          });
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < filtered.length) {
            onSelectToken?.(filtered[activeIndex]);
            close();
          }
          break;
      }
    },
    [activeIndex, filtered, onSelectToken, close],
  );

  // Keep DOM focus in sync with activeIndex
  useEffect(() => {
    if (!listRef.current || activeIndex < 0) return;
    const items = listRef.current.querySelectorAll<HTMLElement>("[data-option]");
    items[activeIndex]?.focus();
  }, [activeIndex]);

  // Reset cursor when results change
  useEffect(() => { setActiveIndex(-1); }, [filtered.length]);

  // ── Approval ─────────────────────────────────────────────────────────────

  const handleApprove = async () => {
    if (!selectedToken || !approvalAmount || !onApprove) return;
    try {
      await onApprove(selectedToken, approvalAmount);
      setApprovalAmount(null);
    } catch (err) {
      console.error("Approval failed:", err);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Trigger button */}
      <div className="relative">
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          onClick={() => (isOpen ? close() : open())}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-label={
            selectedToken
              ? `Selected token: ${selectedToken.name}. Click to change.`
              : "Select a token"
          }
          className="w-full rounded-lg p-4 flex items-center justify-between transition-colors"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          }}
        >
          <div className="flex items-center gap-3">
            {selectedToken?.icon && (
              <span className="text-2xl" aria-hidden="true">{selectedToken.icon}</span>
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
            aria-hidden="true"
          />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div
            ref={dropdownRef}
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
                  aria-hidden="true"
                />
                <input
                  ref={searchRef}
                  type="text"
                  role="combobox"
                  aria-label="Search tokens"
                  aria-autocomplete="list"
                  aria-controls={listboxId}
                  aria-expanded="true"
                  placeholder="Search tokens…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setActiveIndex(0);
                    }
                  }}
                  className="w-full pl-10 pr-4 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    background: "var(--background)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              </div>
            </div>

            {/* List */}
            <div
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-label="Select token"
              aria-activedescendant={
                activeIndex >= 0 ? `${uid}-opt-${filtered[activeIndex]?.address}` : undefined
              }
              onKeyDown={handleListKeyDown}
              className="max-h-64 overflow-y-auto"
            >
              {filtered.length === 0 ? (
                <div className="p-4 text-center text-sm" style={{ color: "var(--muted)" }}>
                  No tokens found
                </div>
              ) : (
                filtered.map((token, idx) => {
                  const isSelected = selectedToken?.address === token.address;
                  const isActive   = idx === activeIndex;
                  return (
                    <button
                      key={token.address}
                      id={`${uid}-opt-${token.address}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-option=""
                      tabIndex={isActive ? 0 : -1}
                      onClick={() => { onSelectToken?.(token); close(); }}
                      className="w-full px-4 py-3 flex items-center justify-between transition-opacity border-b last:border-b-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                      style={{
                        background: isActive
                          ? "rgba(59,130,246,0.08)"
                          : isSelected
                          ? "var(--background)"
                          : "transparent",
                        borderColor: "var(--border)",
                        color: "var(--foreground)",
                      }}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {token.icon && (
                          <span className="text-xl" aria-hidden="true">{token.icon}</span>
                        )}
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
                  );
                })
              )}
            </div>

            {/* Close hint */}
            <div
              className="border-t px-3 py-2 text-xs text-center"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}
            >
              Press{" "}
              <kbd
                className="rounded px-1 py-0.5 font-mono text-[10px]"
                style={{ background: "var(--background)", border: "1px solid var(--border)" }}
              >
                Esc
              </kbd>{" "}
              to close
            </div>
          </div>
        )}
      </div>

      {/* Selected token info */}
      {selectedToken && (
        <div
          className="rounded-lg p-4 space-y-3"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs" style={{ color: "var(--muted)" }}>Balance</p>
              <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                {selectedToken.balance.toLocaleString()}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                {selectedToken.symbol}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--muted)" }}>Allowance</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                  {selectedToken.allowance.toLocaleString()}
                </p>
                {selectedToken.allowance > 0 ? (
                  <CheckCircle size={16} style={{ color: "#22c55e" }} aria-label="Sufficient allowance" />
                ) : (
                  <AlertCircle size={16} style={{ color: "#ef4444" }} aria-label="No allowance set" />
                )}
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                {selectedToken.symbol}
              </p>
            </div>
          </div>

          {/* Approval section */}
          {needsApproval && (
            <div
              className="rounded p-3"
              style={{ background: "#ef444420", border: "1px solid #ef4444" }}
            >
              <p className="text-xs font-semibold mb-3" style={{ color: "#ef4444" }}>
                Token Approval Required
              </p>
              <div className="space-y-2">
                <div>
                  <label
                    htmlFor={`${uid}-approval-amount`}
                    className="text-xs"
                    style={{ color: "var(--muted)" }}
                  >
                    Approval Amount
                  </label>
                  <input
                    id={`${uid}-approval-amount`}
                    type="number"
                    value={approvalAmount ?? ""}
                    onChange={(e) =>
                      setApprovalAmount(e.target.value ? parseFloat(e.target.value) : null)
                    }
                    placeholder="Enter amount"
                    className="w-full mt-1 px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    style={{
                      background: "var(--background)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={!approvalAmount || isApproving}
                  className="w-full px-4 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
                  style={{ background: "#ef4444", color: "white" }}
                  aria-label={`Approve ${selectedToken.symbol} for spending`}
                >
                  {isApproving ? "Approving…" : "Approve Token"}
                </button>
              </div>
            </div>
          )}

          {/* Contract address */}
          <div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>Contract Address</p>
            <p className="text-xs font-mono mt-1 break-all" style={{ color: "var(--foreground)" }}>
              {selectedToken.address}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
