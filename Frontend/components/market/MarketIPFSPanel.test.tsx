import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MarketIPFSPanel from "./MarketIPFSPanel";

const mockIPFS = vi.hoisted(() => ({
  clearError: vi.fn(),
  uploadJSON: vi.fn(),
  retrieve: vi.fn(),
  pin: vi.fn(),
}));

vi.mock("@/hooks/useIPFS", () => ({
  useIPFS: () => ({
    status: "idle",
    hash: null,
    gatewayUrl: null,
    storageStatus: null,
    error: null,
    ...mockIPFS,
  }),
}));

const uploadedResult = {
  hash: "Qm12345678901234567890123456789012345678901234",
  url: "https://gateway.pinata.cloud/ipfs/Qm12345678901234567890123456789012345678901234",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIPFS.uploadJSON
    .mockRejectedValueOnce(new Error("Network unavailable"))
    .mockResolvedValue(uploadedResult);
});

describe("MarketIPFSPanel upload recovery", () => {
  it("retries the original payload after a failed upload", async () => {
    const user = userEvent.setup();
    const marketData = { title: "Delay at Gate 12", description: "Entered details" };
    const onUploadComplete = vi.fn();

    render(<MarketIPFSPanel marketData={marketData} onUploadComplete={onUploadComplete} />);
    await user.click(screen.getByRole("button", { name: "Store Market Data on IPFS" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Network unavailable");

    await user.click(screen.getByRole("button", { name: "Retry upload" }));

    await waitFor(() => expect(onUploadComplete).toHaveBeenCalledWith(uploadedResult.hash, uploadedResult.url));
    expect(mockIPFS.uploadJSON).toHaveBeenNthCalledWith(1, marketData, { name: "GateDelay-Market-Metadata" });
    expect(mockIPFS.uploadJSON).toHaveBeenNthCalledWith(2, marketData, { name: "GateDelay-Market-Metadata" });
    expect(screen.queryByRole("button", { name: "Retry upload" })).not.toBeInTheDocument();
  });

  it("cancels the retry prompt without clearing entered market data", async () => {
    const user = userEvent.setup();
    const marketData = { title: "Delay at Gate 12", description: "Entered details" };

    render(<MarketIPFSPanel marketData={marketData} />);
    await user.click(screen.getByRole("button", { name: "Store Market Data on IPFS" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Network unavailable");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mockIPFS.clearError).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Store Market Data on IPFS" }));
    await waitFor(() => expect(mockIPFS.uploadJSON).toHaveBeenCalledTimes(2));
    expect(mockIPFS.uploadJSON).toHaveBeenLastCalledWith(marketData, { name: "GateDelay-Market-Metadata" });
  });
});
