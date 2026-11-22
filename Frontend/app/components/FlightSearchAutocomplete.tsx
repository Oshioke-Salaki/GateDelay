"use client";
import { useState, useEffect, useRef, useCallback, useId } from "react";

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

type ErrorType = "timeout" | "rate_limit" | "api_key" | "network" | "provider" | null;

// Debounce helper with a cancel() method so the caller can prevent a queued
// invocation from firing after unmount. (#1184)
interface Debounced<T extends (...args: Parameters<T>) => void> {
  (...args: Parameters<T>): void;
  cancel(): void;
}

function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  ms: number,
): Debounced<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const debounced = (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };

  debounced.cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };

  return debounced as Debounced<T>;
}

const FETCH_TIMEOUT_MS = 8000;

function getErrorMessage(type: ErrorType): string {
  switch (type) {
    case "timeout":
      return "Search timed out. Check your connection or enter the flight number manually.";
    case "rate_limit":
      return "Too many requests — wait a moment, then try again.";
    case "api_key":
      return "Flight search is not configured. Enter the flight number manually.";
    case "network":
      return "Network error. Check your connection or enter the flight number manually.";
    case "provider":
      return "Flight data provider error. Try again or enter the flight number manually.";
    default:
      return "";
  }
}

/**
 * #1186 — runtime-validate a single flight record from the AviationStack
 * response.  Returns null for records that are missing the minimum fields
 * needed to render a useful suggestion.
 */
function parseFlightRecord(f: unknown): FlightSuggestion | null {
  if (f === null || typeof f !== "object") return null;
  const rec = f as Record<string, unknown>;

  const flight = rec.flight as Record<string, unknown> | null | undefined;
  const airline = rec.airline as Record<string, unknown> | null | undefined;
  const dep = rec.departure as Record<string, unknown> | null | undefined;
  const arr = rec.arrival as Record<string, unknown> | null | undefined;

  const flight_number =
    typeof flight?.iata === "string" ? flight.iata.trim() : "";

  // Require at least a non-empty flight identifier — discard otherwise.
  if (!flight_number) return null;

  return {
    flight_number,
    airline: typeof airline?.name === "string" ? airline.name : "",
    departure: typeof dep?.iata === "string" ? dep.iata : "",
    arrival: typeof arr?.iata === "string" ? arr.iata : "",
  };
}

export default function FlightSearchAutocomplete({ onSelect, placeholder = "Search flights…" }: Props) {
  const uid = useId();
  const listboxId = `${uid}-listbox`;
  const getOptionId = (index: number) => `${uid}-option-${index}`;
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<FlightSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const [errorType, setErrorType] = useState<ErrorType>(null);
  const [noResults, setNoResults] = useState(false);

  // #1187 — flag set when the user commits a selection; prevents the search
  // effect from firing again on the resulting query update.
  const selectionCommitted = useRef(false);

  const listRef = useRef<HTMLUListElement>(null);

  // Monotonically increasing counter used to discard stale responses. (#1183)
  // Each new fetch increments this; the response only updates state if its
  // captured id matches the current value when it resolves.
  const requestIdRef = useRef(0);

  const fetchSuggestions = useCallback(
    debounce(async (q: string) => {
      if (q.length < 2) {
        setSuggestions([]);
        setOpen(false);
        setErrorType(null);
        setNoResults(false);
        return;
      }

      // Capture and advance the request identity before any async work so
      // stale responses from earlier queries are silently discarded. (#1183)
      const requestId = ++requestIdRef.current;

      setLoading(true);
      setErrorType(null);
      setNoResults(false);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      try {
        // Proxy request — API key stays on the server. (#1182)
        const res = await fetch(
          `/api/flights/search?q=${encodeURIComponent(q)}`,
          { signal: controller.signal },
        );
        clearTimeout(timeoutId);

        // If a newer request has already started, discard this response. (#1183)
        if (requestId !== requestIdRef.current) return;

        if (res.status === 429) {
          setErrorType("rate_limit");
          setSuggestions([]);
          setOpen(false);
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { code?: string };
          if (body.code === "CONFIG_ERROR") {
            setErrorType("api_key");
          } else {
            setErrorType("provider");
          }
          setSuggestions([]);
          setOpen(false);
          return;
        }

        const data = await res.json() as { data?: Record<string, unknown>[] };

        if (requestId !== requestIdRef.current) return;

        const results: FlightSuggestion[] = (data.data ?? []).map((f) => {
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
        setNoResults(results.length === 0);
        setOpen(results.length > 0);
        setActiveIndex(-1);
      } catch (err) {
        clearTimeout(timeoutId);
        if (requestId !== requestIdRef.current) return;
        setErrorType((err as Error).name === "AbortError" ? "timeout" : "network");
        setSuggestions([]);
        setOpen(false);
      } finally {
        // Only clear the loading spinner if this is still the active request.
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }, 350),
    [],
  );

  useEffect(() => {
    fetchSuggestions(query);
    // Cancel any pending debounced invocation when the component unmounts or
    // before the next query fires, preventing post-teardown state updates. (#1184)
    return () => fetchSuggestions.cancel();
  }, [query, fetchSuggestions]);

  const select = (flight: FlightSuggestion) => {
    // #1187 — mark the selection before updating the query so the effect
    // above can skip the resulting search.
    selectionCommitted.current = true;
    setQuery(flight.flight_number);
    setOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
    setErrorType(null);
    setNoResults(false);
    onSelect?.(flight);
  };

  const useManualEntry = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setOpen(false);
    setErrorType(null);
    setNoResults(false);
    onSelect?.({ flight_number: trimmed, airline: "", departure: "", arrival: "" });
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

  const showFeedback = !loading && query.length >= 2 && (errorType !== null || noResults);
  const isError = errorType !== null;

  // #1185 — aria-activedescendant points at the currently highlighted option.
  const activeDescendant =
    open && activeIndex >= 0 ? getOptionId(activeIndex) : undefined;

  return (
    <div className="relative w-full space-y-1.5">
      <div className="relative">
        {/* #1185 — role="combobox" owns the listbox; per-instance IDs prevent collisions. */}
        <input
          type="text"
          role="combobox"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeDescendant}
          aria-invalid={isError}
          className="w-full rounded-lg px-4 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          style={{
            background: "var(--card)",
            color: "var(--foreground)",
            border: `1px solid ${isError ? "rgba(239,68,68,0.5)" : "var(--border)"}`,
          }}
        />
        {loading && (
          <span
            aria-label="Searching…"
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
          />
        )}
      </div>

      {showFeedback && (
        <div
          role={isError ? "alert" : "status"}
          className="rounded-lg px-3 py-2 text-xs flex items-start justify-between gap-2"
          style={{
            background: isError ? "rgba(239,68,68,0.06)" : "var(--card)",
            border: `1px solid ${isError ? "rgba(239,68,68,0.25)" : "var(--border)"}`,
            color: isError ? "#ef4444" : "var(--muted)",
          }}
        >
          <span>
            {noResults
              ? `No flights found for "${query}".`
              : getErrorMessage(errorType)}
          </span>
          {query.trim() && (
            <button
              type="button"
              onClick={useManualEntry}
              className="shrink-0 font-medium underline underline-offset-2 hover:opacity-80 transition-opacity whitespace-nowrap"
              style={{ color: isError ? "#ef4444" : "#3b82f6" }}
            >
              Use &ldquo;{query}&rdquo;
            </button>
          )}
        </div>
      )}

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          ref={listRef}
          className="absolute z-50 mt-1 w-full rounded-lg shadow-lg overflow-hidden"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          {suggestions.map((f, i) => (
            <li
              key={f.flight_number + i}
              id={getOptionId(i)}
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
