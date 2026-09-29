"use client";

import React from "react";

interface LeverageSelectorProps {
    leverage: number;
    onChange: (leverage: number) => void;
    maxLeverage?: number;
}

export default function LeverageSelector({
    leverage,
    onChange,
    maxLeverage = 10,
}: LeverageSelectorProps) {
    const marks = [1, 2, 3, 5, 10];

    return (
        <div className="space-y-4 py-2">
            <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-gray-700">
                    Leverage
                </label>
                <div className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-sm font-bold shadow-sm border border-blue-100">
                    {leverage}x
                </div>
            </div>

            <div className="relative pt-1">
                <input
                    type="range"
                    min="1"
                    max={maxLeverage}
                    step="1"
                    value={leverage}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between mt-2 px-1">
                    {marks.map((mark) => (
                        <button
                            key={mark}
                            type="button"
                            onClick={() => onChange(mark)}
                            className={`text-xs transition-colors ${
                                leverage === mark
                                    ? "font-bold text-blue-600"
                                    : "text-gray-500 hover:text-gray-900"
                            }`}
                        >
                            {mark}x
                        </button>
                    ))}
                </div>
            </div>

            {/* High Risk Warning */}
            {leverage >= 5 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2 items-start transition-all animate-in fade-in duration-300">
                    <svg
                        className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                    </svg>
                    <div className="text-xs text-red-800">
                        <span className="font-semibold block mb-0.5">
                            High Risk Warning
                        </span>
                        Trading with {leverage}x leverage significantly increases
                        your risk of liquidation. Small price movements can result in
                        loss of your entire margin.
                    </div>
                </div>
            )}
        </div>
    );
}