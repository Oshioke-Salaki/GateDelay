"use client";

import { ReactNode } from "react";

// ─── Settings Section ─────────────────────────────────────────────────────────

interface SettingsSectionProps {
    title: string;
    description?: string;
    icon?: ReactNode;
    children: ReactNode;
}

export function SettingsSection({ title, description, icon, children }: SettingsSectionProps) {
    return (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-start space-x-3 mb-6">
                {icon && <div className="text-2xl mt-1">{icon}</div>}
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-900">{title}</h2>
                    {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
                </div>
            </div>
            <div className="space-y-4">{children}</div>
        </div>
    );
}

// ─── Settings Row ─────────────────────────────────────────────────────────────

interface SettingsRowProps {
    label: string;
    description?: string;
    children: ReactNode;
    error?: string;
}

export function SettingsRow({ label, description, children, error }: SettingsRowProps) {
    return (
        <div className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0">
            <div className="flex-1 pr-4">
                <label className="block text-sm font-medium text-gray-900">{label}</label>
                {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
                {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
            </div>
            <div className="flex-shrink-0">{children}</div>
        </div>
    );
}
