import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ConnectModal from "./ConnectModal";
import { isParticleConnectKitConfigured } from "../../lib/walletDetection";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock("../../lib/walletDetection", async () => {
  const actual = await vi.importActual<typeof import("../../lib/walletDetection")>(
    "../../lib/walletDetection",
  );
  return {
    ...actual,
    isParticleConnectKitConfigured: vi.fn(() => false),
  };
});

describe("ConnectModal", () => {
  beforeEach(() => {
    delete (window as Window & { ethereum?: unknown }).ethereum;
    vi.mocked(isParticleConnectKitConfigured).mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders empty state when no injected wallet and Particle is not configured", () => {
    render(<ConnectModal isOpen onClose={() => {}} />);
    expect(screen.getByTestId("wallet-empty-state")).toBeInTheDocument();
    expect(screen.getByText(/No wallet providers detected/i)).toBeInTheDocument();
  });

  it("mounts without uncaught errors when wallet globals are missing", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ConnectModal isOpen onClose={() => {}} />)).not.toThrow();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("shows wallet options when Particle ConnectKit env is configured", () => {
    vi.mocked(isParticleConnectKitConfigured).mockReturnValue(true);

    render(<ConnectModal isOpen onClose={() => {}} />);
    expect(screen.queryByTestId("wallet-empty-state")).not.toBeInTheDocument();
    expect(screen.getByText("MetaMask")).toBeInTheDocument();
    expect(screen.getByText("WalletConnect")).toBeInTheDocument();
  });

  it("shows MetaMask when injected without Particle (connection requires Particle)", () => {
    (window as Window & { ethereum?: { isMetaMask?: boolean } }).ethereum = {
      isMetaMask: true,
    };

    render(<ConnectModal isOpen onClose={() => {}} />);
    expect(screen.queryByTestId("wallet-empty-state")).not.toBeInTheDocument();
    expect(screen.getByText("MetaMask")).toBeInTheDocument();
    expect(screen.getByText(/Browser wallet detected/i)).toBeInTheDocument();
  });
});
