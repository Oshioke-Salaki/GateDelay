"use client";

import { useEffect, useState } from "react";

interface Level { price: number; quantity: number }
interface Book { bids: Level[]; asks: Level[] }
interface Venue { name: string; orderBookUrl: string }

/** Explicit per-market opt-in. LMSR markets have no CLOB venue by default. */
function configuredVenue(marketId: string): Venue | null {
  try {
    const venues = JSON.parse(process.env.NEXT_PUBLIC_CLOB_VENUES_JSON || "{}");
    const venue = venues[marketId];
    return venue && typeof venue.name === "string" && venue.name.trim() && typeof venue.orderBookUrl === "string" && venue.orderBookUrl.trim() ? venue : null;
  } catch { return null; }
}

export default function ClobOrderBook({ marketId }: { marketId: string; userAddress?: string }) {
  const venue = configuredVenue(marketId);
  const name = venue?.name;
  const endpoint = venue?.orderBookUrl;
  const key = JSON.stringify([marketId, name, endpoint]);
  const [state, setState] = useState<{ key: string; book: Book | null; message: string }>({ key: "", book: null, message: "Loading order book…" });
  useEffect(() => {
    if (!endpoint) return;
    const controller = new AbortController();
    setState({ key, book: null, message: "Loading order book…" });
    void (async () => {
      try {
        const url = new URL(endpoint, window.location.origin);
        url.searchParams.set("marketId", marketId);
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error("Order book unavailable.");
        const book: Book = await response.json();
        const valid = (levels: Level[]) => Array.isArray(levels) && levels.every((l) => l && Number.isFinite(l.price) && l.price > 0 && Number.isFinite(l.quantity) && l.quantity > 0);
        if (!book || !valid(book.bids) || !valid(book.asks)) throw new Error("Invalid order book response.");
        if (!controller.signal.aborted) setState({ key, book, message: "" });
      } catch (error) {
        if (!controller.signal.aborted) setState({ key, book: null, message: error instanceof Error ? error.message : "Order book unavailable." });
      }
    })();
    return () => controller.abort();
  }, [key, endpoint, marketId]);
  if (!venue) return null;
  const book = state.key === key ? state.book : null;
  return (
    <section className="rounded-lg p-4 space-y-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <h3 className="font-semibold">{venue.name} · CLOB order book</h3>
      <p className="text-xs" style={{ color: "var(--muted)" }}>Venue orders are separate from LMSR prediction-market quotes.</p>
      {!book ? <p role="status">{state.key === key ? state.message : "Loading order book…"}</p> : (
        <div className="grid grid-cols-2 gap-4">
          {(["bids", "asks"] as const).map((side) => (
            <div key={side}>
              <h4 className="capitalize font-medium">{side}</h4>
              {book[side].length === 0 ? <p>No {side} available.</p> : (
                <table className="w-full text-xs"><thead><tr><th>Price</th><th>Quantity</th></tr></thead>
                  <tbody>{[...book[side]].sort((a, b) => side === "bids" ? b.price - a.price : a.price - b.price).map((level, i) => <tr key={i}><td>{level.price.toFixed(4)}</td><td>{level.quantity.toLocaleString()}</td></tr>)}</tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
