import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ArchiveView from "../../components/archive/ArchiveView";
import type { ArchivedMarket } from "../../app/archive/page";

const sampleMarkets: ArchivedMarket[] = [
  {
    id: "1",
    title: "Will AA123 arrive on time?",
    description: "American Airlines flight AA123 from JFK to LAX.",
    category: "flight",
    resolvedOutcome: "yes",
    resolutionDate: "2026-04-20T18:30:00Z",
    volume: 10000,
    participants: 50,
    createdAt: "2026-04-15T10:00:00Z",
    endDate: "2026-04-20T18:00:00Z",
    finalPrice: 0.8,
  },
  {
    id: "2",
    title: "Will UA456 be delayed?",
    description: "United Airlines flight UA456 from ORD to SFO.",
    category: "flight",
    resolvedOutcome: "no",
    resolutionDate: "2026-04-19T22:15:00Z",
    volume: 5000,
    participants: 20,
    createdAt: "2026-04-14T14:30:00Z",
    endDate: "2026-04-19T21:00:00Z",
    finalPrice: 0.2,
  },
  {
    id: "3",
    title: "Will Bitcoin exceed $90k?",
    description: "Bitcoin price prediction for April 2026.",
    category: "crypto",
    resolvedOutcome: "cancelled",
    resolutionDate: "2026-04-18T14:00:00Z",
    volume: 15000,
    participants: 30,
    createdAt: "2026-04-01T08:00:00Z",
    endDate: "2026-04-18T12:00:00Z",
    finalPrice: 0.5,
  },
];

describe("ArchiveView Component", () => {
  it("renders statistics correctly", () => {
    render(<ArchiveView markets={sampleMarkets} />);

    // Total Volume = 10000 + 5000 + 15000 = 30,000
    expect(screen.getByTestId("stats-total-volume")).toHaveTextContent("30,000");

    // Total Participants = 50 + 20 + 30 = 100
    expect(screen.getByTestId("stats-total-participants")).toHaveTextContent("100");

    // Avg Price = (0.8 + 0.2 + 0.5) / 3 = 0.50
    expect(screen.getByTestId("stats-avg-price")).toHaveTextContent("$0.50");

    // Total Count
    expect(screen.getByTestId("archive-results-count")).toHaveTextContent("3 Markets Found");
  });

  it("filters markets by search query", () => {
    render(<ArchiveView markets={sampleMarkets} />);

    const searchInput = screen.getByTestId("archive-search-input");
    fireEvent.change(searchInput, { target: { value: "Bitcoin" } });

    expect(screen.getByTestId("archive-results-count")).toHaveTextContent("1 Market Found");
    expect(screen.getByText("Will Bitcoin exceed $90k?")).toBeInTheDocument();
    expect(screen.queryByText("Will AA123 arrive on time?")).not.toBeInTheDocument();
  });

  it("filters markets by resolved outcome", () => {
    render(<ArchiveView markets={sampleMarkets} />);

    const yesFilter = screen.getByTestId("filter-outcome-yes");
    fireEvent.click(yesFilter);

    expect(screen.getByTestId("archive-results-count")).toHaveTextContent("1 Market Found");
    expect(screen.getByText("Will AA123 arrive on time?")).toBeInTheDocument();

    // Toggle off
    fireEvent.click(yesFilter);
    expect(screen.getByTestId("archive-results-count")).toHaveTextContent("3 Markets Found");
  });

  it("filters markets by category", () => {
    render(<ArchiveView markets={sampleMarkets} />);

    const cryptoFilter = screen.getByTestId("filter-category-crypto");
    fireEvent.click(cryptoFilter);

    expect(screen.getByTestId("archive-results-count")).toHaveTextContent("1 Market Found");
    expect(screen.getByText("Will Bitcoin exceed $90k?")).toBeInTheDocument();
  });

  it("filters markets by date range", () => {
    render(<ArchiveView markets={sampleMarkets} />);

    const dateFrom = screen.getByTestId("date-from-input");
    const dateTo = screen.getByTestId("date-to-input");

    fireEvent.change(dateFrom, { target: { value: "2026-04-19" } });
    fireEvent.change(dateTo, { target: { value: "2026-04-21" } });

    // Should include AA123 (Apr 20) and UA456 (Apr 19)
    expect(screen.getByTestId("archive-results-count")).toHaveTextContent("2 Markets Found");
    expect(screen.queryByText("Will Bitcoin exceed $90k?")).not.toBeInTheDocument();
  });

  it("displays empty state message when no markets match filters", () => {
    render(<ArchiveView markets={sampleMarkets} />);

    const searchInput = screen.getByTestId("archive-search-input");
    fireEvent.change(searchInput, { target: { value: "NonExistentMarket" } });

    expect(screen.getByTestId("archive-results-count")).toHaveTextContent("0 Markets Found");
    expect(screen.getByTestId("archive-empty-state")).toBeInTheDocument();
    expect(screen.getByText("No markets match your filters")).toBeInTheDocument();
  });
});
