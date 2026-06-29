"use client";

import { useState, useEffect } from "react";
import { errorReporter, ErrorReport } from "@/lib/errorReporting";

// ─── Error Dashboard ──────────────────────────────────────────────────────────

export function ErrorDashboard() {
    const [errors, setErrors] = useState<ErrorReport[]>([]);
    const [filter, setFilter] = useState<"all" | "error" | "warning" | "info">("all");
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        loadErrors();
    }, [filter]);

    const loadErrors = () => {
        const allErrors =
            filter === "all" ? errorReporter.getErrors() : errorReporter.getErrorsByLevel(filter);
        setErrors(allErrors);
    };

    const handleClear = () => {
        if (confirm("Are you sure you want to clear all error logs?")) {
            errorReporter.clearErrors();
            loadErrors();
        }
    };

    const handleDownload = () => {
        errorReporter.downloadErrors();
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 left-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-red-700 transition-colors text-sm font-medium z-50"
                title="Open Error Dashboard"
            >
                🐛 Errors ({errors.length})
            </button>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-xl font-bold">Error Dashboard</h2>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                    >
                        ×
                    </button>
                </div>

                {/* Filters */}
                <div className="flex items-center justify-between p-4 border-b bg-gray-50">
                    <div className="flex space-x-2">
                        {(["all", "error", "warning", "info"] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1 rounded text-sm font-medium ${filter === f
                                        ? "bg-blue-600 text-white"
                                        : "bg-white text-gray-700 hover:bg-gray-100"
                                    }`}
                            >
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>
                    <div className="flex space-x-2">
                        <button
                            onClick={handleDownload}
                            className="px-3 py-1 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
                        >
                            Download
                        </button>
                        <button
                            onClick={handleClear}
                            className="px-3 py-1 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700"
                        >
                            Clear All
                        </button>
                    </div>
                </div>

                {/* Error List */}
                <div className="flex-1 overflow-y-auto p-4">
                    {errors.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <p className="text-4xl mb-2">✨</p>
                            <p>No errors logged</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {errors.map((error, index) => (
                                <ErrorItem key={index} error={error} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 text-sm text-gray-600">
                    <p>
                        Total Errors: {errors.length} | Last Updated:{" "}
                        {errors.length > 0
                            ? new Date(errors[errors.length - 1].timestamp).toLocaleString()
                            : "N/A"}
                    </p>
                </div>
            </div>
        </div>
    );
}

// ─── Error Item ───────────────────────────────────────────────────────────────

function ErrorItem({ error }: { error: ErrorReport }) {
    const [expanded, setExpanded] = useState(false);

    const levelColors = {
        error: "bg-red-50 border-red-200 text-red-800",
        warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
        info: "bg-blue-50 border-blue-200 text-blue-800",
    };

    const levelIcons = {
        error: "🔴",
        warning: "🟡",
        info: "🔵",
    };

    return (
        <div className={`border rounded-lg p-3 ${levelColors[error.level]}`}>
            <div
                className="flex items-start justify-between cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                        <span>{levelIcons[error.level]}</span>
                        <span className="font-semibold text-sm">{error.level.toUpperCase()}</span>
                        <span className="text-xs opacity-75">
                            {new Date(error.timestamp).toLocaleString()}
                        </span>
                    </div>
                    <p className="text-sm font-mono">{error.message}</p>
                </div>
                <button className="text-lg ml-2">{expanded ? "▼" : "▶"}</button>
            </div>

            {expanded && (
                <div className="mt-3 space-y-2 text-xs">
                    {error.stack && (
                        <div>
                            <p className="font-semibold mb-1">Stack Trace:</p>
                            <pre className="bg-white bg-opacity-50 p-2 rounded overflow-x-auto max-h-40 overflow-y-auto">
                                {error.stack}
                            </pre>
                        </div>
                    )}

                    {error.componentStack && (
                        <div>
                            <p className="font-semibold mb-1">Component Stack:</p>
                            <pre className="bg-white bg-opacity-50 p-2 rounded overflow-x-auto max-h-40 overflow-y-auto">
                                {error.componentStack}
                            </pre>
                        </div>
                    )}

                    {error.context && (
                        <div>
                            <p className="font-semibold mb-1">Context:</p>
                            <pre className="bg-white bg-opacity-50 p-2 rounded overflow-x-auto">
                                {JSON.stringify(error.context, null, 2)}
                            </pre>
                        </div>
                    )}

                    <div className="flex items-center space-x-4 pt-2 border-t border-current border-opacity-20">
                        <span>URL: {error.url}</span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const errorText = `${error.level.toUpperCase()}: ${error.message}\n\nStack:\n${error.stack || "N/A"
                                    }\n\nTimestamp: ${error.timestamp}\nURL: ${error.url}`;
                                navigator.clipboard.writeText(errorText);
                            }}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                            📋 Copy
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
