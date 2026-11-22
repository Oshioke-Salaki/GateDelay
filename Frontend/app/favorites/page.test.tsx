import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import FavoritesPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ success: vi.fn() }),
}));

describe("FavoritesPage empty state", () => {
  afterEach(() => localStorage.clear());

  it("guides users to browse or search and explains how to favorite markets", async () => {
    localStorage.removeItem("market_favorites");
    render(<FavoritesPage />);

    await waitFor(() => expect(screen.getByRole("heading", { name: /your watchlist is empty/i })).toBeInTheDocument());

    expect(screen.getByText(/select the star on any market/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse markets/i })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: /search markets/i })).toHaveAttribute("href", "/markets/search");
  });
});
