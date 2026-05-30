"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Market } from "./TradingInterface";
import { useToast } from "@/hooks/useToast";
import { useSettings } from "@/hooks/useSettings";
import LeverageSelector from "./LeverageSelector";

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

// ─── Order Panel ──────────────────────────────────────────────────────────────

export default function OrderPanel({
    market,
    userAddress,
    activeTab,
    onTabChange,
}: OrderPanelProps) {
    const [orderType, setOrderType] = useState<"market" | "limit">("market");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const toast = useToast();
    const { settings } = useSettings();

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm<OrderFormData>({
        defaultValues: {
            amount: 0,
            price: market.currentPrice,
            total: 0,
            orderType: "market",
            leverage: 1,
        },
    });

    const amount = watch("amount") || 0;
    const price = watch("price") || market.currentPrice;
    const leverage = watch("leverage") || 1;

    // Calculate leverage adjustments
    const positionSize = amount * (orderType === "market" ? market.currentPrice : price);
    const requiredMargin = positionSize / leverage;

    // Mock balance - in production, fetch from wallet/backend
    const balance = 1000;
    const purchasingPower = balance * leverage; // Leverage multiplies purchasing power
    const maxAmount = orderType === "market" ? purchasingPower / market.currentPrice : purchasingPower / price;

    // ─── Handlers ─────────────────────────────────────────────────────────────

    const onSubmit = async (data: OrderFormData) => {
        if (!userAddress) {
            toast.error("Wallet Not Connected", "Please connect your wallet to trade");
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
                `Do you want to proceed?`
            );

            if (!confirmed) return;
        }

        setIsSubmitting(true);

        try {
            // TODO: Implement actual order submission
            await new Promise((resolve) => setTimeout(resolve, 1500));

            toast.success(
                "Order Placed",
                `${activeTab.toUpperCase()} order for ${data.amount} shares at ${leverage}x leverage placed successfully`
            );

            // Reset form
            setValue("amount", 0);
            setValue("total", 0);
            setValue("leverage", 1);
        } catch (error) {
            toast.error("Order Failed", "Failed to place order. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSetPercentage = (percentage: number) => {
        const newAmount = (maxAmount * percentage) / 100;
        setValue("amount", parseFloat(newAmount.toFixed(4)));
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="bg-white rounded-lg shadow-lg sticky top-6">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => onTabChange("buy")}
                    className={`flex-1 py-4 font-semibold transition-colors ${activeTab === "buy"
                            ? "text-green-600 border-b-2 border-green-600"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                >
                    Buy
                </button>
                <button
                    onClick={() => onTabChange("sell")}
                    className={`flex-1 py-4 font-semibold transition-colors ${activeTab === "sell"
                            ? "text-red-600 border-b-2 border-red-600"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                >
                    Sell
                </button>
            </div>

            {/* Order Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                {/* Order Type */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Order Type</label>
                    <div className="flex space-x-2">
                        <button
                            type="button"
                            onClick={() => setOrderType("market")}
                            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${orderType === "market"
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                }`}
                        >
                            Market
                        </button>
                        <button
                            type="button"
                            onClick={() => setOrderType("limit")}
                            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${orderType === "limit"
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                }`}
                        >
                            Limit
                        </button>
                    </div>
                </div>

                {/* Price (Limit Orders Only) */}
                {orderType === "limit" && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Price (USD)
                        </label>
                        <input
                            type="number"
                            step="0.0001"
                            {...register("price", {
                                required: "Price is required",
                                min: { value: 0.0001, message: "Price must be positive" },
                            })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0.0000"
                        />
                        {errors.price && (
                            <p className="text-xs text-red-600 mt-1">{errors.price.message}</p>
                        )}
                    </div>
                )}

                {/* Market Price Display */}
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Amount (Shares)
                    </label>
                    <input
                        type="number"
                        step="0.0001"
                        {...register("amount", {
                            required: "Amount is required",
                            min: { value: 0.0001, message: "Amount must be positive" },
                            max: { value: maxAmount, message: "Insufficient purchasing power" },
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.0000"
                    />
                    {errors.amount && (
                        <p className="text-xs text-red-600 mt-1">{errors.amount.message}</p>
                    )}

                    {/* Percentage Buttons */}
                    <div className="flex space-x-2 mt-2">
                        {[25, 50, 75, 100].map((percentage) => (
                            <button
                                key={percentage}
                                type="button"
                                onClick={() => handleSetPercentage(percentage)}
                                className="flex-1 py-1 px-2 text-xs font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                            >
                                {percentage}%
                            </button>
                        ))}
                    </div>
                </div>

                {/* Leverage Selector Widget */}
                <div className="pt-2 border-t border-gray-100">
                    <LeverageSelector
                        leverage={leverage}
                        onChange={(val) => setValue("leverage", val)}
                    />
                </div>

                {/* Leverage Calculations Breakdown */}
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

                {/* Account Balances Context */}
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

                {/* Slippage Warning */}
                {orderType === "market" && (
                    <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                        <p className="text-xs text-yellow-800">
                            <span className="font-semibold">Slippage Tolerance:</span>{" "}
                            {settings.trading.defaultSlippage}%
                        </p>
                    </div>
                )}

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={isSubmitting || !userAddress}
                    className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${activeTab === "buy"
                            ? "bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                            : "bg-red-600 hover:bg-red-700 disabled:bg-gray-400"
                        } disabled:cursor-not-allowed`}
                >
                    {isSubmitting
                        ? "Processing..."
                        : !userAddress
                            ? "Connect Wallet"
                            : `${activeTab === "buy" ? "Buy" : "Sell"} ${market.name.split(" ")[0]}`}
                </button>

                {/* Fee Info */}
                <div className="text-xs text-gray-500 text-center">
                    <p>Trading fee: 0.3% • Gas fee: ~$2.50</p>
                </div>
            </form>
        </div>
    );
}