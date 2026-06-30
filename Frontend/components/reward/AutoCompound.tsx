"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";

type CompoundFrequency = "daily" | "weekly" | "monthly";

interface CompoundHistoryItem {
  id: string;
  timestamp: number;
  amount: number;
  newBalance: number;
}

const MOCK_HISTORY: CompoundHistoryItem[] = [
  { id: "1", timestamp: Date.now() - 86400000 * 7, amount: 12.5, newBalance: 1012.5 },
  { id: "2", timestamp: Date.now() - 86400000 * 14, amount: 10.3, newBalance: 1000 },
  { id: "3", timestamp: Date.now() - 86400000 * 21, amount: 8.7, newBalance: 989.7 },
];

const STORAGE_KEY = "autocompound-config";

export default function AutoCompound() {
  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState<CompoundFrequency>("weekly");
  const [minThreshold, setMinThreshold] = useState(5);
  const [history, setHistory] = useState<CompoundHistoryItem[]>(MOCK_HISTORY);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const config = JSON.parse(saved);
        setEnabled(config.enabled);
        setFrequency(config.frequency);
        setMinThreshold(config.minThreshold);
      } catch {}
    }
  }, []);

  const saveConfig = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      enabled,
      frequency,
      minThreshold,
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const getFrequencyLabel = (f: CompoundFrequency): string => {
    switch (f) {
      case "daily": return "Daily";
      case "weekly": return "Weekly";
      case "monthly": return "Monthly";
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
        Auto-Compound Rewards
      </h2>

      <div className="grid sm:grid-cols-2 gap-4">
        <div
          className="rounded-xl p-4"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              Configuration
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm" style={{ color: "var(--foreground)" }}>
                Enable Auto-Compound
              </span>
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs mb-1.5" style={{ color: "var(--muted)" }}>
                Compound Frequency
              </p>
              <div className="flex gap-2">
                {(["daily", "weekly", "monthly"] as CompoundFrequency[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFrequency(f)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors`}
                    style={{
                      background: frequency === f ? "#3b82f622" : "var(--background)",
                      color: frequency === f ? "#3b82f6" : "var(--muted)",
                      border: `1px solid ${frequency === f ? "#3b82f655" : "var(--border)"}`,
                    }}
                    disabled={!enabled}
                  >
                    {getFrequencyLabel(f)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs mb-1.5" style={{ color: "var(--muted)" }}>
                Minimum Reward Threshold ($)
              </p>
              <input
                type="number"
                value={minThreshold}
                onChange={(e) => setMinThreshold(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
                disabled={!enabled}
              />
            </div>

            <button
              onClick={saveConfig}
              className="w-full px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
              style={{
                background: "#3b82f6",
                color: "white",
              }}
            >
              {saved ? "Saved ✓" : "Save Configuration"}
            </button>
          </div>
        </div>

        <div
          className="rounded-xl p-4"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <p className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
            Compound Schedule Preview
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: "var(--muted)" }}>Next Compound</span>
              <span style={{ color: "var(--foreground)" }}>
                {format(Date.now() + (frequency === "daily" ? 86400000 : frequency === "weekly" ? 604800000 : 2592000000), "MMM d, h:mm a")}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: "var(--muted)" }}>Est. Next Reward</span>
              <span style={{ color: "var(--foreground)" }}>$15.20</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: "var(--muted)" }}>Current Balance</span>
              <span style={{ color: "var(--foreground)" }}>$1,234.56</span>
            </div>
          </div>
        </div>
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid var(--border)" }}
      >
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Compound History
          </p>
        </div>
        {history.length === 0 ? (
          <div
            className="px-4 py-10 text-center text-sm"
            style={{ color: "var(--muted)", background: "var(--background)" }}
          >
            No compound history yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ background: "var(--background)" }}>
              <thead>
                <tr style={{ background: "var(--card)" }}>
                  {["Date", "Amount", "New Balance"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-xs font-semibold text-left"
                      style={{ color: "var(--muted)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--foreground)" }}>
                      {format(item.timestamp, "MMM d, yyyy h:mm a")}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "#22c55e" }}>
                      +${item.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--foreground)" }}>
                      ${item.newBalance.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
