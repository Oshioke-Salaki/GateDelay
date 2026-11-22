"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/useToast";

interface FavoriteButtonProps {
  marketId: string;
  onToggle?: (isFavorited: boolean) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  /**
   * Optional async function that persists the toggle server-side.
   * If it throws, the toggle is rolled back and an error toast is shown.
   * When omitted the button is localStorage-only and never rolls back.
   */
  onPersist?: (marketId: string, isFavorited: boolean) => Promise<void>;
}

const STORAGE_KEY = "market_favorites";

function readFavorites(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeFavorites(ids: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export default function FavoriteButton({
  marketId,
  onToggle,
  className = "",
  size = "md",
  onPersist,
}: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const { success, error } = useToast();

  // Hydrate from localStorage on mount
  useEffect(() => {
    setIsFavorited(readFavorites().includes(marketId));
  }, [marketId]);

  const handleToggle = useCallback(async () => {
    if (isPending) return;

    // ── Optimistic update ──────────────────────────────────────────────────
    const previousValue = isFavorited;
    const nextValue = !isFavorited;

    // Write to localStorage immediately so all other tabs/components reflect
    // the change without waiting for any async work.
    const prev = readFavorites();
    const next = nextValue
      ? [...prev, marketId]
      : prev.filter((id) => id !== marketId);

    writeFavorites(next);
    setIsFavorited(nextValue);
    onToggle?.(nextValue);

    // ── Persist (optional) ─────────────────────────────────────────────────
    if (!onPersist) {
      // localStorage-only path — show a quiet success toast
      if (nextValue) {
        success("Added to favorites", undefined, { duration: 2500 });
      }
      return;
    }

    setIsPending(true);
    try {
      await onPersist(marketId, nextValue);
      if (nextValue) {
        success("Added to favorites");
      }
      // Removal is silent — no toast needed
    } catch (err) {
      // ── Rollback ───────────────────────────────────────────────────────
      writeFavorites(prev);
      setIsFavorited(previousValue);
      onToggle?.(previousValue);

      error(
        nextValue ? "Could not save favorite" : "Could not remove favorite",
        (err as Error)?.message || "Please try again.",
      );
    } finally {
      setIsPending(false);
    }
  }, [isPending, isFavorited, marketId, onToggle, onPersist, success, error]);

  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  };

  const iconSize = {
    sm: "16",
    md: "20",
    lg: "24",
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={isFavorited}
      className={`inline-flex items-center justify-center rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${sizeClasses[size]} ${className}`}
      style={{
        background: isFavorited ? "#f59e0b18" : "var(--border)",
        border: `1px solid ${isFavorited ? "#f59e0b44" : "var(--border)"}`,
        cursor: isPending ? "not-allowed" : "pointer",
        opacity: isPending ? 0.6 : 1,
      }}
    >
      <svg
        width={iconSize[size]}
        height={iconSize[size]}
        viewBox="0 0 24 24"
        fill={isFavorited ? "#f59e0b" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: isFavorited ? "#f59e0b" : "var(--muted)" }}
        aria-hidden="true"
      >
        <polygon points="12 2 15.09 10.26 24 10.27 17.18 16.70 20.09 25 12 19.54 3.91 25 6.82 16.70 0 10.27 8.91 10.26 12 2" />
      </svg>
    </button>
  );
}
