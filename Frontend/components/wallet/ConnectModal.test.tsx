import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ConnectModal from "./ConnectModal";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

describe("ConnectModal", () => {
  beforeEach(() => {
    delete (window as Window & { ethereum?: unknown }).ethereum;
    vi.unstubAllEnvs();
  });

  afterEach(() => {
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
    vi.stubEnv("NEXT_PUBLIC_PROJECT_ID", "test-project");
    vi.stubEnv("NEXT_PUBLIC_CLIENT_KEY", "test-client");
    vi.stubEnv("NEXT_PUBLIC_APP_ID", "test-app");

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
