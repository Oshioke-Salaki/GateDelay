/**
 * MarketSearch component tests
 *
 * Covers:
 *  - Text search matching (title + description, case-insensitive)
 *  - Category filter
 *  - Status filter
 *  - Volume / liquidity range filters
 *  - Sorting (relevance, volume, date, liquidity)
 *  - Empty results state
 *  - Saved-search save / load / delete
 *  - Share-search URL construction (clipboard)
 *  - URL / query-state reading via useSearchParams in SearchPage
 *  - onSearch callback debounce / immediate fire
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { ReadonlyURLSearchParams } from "next/navigation";
import MarketSearch, { type Market } from "./MarketSearch";

// ─── next/navigation mock ─────────────────────────────────────────────────────
// Some test cases import the search page, which calls useSearchParams(). We
// need a controllable mock so we can feed arbitrary URL params.
const mockSearchParams = vi.fn<() => ReadonlyURLSearchParams>();
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams(),
}));

// ─── lodash debounce – make it synchronous so we don't need timers ────────────
vi.mock("lodash", async (importActual) => {
  const actual = await importActual<typeof import("lodash")>();
  return { ...actual, debounce: (fn: (...a: unknown[]) => unknown) => fn };
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MARKETS: Market[] = [
  {
    id: "1",
    title: "Will AA123 arrive on time?",
    description: "American Airlines flight from JFK to LAX.",
    category: "flight",
    status: "open",
    yesPrice: 0.62,
    noPrice: 0.38,
    volume: 14820,
    liquidity: 5400,
    createdAt: "2026-04-20T10:00:00Z",
  },
  {
    id: "2",
    title: "Will Bitcoin exceed $100k by EOY?",
    description: "Bitcoin price prediction for end of 2026.",
    category: "crypto",
    status: "open",
    yesPrice: 0.72,
    noPrice: 0.28,
    volume: 125000,
    liquidity: 45000,
    createdAt: "2026-04-15T08:00:00Z",
  },
  {
    id: "3",
    title: "Lakers championship 2026?",
    description: "NBA championship prediction.",
    category: "sports",
    status: "closed",
    yesPrice: 0.28,
    noPrice: 0.72,
    volume: 45000,
    liquidity: 18000,
    createdAt: "2026-04-10T16:00:00Z",
  },
  {
    id: "4",
    title: "Fed rate cut Q2 2026?",
    description: "Federal Reserve interest rate decision.",
    category: "other",
    status: "resolved",
    yesPrice: 0.58,
    noPrice: 0.42,
    volume: 3000,
    liquidity: 500,
    createdAt: "2026-04-05T11:00:00Z",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderSearch(
  markets: Market[] = MARKETS,
  onSearch = vi.fn(),
  isLoading = false,
  error: string | null = null,
  onRetry?: () => void,
) {
  return render(
    <MarketSearch markets={markets} onSearch={onSearch} isLoading={isLoading} error={error} onRetry={onRetry} />,
  );
}

async function openFilters(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /filters/i }));
}

// ─── Text search matching ─────────────────────────────────────────────────────

describe("text search matching", () => {
  it("shows all markets when query is empty", () => {
    renderSearch();
    expect(screen.getByText(/4 results/i)).toBeInTheDocument();
    MARKETS.forEach((m) => expect(screen.getByText(m.title)).toBeInTheDocument());
  });

  it("filters by a title substring (case-insensitive)", async () => {
    const user = userEvent.setup();
    renderSearch();
    await user.type(screen.getByPlaceholderText(/search markets/i), "bitcoin");
    expect(screen.getByText(/1 results/i)).toBeInTheDocument();
    expect(screen.getByText("Will Bitcoin exceed $100k by EOY?")).toBeInTheDocument();
    expect(screen.queryByText("Will AA123 arrive on time?")).not.toBeInTheDocument();
  });

  it("filters by a description substring", async () => {
    const user = userEvent.setup();
    renderSearch();
    await user.type(screen.getByPlaceholderText(/search markets/i), "federal reserve");
    expect(screen.getByText(/1 results/i)).toBeInTheDocument();
    expect(screen.getByText("Fed rate cut Q2 2026?")).toBeInTheDocument();
  });

  it("is case-insensitive for both title and description", async () => {
    const user = userEvent.setup();
    renderSearch();
    await user.type(screen.getByPlaceholderText(/search markets/i), "NBA");
    // "NBA championship prediction." matches description
    expect(screen.getByText("Lakers championship 2026?")).toBeInTheDocument();
  });

  it("fires the onSearch callback when the query changes", async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();
    renderSearch(MARKETS, onSearch);
    await user.type(screen.getByPlaceholderText(/search markets/i), "x");
    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({ query: "x" }),
    );
  });

  it("clears results when query is cleared", async () => {
    const user = userEvent.setup();
    renderSearch();
    const input = screen.getByPlaceholderText(/search markets/i);
    await user.type(input, "bitcoin");
    await user.clear(input);
    expect(screen.getByText(/4 results/i)).toBeInTheDocument();
  });
});

// ─── Category filter ──────────────────────────────────────────────────────────

describe("category filter", () => {
  it("shows only flight markets when flight is selected", async () => {
    const user = userEvent.setup();
    renderSearch();
    await openFilters(user);
    await user.selectOptions(screen.getByRole("combobox", { name: /category/i }), "flight");
    expect(screen.getByText(/1 results/i)).toBeInTheDocument();
    expect(screen.getByText("Will AA123 arrive on time?")).toBeInTheDocument();
    expect(screen.queryByText("Will Bitcoin exceed $100k by EOY?")).not.toBeInTheDocument();
  });

  it("shows only crypto markets when crypto is selected", async () => {
    const user = userEvent.setup();
    renderSearch();
    await openFilters(user);
    await user.selectOptions(screen.getByRole("combobox", { name: /category/i }), "crypto");
    expect(screen.getByText(/1 results/i)).toBeInTheDocument();
    expect(screen.getByText("Will Bitcoin exceed $100k by EOY?")).toBeInTheDocument();
  });

  it("shows all markets when category is reset to All Categories", async () => {
    const user = userEvent.setup();
    renderSearch();
    await openFilters(user);
    await user.selectOptions(screen.getByRole("combobox", { name: /category/i }), "flight");
    await user.selectOptions(screen.getByRole("combobox", { name: /category/i }), "");
    expect(screen.getByText(/4 results/i)).toBeInTheDocument();
  });

  it("fires onSearch with the selected category", async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();
    renderSearch(MARKETS, onSearch);
    await openFilters(user);
    await user.selectOptions(screen.getByRole("combobox", { name: /category/i }), "sports");
    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({ category: "sports" }),
    );
  });
});

// ─── Status filter ────────────────────────────────────────────────────────────

describe("status filter", () => {
  it("shows only open markets", async () => {
    const user = userEvent.setup();
    renderSearch();
    await openFilters(user);
    await user.selectOptions(screen.getByRole("combobox", { name: /status/i }), "open");
    expect(screen.getByText(/2 results/i)).toBeInTheDocument();
    expect(screen.getByText("Will AA123 arrive on time?")).toBeInTheDocument();
    expect(screen.getByText("Will Bitcoin exceed $100k by EOY?")).toBeInTheDocument();
  });

  it("shows only closed markets", async () => {
    const user = userEvent.setup();
    renderSearch();
    await openFilters(user);
    await user.selectOptions(screen.getByRole("combobox", { name: /status/i }), "closed");
    expect(screen.getByText(/1 results/i)).toBeInTheDocument();
    expect(screen.getByText("Lakers championship 2026?")).toBeInTheDocument();
  });

  it("combines category + status filters", async () => {
    const user = userEvent.setup();
    renderSearch();
    await openFilters(user);
    await user.selectOptions(screen.getByRole("combobox", { name: /category/i }), "crypto");
    await user.selectOptions(screen.getByRole("combobox", { name: /status/i }), "closed");
    // No crypto+closed market in fixture
    expect(screen.getByText(/0 results/i)).toBeInTheDocument();
  });
});

// ─── Volume / liquidity range filters ────────────────────────────────────────

describe("volume filter", () => {
  it("applies min volume filter", async () => {
    const user = userEvent.setup();
    renderSearch();
    await openFilters(user);
    await user.type(screen.getByRole("spinbutton", { name: /min volume/i }), "50000");
    // Only Bitcoin (125000) and Lakers (45000 < 50000 so excluded)
    expect(screen.getByText(/1 results/i)).toBeInTheDocument();
    expect(screen.getByText("Will Bitcoin exceed $100k by EOY?")).toBeInTheDocument();
  });

  it("applies max volume filter", async () => {
    const user = userEvent.setup();
    renderSearch();
    await openFilters(user);
    await user.type(screen.getByRole("spinbutton", { name: /max volume/i }), "5000");
    // Only Fed rate (3000)
    expect(screen.getByText(/1 results/i)).toBeInTheDocument();
    expect(screen.getByText("Fed rate cut Q2 2026?")).toBeInTheDocument();
  });

  it("applies min liquidity filter", async () => {
    const user = userEvent.setup();
    renderSearch();
    await openFilters(user);
    await user.type(screen.getByRole("spinbutton", { name: /min liquidity/i }), "10000");
    // Bitcoin (45000) and Lakers (18000) qualify; AA123 (5400) and Fed (500) do not
    expect(screen.getByText(/2 results/i)).toBeInTheDocument();
  });
});

// ─── Sort order ───────────────────────────────────────────────────────────────

describe("sort order", () => {
  it("sorts by volume descending", async () => {
    const user = userEvent.setup();
    renderSearch();
    await openFilters(user);
    await user.selectOptions(screen.getByRole("combobox", { name: /sort by/i }), "volume");
    const cards = screen.getAllByRole("heading", { level: 3 });
    // Bitcoin (125k) > Lakers (45k) > AA123 (14820) > Fed (3000)
    expect(cards[0]).toHaveTextContent("Will Bitcoin exceed $100k by EOY?");
    expect(cards[1]).toHaveTextContent("Lakers championship 2026?");
  });

  it("sorts by liquidity descending", async () => {
    const user = userEvent.setup();
    renderSearch();
    await openFilters(user);
    await user.selectOptions(screen.getByRole("combobox", { name: /sort by/i }), "liquidity");
    const cards = screen.getAllByRole("heading", { level: 3 });
    // Bitcoin (45000) > Lakers (18000) > AA123 (5400) > Fed (500)
    expect(cards[0]).toHaveTextContent("Will Bitcoin exceed $100k by EOY?");
  });

  it("sorts by date newest first", async () => {
    const user = userEvent.setup();
    renderSearch();
    await openFilters(user);
    await user.selectOptions(screen.getByRole("combobox", { name: /sort by/i }), "date");
    const cards = screen.getAllByRole("heading", { level: 3 });
    // AA123 (Apr 20) > Bitcoin (Apr 15) > Lakers (Apr 10) > Fed (Apr 5)
    expect(cards[0]).toHaveTextContent("Will AA123 arrive on time?");
  });

  it("relevance sort places exact title match first", async () => {
    const user = userEvent.setup();
    renderSearch();
    // "bitcoin" appears in title of market 2 at position 5 ("Will Bitcoin…")
    await user.type(screen.getByPlaceholderText(/search markets/i), "bitcoin");
    const cards = screen.getAllByRole("heading", { level: 3 });
    expect(cards[0]).toHaveTextContent("Will Bitcoin exceed $100k by EOY?");
  });
});

// ─── Empty results ────────────────────────────────────────────────────────────

describe("empty results", () => {
  it("shows 'No markets found' when nothing matches a text query", async () => {
    const user = userEvent.setup();
    renderSearch();
    await user.type(
      screen.getByPlaceholderText(/search markets/i),
      "xyzzy-no-match-8675309",
    );
    expect(screen.getByText(/no markets found/i)).toBeInTheDocument();
    expect(screen.getByText(/0 results/i)).toBeInTheDocument();
  });

  it("shows 'No markets found' when category filter yields nothing", async () => {
    const user = userEvent.setup();
    renderSearch();
    await openFilters(user);
    // "politics" category has no markets in fixtures
    await user.selectOptions(screen.getByRole("combobox", { name: /category/i }), "politics");
    expect(screen.getByText(/no markets found/i)).toBeInTheDocument();
  });

  it("shows an unavailable state when the source has no markets", () => {
    renderSearch([]);
    expect(screen.getByText(/no markets are available/i)).toBeInTheDocument();
    expect(screen.getByText(/0 results/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse markets/i })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: /view favorites/i })).toHaveAttribute("href", "/favorites");
  });

  it("clears a no-match search from the empty state", async () => {
    const user = userEvent.setup();
    renderSearch();
    await user.type(screen.getByPlaceholderText(/search markets/i), "xyzzy-no-match-8675309");
    await user.click(screen.getByRole("button", { name: /clear search and filters/i }));

    expect(screen.getByText(/4 results/i)).toBeInTheDocument();
    expect(screen.getByText("Will AA123 arrive on time?")).toBeInTheDocument();
  });

  it("shows loading feedback instead of empty results while isLoading is true", () => {
    renderSearch(MARKETS, vi.fn(), true);
    expect(screen.getByText(/searching…/i)).toBeInTheDocument();
    expect(screen.getByTestId("market-list-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("market-list-empty")).not.toBeInTheDocument();
    expect(screen.queryByText("Will AA123 arrive on time?")).not.toBeInTheDocument();
  });

  it("shows request failure and retry instead of empty results", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    renderSearch([], vi.fn(), false, "The server could not be reached.", onRetry);

    expect(screen.getByRole("alert")).toHaveTextContent(/unable to load markets/i);
    expect(screen.getByRole("alert")).toHaveTextContent(/server could not be reached/i);
    expect(screen.queryByTestId("market-list-empty")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

// ─── Clear filters ────────────────────────────────────────────────────────────

describe("clear filters", () => {
  it("restores all results after clearing active filters", async () => {
    const user = userEvent.setup();
    renderSearch();
    await openFilters(user);
    await user.selectOptions(screen.getByRole("combobox", { name: /category/i }), "crypto");
    expect(screen.getByText(/1 results/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /clear filters/i }));
    expect(screen.getByText(/4 results/i)).toBeInTheDocument();
  });

  it("hides the Clear Filters button when no filters are active", () => {
    renderSearch();
    // Filters panel not shown by default, but even if it were:
    expect(screen.queryByRole("button", { name: /clear filters/i })).not.toBeInTheDocument();
  });
});

// ─── Saved search ─────────────────────────────────────────────────────────────

describe("saved searches", () => {
  it("saves a search with a non-empty query and shows it in the dropdown", async () => {
    const user = userEvent.setup();
    renderSearch();
    await user.type(screen.getByPlaceholderText(/search markets/i), "Lakers");
    await openFilters(user);
    await user.click(screen.getByRole("button", { name: /save search/i }));
    // Open saved-search dropdown (bookmark button)
    await user.click(screen.getAllByRole("button").find((b) => b.querySelector("svg"))!);
    expect(screen.getByText("Lakers")).toBeInTheDocument();
  });

  it("does not save a search when query is empty", async () => {
    const user = userEvent.setup();
    renderSearch();
    await openFilters(user);
    await user.click(screen.getByRole("button", { name: /save search/i }));
    // Bookmark button — no dropdown should appear because nothing was saved
    const bookmarkBtn = screen.getByRole("button", { name: "" });
    // clicking it with no saved searches should silently do nothing (no dropdown text)
    await user.click(bookmarkBtn);
    expect(screen.queryByText(/saved searches/i)).not.toBeInTheDocument();
  });
});

// ─── Share / URL construction ─────────────────────────────────────────────────

describe("share search URL", () => {
  beforeEach(() => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: { origin: "https://gatedelay.io", pathname: "/markets/search" },
    });
    Object.defineProperty(navigator, "clipboard", {
      writable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    vi.stubGlobal("alert", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("copies a URL containing q= when query is set", async () => {
    const user = userEvent.setup();
    renderSearch();
    await user.type(screen.getByPlaceholderText(/search markets/i), "bitcoin");
    await openFilters(user);
    await user.click(screen.getByRole("button", { name: /share/i }));
    const written = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(written).toContain("q=bitcoin");
    expect(written).toContain("/markets/search");
  });

  it("includes category in the shared URL when selected", async () => {
    const user = userEvent.setup();
    renderSearch();
    await openFilters(user);
    await user.selectOptions(screen.getByRole("combobox", { name: /category/i }), "crypto");
    await user.click(screen.getByRole("button", { name: /share/i }));
    const written = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(written).toContain("category=crypto");
  });

  it("includes sort param in the shared URL", async () => {
    const user = userEvent.setup();
    renderSearch();
    await openFilters(user);
    await user.selectOptions(screen.getByRole("combobox", { name: /sort by/i }), "volume");
    await user.click(screen.getByRole("button", { name: /share/i }));
    const written = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(written).toContain("sort=volume");
  });
});

// ─── URL / query-state: SearchPage integration ────────────────────────────────

describe("SearchPage URL query-state reading", () => {
  /**
   * The SearchPage reads q, category, and status from useSearchParams() on
   * mount (currently logged, not yet wired to initial filter state). We verify
   * that the hook is called and that the component does not crash with params.
   */

  function makeSearchParams(init: Record<string, string>): ReadonlyURLSearchParams {
    return new URLSearchParams(init) as unknown as ReadonlyURLSearchParams;
  }

  it("mounts without crashing when URL has q, category, and status", async () => {
    mockSearchParams.mockReturnValue(
      makeSearchParams({ q: "bitcoin", category: "crypto", status: "open" }),
    );

    // Dynamic import to keep the module isolated per test
    const { default: SearchPage } = await import("../../markets/search/page");
    expect(() =>
      render(
        <Suspense fallback={null}>
          <SearchPage />
        </Suspense>,
      ),
    ).not.toThrow();
  });

  it("mounts without crashing when URL has no search params", async () => {
    mockSearchParams.mockReturnValue(makeSearchParams({}));
    const { default: SearchPage } = await import("../../markets/search/page");
    expect(() =>
      render(
        <Suspense fallback={null}>
          <SearchPage />
        </Suspense>,
      ),
    ).not.toThrow();
  });

  it("calls useSearchParams on mount", async () => {
    mockSearchParams.mockReturnValue(makeSearchParams({ q: "lakers" }));
    const { default: SearchPage } = await import("../../markets/search/page");
    render(
      <Suspense fallback={null}>
        <SearchPage />
      </Suspense>,
    );
    await waitFor(() => expect(mockSearchParams).toHaveBeenCalled());
  });
});
