"use client";

import { ChangeEvent } from "react";

// ─── Toggle Switch ────────────────────────────────────────────────────────────

interface ToggleSwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}

export function ToggleSwitch({ checked, onChange, disabled }: ToggleSwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`
        relative inline-flex h-6 w-11 items-center rounded-full transition-colors
        ${checked ? "bg-blue-600" : "bg-gray-300"}
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
      `}
        >
            <span
                className={`
          inline-block h-4 w-4 transform rounded-full bg-white transition-transform
          ${checked ? "translate-x-6" : "translate-x-1"}
        `}
            />
        </button>
    );
}

// ─── Select Input ─────────────────────────────────────────────────────────────

interface SelectInputProps {
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
    disabled?: boolean;
}

export function SelectInput({ value, onChange, options, disabled }: SelectInputProps) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}

// ─── Number Input ─────────────────────────────────────────────────────────────

interface NumberInputProps {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    suffix?: string;
    disabled?: boolean;
}

export function NumberInput({
    value,
    onChange,
    min,
    max,
    step = 0.1,
    suffix,
    disabled,
}: NumberInputProps) {
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const newValue = parseFloat(e.target.value);
        if (!isNaN(newValue)) {
            onChange(newValue);
        }
    };

    return (
        <div className="flex items-center space-x-2">
            <input
                type="number"
                value={value}
                onChange={handleChange}
                min={min}
                max={max}
                step={step}
                disabled={disabled}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {suffix && <span className="text-sm text-gray-600">{suffix}</span>}
        </div>
    );
}

// ─── Radio Group ──────────────────────────────────────────────────────────────

interface RadioGroupProps {
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string; description?: string }>;
    disabled?: boolean;
}

export function RadioGroup({ value, onChange, options, disabled }: RadioGroupProps) {
    return (
        <div className="space-y-2">
            {options.map((option) => (
                <label
                    key={option.value}
                    className={`
            flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-colors
            ${value === option.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          `}
                >
                    <input
                        type="radio"
                        value={option.value}
                        checked={value === option.value}
                        onChange={(e) => onChange(e.target.value)}
                        disabled={disabled}
                        className="mt-1"
                    />
                    <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">{option.label}</div>
                        {option.description && (
                            <div className="text-xs text-gray-500 mt-1">{option.description}</div>
                        )}
                    </div>
                </label>
            ))}
        </div>
    );
}

// ─── Text Input ───────────────────────────────────────────────────────────────

interface TextInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
}

export function TextInput({ value, onChange, placeholder, disabled }: TextInputProps) {
    return (
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
    );
}

// ─── Range Slider ─────────────────────────────────────────────────────────────

interface RangeSliderProps {
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step?: number;
    showValue?: boolean;
    suffix?: string;
    disabled?: boolean;
}

export function RangeSlider({
    value,
    onChange,
    min,
    max,
    step = 1,
    showValue = true,
    suffix,
    disabled,
}: RangeSliderProps) {
    return (
        <div className="flex items-center space-x-4">
            <input
                type="range"
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                min={min}
                max={max}
                step={step}
                disabled={disabled}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {showValue && (
                <span className="text-sm font-medium text-gray-700 min-w-[60px] text-right">
                    {value}
                    {suffix}
                </span>
            )}
        </div>
    );
}
