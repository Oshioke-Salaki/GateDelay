"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
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
import { applySlippage } from "@/lib/slippage";
import { useFeePolicy } from "@/hooks/useFeePolicy";
import { useGasEstimate } from "@/hooks/useGasEstimate";

// ─── Venue capabilities ───────────────────────────────────────────────────────
// Only venues listed here support limit orders / leverage in the direct
// MarketMaker execution path. Everything else falls back to market orders at 1x.

interface VenueCapabilities {
  limitOrders: boolean;
  leverage: boolean;
}

const VENUE_CAPABILITIES: Record<string, VenueCapabilities> = {
  marketmaker: { limitOrders: false, leverage: false },
};

function getVenueCapabilities(venue?: string): VenueCapabilities {
  if (!venue) return { limitOrders: false, leverage: false };
  return VENUE_CAPABILITIES[venue.toLowerCase()] ?? { limitOrders: false, leverage: false };
}

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

  // Sell-side holdings (outcome shares owned for the selected market/outcome)
  const [ownedShares, setOwnedShares] = useState<number | null>(null);
  const [holdingsLoading, setHoldingsLoading] = useState(false);

  // Quote refresh state (slippage bounds are derived from the live quote)
  const [isRefreshingQuote, setIsRefreshingQuote] = useState(false);

  const toast = useToast();
  const { settings } = useSettings();

  const venue = settings.trading.executionVenue;
  const capabilities = useMemo(() => getVenueCapabilities(venue), [venue]);
  const supportsLimitOrders = capabilities.limitOrders;
  const supportsLeverage = capabilities.leverage;

  const slippageTolerance = settings.trading.defaultSlippage;
  const { policy: feePolicy, isLoading: feePolicyLoading } = useFeePolicy(venue);

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
  const rawLeverage = watch("leverage") || 1;
  const leverage = supportsLeverage ? rawLeverage : 1;

  // ─── Size-dependent LMSR quote ─────────────────────────────────────────────
  // Quote the entire trade size so the preview reflects the LMSR price curve
  // rather than a linear shares × spot-price estimate.
  const {
    cost: quotedCost,
    isLoading: isQuoteLoading,
    isError: isQuoteError,
    error: quoteError,
  } = useLmsrQuote({
    marketId: market.id,
    amount,
    side: activeTab,
    enabled: amount > 0,
  });

  // ─── Derived figures ───────────────────────────────────────────────────────
  const effectiveOrderType = supportsLimitOrders ? orderType : "market";
  const effectivePrice = effectiveOrderType === "market" ? market.currentPrice : price;
  const positionSize   = amount * effectivePrice;
  const requiredMargin = positionSize / leverage;

  // Mock balance — replace with real wallet / backend query
  const balance        = 1000;
  const purchasingPower = balance * leverage;

  // ─── Sizing source: collateral (buy) vs owned outcome shares (sell) ───────
  const isSell = activeTab === "sell";
  const availableSize = isSell ? ownedShares ?? 0 : purchasingPower / effectivePrice;
  const maxAmount = availableSize;
  const sizingUnavailable = isSell && (holdingsLoading || ownedShares === null);

  // ─── Slippage bounds derived from the current quote ───────────────────────
  // For buys we cap the maximum cost; for sells we floor the minimum proceeds.
  const quotePrice = effectivePrice;
  const slippageBounds = useMemo(() => {
    if (!quotePrice || quotePrice <= 0) return null;
    const notional = amount * quotePrice;
    if (notional <= 0) return null;
    const { minProceeds, maxCost } = applySlippage(
      notional,
      slippageTolerance,
      activeTab,
    );
    return { minProceeds, maxCost };
  }, [quotePrice, amount, slippageTolerance, activeTab]);

  const isQuoteStale = useMemo(() => {
    // A quote is stale when the market price has drifted from the price the
    // bounds were computed against, or when no bounds could be derived.
    if (amount > 0 && !slippageBounds) return true;
    return false;
  }, [amount, slippageBounds]);

  // ─── Slippage warning (inline) ─────────────────────────────────────────────
  const slippageWarning = getSlippageWarning(
    effectiveOrderType,
    slippageTolerance,
  );

  // ─── Fee + gas estimates ──────────────────────────────────────────────────
  const feeBps = feePolicy?.tradingFeeBps ?? 0;
  const tradingFee = (positionSize * feeBps) / 10_000;

  const {
    estimate: gasEstimate,
    isLoading: gasLoading,
    error: gasError,
  } = useGasEstimate({
    venue,
    orderType: effectiveOrderType,
    marketId: market.id,
    amount,
    price: quotePrice,
    side: activeTab,
  });

  // ─── Simulated market-status check ────────────────────────────────────────
  // In production, drive this from a real API / WebSocket feed.
  useEffect(() => {
    if (market.status && market.status !== "open") {
      setMarketWarning(`This market is currently ${market.status}. Orders cannot be placed.`);
    } else {
      setMarketWarning(null);
    }
  }, [market.status]);

  // ─── Enforce venue capabilities on the form state ─────────────────────────
  useEffect(() => {
    if (!supportsLimitOrders && orderType !== "market") {
      setOrderType("market");
      setValue("orderType", "market");
    }
    if (!supportsLeverage && rawLeverage !== 1) {
      setValue("leverage", 1);
    }
  }, [supportsLimitOrders, supportsLeverage, orderType, rawLeverage, setValue]);

  // ─── Load owned outcome shares for sells ──────────────────────────────────
  useEffect(() => {
    if (!isSell || !userAddress) {
      setOwnedShares(null);
      setHoldingsLoading(false);
      return;
    }

    let cancelled = false;
    setHoldingsLoading(true);

    (async () => {
      try {
        const res = await fetch(
          `/api/wallet/${encodeURIComponent(userAddress)}/positions` +
            `?marketId=${encodeURIComponent(market.id)}` +
            `&outcome=${encodeURIComponent(activeTab)}`,
        );
        if (!res.ok) throw new Error("Failed to load holdings");
        const data = (await res.json()) as { shares?: number };
        if (!cancelled) setOwnedShares(Number(data.shares ?? 0));
      } catch {
        if (!cancelled) setOwnedShares(0);
      } finally {
        if (!cancelled) setHoldingsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSell, userAddress, market.id, activeTab]);

  // ─── Refresh the quote when slippage changes or the quote goes stale ──────
  useEffect(() => {
    if (!isQuoteStale) return;
    let cancelled = false;
    setIsRefreshingQuote(true);
    (async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 300));
      } finally {
        if (!cancelled) setIsRefreshingQuote(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isQuoteStale, slippageTolerance]);

  // ─── Insufficient-balance warning (shown inline, not just on submit) ───────
  const insufficientBalance = (() => {
    if (amount <= 0) return null;
    if (isSell) {
      if (ownedShares === null) return null;
      return amount > ownedShares
        ? `Insufficient shares. You need ${amount.toFixed(4)} but own ${ownedShares.toFixed(4)}.`
        : null;
    }
    return positionSize > purchasingPower
      ? `Insufficient purchasing power. You need $${positionSize.toFixed(2)} but have $${purchasingPower.toFixed(2)}.`
      : null;
  })();

  // ─── Refresh balance after confirmed transactions ──────────────────────────
  useEffect(() => {
    if (isConfirmed) {
      refetchBalance();
    }
  }, [isConfirmed, refetchBalance]);

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

    // Guard against unsupported venue/order combinations
    if (orderType === "limit" && !supportsLimitOrders) {
      toast.error("Unsupported Order Type", "Limit orders are not supported on this venue");
      return;
    }
    if (rawLeverage !== 1 && !supportsLeverage) {
      toast.error("Unsupported Leverage", "Leverage is not supported on this venue");
      return;
    }

    if (isRefreshingQuote || isQuoteStale) {
      toast.error("Quote Refreshing", "Please wait for the quote to refresh before confirming");
      return;
    }

    if (!slippageBounds) {
      toast.error("Missing Quote", "Unable to derive slippage bounds for this order");
      return;
    }

    const orderValidation = validateOrderType(effectiveOrderType, Number(data.price));
    if (orderValidation !== true) {
      toast.error("Invalid Order", orderValidation);
      return;
    }

    if (settings.trading.confirmTransactions) {
      const boundsLine = isSell
        ? `Min Proceeds: $${slippageBounds.minProceeds.toFixed(2)}`
        : `Max Cost: $${slippageBounds.maxCost.toFixed(2)}`;
      const confirmed = confirm(
        `Confirm ${activeTab.toUpperCase()} order:\n\n` +
          `Amount: ${data.amount} shares\n` +
          `Price: $${effectiveOrderType === "market" ? market.currentPrice.toFixed(4) : Number(data.price).toFixed(4)}\n` +
          `Leverage: ${leverage}x\n` +
          `Position Size: $${positionSize.toFixed(2)}\n` +
          `Required Margin: $${requiredMargin.toFixed(2)}\n` +
          `Slippage Tolerance: ${slippageTolerance}%\n` +
          `${boundsLine}\n` +
          `Trading Fee: $${tradingFee.toFixed(2)}\n` +
          `Estimated Gas: ${gasEstimate ? `$${gasEstimate.totalCostUsd.toFixed(2)}` : "unavailable"}\n\n` +
          `Do you want to proceed?`,
      );
      if (!confirmed) return;
    }

    if (isQuoteError || quotedCost == null) {
      toast.error(
        "Quote Unavailable",
        quoteError?.message ?? "Unable to quote this trade size. Please try again.",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const contract = getOrderContractConfig(market);
      const hash = await writeContractAsync({
        ...contract,
        functionName: activeTab === "buy" ? "buy" : "sell",
        args: [
          market.id,
          data.amount,
          orderType === "market" ? 0 : Number(data.price),
          leverage,
          quotedCost,
        ],
      });

      trackTransaction(hash, {
        type: "order",
        marketId: market.id,
        side: activeTab,
        amount: data.amount,
      });

      // Wait for the receipt; success is only reported once execution confirms.
      const receipt = await waitForReceipt(hash);

      if (receipt.status !== "success") {
        toast.error(
          "Order Failed",
          "The transaction was reverted on-chain. No order was placed.",
        );
        return;
      }

      toast.success(
        "Order Placed",
        `${activeTab.toUpperCase()} order for ${data.amount} shares at ${leverage}x leverage placed successfully`,
      );
      setValue("amount", 0);
      setValue("total", 0);
      setValue("leverage", 1);
      refetchBalance();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/user rejected|denied/i.test(message)) {
        toast.error("Transaction Rejected", "You rejected the transaction in your wallet.");
      } else {
        toast.error("Order Failed", message || "Failed to place order. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
      resetWrite();
    }
  };

  const handleSetPercentage = (percentage: number) => {
    if (sizingUnavailable) return;
    const base = isSell ? ownedShares ?? 0 : maxAmount;
    const raw = (base * percentage) / 100;
    const clamped = isSell ? Math.min(raw, ownedShares ?? 0) : raw;
    setValue("amount", parseFloat(clamped.toFixed(4)), { shouldValidate: true });
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
        {/* Order Type — only for venues that support limit orders */}
        {supportsLimitOrders && (
          <OrderTypeSelector
            orderType={orderType}
            onChange={(type) => {
              setOrderType(type);
              setValue("orderType", type);
            }}
          />
        )}

        {/* Limit Price */}
        {effectiveOrderType === "limit" && (
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
        {effectiveOrderType === "market" && (
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
                disabled={sizingUnavailable}
                className="flex-1 py-1 px-2 text-xs font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pct}%
              </button>
            ))}
          </div>
          {isSell && (
            <p className="text-xs mt-1 text-gray-400">
              {holdingsLoading
                ? "Loading owned shares…"
                : ownedShares === null
                ? "Connect wallet to size by holdings"
                : `Owned: ${ownedShares.toFixed(4)} shares`}
            </p>
          )}
        </div>

        {/* Leverage — only for venues that support it */}
        {supportsLeverage && (
          <div className="pt-2 border-t border-gray-100">
            <LeverageSelector
              leverage={leverage}
              onChange={(val) => setValue("leverage", val)}
            />
          </div>
        )}

        {/* Leverage breakdown */}
        <div className="space-y-2 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Position Size</span>
            <span className="font-semibold text-gray-900">
              {isQuoteLoading ? "Quoting…" : `$${positionSize.toFixed(2)}`}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Required Margin</span>
            <span className="font-bold text-blue-600">
              {isQuoteLoading ? "…" : `$${requiredMargin.toFixed(2)}`}
            </span>
          </div>
          {isQuoteError && (
            <p role="alert" className="text-xs" style={{ color: "#ef4444" }}>
              Unable to quote this trade size. Please try again.
            </p>
          )}
        </div>

        {/* Balance context */}
        <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Available Balance:</span>
            <span className="font-semibold text-gray-900">
              {!isConnected && !userAddress
                ? "—"
                : isBalanceLoading
                ? "Loading…"
                : isBalanceError
                ? "Unavailable"
                : `$${availableBalance.toFixed(2)}`}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Total Purchasing Power:</span>
            <span className="font-medium text-blue-700">
              {isBalanceLoading || isBalanceError ? "—" : `$${purchasingPower.toFixed(2)}`}
            </span>
          </div>
        </div>

        {/* Slippage notice — shown inline so the user sees it before submitting */}
        {effectiveOrderType === "market" && (
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
                {slippageTolerance}%
              </p>
            )}
            {slippageBounds && (
              <p className="text-xs mt-1 text-gray-700">
                {isSell
                  ? `Min proceeds: $${slippageBounds.minProceeds.toFixed(2)}`
                  : `Max cost: $${slippageBounds.maxCost.toFixed(2)}`}
              </p>
            )}
            {isRefreshingQuote && (
              <p className="text-xs mt-1 text-gray-500">Refreshing quote…</p>
            )}
          </div>
        )}

        {/* Stale price warning — shown inline above submit so users can't miss it */}
        <StalePriceWarning marketId={market.id} />

        {/* Submit */}
        <button
          type="submit"
          disabled={
            isSubmitting ||
            !userAddress ||
            isMarketClosed ||
            isRefreshingQuote ||
            isQuoteStale ||
            sizingUnavailable
          }
          title={
            !userAddress
              ? "Connect your wallet to place an order"
              : isMarketClosed
              ? marketWarning ?? "Market is not open"
              : isRefreshingQuote || isQuoteStale
              ? "Refreshing quote…"
              : sizingUnavailable
              ? "Loading available shares…"
              : undefined
          }
          className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
            activeTab === "buy"
              ? "bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
              : "bg-red-600 hover:bg-red-700 disabled:bg-gray-400"
          } disabled:cursor-not-allowed`}
        >
          {isSubmitting || isWritePending || isConfirming
            ? isConfirming
              ? "Confirming…"
              : "Processing…"
            : !userAddress
            ? "Connect Wallet"
            : `${activeTab === "buy" ? "Buy" : "Sell"} ${market.name.split(" ")[0]}`}
        </button>

        {/* Fee info — driven by the configured fee policy and gas estimate */}
        <div className="text-xs text-gray-500 text-center space-y-1">
          <p>
            {feePolicyLoading
              ? "Trading fee: loading…"
              : `Trading fee: ${(feeBps / 100).toFixed(2)}%${
                  positionSize > 0 ? ` ($${tradingFee.toFixed(2)})` : ""
                }`}
            {" · "}
            {gasLoading
              ? "Gas: estimating…"
              : gasError
              ? "Gas: unavailable"
              : gasEstimate
              ? `Gas: ~$${gasEstimate.totalCostUsd.toFixed(2)}`
              : "Gas: —"}
          </p>
        </div>
      </form>
    </div>
  );
}
