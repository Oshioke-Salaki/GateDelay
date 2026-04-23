"use client";
import { useState, useEffect, useRef, useCallback } from "react";

interface FlightSuggestion {
  flight_number: string;
  airline: string;
  departure: string;
  arrival: string;
}

interface Props {
  onSelect?: (flight: FlightSuggestion) => void;
  placeholder?: string;
}

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export default function FlightSearchAutocomplete({ onSelect, placeholder = "Search flights…" }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<FlightSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  const fetchSuggestions = useCallback(
    debounce(async (q: string) => {
      if (q.length < 2) { setSuggestions([]); setOpen(false); return; }
      setLoading(true);
      try {
        const key = process.env.NEXT_PUBLIC_AVIATION_STACK_KEY;
        const res = await fetch(
          `https://api.aviationstack.com/v1/flights?access_key=${key}&flight_iata=${encodeURIComponent(q)}&limit=5`
        );
        const data = await res.json();
        const results: FlightSuggestion[] = (data.data ?? []).map((f: Record<string, unknown>) => {
          const flight = f.flight as Record<string, string>;
          const airline = f.airline as Record<string, string>;
          const dep = f.departure as Record<string, string>;
          const arr = f.arrival as Record<string, string>;
          return {
            flight_number: flight?.iata ?? "",
            airline: airline?.name ?? "",
            departure: dep?.iata ?? "",
            arrival: arr?.iata ?? "",
          };
        });
        setSuggestions(results);
        setOpen(results.length > 0);
        setActiveIndex(-1);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 350),
    []
  );

  useEffect(() => { fetchSuggestions(query); }, [query, fetchSuggestions]);

  const select = (flight: FlightSuggestion) => {
    setQuery(flight.flight_number);
    setOpen(false);
    onSelect?.(flight);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      select(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="flight-suggestions"
          className="w-full rounded-lg px-4 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          style={{
            background: "var(--card)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
          }}
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        )}
      </div>

      {open && (
        <ul
          id="flight-suggestions"
          role="listbox"
          ref={listRef}
          className="absolute z-50 mt-1 w-full rounded-lg shadow-lg overflow-hidden"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          {suggestions.map((f, i) => (
            <li
              key={f.flight_number + i}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={() => select(f)}
              onMouseEnter={() => setActiveIndex(i)}
              className="flex items-center justify-between px-4 py-2.5 cursor-pointer text-sm transition-colors"
              style={{
                background: i === activeIndex ? "var(--border)" : "transparent",
                color: "var(--foreground)",
              }}
            >
              <span className="font-medium">{f.flight_number}</span>
              <span style={{ color: "var(--muted)" }} className="text-xs">
                {f.departure} → {f.arrival}
              </span>
              <span style={{ color: "var(--muted)" }} className="text-xs truncate max-w-[120px]">
                {f.airline}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
