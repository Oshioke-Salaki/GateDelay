/**
 * Chain registry — single source of truth for every network the nonce manager
 * is allowed to operate on.
 *
 * Adding a network:
 *   1. Add an entry to CHAIN_REGISTRY with a canonical name, chainId and RPC
 *      URL env-var key.
 *   2. Optionally add lowercase aliases to CHAIN_ALIASES that point to the
 *      canonical name.
 *
 * All lookups (including aliases) are normalised to lowercase before matching.
 */

import { BadRequestException } from '@nestjs/common';

export interface ChainEntry {
  /** Canonical human-readable name (lowercase). */
  name: string;
  /** EIP-155 chain ID — the authoritative identity used for cache keys. */
  chainId: number;
  /**
   * RPC URL.  Resolved at runtime so callers can override via environment
   * variables without redeploying.
   */
  rpcUrl: string;
}

/**
 * Canonical registry entries.  The `rpcUrl` field is resolved eagerly from
 * `process.env` so that the registry can be constructed without NestJS DI;
 * the NonceManagerService passes the resolved URL down.
 *
 * Key = canonical name (lowercase).
 */
const CHAIN_REGISTRY: Record<string, Omit<ChainEntry, 'name'>> = {
  mantle: {
    chainId: 5000,
    rpcUrl:
      process.env.BLOCKCHAIN_RPC_URL_MANTLE ??
      process.env.BLOCKCHAIN_RPC_URL ??
      'https://rpc.mantle.xyz',
  },
  'mantle-testnet': {
    chainId: 5001,
    rpcUrl:
      process.env.BLOCKCHAIN_RPC_URL_MANTLE_TESTNET ??
      'https://rpc.testnet.mantle.xyz',
  },
  mainnet: {
    chainId: 1,
    rpcUrl:
      process.env.BLOCKCHAIN_RPC_URL_MAINNET ??
      process.env.MAINNET_RPC_URL ??
      'https://eth-mainnet.g.alchemy.com/v2/demo',
  },
  goerli: {
    chainId: 5,
    rpcUrl:
      process.env.BLOCKCHAIN_RPC_URL_GOERLI ??
      process.env.TESTNET_RPC_URL ??
      'https://eth-goerli.g.alchemy.com/v2/demo',
  },
  polygon: {
    chainId: 137,
    rpcUrl:
      process.env.BLOCKCHAIN_RPC_URL_POLYGON ??
      process.env.POLYGON_RPC_URL ??
      'https://polygon-rpc.com',
  },
  'polygon-amoy': {
    chainId: 80002,
    rpcUrl:
      process.env.BLOCKCHAIN_RPC_URL_POLYGON_AMOY ??
      'https://rpc-amoy.polygon.technology',
  },
};

/**
 * Alias table — maps alternate names to their canonical name.
 * All values must be keys that exist in CHAIN_REGISTRY.
 */
const CHAIN_ALIASES: Record<string, string> = {
  mnt: 'mantle',
  ethereum: 'mainnet',
  eth: 'mainnet',
  homestead: 'mainnet',
  testnet: 'goerli',
  matic: 'polygon',
  pol: 'polygon',
};

// ── Public helpers ─────────────────────────────────────────────────────────────

/**
 * Resolve a network label (name or alias) to a ChainEntry.
 *
 * @throws BadRequestException for any name not in the allowlist.
 */
export function resolveChain(network: string): ChainEntry {
  const normalized = (network ?? '').trim().toLowerCase();
  const canonical = CHAIN_ALIASES[normalized] ?? normalized;
  const entry = CHAIN_REGISTRY[canonical];

  if (!entry) {
    throw new BadRequestException(
      `Unknown or unsupported network "${network}". ` +
        `Supported networks: ${Object.keys(CHAIN_REGISTRY).join(', ')}.`,
    );
  }

  return { name: canonical, ...entry };
}

/**
 * Return the canonical chain entry for a given numeric chain ID.
 *
 * @throws BadRequestException if no registered chain matches.
 */
export function resolveChainById(chainId: number): ChainEntry {
  const entry = Object.entries(CHAIN_REGISTRY).find(
    ([, v]) => v.chainId === chainId,
  );
  if (!entry) {
    throw new BadRequestException(
      `Unknown chain ID ${chainId}. ` +
        `Registered IDs: ${Object.values(CHAIN_REGISTRY)
          .map((e) => e.chainId)
          .join(', ')}.`,
    );
  }
  return { name: entry[0], ...entry[1] };
}

/** All canonical chain entries. */
export function allChains(): ChainEntry[] {
  return Object.entries(CHAIN_REGISTRY).map(([name, entry]) => ({
    name,
    ...entry,
  }));
}
