"use client";

import { ReactNode } from "react";
import { ErrorBoundary } from "./ErrorBoundary";

// ─── Page Error Boundary ──────────────────────────────────────────────────────

interface PageErrorBoundaryProps {
    children: ReactNode;
}

export function PageErrorBoundary({ children }: PageErrorBoundaryProps) {
    return (
        <ErrorBoundary
            level="page"
            showDetails={process.env.NODE_ENV === "development"}
            onError={(error, errorInfo) => {
                // Log to analytics or error tracking service
                console.error("Page Error:", error, errorInfo);
            }}
        >
            {children}
        </ErrorBoundary>
    );
}
