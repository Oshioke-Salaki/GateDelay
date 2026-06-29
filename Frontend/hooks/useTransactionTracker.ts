"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";

export interface TrackedTransaction {
  hash: `0x${string}`;
  description: string;
  timestamp: number;
}

const STORAGE_KEY = "gate_delay_txs";

export function useTransactionTracker() {
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
        // Filter out transactions older than 24 hours to prevent bloated storage
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const recent = parsed.filter(tx => tx.timestamp > oneDayAgo);
        
        // If we filtered out some, update storage
        if (recent.length !== parsed.length) {
          localStorage.setItem(`${STORAGE_KEY}_${chainId}_${address}`, JSON.stringify(recent));
        }
        
        setTransactions(recent);
      } else {
        setTransactions([]);
      }
    } catch (e) {
      console.error("Failed to load transactions", e);
      setTransactions([]);
    }
  }, [address, chainId]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const addTransaction = useCallback((hash: `0x${string}`, description: string) => {
    if (!address || !chainId) return;
    
    const newTx: TrackedTransaction = {
      hash,
      description,
      timestamp: Date.now()
    };

    setTransactions(prev => {
      const exists = prev.find(t => t.hash === hash);
      if (exists) return prev;
      
      const updated = [newTx, ...prev];
      localStorage.setItem(`${STORAGE_KEY}_${chainId}_${address}`, JSON.stringify(updated));
      return updated;
    });
  }, [address, chainId]);

  const removeTransaction = useCallback((hash: `0x${string}`) => {
    if (!address || !chainId) return;
    
    setTransactions(prev => {
      const updated = prev.filter(t => t.hash !== hash);
      localStorage.setItem(`${STORAGE_KEY}_${chainId}_${address}`, JSON.stringify(updated));
      return updated;
    });
  }, [address, chainId]);

  const clearTransactions = useCallback(() => {
    if (!address || !chainId) return;
    
    setTransactions([]);
    localStorage.removeItem(`${STORAGE_KEY}_${chainId}_${address}`);
  }, [address, chainId]);

  return {
    transactions,
    addTransaction,
    removeTransaction,
    clearTransactions,
    refresh: loadTransactions
  };
}
