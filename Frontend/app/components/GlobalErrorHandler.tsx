"use client";

import { useEffect } from "react";
import { useToast } from "@/hooks/useToast";

// ─── Global Error Handler ─────────────────────────────────────────────────────

export function GlobalErrorHandler() {
    const toast = useToast();

    useEffect(() => {
        // Handle unhandled promise rejections
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            console.error("Unhandled Promise Rejection:", event.reason);

            toast.error(
                "Something went wrong",
                "An unexpected error occurred. Please try again.",
                { duration: 7000 }
            );

            // Log to error tracking service
            if (process.env.NODE_ENV === "production") {
                // TODO: Send to error tracking service
                console.error("Production Unhandled Rejection:", {
                    reason: event.reason,
                    promise: event.promise,
                    timestamp: new Date().toISOString(),
                });
            }

            // Prevent default browser error handling
            event.preventDefault();
        };

        // Handle global errors
        const handleError = (event: ErrorEvent) => {
            console.error("Global Error:", event.error);

            // Don't show toast for script loading errors (common in dev)
            if (event.message.includes("Script error")) {
                return;
            }

            toast.error(
                "Application Error",
                "An unexpected error occurred. The page may need to be refreshed.",
                { duration: 7000 }
            );

            // Log to error tracking service
            if (process.env.NODE_ENV === "production") {
                console.error("Production Global Error:", {
                    message: event.message,
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                    error: event.error,
                    timestamp: new Date().toISOString(),
                });
            }
        };

        // Add event listeners
        window.addEventListener("unhandledrejection", handleUnhandledRejection);
        window.addEventListener("error", handleError);

        // Cleanup
        return () => {
            window.removeEventListener("unhandledrejection", handleUnhandledRejection);
            window.removeEventListener("error", handleError);
        };
    }, [toast]);

    return null;
}
