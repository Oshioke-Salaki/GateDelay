"use client";

import { ReactNode, useState, useEffect } from "react";
import { ErrorBoundary } from "./ErrorBoundary";

// ─── Async Error Boundary ─────────────────────────────────────────────────────

interface AsyncErrorBoundaryProps {
    children: ReactNode;
    onError?: (error: Error) => void;
    fallback?: ReactNode | ((error: Error, retry: () => void) => ReactNode);
}

export function AsyncErrorBoundary({ children, onError, fallback }: AsyncErrorBoundaryProps) {
    const [resetKey, setResetKey] = useState(0);

    const handleReset = () => {
        setResetKey((prev) => prev + 1);
    };

    return (
        <ErrorBoundary
            level="component"
            resetKeys={[resetKey]}
            onReset={handleReset}
            onError={(error, errorInfo) => {
                console.error("Async Error:", error, errorInfo);
                if (onError) {
                    onError(error);
                }
            }}
            fallback={
                typeof fallback === "function"
                    ? (error, errorInfo, reset) => fallback(error, reset)
                    : fallback ||
                      ((error, errorInfo, reset) => (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                              <div className="flex items-start space-x-3">
                                  <span className="text-yellow-600 text-xl">⚠️</span>
                                  <div className="flex-1">
                                      <p className="text-sm font-semibold text-yellow-800">
                                          Failed to load data
                                      </p>
                                      <p className="text-xs text-yellow-600 mt-1">{error.message}</p>
                                      <button
                                          onClick={reset}
                                          className="mt-2 px-3 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 font-medium"
                                      >
                                          Retry
                                      </button>
                                  </div>
                              </div>
                          </div>
                      ))
            }
        >
            {children}
        </ErrorBoundary>
    );
}

// ─── Hook for throwing async errors ───────────────────────────────────────────

export function useAsyncError() {
    const [, setError] = useState();

    return (error: Error) => {
        setError(() => {
            throw error;
        });
    };
}
