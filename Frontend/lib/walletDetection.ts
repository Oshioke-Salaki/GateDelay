/**
 * Defensive wallet-provider detection for browser environments.
 * Never assumes `window.ethereum` or other injected globals exist.
 */

export type EthereumProvider = {
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  providers?: EthereumProvider[];
};

function readEthereum(): EthereumProvider | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const eth = (window as Window & { ethereum?: EthereumProvider }).ethereum;
    return eth;
  } catch {
    return undefined;
  }
}

/** Safely detect MetaMask (or compatible injected EIP-1193 provider). */
export function isMetaMaskInstalled(): boolean {
  const ethereum = readEthereum();
  if (!ethereum) return false;

  if (ethereum.isMetaMask) return true;

  // Some browsers expose multiple providers (e.g. EIP-6963 aggregator)
  if (Array.isArray(ethereum.providers)) {
    return ethereum.providers.some((p) => p.isMetaMask);
  }

  return false;
}

/** True when any injected EIP-1193 provider is present. */
export function hasInjectedWalletProvider(): boolean {
  return readEthereum() !== undefined;
}

/** Particle ConnectKit requires these public env vars at build time. */
export function isParticleConnectKitConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_PROJECT_ID &&
      process.env.NEXT_PUBLIC_CLIENT_KEY &&
      process.env.NEXT_PUBLIC_APP_ID,
  );
}

/** User can attempt a wallet connection (injected and/or Particle). */
export function hasAnyWalletConnectionPath(): boolean {
  return hasInjectedWalletProvider() || isParticleConnectKitConfigured();
}
