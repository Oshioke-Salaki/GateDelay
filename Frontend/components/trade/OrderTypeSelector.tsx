"use client";

import { useCallback } from "react";
import { TrendingUp, Target, Info } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrderType = "market" | "limit";

export interface OrderTypeSelectorProps {
  /** Currently selected order type */
  orderType: OrderType;
  /** Called when user switches order type */
  onChange: (type: OrderType) => void;
  /** Disable switching */
  disabled?: boolean;
  /** Show detailed descriptions below selector */
  showDescriptions?: boolean;
  /** Validation error message to display */
  error?: string;
}

// ─── Order type metadata ────────────────────────────────────────────────────────

const ORDER_TYPES: {
  value: OrderType;
  label: string;
  icon: React.ElementType;
  description: string;
  detail: string;
}[] = [
  {
    value: "market",
    label: "Market",
    icon: TrendingUp,
    description: "Execute immediately at the best available price",
    detail: "Your order fills at the current market price. Subject to slippage based on your tolerance setting.",
  },
  {
    value: "limit",
    label: "Limit",
    icon: Target,
    description: "Set a specific price and wait for a match",
    detail: "Your order only executes when the market reaches your specified price. May not fill immediately.",
  },
];

// ─── OrderTypeSelector ──────────────────────────────────────────────────────────

export default function OrderTypeSelector({
  orderType,
  onChange,
  disabled = false,
  showDescriptions = true,
  error,
}: OrderTypeSelectorProps) {
  const handleChange = useCallback(
    (type: OrderType) => {
      if (disabled) return;
      onChange(type);
    },
    [onChange, disabled]
  );

  const selectedMeta = ORDER_TYPES.find((t) => t.value === orderType);

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">Order Type</label>

      {/* Toggle buttons */}
      <div className="flex space-x-2">
        {ORDER_TYPES.map(({ value, label, icon: Icon }) => {
          const isActive = orderType === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => handleChange(value)}
              disabled={disabled}
              aria-pressed={isActive}
              className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      {/* Order type description */}
      {showDescriptions && selectedMeta && (
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 space-y-1">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-blue-800">
                {selectedMeta.label} Order
              </p>
              <p className="text-xs text-blue-700 mt-0.5">{selectedMeta.description}</p>
              <p className="text-xs text-blue-600/80 mt-1">{selectedMeta.detail}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Validate order type and price for limit orders */
export function validateOrderType(
  orderType: OrderType,
  price?: number
): string | true {
  if (orderType !== "market" && orderType !== "limit") {
    return "Invalid order type selected";
  }
  if (orderType === "limit") {
    if (price === undefined || price === null || isNaN(price)) {
      return "Price is required for limit orders";
    }
    if (price <= 0) {
      return "Price must be positive for limit orders";
    }
  }
  return true;
}
