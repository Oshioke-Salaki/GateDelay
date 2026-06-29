"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

export interface Category {
  id: string;
  name: string;
  count: number;
  icon?: string;
  subcategories?: Category[];
}

interface CategoryNavProps {
  categories: Category[];
  selectedCategory?: string;
  onCategorySelect?: (categoryId: string) => void;
  showCounts?: boolean;
  showSubcategories?: boolean;
}

export default function CategoryNav({
  categories,
  selectedCategory,
  onCategorySelect,
  showCounts = true,
  showSubcategories = true,
}: CategoryNavProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const toggleExpanded = useCallback((categoryId: string) => {
    setExpandedCategory((prev) => (prev === categoryId ? null : categoryId));
  }, []);

  const handleCategoryClick = useCallback(
    (categoryId: string) => {
      onCategorySelect?.(categoryId);
    },
    [onCategorySelect]
  );

  const totalMarkets = categories.reduce((sum, cat) => sum + cat.count, 0);

  return (
    <nav
      aria-label="Market categories"
      className="flex flex-col gap-1"
      style={{ color: "var(--foreground)" }}
    >
      {/* All Markets */}
      <button
        onClick={() => handleCategoryClick("")}
        className={[
          "flex items-center justify-between px-4 py-2.5 rounded-lg transition-colors",
          "text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          selectedCategory === "" || !selectedCategory
            ? "bg-blue-500/10 text-blue-600"
            : "hover:bg-gray-100 dark:hover:bg-gray-800",
        ].join(" ")}
      >
        <span>All Markets</span>
        {showCounts && (
          <span
            className="text-xs px-2 py-1 rounded-full"
            style={{ background: "var(--border)", color: "var(--muted)" }}
          >
            {totalMarkets}
          </span>
        )}
      </button>

      {/* Category List */}
      <div className="space-y-1">
        {categories.map((category) => {
          const isExpanded = expandedCategory === category.id;
          const hasSubcategories =
            showSubcategories && category.subcategories && category.subcategories.length > 0;

          return (
            <div key={category.id}>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleCategoryClick(category.id)}
                  className={[
                    "flex-1 flex items-center justify-between px-4 py-2.5 rounded-lg transition-colors",
                    "text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                    selectedCategory === category.id
                      ? "bg-blue-500/10 text-blue-600"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-2">
                    {category.icon && <span className="text-lg">{category.icon}</span>}
                    {category.name}
                  </span>
                  {showCounts && (
                    <span
                      className="text-xs px-2 py-1 rounded-full"
                      style={{ background: "var(--border)", color: "var(--muted)" }}
                    >
                      {category.count}
                    </span>
                  )}
                </button>

                {/* Expand/Collapse button for subcategories */}
                {hasSubcategories && (
                  <button
                    onClick={() => toggleExpanded(category.id)}
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? "Collapse" : "Expand"} ${category.name} subcategories`}
                    className="px-2 py-2.5 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    >
                      <polyline points="6 10 10 6 6 2" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Subcategories */}
              {hasSubcategories && isExpanded && (
                <div className="ml-4 space-y-1 mt-1">
                  {category.subcategories!.map((subcategory) => (
                    <button
                      key={subcategory.id}
                      onClick={() => handleCategoryClick(subcategory.id)}
                      className={[
                        "w-full flex items-center justify-between px-4 py-2 rounded-lg transition-colors",
                        "text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                        selectedCategory === subcategory.id
                          ? "bg-blue-500/10 text-blue-600 font-medium"
                          : "hover:bg-gray-100 dark:hover:bg-gray-800",
                      ].join(" ")}
                    >
                      <span className="flex items-center gap-2">
                        {subcategory.icon && <span>{subcategory.icon}</span>}
                        {subcategory.name}
                      </span>
                      {showCounts && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: "var(--border)", color: "var(--muted)" }}
                        >
                          {subcategory.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
