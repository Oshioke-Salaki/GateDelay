"use client";

import { ReactNode } from "react";
import { ErrorBoundary } from "./ErrorBoundary";

// ─── Component Error Boundary ─────────────────────────────────────────────────

interface ComponentErrorBoundaryProps {
    children: ReactNode;
    componentName?: string;
    fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
    onError?: (error: Error) => void;
}

export function ComponentErrorBoundary({
    children,
    componentName,
    fallback,
    onError,
}: ComponentErrorBoundaryProps) {
    return (
        <ErrorBoundary
            level="component"
            showDetails={false}
            onError={(error, errorInfo) => {
                console.error(`Component Error [${componentName || "Unknown"}]:`, error);
                if (onError) {
                    onError(error);
                }
            }}
            fallback={
                typeof fallback === "function"
                    ? (error, errorInfo, reset) => fallback(error, reset)
                    : fallback ||
                      ((error, errorInfo, reset) => (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                              <div className="flex items-start space-x-3">
                                  <span className="text-red-600 text-xl">⚠️</span>
                                  <div className="flex-1">
                                      <p className="text-sm font-semibold text-red-800">
                                          {componentName || "Component"} failed to load
                                      </p>
                                      <p className="text-xs text-red-600 mt-1">{error.message}</p>
                                      <button
                                          onClick={reset}
                                          className="mt-2 text-xs text-red-700 hover:text-red-900 font-medium underline"
                                      >
                                          Try again
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
