/**
 * Shared helpers for surfacing on-chain transaction references in toasts and UI.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract, useWatchContractEvent } from "wagmi";
import { formatUnits, parseUnits } from "viem";

/** Shorten a 0x… hash for display: 0x1234…abcd */
export function truncateTxHash(hash: string): string {
  if (hash.length < 14) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

/**
 * Build a Mantle explorer URL for a transaction hash.
 * Falls back to the staging explorer when NEXT_PUBLIC_EXPLORER_URL is absent.
 */
export function explorerTxUrl(hash: string): string {
  const base =
    process.env.NEXT_PUBLIC_EXPLORER_URL?.replace(/\/+$/, "") ??
    "https://explorer.mantle.xyz";
  return `${base}/tx/${hash}`;
}

/* -------------------------------------------------------------------------- */
/*                              Contract config                               */
/* -------------------------------------------------------------------------- */

/** Collateral (ERC-20) token address used for trading. */
export const COLLATERAL_TOKEN_ADDRESS = (process.env
  .NEXT_PUBLIC_COLLATERAL_TOKEN_ADDRESS ?? "") as `0x${string}`;

/** LMSR market / AMM contract address used for trade quotes. */
export const LMSR_CONTRACT_ADDRESS = (process.env
  .NEXT_PUBLIC_LMSR_CONTRACT_ADDRESS ?? "") as `0x${string}`;

/** Number of decimals used by the collateral token (USDC-style default). */
export const COLLATERAL_DECIMALS = Number(
  process.env.NEXT_PUBLIC_COLLATERAL_DECIMALS ?? 6,
);

/** Minimal ERC-20 ABI for balance reads. */
const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/**
 * Minimal LMSR ABI. `quoteCost` returns the total cost (in collateral units)
 * to buy `shares` of the given outcome. Adjust the name/signature to match the
 * deployed contract if it differs.
 */
const LMSR_ABI = [
  {
    type: "function",
    name: "quoteCost",
    stateMutability: "view",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "outcome", type: "uint8" },
      { name: "shares", type: "uint256" },
    ],
    outputs: [{ name: "cost", type: "uint256" }],
  },
] as const;

/* -------------------------------------------------------------------------- */
/*                          Collateral balance hook                           */
/* -------------------------------------------------------------------------- */

export interface CollateralBalanceResult {
  /** Human-readable balance (already divided by token decimals). */
  balance: number;
  /** Raw on-chain balance in base units. */
  rawBalance: bigint;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Reads the connected account's collateral balance.
 *
 * Automatically refetches when:
 *  - the connected account changes,
 *  - the active chain changes,
 *  - a Transfer event involving the account is observed (covers confirmed
 *    transactions that move collateral).
 */
export function useCollateralBalance(): CollateralBalanceResult {
  const { address, chainId } = useAccount();

  const enabled =
    Boolean(address) &&
    Boolean(COLLATERAL_TOKEN_ADDRESS) &&
    COLLATERAL_TOKEN_ADDRESS.startsWith("0x");

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    address: COLLATERAL_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId,
    query: {
      enabled,
      // Keep the balance reasonably fresh.
      staleTime: 5_000,
    },
  });

  // Refetch whenever the account or chain changes.
  useEffect(() => {
    if (enabled) {
      void refetch();
    }
  }, [address, chainId, enabled, refetch]);

  // Refetch after confirmed transactions that move collateral.
  useWatchContractEvent({
    address: COLLATERAL_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    eventName: "Transfer",
    chainId,
    enabled,
    onLogs: () => {
      void refetch();
    },
  });

  const rawBalance = (data as bigint | undefined) ?? 0n;
  const balance = useMemo(() => {
    try {
      return Number(formatUnits(rawBalance, COLLATERAL_DECIMALS));
    } catch {
      return 0;
    }
  }, [rawBalance]);

  return {
    balance,
    rawBalance,
    isLoading: enabled ? isLoading : false,
    error: (error as Error | null) ?? null,
    refetch: () => {
      void refetch();
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                              LMSR trade quote                              */
/* -------------------------------------------------------------------------- */

export interface TradeQuoteParams {
  marketId: bigint | number | string;
  outcome: number;
  /** Number of shares to trade (human-readable, e.g. 12.5). */
  shares: number;
}

export interface TradeQuoteResult {
  /** Total cost in collateral units for the entire trade size. */
  cost: number;
  /** Raw cost in base units. */
  rawCost: bigint;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Requests an LMSR quote for the entire trade size.
 *
 * Uses the on-chain `quoteCost` view function so the preview reflects the
 * full price curve rather than a spot-price multiplication.
 */
export function useTradeQuote(
  params: TradeQuoteParams | null,
): TradeQuoteResult {
  const { chainId } = useAccount();

  const sharesRaw = useMemo(() => {
    if (!params || !Number.isFinite(params.shares) || params.shares <= 0) {
      return 0n;
    }
    try {
      return parseUnits(params.shares.toString(), COLLATERAL_DECIMALS);
    } catch {
      return 0n;
    }
  }, [params?.shares]);

  const enabled =
    Boolean(params) &&
    sharesRaw > 0n &&
    Boolean(LMSR_CONTRACT_ADDRESS) &&
    LMSR_CONTRACT_ADDRESS.startsWith("0x");

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    address: LMSR_CONTRACT_ADDRESS,
    abi: LMSR_ABI,
    functionName: "quoteCost",
    args:
      params && enabled
        ? [BigInt(params.marketId), params.outcome, sharesRaw]
        : undefined,
    chainId,
    query: {
      enabled,
      staleTime: 2_000,
    },
  });

  const rawCost = (data as bigint | undefined) ?? 0n;
  const cost = useMemo(() => {
    try {
      return Number(formatUnits(rawCost, COLLATERAL_DECIMALS));
    } catch {
      return 0;
    }
  }, [rawCost]);

  return {
    cost,
    rawCost,
    isLoading: enabled ? isLoading : false,
    error: (error as Error | null) ?? null,
    refetch: () => {
      void refetch();
    },
  };
}

/**
 * Imperative LMSR quote helper for callers that need a one-off quote outside
 * of React render (e.g. right before submitting a transaction).
 *
 * Falls back to the backend quote endpoint when configured, otherwise returns
 * the on-chain quote via the provided reader.
 */
export async function getTradeQuote(
  params: TradeQuoteParams,
  readContract: (args: {
    address: `0x${string}`;
    abi: typeof LMSR_ABI;
    functionName: "quoteCost";
    args: [bigint, number, bigint];
  }) => Promise<bigint>,
): Promise<{ cost: number; rawCost: bigint }> {
  const sharesRaw = parseUnits(params.shares.toString(), COLLATERAL_DECIMALS);
  const rawCost = await readContract({
    address: LMSR_CONTRACT_ADDRESS,
    abi: LMSR_ABI,
    functionName: "quoteCost",
    args: [BigInt(params.marketId), params.outcome, sharesRaw],
  });
  return {
    cost: Number(formatUnits(rawCost, COLLATERAL_DECIMALS)),
    rawCost,
  };
}