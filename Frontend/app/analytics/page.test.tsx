import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AnalyticsPage from "./page";

const metrics = {
  totalTrades: 0,
  winRate: 0,
  totalProfit: 0,
  totalLoss: 0,
  averageTradeSize: 0,
  bestTrade: 0,
  worstTrade: 0,
};

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response;
}

function installAnalyticsFetch(historyResponse: Response | Promise<Response> = jsonResponse([])) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("trade-history")) return Promise.resolve(historyResponse);
    if (url.includes("/metrics")) return Promise.resolve(jsonResponse(metrics));
    return Promise.resolve(jsonResponse([]));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AnalyticsPage", () => {
  it("shows empty chart states and filters history by the selected date range", async () => {
    const user = userEvent.setup();
    const fetchMock = installAnalyticsFetch();
    render(<AnalyticsPage />);

    expect(await screen.findByText("No portfolio metrics are available yet.")).toBeInTheDocument();
    expect(await screen.findAllByText("No data available for this date range.")).toHaveLength(4);

    const filters = screen.getByRole("group", { name: "Filter analytics by date range" });
    expect(within(filters).getByRole("button", { name: "30D" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(filters).getByRole("button", { name: "7D" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/analytics/trade-history?range=7d",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
    expect(within(filters).getByRole("button", { name: "7D" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows an inline error when the selected range cannot be loaded", async () => {
    installAnalyticsFetch(jsonResponse({ message: "Unavailable" }, 503));
    render(<AnalyticsPage />);

    expect(await screen.findByText(/Could not load chart data: Request failed \(503\)/)).toBeInTheDocument();
    expect(screen.getByText("Win/Loss Distribution")).toBeInTheDocument();
  });

  it("keeps charts in a loading state while a newly selected range is pending", async () => {
    const user = userEvent.setup();
    let resolveHistory: ((response: Response) => void) | undefined;
    const pendingHistory = new Promise<Response>((resolve) => {
      resolveHistory = resolve;
    });
    installAnalyticsFetch(pendingHistory);
    render(<AnalyticsPage />);

    await screen.findByText("No portfolio metrics are available yet.");
    const filters = screen.getByRole("group", { name: "Filter analytics by date range" });
    await user.click(within(filters).getByRole("button", { name: "7D" }));
    expect(await screen.findByText("Updating…")).toBeInTheDocument();

    await act(async () => {
      resolveHistory?.(jsonResponse([]));
      await pendingHistory;
    });
    expect(await screen.findAllByText("No data available for this date range.")).toHaveLength(4);
  });
});
