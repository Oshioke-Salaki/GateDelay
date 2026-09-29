import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NetworkMismatchBanner } from "./NetworkMismatchBanner";

const wallet = vi.hoisted(() => ({
  chainId: 1 as number | undefined,
  isConnected: true,
  supportsSwitching: true,
  switchChainAsync: vi.fn(),
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({
    chainId: wallet.chainId,
    isConnected: wallet.isConnected,
    connector: wallet.supportsSwitching ? { switchChain: vi.fn() } : {},
  }),
  useSwitchChain: () => ({
    chains: [
      { id: 5000, name: "Mantle" },
      { id: 1, name: "Ethereum" },
    ],
    isPending: false,
    switchChainAsync: wallet.switchChainAsync,
  }),
}));

describe("NetworkMismatchBanner", () => {
  beforeEach(() => {
    wallet.chainId = 1;
    wallet.isConnected = true;
    wallet.supportsSwitching = true;
    wallet.switchChainAsync.mockReset().mockResolvedValue({ id: 5000 });
  });

  it("shows the connected network and switch action when the network differs", () => {
    render(<NetworkMismatchBanner />);

    expect(screen.getByRole("alert")).toHaveTextContent("Ethereum");
    expect(screen.getByRole("button", { name: "Switch to Mantle" })).toBeInTheDocument();
  });

  it("switches to Mantle when requested", () => {
    render(<NetworkMismatchBanner />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to Mantle" }));

    expect(wallet.switchChainAsync).toHaveBeenCalledWith({ chainId: 5000 });
  });

  it("omits the switch action when the connector does not support switching", () => {
    wallet.supportsSwitching = false;
    render(<NetworkMismatchBanner />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("stays hidden when disconnected or already on Mantle", () => {
    wallet.isConnected = false;
    const disconnected = render(<NetworkMismatchBanner />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    disconnected.unmount();
    wallet.isConnected = true;
    wallet.chainId = 5000;
    render(<NetworkMismatchBanner />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});