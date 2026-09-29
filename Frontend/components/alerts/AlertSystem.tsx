"use client";

import { useCallback, useEffect, useMemo, useReducer, useState, useRef, memo, createContext, useContext, type Dispatch } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Plus,
  X,
  Trash2,
  Edit3,
  Check,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  BellOff,
  Mail,
  Smartphone,
  Monitor,
  Search,
  RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { useWebSocketContext } from "@/app/components/WebSocketProvider";
import type { PriceUpdate } from "@/hooks/useWebSocket";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AlertType = "above" | "below" | "change_percent";
export type AlertChannel = "email" | "push" | "in_app";
export type AlertStatus = "active" | "triggered" | "paused";

export interface AlertCondition {
  marketId: string;
  marketTitle: string;
  type: AlertType;
  threshold: number;
  createdPrice?: number;
}

export interface Alert {
  id: string;
  name: string;
  condition: AlertCondition;
  channels: AlertChannel[];
  status: AlertStatus;
  createdAt: number;
  triggeredAt?: number;
  triggeredPrice?: number;
}

interface AlertContextValue {
  alerts: Alert[];
  dispatch: Dispatch<AlertAction>;
}

const AlertContext = createContext<AlertContextValue | null>(null);

function useAlertContext(): AlertContextValue {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error("useAlertContext must be used within AlertSystem");
  return ctx;
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

type AlertAction =
  | { type: "ADD"; alert: Alert }
  | { type: "UPDATE"; id: string; updates: Partial<Alert> }
  | { type: "DELETE"; id: string }
  | { type: "TRIGGER"; id: string; price: number }
  | { type: "RESET"; id: string }
  | { type: "LOAD"; alerts: Alert[] };

function alertReducer(state: Alert[], action: AlertAction): Alert[] {
  switch (action.type) {
    case "ADD":
      return [...state, action.alert];
    case "UPDATE":
      return state.map((a) => (a.id === action.id ? { ...a, ...action.updates } : a));
    case "DELETE":
      return state.filter((a) => a.id !== action.id);
    case "TRIGGER":
      return state.map((a) =>
        a.id === action.id
          ? {
              ...a,
              status: "triggered" as AlertStatus,
              triggeredAt: Date.now(),
              triggeredPrice: action.price,
            }
          : a
      );
    case "RESET":
      return state.map((a) =>
        a.id === action.id
          ? { ...a, status: "active" as AlertStatus, triggeredAt: undefined, triggeredPrice: undefined }
          : a
      );
    case "LOAD":
      return action.alerts;
    default:
      return state;
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "gatedelay_price_alerts";

const ALERT_TYPE_OPTIONS: { value: AlertType; label: string; description: string }[] = [
  { value: "above", label: "Price Above", description: "Alert when price rises above threshold" },
  { value: "below", label: "Price Below", description: "Alert when price drops below threshold" },
  { value: "change_percent", label: "Change %", description: "Alert when price changes by X% from creation" },
];

const CHANNEL_OPTIONS: { value: AlertChannel; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "push", label: "Push" },
  { value: "in_app", label: "In-App" },
];

const EXAMPLE_MARKETS = [
  { id: "btc-usd", title: "BTC/USD" },
  { id: "eth-usd", title: "ETH/USD" },
  { id: "sol-usd", title: "SOL/USD" },
  { id: "bnb-usd", title: "BNB/USD" },
  { id: "xrp-usd", title: "XRP/USD" },
  { id: "ada-usd", title: "ADA/USD" },
  { id: "doge-usd", title: "DOGE/USD" },
  { id: "dot-usd", title: "DOT/USD" },
  { id: "matic-usd", title: "MATIC/USD" },
  { id: "link-usd", title: "LINK/USD" },
];

const TRIGGER_COOLDOWN_MS = 30000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return `alert-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function checkCondition(condition: AlertCondition, currentPrice: number): boolean {
  switch (condition.type) {
    case "above":
      return currentPrice >= condition.threshold;
    case "below":
      return currentPrice <= condition.threshold;
    case "change_percent": {
      if (!condition.createdPrice || condition.createdPrice === 0) return false;
      const changePercent = Math.abs(currentPrice - condition.createdPrice) / condition.createdPrice * 100;
      return changePercent >= condition.threshold;
    }
    default:
      return false;
  }
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
}

function loadAlertsFromStorage(): Alert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Alert[];
  } catch {
    return [];
  }
}

function saveAlertsToStorage(alerts: Alert[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch {
    // storage full or unavailable
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const StatusBadge = memo(function StatusBadge({ status }: { status: AlertStatus }) {
  const config = {
    active: { color: "#22c55e", bg: "#22c55e18", border: "#22c55e44", label: "Active" },
    triggered: { color: "#f59e0b", bg: "#f59e0b18", border: "#f59e0b44", label: "Triggered" },
    paused: { color: "#6b7280", bg: "#6b728018", border: "#6b728044", label: "Paused" },
  }[status];

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ color: config.color, background: config.bg, border: `1px solid ${config.border}` }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: config.color }}
      />
      {config.label}
    </span>
  );
});

const ChannelIcon = memo(function ChannelIcon({ channel }: { channel: AlertChannel }) {
  const icons = {
    email: <Mail size={14} />,
    push: <Smartphone size={14} />,
    in_app: <Monitor size={14} />,
  };
  return <span title={channel}>{icons[channel]}</span>;
});

const AlertTypeIcon = memo(function AlertTypeIcon({ type }: { type: AlertType }) {
  const icons = {
    above: <ArrowUpRight size={16} />,
    below: <ArrowDownRight size={16} />,
    change_percent: <TrendingUp size={16} />,
  };
  const colors = {
    above: "#22c55e",
    below: "#ef4444",
    change_percent: "#3b82f6",
  };
  return (
    <span style={{ color: colors[type] }} title={ALERT_TYPE_OPTIONS.find((o) => o.value === type)?.label}>
      {icons[type]}
    </span>
  );
});

interface AlertCardProps {
  alert: Alert;
  onEdit: (alert: Alert) => void;
  onDelete: (id: string) => void;
  onReset: (id: string) => void;
}

const AlertCard = memo(function AlertCard({ alert, onEdit, onDelete, onReset }: AlertCardProps) {
  const typeColors = {
    above: "#22c55e",
    below: "#ef4444",
    change_percent: "#3b82f6",
  };

  const borderColor = typeColors[alert.condition.type];
  const timeAgo = formatTimeAgo(alert.createdAt);
  const triggeredAgo = alert.triggeredAt ? formatTimeAgo(alert.triggeredAt) : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 350, damping: 30 }}
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderLeft: `4px solid ${borderColor}`,
      }}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <AlertTypeIcon type={alert.condition.type} />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>
                {alert.name}
              </h3>
              <p className="text-xs mt-0.5 truncate" style={{ color: "var(--muted)" }}>
                {alert.condition.marketTitle}
              </p>
            </div>
          </div>
          <StatusBadge status={alert.status} />
        </div>

        {/* Condition */}
        <div className="mb-3">
          {alert.condition.type === "change_percent" ? (
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Change of <span className="font-semibold" style={{ color: "var(--foreground)" }}>{alert.condition.threshold}%</span> from creation price
              {alert.condition.createdPrice && (
                <span> (base: {formatPrice(alert.condition.createdPrice)})</span>
              )}
            </p>
          ) : (
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {alert.condition.type === "above" ? "Above" : "Below"}{" "}
              <span className="font-semibold" style={{ color: "var(--foreground)" }}>
                {formatPrice(alert.condition.threshold)}
              </span>
            </p>
          )}
        </div>

        {/* Triggered info */}
        {alert.status === "triggered" && alert.triggeredPrice && (
          <div
            className="mb-3 px-3 py-2 rounded-lg text-xs"
            style={{ background: "#f59e0b12", border: "1px solid #f59e0b33", color: "#f59e0b" }}
          >
            Triggered at {formatPrice(alert.triggeredPrice)} {triggeredAgo && `(${triggeredAgo})`}
          </div>
        )}

        {/* Channels */}
        <div className="flex items-center gap-3 mb-3">
          {alert.channels.map((ch) => (
            <span key={ch} style={{ color: "var(--muted)" }} title={ch}>
              <ChannelIcon channel={ch} />
            </span>
          ))}
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Created {timeAgo}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
          {alert.status === "triggered" && (
            <button
              onClick={() => onReset(alert.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              style={{ color: "#3b82f6", background: "#3b82f618" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#3b82f630")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#3b82f618")}
            >
              <RotateCcw size={12} />
              Reset
            </button>
          )}
          {alert.status !== "triggered" && (
            <button
              onClick={() => onEdit(alert)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              style={{ color: "var(--foreground)", background: "var(--border)" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--muted)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--border)")}
            >
              <Edit3 size={12} />
              Edit
            </button>
          )}
          <button
            onClick={() => onDelete(alert.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ml-auto"
            style={{ color: "#ef4444", background: "#ef444418" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#ef444430")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#ef444418")}
          >
            <Trash2 size={12} />
            Delete
          </button>
        </div>
      </div>
    </motion.div>
  );
});

interface AlertFormProps {
  editingAlert?: Alert | null;
  onSubmit: (data: {
    name: string;
    marketId: string;
    marketTitle: string;
    type: AlertType;
    threshold: number;
    channels: AlertChannel[];
  }) => void;
  onCancel: () => void;
}

function AlertForm({ editingAlert, onSubmit, onCancel }: AlertFormProps) {
  const [name, setName] = useState(editingAlert?.name ?? "");
  const [marketId, setMarketId] = useState(editingAlert?.condition.marketId ?? "");
  const [marketTitle, setMarketTitle] = useState(editingAlert?.condition.marketTitle ?? "");
  const [alertType, setAlertType] = useState<AlertType>(editingAlert?.condition.type ?? "above");
  const [threshold, setThreshold] = useState(editingAlert?.condition.threshold ?? 100);
  const [channels, setChannels] = useState<AlertChannel[]>(editingAlert?.channels ?? ["in_app"]);
  const [marketSearch, setMarketSearch] = useState(editingAlert?.condition.marketTitle ?? "");

  const filteredMarkets = useMemo(
    () =>
      EXAMPLE_MARKETS.filter((m) =>
        m.title.toLowerCase().includes(marketSearch.toLowerCase()) ||
        m.id.toLowerCase().includes(marketSearch.toLowerCase())
      ),
    [marketSearch]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim() || !marketId || !marketTitle) return;
      onSubmit({
        name: name.trim(),
        marketId,
        marketTitle: marketTitle.trim(),
        type: alertType,
        threshold,
        channels,
      });
    },
    [name, marketId, marketTitle, alertType, threshold, channels, onSubmit]
  );

  const toggleChannel = useCallback((ch: AlertChannel) => {
    setChannels((prev) => (prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]));
  }, []);

  const selectMarket = useCallback((m: { id: string; title: string }) => {
    setMarketId(m.id);
    setMarketTitle(m.title);
    setMarketSearch(m.title);
  }, []);

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
      onSubmit={handleSubmit}
      className="mb-5 rounded-xl overflow-hidden"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
            {editingAlert ? "Edit Alert" : "Create New Alert"}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg transition-colors cursor-pointer"
            style={{ color: "var(--muted)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--border)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
          >
            <X size={16} />
          </button>
        </div>

        {/* Alert Name */}
        <div className="mb-4">
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
            Alert Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., BTC breakout alert"
            required
            className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          />
        </div>

        {/* Market Selector */}
        <div className="mb-4">
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
            Market
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
            <input
              type="text"
              value={marketSearch}
              onChange={(e) => setMarketSearch(e.target.value)}
              placeholder="Search markets..."
              required
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              list="market-suggestions"
            />
            <datalist id="market-suggestions">
              {EXAMPLE_MARKETS.map((m) => (
                <option key={m.id} value={m.title} />
              ))}
            </datalist>
          </div>
          {marketSearch && filteredMarkets.length > 0 && (
            <div
              className="mt-1.5 rounded-lg overflow-hidden border"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            >
              {filteredMarkets.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => selectMarket(m)}
                  className="w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer"
                  style={{ color: "var(--foreground)" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--border)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
                >
                  {m.title} <span style={{ color: "var(--muted)" }}>({m.id})</span>
                </button>
              ))}
            </div>
          )}
          <input type="hidden" value={marketId} required />
        </div>

        {/* Alert Type */}
        <div className="mb-4">
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
            Condition Type
          </label>
          <div className="grid grid-cols-3 gap-2">
            {ALERT_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAlertType(opt.value)}
                className={`flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  alertType === opt.value ? "ring-2 ring-blue-500/50" : ""
                }`}
                style={{
                  background: alertType === opt.value ? "var(--border)" : "var(--background)",
                  border: `1px solid ${alertType === opt.value ? "#3b82f6" : "var(--border)"}`,
                  color: alertType === opt.value ? "#3b82f6" : "var(--muted)",
                }}
              >
                {opt.value === "above" && <ArrowUpRight size={16} />}
                {opt.value === "below" && <ArrowDownRight size={16} />}
                {opt.value === "change_percent" && <TrendingUp size={16} />}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Threshold */}
        <div className="mb-4">
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
            {alertType === "change_percent" ? "Change %" : "Price Threshold"}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value) || 0)}
              min={0}
              step={alertType === "change_percent" ? 0.1 : 1}
              required
              className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            />
            {alertType === "change_percent" ? (
              <span className="text-sm font-medium" style={{ color: "var(--muted)" }}>%</span>
            ) : (
              <span className="text-sm font-medium" style={{ color: "var(--muted)" }}>USD</span>
            )}
          </div>
        </div>

        {/* Channels */}
        <div className="mb-5">
          <label className="block text-xs font-medium mb-2" style={{ color: "var(--muted)" }}>
            Notification Channels
          </label>
          <div className="flex flex-wrap gap-2">
            {CHANNEL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleChannel(opt.value)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer"
                style={{
                  background: channels.includes(opt.value) ? "#3b82f618" : "var(--background)",
                  border: `1px solid ${channels.includes(opt.value) ? "#3b82f6" : "var(--border)"}`,
                  color: channels.includes(opt.value) ? "#3b82f6" : "var(--muted)",
                }}
              >
                <ChannelIcon channel={opt.value} />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!name.trim() || !marketId || !marketTitle}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #3b82f6, #6366f1)",
              color: "#fff",
              opacity: (!name.trim() || !marketId || !marketTitle) ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (name.trim() && marketId && marketTitle)
                ((e.currentTarget as HTMLButtonElement).style.opacity = "0.9");
            }}
            onMouseLeave={(e) => {
              ((e.currentTarget as HTMLButtonElement).style.opacity =
                (!name.trim() || !marketId || !marketTitle) ? "0.5" : "1");
            }}
          >
            <Check size={14} />
            {editingAlert ? "Update Alert" : "Create Alert"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            style={{ background: "var(--border)", color: "var(--foreground)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--muted)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--border)")}
          >
            Cancel
          </button>
        </div>
      </div>
    </motion.form>
  );
}

// ─── Stats Row ───────────────────────────────────────────────────────────────

function StatsRow({ alerts }: { alerts: Alert[] }) {
  const stats = useMemo(() => {
    const active = alerts.filter((a) => a.status === "active").length;
    const triggered = alerts.filter((a) => a.status === "triggered").length;
    const paused = alerts.filter((a) => a.status === "paused").length;
    return { total: alerts.length, active, triggered, paused };
  }, [alerts]);

  const items = [
    { label: "Total", value: stats.total, color: "var(--foreground)" },
    { label: "Active", value: stats.active, color: "#22c55e" },
    { label: "Triggered", value: stats.triggered, color: "#f59e0b" },
    { label: "Paused", value: stats.paused, color: "#6b7280" },
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{ background: "var(--border)" }}
        >
          <span className="text-sm font-bold" style={{ color: item.color }}>
            {item.value}
          </span>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{ background: "var(--border)" }}
      >
        <BellOff size={28} style={{ color: "var(--muted)" }} />
      </div>
      <h3 className="text-base font-semibold mb-1" style={{ color: "var(--foreground)" }}>
        No price alerts yet
      </h3>
      <p className="text-sm mb-5 max-w-xs" style={{ color: "var(--muted)" }}>
        Create your first alert to receive notifications when markets hit your target prices.
      </p>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
        style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "#fff" }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "0.9")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}
      >
        <Plus size={16} />
        Create Your First Alert
      </button>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AlertSystem() {
  const toast = useToast();
  const ws = useWebSocketContext();
  const [alerts, dispatch] = useReducer(alertReducer, []);
  const [showForm, setShowForm] = useState(false);
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);
  const [connected, setConnected] = useState(ws.isConnected);

  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;
  const subscribedMarketsRef = useRef<Set<string>>(new Set());
  const lastTriggerRef = useRef<Map<string, number>>(new Map());

  // Load from localStorage on mount
  useEffect(() => {
    const stored = loadAlertsFromStorage();
    if (stored.length > 0) {
      dispatch({ type: "LOAD", alerts: stored });
    }
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    saveAlertsToStorage(alerts);
  }, [alerts]);

  // Track connection status
  useEffect(() => {
    setConnected(ws.isConnected);
  }, [ws.isConnected]);

  // Subscribe/unsubscribe markets when alerts change
  useEffect(() => {
    if (!ws.isConnected) return;

    const activeMarketIds = new Set(
      alerts
        .filter((a) => a.status === "active")
        .map((a) => a.condition.marketId)
    );

    const toUnsubscribe = [...subscribedMarketsRef.current].filter((id) => !activeMarketIds.has(id));
    const toSubscribe = [...activeMarketIds].filter((id) => !subscribedMarketsRef.current.has(id));

    if (toUnsubscribe.length > 0) {
      ws.unsubscribe(toUnsubscribe);
    }
    if (toSubscribe.length > 0) {
      ws.subscribe(toSubscribe);
    }

    subscribedMarketsRef.current = activeMarketIds;

    return () => {
      if (toUnsubscribe.length > 0) {
        ws.unsubscribe(toUnsubscribe);
      }
    };
  }, [alerts, ws.isConnected]);

  // Listen for price updates and check alert conditions
  useEffect(() => {
    if (!ws.isConnected) return;

    const unsubscribe = ws.on("priceUpdate", (update: PriceUpdate) => {
      const currentAlerts = alertsRef.current;
      for (const alert of currentAlerts) {
        if (alert.status !== "active") continue;
        if (alert.condition.marketId !== update.marketId) continue;

        const now = Date.now();
        const lastTrigger = lastTriggerRef.current.get(alert.id) || 0;
        if (now - lastTrigger < TRIGGER_COOLDOWN_MS) continue;

        if (checkCondition(alert.condition, update.price)) {
          lastTriggerRef.current.set(alert.id, now);
          dispatch({ type: "TRIGGER", id: alert.id, price: update.price });

          if (alert.channels.includes("in_app")) {
            toast.warning("Price Alert Triggered", `${alert.name}: ${alert.condition.marketTitle} reached ${formatPrice(update.price)}`);
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [ws.isConnected, toast]);

  const handleSubmit = useCallback(
    (data: {
      name: string;
      marketId: string;
      marketTitle: string;
      type: AlertType;
      threshold: number;
      channels: AlertChannel[];
    }) => {
      if (editingAlert) {
        const updated: Alert = {
          ...editingAlert,
          name: data.name,
          condition: {
            ...editingAlert.condition,
            marketId: data.marketId,
            marketTitle: data.marketTitle,
            type: data.type,
            threshold: data.threshold,
          },
          channels: data.channels,
        };
        dispatch({ type: "UPDATE", id: editingAlert.id, updates: updated });
        toast.success("Alert Updated", `"${data.name}" has been updated`);
      } else {
        const existingPrice = ws.getPrice(data.marketId)?.price;
        const newAlert: Alert = {
          id: generateId(),
          name: data.name,
          condition: {
            ...data,
            createdPrice: data.type === "change_percent" ? existingPrice : undefined,
          },
          channels: data.channels,
          status: "active",
          createdAt: Date.now(),
        };
        dispatch({ type: "ADD", alert: newAlert });
        toast.success("Alert Created", `"${data.name}" is now active`);
      }

      setShowForm(false);
      setEditingAlert(null);
    },
    [editingAlert, ws.prices, toast]
  );

  const handleEdit = useCallback((alert: Alert) => {
    setEditingAlert(alert);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      dispatch({ type: "DELETE", id });
      toast.info("Alert Deleted", "The alert has been removed");
    },
    [toast]
  );

  const handleReset = useCallback(
    (id: string) => {
      dispatch({ type: "RESET", id });
      toast.success("Alert Reset", "The alert is now active again");
    },
    [toast]
  );

  const handleAddNew = useCallback(() => {
    setEditingAlert(null);
    setShowForm((prev) => !prev);
  }, []);

  const handleCancelForm = useCallback(() => {
    setShowForm(false);
    setEditingAlert(null);
  }, []);

  const sortedAlerts = useMemo(() => {
    return [...alerts].sort((a, b) => {
      const statusOrder = { triggered: 0, active: 1, paused: 2 };
      const statusDiff = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
      if (statusDiff !== 0) return statusDiff;
      return b.createdAt - a.createdAt;
    });
  }, [alerts]);

  return (
    <AlertContext.Provider value={{ alerts, dispatch }}>
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div className="p-5 flex flex-col gap-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "#3b82f618" }}
              >
                <Bell size={20} style={{ color: "#3b82f6" }} />
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                  Price Alerts
                </h2>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {connected ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e" }} />
                      Live monitoring active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#ef4444" }} />
                      Disconnected — alerts will trigger on reconnect
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={handleAddNew}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer"
              style={{
                background: showForm ? "var(--border)" : "linear-gradient(135deg, #3b82f6, #6366f1)",
                color: showForm ? "var(--foreground)" : "#fff",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "0.9")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}
            >
              {showForm ? <X size={16} /> : <Plus size={16} />}
              {showForm ? "Cancel" : "Add Alert"}
            </button>
          </div>

          <StatsRow alerts={alerts} />
        </div>

        {/* Body */}
        <div className="p-5">
          <AnimatePresence mode="sync">
            {showForm && (
              <AlertForm
                key={editingAlert?.id ?? "new-alert-form"}
                editingAlert={editingAlert}
                onSubmit={handleSubmit}
                onCancel={handleCancelForm}
              />
            )}
          </AnimatePresence>

          {alerts.length === 0 && !showForm ? (
            <EmptyState onAdd={handleAddNew} />
          ) : (
            <div className="grid gap-3">
              <AnimatePresence mode="sync">
                {sortedAlerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onReset={handleReset}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </AlertContext.Provider>
  );
}

// ─── Convenience Hook ────────────────────────────────────────────────────────

export function useAlerts() {
  const ctx = useAlertContext();
  return {
    alerts: ctx.alerts,
    dispatch: ctx.dispatch,
  };
}

export { checkCondition, formatPrice, formatTimeAgo };
