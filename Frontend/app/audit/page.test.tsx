import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AuditPage from "./page";

/**
 * Happy path for the `/audit` route.
 *
 * Covers the three things the page has to get right on a cold load:
 *  1. it renders inside the app shell's `QueryProvider` without throwing,
 *  2. it reaches the backend through the `/api/market-audit` proxy, and
 *  3. the records that come back are the ones rendered — not the mock fallback.
 */

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

const BACKEND_LOGS = [
  {
    id: "audit-1",
    marketId: "market-100",
    operation: "CREATE_MARKET",
    actor: "admin-01",
    details: "Market market-100 initialised after oracle validation.",
    severity: "MEDIUM" as const,
    createdAt: "2026-06-28T10:15:00.000Z",
    previousHash: "GENESIS",
    hash: "0xaaa1",
  },
  {
    id: "audit-2",
    marketId: "market-101",
    operation: "PAUSE_MARKET",
    actor: "admin-02",
    details: "Circuit breaker tripped; market-101 suspended.",
    severity: "HIGH" as const,
    createdAt: "2026-06-28T11:30:00.000Z",
    previousHash: "0xaaa1",
    hash: "0xaaa2",
  },
];

/** A fresh client per test so one test's cache cannot answer the next one. */
function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuditPage />
    </QueryClientProvider>,
  );
}

describe("AuditPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        statusText: "OK",
        json: async () => BACKEND_LOGS,
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the page header and description", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: /market audit log/i, level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/inspect the history of all market actions/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/links each operation to its predecessor using sha-256/i),
    ).toBeInTheDocument();
  });

  it("mounts without throwing when a QueryClient is present", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderPage()).not.toThrow();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("requests audit records through the backend proxy on first load", async () => {
    renderPage();

    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());

    const [url] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain("/api/market-audit");
  });

  it("renders live backend records rather than the mock fallback", async () => {
    renderPage();

    const table = await screen.findByRole("table");

    expect(
      await within(table).findByText("Market market-100 initialised after oracle validation."),
    ).toBeInTheDocument();
    expect(
      within(table).getByText("Circuit breaker tripped; market-101 suspended."),
    ).toBeInTheDocument();

    // The mock generator emits `audit-log-uuid-*` ids and a fixed GENESIS
    // banner string; neither may appear once real rows have arrived.
    expect(within(table).queryByText(/audit-log-uuid-/)).not.toBeInTheDocument();
    expect(screen.getByText(/Showing 1 to 2 of 2 events/i)).toBeInTheDocument();
  });

  it("exposes the log region as a labelled landmark", () => {
    renderPage();
    expect(
      screen.getByRole("region", { name: /market audit log records/i }),
    ).toBeInTheDocument();
  });

  it("keeps the wide table in its own horizontal scroll container", async () => {
    renderPage();

    const table = await screen.findByRole("table");
    // The table declares a floor width, so the scrolling must happen in the
    // wrapper — otherwise the whole page scrolls sideways on a phone.
    expect(table.className).toContain("min-w-[880px]");
    expect(table.parentElement?.className).toContain("overflow-x-auto");
  });
});
