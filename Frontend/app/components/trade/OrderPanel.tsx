"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Market } from "./TradingInterface";
import { useToast } from "@/hooks/useToast";
import { useSettings } from "@/hooks/useSettings";
import LeverageSelector from "./LeverageSelector";
import OrderTypeSelector, { validateOrderType } from "@/components/trade/OrderTypeSelector";
import {
  TRADE_LIMITS,
  validateTradeAmount,
  validateLimitPrice,
  getSlippageWarning,
} from "@/lib/validationRules";
import StalePriceWarning from "@/components/market/StalePriceWarning";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderFormData {
  amount: number;
  price: number;
  total: number;
  orderType: "market" | "limit";
  leverage: number;
}

interface OrderPanelProps {
  market: Market;
  userAddress?: string;
  activeTab: "buy" | "sell";
  onTabChange: (tab: "buy" | "sell") => void;
}

// ─── Inline error helper ──────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs mt-1" style={{ color: "#ef4444" }}>
      {message}
    </p>
  );
}

function FieldWarning({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="status" className="text-xs mt-1" style={{ color: "#f59e0b" }}>
      ⚠ {message}
    </p>
  );
}

// ─── Order Panel ──────────────────────────────────────────────────────────────

export default function OrderPanel({
  market,
  userAddress,
  activeTab,
  onTabChange,
}: OrderPanelProps) {
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Liquidity / market-status warnings (simulated; replace with real API)
  const [marketWarning, setMarketWarning] = useState<string | null>(null);

  const toast = useToast();
  const { settings } = useSettings();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OrderFormData>({
    mode: "onChange",          // validate as user types
    defaultValues: {
      amount: 0,
      price: market.currentPrice,
      total: 0,
      orderType: "market",
      leverage: 1,
    },
  });

  const amount   = watch("amount") || 0;
  const price    = watch("price")  || market.currentPrice;
  const leverage = watch("leverage") || 1;

  // ─── Derived figures ───────────────────────────────────────────────────────
  const effectivePrice = orderType === "market" ? market.currentPrice : price;
  const positionSize   = amount * effectivePrice;
  const requiredMargin = positionSize / leverage;

  // Mock balance — replace with real wallet / backend query
  const balance        = 1000;
  const purchasingPower = balance * leverage;
  const maxAmount       = purchasingPower / effectivePrice;

  // ─── Slippage warning (inline) ─────────────────────────────────────────────
  const slippageWarning = getSlippageWarning(
    orderType,
    settings.trading.defaultSlippage,
  );

  // ─── Simulated market-status check ────────────────────────────────────────
  // In production, drive this from a real API / WebSocket feed.
  useEffect(() => {
    if (market.status && market.status !== "open") {
      setMarketWarning(`This market is currently ${market.status}. Orders cannot be placed.`);
    } else {
      setMarketWarning(null);
    }
  }, [market.status]);

  // ─── Insufficient-balance warning (shown inline, not just on submit) ───────
  const insufficientBalance =
    amount > 0 && positionSize > purchasingPower
      ? `Insufficient purchasing power. You need $${positionSize.toFixed(2)} but have $${purchasingPower.toFixed(2)}.`
      : null;

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const onSubmit = async (data: OrderFormData) => {
    if (!userAddress) {
      toast.error("Wallet Not Connected", "Please connect your wallet to trade");
      return;
    }

    if (marketWarning) {
      toast.error("Market Unavailable", marketWarning);
      return;
    }

    const orderValidation = validateOrderType(orderType, Number(data.price));
    if (orderValidation !== true) {
      toast.error("Invalid Order", orderValidation);
      return;
    }

    if (settings.trading.confirmTransactions) {
      const confirmed = confirm(
        `Confirm ${activeTab.toUpperCase()} order:\n\n` +
          `Amount: ${data.amount} shares\n` +
          `Price: $${orderType === "market" ? market.currentPrice.toFixed(4) : Number(data.price).toFixed(4)}\n` +
          `Leverage: ${leverage}x\n` +
          `Position Size: $${positionSize.toFixed(2)}\n` +
          `Required Margin: $${requiredMargin.toFixed(2)}\n\n` +
          `Do you want to proceed?`,
      );
      if (!confirmed) return;
    }

    setIsSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      toast.success(
        "Order Placed",
        `${activeTab.toUpperCase()} order for ${data.amount} shares at ${leverage}x leverage placed successfully`,
      );
      setValue("amount", 0);
      setValue("total", 0);
      setValue("leverage", 1);
    } catch {
      toast.error("Order Failed", "Failed to place order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetPercentage = (percentage: number) => {
    const newAmount = (maxAmount * percentage) / 100;
    setValue("amount", parseFloat(newAmount.toFixed(4)), { shouldValidate: true });
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const isMarketClosed = !!marketWarning;

  return (
    <div className="bg-white rounded-lg shadow-lg sticky top-6">
      {/* Buy / Sell tabs */}
      <div className="flex border-b border-gray-200">
        {(["buy", "sell"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`flex-1 py-4 font-semibold transition-colors capitalize ${
              activeTab === tab
                ? tab === "buy"
                  ? "text-green-600 border-b-2 border-green-600"
                  : "text-red-600 border-b-2 border-red-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Market-status banner */}
      {marketWarning && (
        <div
          role="alert"
          className="mx-6 mt-4 rounded-lg px-4 py-3 text-sm font-medium"
          style={{
            background: "#ef444418",
            border: "1px solid #ef444444",
            color: "#ef4444",
          }}
        >
          🚫 {marketWarning}
        </div>
      )}

      {/* Order Form */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="p-6 space-y-4">
        {/* Order Type */}
        <OrderTypeSelector
          orderType={orderType}
          onChange={(type) => {
            setOrderType(type);
            setValue("orderType", type);
          }}
        />

        {/* Limit Price */}
        {orderType === "limit" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="op-price">
              Price (USD)
            </label>
            <input
              id="op-price"
              type="number"
              step="0.00000001"
              {...register("price", {
                required: "Price is required for limit orders",
                validate: (v) => validateLimitPrice(v),
              })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00000000"
              aria-invalid={!!errors.price}
              aria-describedby={errors.price ? "op-price-error" : undefined}
            />
            <FieldError message={errors.price?.message} />
            <p className="text-xs mt-1 text-gray-400">
              Min {TRADE_LIMITS.MIN_TRADE_PRICE} · Max {TRADE_LIMITS.MAX_TRADE_PRICE.toLocaleString()}
            </p>
          </div>
        )}

        {/* Market price display */}
        {orderType === "market" && (
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Market Price:</span>
              <span className="text-lg font-bold text-gray-900">
                ${market.currentPrice.toFixed(4)}
              </span>
            </div>
          </div>
        )}

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="op-amount">
            Amount (Shares)
          </label>
          <input
            id="op-amount"
            type="number"
            step="0.0001"
            {...register("amount", {
              required: "Amount is required",
              validate: (v) => validateTradeAmount(v),
            })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0.0000"
            aria-invalid={!!errors.amount}
            aria-describedby={errors.amount ? "op-amount-error" : undefined}
          />
          <FieldError message={errors.amount?.message} />
          {/* Insufficient balance inline warning (shown as soon as user types) */}
          {!errors.amount && <FieldWarning message={insufficientBalance ?? undefined} />}
          <p className="text-xs mt-1 text-gray-400">
            Min {TRADE_LIMITS.MIN_TRADE_AMOUNT} ·{" "}
            Max {TRADE_LIMITS.MAX_TRADE_AMOUNT.toLocaleString()}
          </p>

          {/* Percentage quick-fill buttons */}
          <div className="flex space-x-2 mt-2">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => handleSetPercentage(pct)}
                className="flex-1 py-1 px-2 text-xs font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        {/* Leverage */}
        <div className="pt-2 border-t border-gray-100">
          <LeverageSelector
            leverage={leverage}
            onChange={(val) => setValue("leverage", val)}
          />
        </div>

        {/* Leverage breakdown */}
        <div className="space-y-2 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Position Size</span>
            <span className="font-semibold text-gray-900">${positionSize.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Required Margin</span>
            <span className="font-bold text-blue-600">${requiredMargin.toFixed(2)}</span>
          </div>
        </div>

        {/* Balance context */}
        <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Available Balance:</span>
            <span className="font-semibold text-gray-900">${balance.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Total Purchasing Power:</span>
            <span className="font-medium text-blue-700">${purchasingPower.toFixed(2)}</span>
          </div>
        </div>

        {/* Slippage notice — shown inline so the user sees it before submitting */}
        {orderType === "market" && (
          <div
            className={`p-3 rounded-lg ${
              slippageWarning ? "bg-red-50 border border-red-200" : "bg-yellow-50 border border-yellow-200"
            }`}
          >
            {slippageWarning ? (
              <p className="text-xs text-red-800">
                <span className="font-semibold">⚠ High Slippage:</span> {slippageWarning}
              </p>
            ) : (
              <p className="text-xs text-yellow-800">
                <span className="font-semibold">Slippage Tolerance:</span>{" "}
                {settings.trading.defaultSlippage}%
              </p>
            )}
          </div>
        )}

        {/* Stale price warning — shown inline above submit so users can't miss it */}
        <StalePriceWarning marketId={market.id} />

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting || !userAddress || isMarketClosed}
          title={
            !userAddress
              ? "Connect your wallet to place an order"
              : isMarketClosed
              ? marketWarning ?? "Market is not open"
              : undefined
          }
          className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
            activeTab === "buy"
              ? "bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
              : "bg-red-600 hover:bg-red-700 disabled:bg-gray-400"
          } disabled:cursor-not-allowed`}
        >
          {isSubmitting
            ? "Processing…"
            : !userAddress
            ? "Connect Wallet"
            : `${activeTab === "buy" ? "Buy" : "Sell"} ${market.name.split(" ")[0]}`}
        </button>

        {/* Fee info */}
        <div className="text-xs text-gray-500 text-center">
          <p>Trading fee: 0.3% · Gas fee: ~$2.50</p>
        </div>
      </form>
    </div>
  );
}
