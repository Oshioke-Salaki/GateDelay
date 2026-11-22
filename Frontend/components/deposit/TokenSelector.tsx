"use client";

import {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  useId,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Check, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { useFocusTrap } from "@/hooks/useFocusTrap";

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Default token list ────────────────────────────────────────────────────────

const DEFAULT_TOKENS: Token[] = [
  { id: "usdc",  symbol: "USDC", name: "USD Coin",        icon: "💵", balance: 5000, decimals: 6,  approved: true  },
  { id: "usdt",  symbol: "USDT", name: "Tether",          icon: "🔗", balance: 2500, decimals: 6,  approved: false },
  { id: "eth",   symbol: "ETH",  name: "Ethereum",        icon: "Ξ",  balance: 1.5,  decimals: 18, approved: true  },
  { id: "dai",   symbol: "DAI",  name: "Dai Stablecoin",  icon: "◆", balance: 3200, decimals: 18, approved: false },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function TokenSelector({
  tokens = DEFAULT_TOKENS,
  selectedToken = null,
  onSelect,
  onApprove,
  showBalance = true,
}: TokenSelectorProps) {
  const { success, error } = useToast();
  const [searchQuery, setSearchQuery]   = useState("");
  const [isOpen, setIsOpen]             = useState(false);
  const [approving, setApproving]       = useState<string | null>(null);
  const [activeIndex, setActiveIndex]   = useState(-1); // keyboard cursor

  const uid           = useId();
  const listboxId     = `${uid}-listbox`;
  const triggerId     = `${uid}-trigger`;
  const searchId      = `${uid}-search`;

  // Refs for focus management
  const triggerRef    = useRef<HTMLButtonElement>(null);
  const dropdownRef   = useRef<HTMLDivElement>(null);
  const searchRef     = useRef<HTMLInputElement>(null);
  const listRef       = useRef<HTMLUListElement>(null);

  // Focus trap active while dropdown is open
  useFocusTrap(dropdownRef, isOpen);

  const filteredTokens = useMemo(
    () =>
      tokens.filter(
        (t) =>
          t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.name.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [tokens, searchQuery],
  );

  // ── Open / close helpers ──────────────────────────────────────────────────

  const open = () => {
    setIsOpen(true);
    setActiveIndex(-1);
    // Let the dropdown mount, then focus the search input
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  const close = useCallback(() => {
    setIsOpen(false);
    setSearchQuery("");
    setActiveIndex(-1);
    // Restore focus to the trigger button
    triggerRef.current?.focus();
  }, []);

  // ── Keyboard: Escape to close from anywhere on the page ──────────────────

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

  // ── Arrow-key navigation inside the list ─────────────────────────────────

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filteredTokens.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => {
          const next = Math.max(i - 1, 0);
          // If we go above index 0, send focus back to the search box
          if (i === 0) { searchRef.current?.focus(); return -1; }
          return next;
        });
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filteredTokens.length) {
          handleSelectToken(filteredTokens[activeIndex]);
        }
        break;
      case "Tab":
        // Allow Tab to fall through naturally (focus trap handles wrapping)
        break;
    }
  };

  // Keep DOM focus in sync with activeIndex
  useEffect(() => {
    if (!listRef.current || activeIndex < 0) return;
    const items = listRef.current.querySelectorAll<HTMLElement>('[role="option"]');
    items[activeIndex]?.focus();
  }, [activeIndex]);

  // When search results change, reset cursor
  useEffect(() => { setActiveIndex(-1); }, [filteredTokens.length]);

  // ── Token selection ───────────────────────────────────────────────────────

  const handleSelectToken = useCallback(
    (token: Token) => {
      onSelect?.(token);
      close();
    },
    [onSelect, close],
  );

  // ── Approval ─────────────────────────────────────────────────────────────

  const handleApprove = useCallback(
    async (e: React.MouseEvent, tokenId: string) => {
      e.stopPropagation();
      if (!onApprove) { success("Approved", "Token approval confirmed"); return; }
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Trigger button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
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
          className="w-full rounded-lg p-4 text-left transition-all hover:opacity-90"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {selectedToken ? (
                <>
                  <span className="text-2xl" aria-hidden="true">{selectedToken.icon}</span>
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
              width="20" height="20" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2"
              style={{ color: "var(--muted)" }}
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {selectedToken && showBalance && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <span style={{ color: "var(--muted)" }}>Balance:</span>
              <span className="font-semibold" style={{ color: "var(--foreground)" }}>
                {formatBalance(selectedToken.balance, selectedToken.decimals)}{" "}
                {selectedToken.symbol}
              </span>
            </div>
          )}
        </button>
      </motion.div>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={dropdownRef}
            key="dropdown"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute left-0 right-0 z-50 mt-2 rounded-lg shadow-lg"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            {/* Search */}
            <div className="border-b p-3" style={{ borderColor: "var(--border)" }}>
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--muted)" }}
                  aria-hidden="true"
                />
                <input
                  ref={searchRef}
                  id={searchId}
                  type="text"
                  role="combobox"
                  aria-label="Search tokens"
                  aria-autocomplete="list"
                  aria-controls={listboxId}
                  aria-expanded={isOpen}
                  placeholder="Search tokens…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setActiveIndex(0);
                    }
                  }}
                  className="w-full rounded-lg border bg-transparent py-2 pl-9 pr-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                />
              </div>
            </div>

            {/* Token list */}
            <ul
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-label="Available tokens"
              aria-activedescendant={
                activeIndex >= 0 ? `${uid}-option-${filteredTokens[activeIndex]?.id}` : undefined
              }
              onKeyDown={handleListKeyDown}
              className="max-h-64 overflow-y-auto"
            >
              {filteredTokens.length === 0 ? (
                <li className="flex flex-col items-center justify-center gap-2 p-6 text-center">
                  <AlertCircle size={24} style={{ color: "var(--muted)" }} aria-hidden="true" />
                  <p style={{ color: "var(--muted)" }}>No tokens found</p>
                </li>
              ) : (
                filteredTokens.map((token, idx) => {
                  const isSelected = selectedToken?.id === token.id;
                  const isActive   = idx === activeIndex;
                  return (
                    <li key={token.id} className="p-2">
                      <button
                        id={`${uid}-option-${token.id}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        tabIndex={isActive ? 0 : -1}
                        onClick={() => handleSelectToken(token)}
                        className="w-full rounded-lg px-3 py-3 text-left transition-all hover:opacity-80 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        style={{
                          background: isActive
                            ? "rgba(59,130,246,0.08)"
                            : isSelected
                            ? "rgba(102,126,234,0.1)"
                            : "transparent",
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-xl" aria-hidden="true">{token.icon}</span>
                            <div>
                              <p className="font-semibold" style={{ color: "var(--foreground)" }}>
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
                                <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                                  {formatBalance(token.balance, token.decimals)}
                                </p>
                                <p className="text-xs" style={{ color: "var(--muted)" }}>
                                  {token.symbol}
                                </p>
                              </div>
                            )}
                            {isSelected && (
                              <Check size={20} style={{ color: "#667eea", flexShrink: 0 }} aria-hidden="true" />
                            )}
                          </div>
                        </div>

                        {/* Approval status */}
                        {!token.approved && (
                          <motion.button
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            type="button"
                            onClick={(e) => handleApprove(e, token.id)}
                            disabled={approving === token.id}
                            aria-label={`Approve ${token.symbol} for trading`}
                            className="mt-2 w-full rounded-lg px-2 py-1.5 text-xs font-medium transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                            style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}
                          >
                            {approving === token.id ? "Approving…" : "Approve Token"}
                          </motion.button>
                        )}

                        {token.approved && (
                          <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: "#10b981" }}>
                            <Check size={14} aria-hidden="true" />
                            <span>Approved</span>
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>

            {/* Close hint */}
            <div
              className="border-t px-3 py-2 text-xs text-center"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}
            >
              Press <kbd className="rounded px-1 py-0.5 font-mono text-[10px]"
                style={{ background: "var(--background)", border: "1px solid var(--border)" }}>Esc</kbd>{" "}
              to close
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected token info card */}
      {selectedToken && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-lg p-4"
          style={{ background: "var(--background)", border: "1px solid var(--border)" }}
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
                {formatBalance(selectedToken.balance, selectedToken.decimals)}{" "}
                {selectedToken.symbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: "var(--muted)" }}>Status:</span>
              <span style={{ color: selectedToken.approved ? "#10b981" : "#ef4444" }}>
                {selectedToken.approved ? "✓ Approved" : "✗ Not Approved"}
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
