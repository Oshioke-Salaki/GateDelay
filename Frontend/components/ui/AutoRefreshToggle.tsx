"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format, addMilliseconds } from 'date-fns';
import { RefreshCw, Play, Pause, Settings } from 'lucide-react';

export interface AutoRefreshToggleProps {
  onRefresh: () => Promise<void>;
  defaultIntervalMs?: number;
  defaultEnabled?: boolean;
}

export function AutoRefreshToggle({
  onRefresh,
  defaultIntervalMs = 30000,
  defaultEnabled = false,
}: AutoRefreshToggleProps) {
  const [enabled, setEnabled] = useState(defaultEnabled);
  const [intervalMs, setIntervalMs] = useState(defaultIntervalMs);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [nextRefreshTime, setNextRefreshTime] = useState<Date | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const performRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
      const now = new Date();
      setLastRefreshTime(now);
      if (enabled) {
        setNextRefreshTime(addMilliseconds(now, intervalMs));
      }
    } catch (error) {
      console.error('Refresh failed', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, enabled, intervalMs]);

  useEffect(() => {
    if (enabled) {
      // Set next refresh time if not set
      setNextRefreshTime(addMilliseconds(new Date(), intervalMs));
      
      timerRef.current = setInterval(() => {
        performRefresh();
      }, intervalMs);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setNextRefreshTime(null);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, intervalMs, performRefresh]);

  const handleToggle = () => setEnabled(prev => !prev);
  
  const handleManualRefresh = () => {
    performRefresh();
  };

  const handleIntervalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setIntervalMs(Number(e.target.value));
  };

  return (
    <div className="flex flex-col gap-2 p-4 border rounded-2xl shadow-sm bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors text-zinc-700 dark:text-zinc-300"
            aria-label="Manual refresh"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin text-blue-500" : ""} />
          </button>
          
          <button
            onClick={handleToggle}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
              enabled 
                ? "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:hover:bg-amber-500/30" 
                : "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:hover:bg-blue-500/30"
            }`}
            aria-label={enabled ? "Pause auto refresh" : "Resume auto refresh"}
            aria-pressed={enabled}
          >
            {enabled ? <Pause size={14} /> : <Play size={14} />}
            <span>{enabled ? "Pause" : "Auto"}</span>
          </button>
        </div>

        <button 
          onClick={() => setShowConfig(!showConfig)}
          className={`p-2 rounded-xl transition-colors ${
            showConfig 
              ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100" 
              : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
          }`}
          aria-expanded={showConfig}
          aria-label="Toggle refresh settings"
        >
          <Settings size={16} />
        </button>
      </div>

      {showConfig && (
        <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800 mt-1">
          <label htmlFor="refresh-interval" className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Refresh Interval
          </label>
          <select
            id="refresh-interval"
            value={intervalMs}
            onChange={handleIntervalChange}
            className="text-xs font-medium px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent outline-none cursor-pointer hover:border-blue-400 focus:border-blue-500 transition-colors"
            aria-label="Select refresh interval"
          >
            <option value={10000}>10 Seconds</option>
            <option value={30000}>30 Seconds</option>
            <option value={60000}>1 Minute</option>
            <option value={300000}>5 Minutes</option>
          </select>
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] font-medium text-zinc-400 mt-2">
        <div>
          <span className="uppercase tracking-wider">Last:</span>{' '}
          <span className="text-zinc-600 dark:text-zinc-300">
            {lastRefreshTime ? format(lastRefreshTime, 'HH:mm:ss') : 'Never'}
          </span>
        </div>
        {enabled && (
          <div>
            <span className="uppercase tracking-wider">Next:</span>{' '}
            <span className="text-zinc-600 dark:text-zinc-300">
              {nextRefreshTime ? format(nextRefreshTime, 'HH:mm:ss') : '...'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
