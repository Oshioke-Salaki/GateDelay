import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import ArchivePage from "../../app/archive/page";

const mockMarkets = [
  {
    id: "1",
    title: "Will AA123 arrive on time?",
    description: "American Airlines flight AA123.",
    category: "flight",
    resolvedOutcome: "yes" as const,
    resolutionDate: "2026-04-20T18:30:00Z",
    volume: 14820,
    participants: 87,
    createdAt: "2026-04-15T10:00:00Z",
    endDate: "2026-04-20T18:00:00Z",
    finalPrice: 0.78,
  },
  {
    id: "2",
    title: "Will UA456 be delayed?",
    description: "United Airlines flight UA456.",
    category: "flight",
    resolvedOutcome: "no" as const,
    resolutionDate: "2026-04-19T22:15:00Z",
    volume: 8300,
    participants: 45,
    createdAt: "2026-04-14T14:30:00Z",
    endDate: "2026-04-19T21:00:00Z",
    finalPrice: 0.22,
  },
];

describe("ArchivePage Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders page header and loading skeleton initially", () => {
    vi.spyOn(global, "fetch").mockImplementation(
      () => new Promise(() => {}) // never resolves to stay in loading state
    );

    render(<ArchivePage />);

    expect(screen.getByText("Market Archive")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Browse resolved and inactive markets with performance statistics"
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId("archive-loading")).toBeInTheDocument();
  });

  it("fetches and displays archived markets when fetch succeeds", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ markets: mockMarkets }),
    } as Response);

    render(<ArchivePage />);

    await waitFor(() => {
      expect(screen.queryByTestId("archive-loading")).not.toBeInTheDocument();
    });

    expect(screen.getByTestId("archive-view")).toBeInTheDocument();
    expect(screen.getByText("Will AA123 arrive on time?")).toBeInTheDocument();
    expect(screen.getByText("Will UA456 be delayed?")).toBeInTheDocument();
  });

  it("displays error state when fetch fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    render(<ArchivePage />);

    await waitFor(() => {
      expect(screen.getByTestId("archive-error-container")).toBeInTheDocument();
    });

    expect(screen.getByTestId("archive-error-message")).toHaveTextContent(
      "Failed to fetch archive data (500)"
    );
    expect(screen.getByTestId("archive-retry-button")).toBeInTheDocument();
  });

  it("retries fetching data when retry button is clicked", async () => {
    // First fetch fails
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response)
      // Second fetch succeeds
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ markets: mockMarkets }),
      } as Response);

    render(<ArchivePage />);

    await waitFor(() => {
      expect(screen.getByTestId("archive-error-container")).toBeInTheDocument();
    });

    const retryBtn = screen.getByTestId("archive-retry-button");
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByTestId("archive-view")).toBeInTheDocument();
    });

    expect(screen.getByText("Will AA123 arrive on time?")).toBeInTheDocument();
  });
});
