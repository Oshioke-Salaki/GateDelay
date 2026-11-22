"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAccount } from "wagmi";
import { estimateGasCost } from "@/lib/txUtils";

export interface TrackedTransaction {
  hash: `0x${string}`;
  description: string;
  timestamp: number;
  chainId?: number;
}

const STORAGE_KEY = "gate_delay_txs";

export function useTransactionTracker(includeArchive = false) {
  const { address, chainId } = useAccount();
  const [transactions, setTransactions] = useState<TrackedTransaction[]>([]);

  const loadTransactions = useCallback(() => {
    if (!address || !chainId) {
      setTransactions([]);
      return;
    }
    
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}_${chainId}_${address}`);
      if (stored) {
        const parsed: TrackedTransaction[] = JSON.parse(stored);
        const archiveKey = `${STORAGE_KEY}_archive_${chainId}_${address}`;
        const archived: TrackedTransaction[] = JSON.parse(localStorage.getItem(archiveKey) || "[]");
        const archive = [...archived, ...parsed.filter(tx => !archived.some(old => old.hash === tx.hash))];
        localStorage.setItem(archiveKey, JSON.stringify(archive));
        // Preserve stored history; apply retention only to the tracker view.
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        setTransactions(includeArchive ? archive : parsed.filter(tx => tx.timestamp > oneDayAgo));
      } else {
        setTransactions(includeArchive ? JSON.parse(localStorage.getItem(`${STORAGE_KEY}_archive_${chainId}_${address}`) || "[]") : []);
      }
    } catch (e) {
      console.error("Failed to load transactions", e);
      setTransactions([]);
    }
  }, [address, chainId, includeArchive]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) loadTransactions();
    });
    return () => {
      cancelled = true;
    };
  }, [loadTransactions]);

  const addTransaction = useCallback((hash: `0x${string}`, description: string) => {
    if (!address || !chainId) return;
    
    const newTx: TrackedTransaction = {
      hash,
      description,
      timestamp: Date.now(),
      chainId,
    };

    setTransactions(prev => {
      const exists = prev.find(t => t.hash === hash);
      if (exists) return prev;
      
      const stored: TrackedTransaction[] = JSON.parse(localStorage.getItem(`${STORAGE_KEY}_${chainId}_${address}`) || "[]");
      const updated = [newTx, ...stored.filter(t => t.hash !== hash)];
      const archiveKey = `${STORAGE_KEY}_archive_${chainId}_${address}`;
      const archived: TrackedTransaction[] = JSON.parse(localStorage.getItem(archiveKey) || "[]");
      localStorage.setItem(archiveKey, JSON.stringify([newTx, ...archived.filter(t => t.hash !== hash)]));
      localStorage.setItem(`${STORAGE_KEY}_${chainId}_${address}`, JSON.stringify(updated));
      return includeArchive ? JSON.parse(localStorage.getItem(`${STORAGE_KEY}_archive_${chainId}_${address}`) || "[]") : updated.filter(tx => tx.timestamp > Date.now() - 24 * 60 * 60 * 1000);
    });
  }, [address, chainId, includeArchive]);

  const removeTransaction = useCallback((hash: `0x${string}`) => {
    if (!address || !chainId) return;
    
    setTransactions(prev => {
      const stored: TrackedTransaction[] = JSON.parse(localStorage.getItem(`${STORAGE_KEY}_${chainId}_${address}`) || "[]");
      const updated = stored.filter(t => t.hash !== hash);
      localStorage.setItem(`${STORAGE_KEY}_${chainId}_${address}`, JSON.stringify(updated));
      return includeArchive ? updated : updated.filter(tx => tx.timestamp > Date.now() - 24 * 60 * 60 * 1000);
    });
  }, [address, chainId, includeArchive]);

  const clearTransactions = useCallback(() => {
    if (!address || !chainId) return;
    
    setTransactions([]);
    localStorage.removeItem(`${STORAGE_KEY}_${chainId}_${address}`);
    localStorage.removeItem(`${STORAGE_KEY}_archive_${chainId}_${address}`);
  }, [address, chainId, includeArchive]);

  return {
    transactions,
    addTransaction,
    removeTransaction,
    clearTransactions,
    refresh: loadTransactions
  };
}

export function useTrackTransaction(hash: `0x${string}` | undefined, description: string) {
  const { addTransaction } = useTransactionTracker();

  useEffect(() => {
    if (hash) {
      addTransaction(hash, description);
    }
  }, [addTransaction, description, hash]);
}

export interface GasEstimateResult {
  gasCost: bigint | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useGasEstimate(
  request: Record<string, unknown> | null | undefined,
  gasPreference?: string
): GasEstimateResult {
  const [gasCost, setGasCost] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Serialize the request so the effect re-runs only when parameters change.
  const requestKey = useMemo(() => {
    if (!request) return null;
    try {
      return JSON.stringify(request, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value
      );
    } catch {
      return null;
    }
  }, [request]);

  useEffect(() => {
    if (!requestKey) {
      setGasCost(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const parsedRequest = JSON.parse(requestKey) as Record<string, unknown>;

    Promise.resolve()
      .then(() => estimateGasCost(parsedRequest, gasPreference))
      .then((cost) => {
        if (cancelled) return;
        setGasCost(cost ?? null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setGasCost(null);
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [requestKey, gasPreference, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return { gasCost, isLoading, error, refresh };
}
