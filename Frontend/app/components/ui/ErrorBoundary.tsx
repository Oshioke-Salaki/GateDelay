"use client";

import React, { Component, ReactNode, ErrorInfo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode | ((error: Error, errorInfo: ErrorInfo, reset: () => void) => ReactNode);
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    onReset?: () => void;
    resetKeys?: Array<string | number>;
    level?: "page" | "section" | "component";
    showDetails?: boolean;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

// ─── Error Logger ─────────────────────────────────────────────────────────────

class ErrorLogger {
    static log(error: Error, errorInfo: ErrorInfo, level: string = "component") {
        const errorData = {
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            level,
            timestamp: new Date().toISOString(),
            userAgent: typeof window !== "undefined" ? window.navigator.userAgent : "unknown",
            url: typeof window !== "undefined" ? window.location.href : "unknown",
        };

        // Log to console in development
        if (process.env.NODE_ENV === "development") {
            console.group(`🚨 Error Boundary [${level}]`);
            console.error("Error:", error);
            console.error("Error Info:", errorInfo);
            console.error("Full Details:", errorData);
            console.groupEnd();
        }

        // In production, send to error tracking service
        if (process.env.NODE_ENV === "production") {
            // TODO: Send to error tracking service (e.g., Sentry, LogRocket)
            // Example: Sentry.captureException(error, { contexts: { react: errorInfo } });
            console.error("Production Error:", errorData);
        }

        // Store in localStorage for debugging
        try {
            const errors = JSON.parse(localStorage.getItem("app_errors") || "[]");
            errors.push(errorData);
            // Keep only last 10 errors
            if (errors.length > 10) errors.shift();
            localStorage.setItem("app_errors", JSON.stringify(errors));
        } catch (e) {
            // Ignore localStorage errors
        }
    }

    static getStoredErrors(): any[] {
        try {
            return JSON.parse(localStorage.getItem("app_errors") || "[]");
        } catch {
            return [];
        }
    }

    static clearStoredErrors() {
        try {
            localStorage.removeItem("app_errors");
        } catch {
            // Ignore
        }
    }
}

// ─── Error Boundary Component ─────────────────────────────────────────────────

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return {
            hasError: true,
            error,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        const { onError, level = "component" } = this.props;

        // Log the error
        ErrorLogger.log(error, errorInfo, level);

        // Call custom error handler if provided
        if (onError) {
            onError(error, errorInfo);
        }

        // Update state with error info
        this.setState({
            errorInfo,
        });
    }

    componentDidUpdate(prevProps: ErrorBoundaryProps) {
        const { resetKeys } = this.props;
        const { hasError } = this.state;

        // Reset error boundary if resetKeys change
        if (
            hasError &&
            resetKeys &&
            prevProps.resetKeys &&
            resetKeys.some((key, index) => key !== prevProps.resetKeys![index])
        ) {
            this.reset();
        }
    }

    reset = () => {
        const { onReset } = this.props;

        if (onReset) {
            onReset();
        }

        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    render() {
        const { hasError, error, errorInfo } = this.state;
        const { children, fallback, level = "component", showDetails = false } = this.props;

        if (hasError && error) {
            // Custom fallback
            if (fallback) {
                if (typeof fallback === "function") {
                    return fallback(error, errorInfo!, this.reset);
                }
                return fallback;
            }

            // Default fallback based on level
            return (
                <DefaultErrorFallback
                    error={error}
                    errorInfo={errorInfo!}
                    reset={this.reset}
                    level={level}
                    showDetails={showDetails}
                />
            );
        }

        return children;
    }
}

// ─── Default Error Fallback ───────────────────────────────────────────────────

interface DefaultErrorFallbackProps {
    error: Error;
    errorInfo: ErrorInfo;
    reset: () => void;
    level: "page" | "section" | "component";
    showDetails: boolean;
}

function DefaultErrorFallback({
    error,
    errorInfo,
    reset,
    level,
    showDetails,
}: DefaultErrorFallbackProps) {
    const [detailsExpanded, setDetailsExpanded] = React.useState(false);

    const config = {
        page: {
            title: "Something went wrong",
            description: "We're sorry, but something unexpected happened. Please try refreshing the page.",
            icon: "🚨",
            containerClass: "min-h-screen flex items-center justify-center p-4",
            cardClass: "max-w-2xl w-full",
        },
        section: {
            title: "Section Error",
            description: "This section encountered an error. You can try reloading it.",
            icon: "⚠️",
            containerClass: "p-8",
            cardClass: "max-w-xl mx-auto",
        },
        component: {
            title: "Component Error",
            description: "This component failed to load.",
            icon: "⚠️",
            containerClass: "p-4",
            cardClass: "max-w-md",
        },
    }[level];

    const handleReload = () => {
        if (level === "page") {
            window.location.reload();
        } else {
            reset();
        }
    };

    const handleGoHome = () => {
        window.location.href = "/";
    };

    return (
        <div className={config.containerClass}>
            <div className={`bg-white rounded-lg shadow-lg p-6 ${config.cardClass}`}>
                {/* Icon and Title */}
                <div className="text-center mb-6">
                    <div className="text-6xl mb-4">{config.icon}</div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">{config.title}</h1>
                    <p className="text-gray-600">{config.description}</p>
                </div>

                {/* Error Message */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <p className="text-sm font-semibold text-red-800 mb-1">Error Details:</p>
                    <p className="text-sm text-red-700 font-mono">{error.message}</p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <button
                        onClick={handleReload}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                        {level === "page" ? "Reload Page" : "Try Again"}
                    </button>
                    {level === "page" && (
                        <button
                            onClick={handleGoHome}
                            className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                        >
                            Go to Home
                        </button>
                    )}
                </div>

                {/* Technical Details (Expandable) */}
                {(showDetails || process.env.NODE_ENV === "development") && (
                    <div className="border-t pt-4">
                        <button
                            onClick={() => setDetailsExpanded(!detailsExpanded)}
                            className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-700 hover:text-gray-900"
                        >
                            <span>Technical Details</span>
                            <span className="text-gray-400">{detailsExpanded ? "▼" : "▶"}</span>
                        </button>

                        {detailsExpanded && (
                            <div className="mt-3 space-y-3">
                                {/* Stack Trace */}
                                <div>
                                    <p className="text-xs font-semibold text-gray-600 mb-1">Stack Trace:</p>
                                    <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto max-h-40 overflow-y-auto">
                                        {error.stack}
                                    </pre>
                                </div>

                                {/* Component Stack */}
                                {errorInfo.componentStack && (
                                    <div>
                                        <p className="text-xs font-semibold text-gray-600 mb-1">Component Stack:</p>
                                        <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto max-h-40 overflow-y-auto">
                                            {errorInfo.componentStack}
                                        </pre>
                                    </div>
                                )}

                                {/* Copy Error Button */}
                                <button
                                    onClick={() => {
                                        const errorText = `Error: ${error.message}\n\nStack:\n${error.stack}\n\nComponent Stack:\n${errorInfo.componentStack}`;
                                        navigator.clipboard.writeText(errorText);
                                    }}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                >
                                    📋 Copy Error Details
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Help Text */}
                <div className="mt-6 text-center">
                    <p className="text-xs text-gray-500">
                        If this problem persists, please contact support with the error details above.
                    </p>
                </div>
            </div>
        </div>
    );
}

// ─── Export Error Logger ──────────────────────────────────────────────────────

export { ErrorLogger };
