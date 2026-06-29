"use client";

import { ReactNode } from "react";
import { ErrorBoundary } from "./ErrorBoundary";

// ─── Section Error Boundary ───────────────────────────────────────────────────

interface SectionErrorBoundaryProps {
    children: ReactNode;
    sectionName?: string;
    fallback?: ReactNode;
}

export function SectionErrorBoundary({
    children,
    sectionName,
    fallback,
}: SectionErrorBoundaryProps) {
    return (
        <ErrorBoundary
            level="section"
            showDetails={process.env.NODE_ENV === "development"}
            onError={(error, errorInfo) => {
                console.error(`Section Error [${sectionName || "Unknown"}]:`, error, errorInfo);
            }}
            fallback={fallback}
        >
            {children}
        </ErrorBoundary>
    );
}
