import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  hasInjectedWalletProvider,
  isMetaMaskInstalled,
  isParticleConnectKitConfigured,
  hasAnyWalletConnectionPath,
} from "./walletDetection";

describe("walletDetection", () => {
  const originalEthereum = (window as Window & { ethereum?: unknown }).ethereum;

  beforeEach(() => {
    delete (window as Window & { ethereum?: unknown }).ethereum;
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    if (originalEthereum !== undefined) {
      (window as Window & { ethereum?: unknown }).ethereum = originalEthereum;
    } else {
      delete (window as Window & { ethereum?: unknown }).ethereum;
    }
  });

  it("does not throw when window.ethereum is absent", () => {
    expect(() => hasInjectedWalletProvider()).not.toThrow();
    expect(hasInjectedWalletProvider()).toBe(false);
    expect(isMetaMaskInstalled()).toBe(false);
  });

  it("detects MetaMask when injected provider is present", () => {
    (window as Window & { ethereum?: { isMetaMask?: boolean } }).ethereum = {
      isMetaMask: true,
    };
    expect(hasInjectedWalletProvider()).toBe(true);
    expect(isMetaMaskInstalled()).toBe(true);
  });

  it("reports connection paths from Particle env or injected wallet", () => {
    expect(hasAnyWalletConnectionPath()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_PROJECT_ID", "pid");
    vi.stubEnv("NEXT_PUBLIC_CLIENT_KEY", "key");
    vi.stubEnv("NEXT_PUBLIC_APP_ID", "app");
    expect(isParticleConnectKitConfigured()).toBe(true);
    expect(hasAnyWalletConnectionPath()).toBe(true);
  });
});
