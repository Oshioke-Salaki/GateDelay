"use client";
import { useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  ColumnDef,
} from "@tanstack/react-table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Market } from "./MarketCard";

const sampleMarkets: Market[] = [
  {
    id: "1",
    title: "Will Bitcoin hit $100k by end of 2025",
    description: "Prediction market for Bitcoin price",
    status: "open",
    yesPrice: 0.65,
    noPrice: 0.35,
    volume: 125000,
    liquidity: 500000,
  },
  {
    id: "2",
    title: "Will Ethereum transition to proof of stake complete",
    description: "Ethereum market",
    status: "open",
    yesPrice: 0.45,
    noPrice: 0.55,
    volume: 95000,
    liquidity: 350000,
  },
  {
    id: "3",
    title: "Will Solana hit $1k by end of Q4 2026",
    description: "Solana price prediction",
    status: "open",
    yesPrice: 0.25,
    noPrice: 0.75,
    volume: 75000,
    liquidity: 250000,
  },
];

export default function ComparisonTool() {
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);

  const toggleMarket = (marketId: string) => {
    setSelectedMarkets((prev) =>
      prev.includes(marketId)
        ? prev.filter((id) => id !== marketId)
        : [...prev, marketId]
    );
  };

  const selectedMarketData = sampleMarkets.filter((m) => selectedMarkets.includes(m.id));

  const getHighlightStyle = (key: string, value: number) => {
    if (selectedMarketData.length <= 1) return {};
    const values = selectedMarketData.map((m) => m[key as keyof Market] as number);
    const max = Math.max(...values);
    const min = Math.min(...values);
    if (value === max && max !== min) {
      return { background: "#22c55e18", borderLeft: "3px solid #22c55e" };
    }
    if (value === min && max !== min) {
      return { background: "#ef444418", borderLeft: "3px solid #ef4444" };
    }
    return {};
  };

  const columns: ColumnDef<Market>[] = [
    {
      accessorKey: "title",
      header: "Market",
    },
    {
      accessorKey: "yesPrice",
      header: "Yes Price",
      cell: ({ getValue, row }) => {
        const val = getValue() as number;
        return (
          <div style={getHighlightStyle("yesPrice", val)} className="px-2 py-1 rounded">
            {(val * 100).toFixed(0)}¢
          </div>
        );
      },
    },
    {
      accessorKey: "noPrice",
      header: "No Price",
      cell: ({ getValue, row }) => {
        const val = getValue() as number;
        return (
          <div style={getHighlightStyle("noPrice", val)} className="px-2 py-1 rounded">
            {(val * 100).toFixed(0)}¢
          </div>
        );
      },
    },
    {
      accessorKey: "volume",
      header: "Volume",
      cell: ({ getValue, row }) => {
        const val = getValue() as number;
        return (
          <div style={getHighlightStyle("volume", val)} className="px-2 py-1 rounded">
            ${val.toLocaleString()}
          </div>
        );
      },
    },
    {
      accessorKey: "liquidity",
      header: "Liquidity",
      cell: ({ getValue, row }) => {
        const val = getValue() as number;
        return (
          <div style={getHighlightStyle("liquidity", val)} className="px-2 py-1 rounded">
            ${val.toLocaleString()}
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: selectedMarketData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const chartData = selectedMarketData.map((m) => ({
    name: m.title.slice(0, 20) + "...",
    yes: m.yesPrice * 100,
    no: m.noPrice * 100,
  }));

  const statsData = selectedMarketData.map((m) => ({
    name: m.title.slice(0, 20) + "...",
    volume: m.volume,
    liquidity: m.liquidity,
  }));

  return (
    <div className="p-6" style={{ maxWidth: "1400px", margin: "0 auto" }}>
      <h2 className="text-2xl font-bold mb-6" style={{ color: "var(--foreground)" }}>
        Market Comparison Tool
      </h2>

      {/* Market Selection */}
      <div className="mb-6 p-4 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <h3 className="text-lg font-semibold mb-3" style={{ color: "var(--foreground)" }}>
        Select Markets
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {sampleMarkets.map((market) => (
          <label
            key={market.id}
            className={`p-4 rounded-lg cursor-pointer transition-all ${
              selectedMarkets.includes(market.id)
                ? "ring-2"
                : ""
            }`}
            style={{
              background: selectedMarkets.includes(market.id)
                ? "var(--border)"
                : "var(--background)",
              border: "1px solid var(--border)",
            }}
          >
            <input
              type="checkbox"
              className="mr-2"
              checked={selectedMarkets.includes(market.id)}
              onChange={() => toggleMarket(market.id)}
            />
            <span style={{ color: "var(--foreground)" }}>{market.title}</span>
          </label>
        ))}
      </div>
      </div>

      {/* Comparison Table */}
      {selectedMarketData.length > 1 && (
        <>
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4" style={{ color: "var(--foreground)" }}>
              Comparison Metrics
            </h3>
            <div className="overflow-x-auto rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <table className="w-full">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-4 py-3 text-left text-sm font-semibold"
                        style={{ color: "var(--foreground)", borderBottom: "1px solid var(--border)" }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </th>
                    ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className="px-4 py-3"
                          style={{
                            color: "var(--foreground)",
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              className="p-4 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
                Yes/No Prices (%)
              </h3>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" stroke="var(--muted)" />
                    <YAxis stroke="var(--muted)" />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                      }}
                    />
                    <Bar dataKey="yes" fill="#22c55e" />
                    <Bar dataKey="no" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div
              className="p-4 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
                Volume & Liquidity
              </h3>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" stroke="var(--muted)" />
                    <YAxis stroke="var(--muted)" />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                      }}
                    />
                    <Bar dataKey="volume" fill="#3b82f6" />
                    <Bar dataKey="liquidity" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}

      {selectedMarketData.length <= 1 && (
        <div className="text-center py-12" style={{ color: "var(--muted)" }}>
          <p className="text-lg">Please select at least two markets to compare</p>
        </div>
      )}
    </div>
  );
}
