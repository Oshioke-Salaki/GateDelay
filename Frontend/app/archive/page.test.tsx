import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ArchivePage from "./page";
import type { ArchivedMarket } from "../../components/archive/types";

/**
 * Happy path plus the failure states for `/archive`.
 *
 * The page previously held a static mock array with `isLoading` pinned to
 * `false`, so there was no loading, error or empty state to exercise — and a
 * real backend failure had nowhere to surface. These cover all four.
 */

const MARKETS: ArchivedMarket[] = [
  {
    id: "1",
    title: "Will AA123 arrive on time?",
    description: "American Airlines flight AA123 from JFK to LAX.",
    category: "flight",
    resolvedOutcome: "yes",
    resolutionDate: "2026-04-20T18:30:00Z",
    volume: 14820,
    participants: 87,
    createdAt: "2026-04-15T10:00:00Z",
    endDate: "2026-04-20T18:00:00Z",
    finalPrice: 0.78,
  },
  {
    id: "2",
    title: "Will UA456 be delayed over 30 min?",
    description: "United Airlines flight UA456 from ORD to SFO.",
    category: "flight",
    resolvedOutcome: "no",
    resolutionDate: "2026-04-19T22:15:00Z",
    volume: 8300,
    participants: 45,
    createdAt: "2026-04-14T14:30:00Z",
    endDate: "2026-04-19T21:00:00Z",
    finalPrice: 0.22,
  },
];

function mockFetchOnce(impl: () => Promise<unknown> | unknown) {
  const fetchMock = vi.fn(async () => impl());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: async () => body,
  };
}

describe("ArchivePage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(MARKETS)));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("always renders the page heading", () => {
    render(<ArchivePage />);
    expect(
      screen.getByRole("heading", { name: /market archive/i, level: 1 }),
    ).toBeInTheDocument();
  });

  it("shows a labelled loading state on first paint", () => {
    render(<ArchivePage />);
    // The first render must be identical server- and client-side; data only
    // arrives in an effect, so this is what hydration reconciles against.
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/loading archived markets/i)).toBeInTheDocument();
  });

  it("fetches through the /api/archive proxy, not the backend directly", async () => {
    const fetchMock = mockFetchOnce(() => jsonResponse(MARKETS));
    render(<ArchivePage />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(String(url)).toMatch(/^\/api\/archive/);
    expect(String(url)).not.toMatch(/localhost/);
  });

  it("renders the markets it received", async () => {
    render(<ArchivePage />);

    expect(
      await screen.findByText("Will AA123 arrive on time?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Will UA456 be delayed over 30 min?"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("accepts a { data: [...] } envelope as well as a bare array", async () => {
    mockFetchOnce(() => jsonResponse({ data: MARKETS }));
    render(<ArchivePage />);

    expect(
      await screen.findByText("Will AA123 arrive on time?"),
    ).toBeInTheDocument();
  });

  it("drops malformed rows instead of crashing the list", async () => {
    mockFetchOnce(() => jsonResponse([MARKETS[0], { id: "bad" }, null]));
    render(<ArchivePage />);

    expect(
      await screen.findByText("Will AA123 arrive on time?"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an empty state rather than a blank page", async () => {
    mockFetchOnce(() => jsonResponse([]));
    render(<ArchivePage />);

    expect(await screen.findByText(/no resolved markets yet/i)).toBeInTheDocument();
  });

  it("surfaces the backend's reason when the request fails", async () => {
    mockFetchOnce(() =>
      jsonResponse({ error: "NEXT_PUBLIC_API_URL is not set." }, false, 500),
    );
    render(<ArchivePage />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/could not load the market archive/i);
    expect(alert).toHaveTextContent(/NEXT_PUBLIC_API_URL is not set/);
  });

  it("surfaces a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("Failed to fetch");
      }),
    );
    render(<ArchivePage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/failed to fetch/i);
  });

  it("retries after a failure", async () => {
    let attempt = 0;
    const fetchMock = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error("Failed to fetch");
      return jsonResponse(MARKETS);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ArchivePage />);
    await screen.findByRole("alert");

    await userEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(
      await screen.findByText("Will AA123 arrive on time?"),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
