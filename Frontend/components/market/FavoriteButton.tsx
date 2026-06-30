"use client";

import { useState, useEffect } from "react";

interface FavoriteButtonProps {
  marketId: string;
  onToggle?: (isFavorited: boolean) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export default function FavoriteButton({
  marketId,
  onToggle,
  className = "",
  size = "md",
}: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load favorite status from localStorage on mount
  useEffect(() => {
    const favorites = JSON.parse(localStorage.getItem("market_favorites") || "[]");
    setIsFavorited(favorites.includes(marketId));
  }, [marketId]);

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      const favorites = JSON.parse(localStorage.getItem("market_favorites") || "[]");
      let updated: string[];

      if (isFavorited) {
        updated = favorites.filter((id: string) => id !== marketId);
      } else {
        updated = [...favorites, marketId];
      }

      localStorage.setItem("market_favorites", JSON.stringify(updated));
      setIsFavorited(!isFavorited);
      onToggle?.(!isFavorited);
    } finally {
      setIsLoading(false);
    }
  };

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
      disabled={isLoading}
      aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
      className={`inline-flex items-center justify-center rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${sizeClasses[size]} ${className}`}
      style={{
        background: isFavorited ? "#f59e0b18" : "var(--border)",
        border: `1px solid ${isFavorited ? "#f59e0b44" : "var(--border)"}`,
        cursor: isLoading ? "not-allowed" : "pointer",
        opacity: isLoading ? 0.6 : 1,
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
      >
        <polygon points="12 2 15.09 10.26 24 10.27 17.18 16.70 20.09 25 12 19.54 3.91 25 6.82 16.70 0 10.27 8.91 10.26 12 2" />
      </svg>
    </button>
  );
}
