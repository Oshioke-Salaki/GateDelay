"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useDisconnect } from "@particle-network/connectkit";

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const SESSION_KEY = "gd_wallet_session";
const RENEW_THRESHOLD = 5 * 60 * 1000; // 5 minutes before timeout

interface SessionData {
  walletAddress: string;
  expiresAt: number;
  createdAt: number;
}

export function useWalletSession() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [session, setSession] = useState<SessionData | null>(null);
  const [isRenewalNeeded, setIsRenewalNeeded] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const saveSession = useCallback((walletAddress: string) => {
    const expiresAt = Date.now() + SESSION_TIMEOUT;
    const newSession: SessionData = {
      walletAddress,
      expiresAt,
      createdAt: Date.now(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    setSession(newSession);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setIsRenewalNeeded(false);
    setTimeLeft(null);
  }, []);

  const renewSession = useCallback(() => {
    if (!address) return;
    saveSession(address);
    setIsRenewalNeeded(false);
  }, [address, saveSession]);

  useEffect(() => {
    if (isConnected && address) {
      const existingSession = localStorage.getItem(SESSION_KEY);
      if (existingSession) {
        try {
          const parsed = JSON.parse(existingSession) as SessionData;
          if (parsed.walletAddress === address && parsed.expiresAt > Date.now()) {
            setSession(parsed);
            return;
          }
        } catch {
          // invalid session, create new one
        }
      }
      saveSession(address);
    } else {
      clearSession();
    }
  }, [isConnected, address, saveSession, clearSession]);

  useEffect(() => {
    if (!session) return;

    const updateTimeLeft = () => {
      const remaining = session.expiresAt - Date.now();
      setTimeLeft(Math.max(0, remaining));

      if (remaining <= 0) {
        clearSession();
        disconnect();
      } else if (remaining <= RENEW_THRESHOLD) {
        setIsRenewalNeeded(true);
      }
    };

    updateTimeLeft();
    const timer = setInterval(updateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [session, clearSession, disconnect]);

  return {
    session,
    isRenewalNeeded,
    timeLeft,
    renewSession,
    clearSession,
  };
}
