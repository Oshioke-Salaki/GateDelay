"use client";

import { useState } from "react";
import { ComponentErrorBoundary } from "@/app/components/ui/ComponentErrorBoundary";
import { SectionErrorBoundary } from "@/app/components/ui/SectionErrorBoundary";
import { AsyncErrorBoundary, useAsyncError } from "@/app/components/ui/AsyncErrorBoundary";
import { ErrorDashboard } from "@/app/components/ui/ErrorDashboard";
import { reportError, reportWarning, reportInfo } from "@/lib/errorReporting";

// ─── Test Components ──────────────────────────────────────────────────────────

function ThrowErrorComponent() {
    throw new Error("This is a test error from ThrowErrorComponent");
}

function ThrowAsyncErrorComponent() {
    const throwError = useAsyncError();

    const handleAsyncError = async () => {
        try {
            await new Promise((resolve, reject) => {
                setTimeout(() => reject(new Error("Async operation failed")), 1000);
            });
        } catch (error) {
            throwError(error as Error);
        }
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="font-semibold mb-2">Async Error Test</h3>
            <button
                onClick={handleAsyncError}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
                Trigger Async Error
            </button>
        </div>
    );
}

function ConditionalErrorComponent({ shouldError }: { shouldError: boolean }) {
    if (shouldError) {
        throw new Error("Conditional error triggered");
    }
    return <div className="text-green-600">✓ Component rendered successfully</div>;
}

// ─── Main Test Page ───────────────────────────────────────────────────────────

export default function TestErrorsPage() {
    const [showError1, setShowError1] = useState(false);
    const [showError2, setShowError2] = useState(false);
    const [showError3, setShowError3] = useState(false);
    const [showAsyncError, setShowAsyncError] = useState(false);

    const handleUnhandledRejection = () => {
        Promise.reject(new Error("Unhandled promise rejection test"));
    };

    const handleGlobalError = () => {
        // @ts-ignore - Intentional error
        window.nonExistentFunction();
    };

    const handleReportError = () => {
        reportError(new Error("Manual error report"), {
            component: "TestErrorsPage",
            action: "handleReportError",
        });
    };

    const handleReportWarning = () => {
        reportWarning("This is a warning message", {
            component: "TestErrorsPage",
            severity: "medium",
        });
    };

    const handleReportInfo = () => {
        reportInfo("This is an info message", {
            component: "TestErrorsPage",
            type: "user_action",
        });
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <h1 className="text-3xl font-bold mb-8">Error Boundary Test Page</h1>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4 text-blue-900">Testing Instructions</h2>
                <ol className="list-decimal list-inside space-y-2 text-blue-800">
                    <li>Click buttons to trigger different types of errors</li>
                    <li>Observe how error boundaries catch and display errors</li>
                    <li>Try the "Try Again" buttons to reset error boundaries</li>
                    <li>Check the Error Dashboard (bottom left) to see logged errors</li>
                    <li>Test that errors don't crash the entire application</li>
                </ol>
            </div>

            {/* Component Error Boundary Tests */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Component Error Boundaries</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Test 1 */}
                    <div>
                        <h3 className="font-medium mb-2">Test 1: Component Error</h3>
                        <ComponentErrorBoundary componentName="Test1Component">
                            <div className="bg-gray-50 p-4 rounded border">
                                <button
                                    onClick={() => setShowError1(!showError1)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mb-2"
                                >
                                    {showError1 ? "Hide Error" : "Show Error"}
                                </button>
                                <ConditionalErrorComponent shouldError={showError1} />
                            </div>
                        </ComponentErrorBoundary>
                    </div>

                    {/* Test 2 */}
                    <div>
                        <h3 className="font-medium mb-2">Test 2: Another Component Error</h3>
                        <ComponentErrorBoundary componentName="Test2Component">
                            <div className="bg-gray-50 p-4 rounded border">
                                <button
                                    onClick={() => setShowError2(!showError2)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mb-2"
                                >
                                    {showError2 ? "Hide Error" : "Show Error"}
                                </button>
                                <ConditionalErrorComponent shouldError={showError2} />
                            </div>
                        </ComponentErrorBoundary>
                    </div>
                </div>
            </div>

            {/* Section Error Boundary Test */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Section Error Boundary</h2>
                <SectionErrorBoundary sectionName="TestSection">
                    <div className="bg-gray-50 p-4 rounded border">
                        <button
                            onClick={() => setShowError3(!showError3)}
                            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 mb-2"
                        >
                            {showError3 ? "Hide Error" : "Show Error"}
                        </button>
                        <ConditionalErrorComponent shouldError={showError3} />
                    </div>
                </SectionErrorBoundary>
            </div>

            {/* Async Error Boundary Test */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Async Error Boundary</h2>
                <AsyncErrorBoundary>
                    <div className="bg-gray-50 p-4 rounded border">
                        {showAsyncError ? (
                            <ThrowAsyncErrorComponent />
                        ) : (
                            <button
                                onClick={() => setShowAsyncError(true)}
                                className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
                            >
                                Load Async Component
                            </button>
                        )}
                    </div>
                </AsyncErrorBoundary>
            </div>

            {/* Global Error Tests */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Global Error Handlers</h2>
                <div className="space-y-3">
                    <div>
                        <p className="text-sm text-gray-600 mb-2">
                            Test unhandled promise rejection (check console and toast)
                        </p>
                        <button
                            onClick={handleUnhandledRejection}
                            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                            Trigger Unhandled Rejection
                        </button>
                    </div>

                    <div>
                        <p className="text-sm text-gray-600 mb-2">
                            Test global error (check console and toast)
                        </p>
                        <button
                            onClick={handleGlobalError}
                            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                            Trigger Global Error
                        </button>
                    </div>
                </div>
            </div>

            {/* Error Reporting Tests */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Error Reporting</h2>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={handleReportError}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                        Report Error
                    </button>
                    <button
                        onClick={handleReportWarning}
                        className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                    >
                        Report Warning
                    </button>
                    <button
                        onClick={handleReportInfo}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Report Info
                    </button>
                </div>
                <p className="text-sm text-gray-600 mt-3">
                    Click the "🐛 Errors" button in the bottom left to view the error dashboard
                </p>
            </div>

            {/* Custom Fallback Example */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Custom Fallback UI</h2>
                <ComponentErrorBoundary
                    componentName="CustomFallbackTest"
                    fallback={(error, reset) => (
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg p-6">
                            <div className="flex items-start space-x-4">
                                <span className="text-4xl">😵</span>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-purple-900 mb-2">
                                        Oops! Something went wrong
                                    </h3>
                                    <p className="text-purple-700 mb-4">
                                        This is a custom fallback UI. You can design it however you want!
                                    </p>
                                    <div className="bg-white bg-opacity-50 p-3 rounded mb-4">
                                        <p className="text-sm font-mono text-purple-800">{error.message}</p>
                                    </div>
                                    <button
                                        onClick={reset}
                                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                                    >
                                        🔄 Reset Component
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                >
                    <div className="bg-gray-50 p-4 rounded border">
                        <button
                            onClick={() => {
                                throw new Error("Custom fallback error");
                            }}
                            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                        >
                            Trigger Custom Fallback
                        </button>
                    </div>
                </ComponentErrorBoundary>
            </div>

            {/* Error Dashboard */}
            <ErrorDashboard />

            {/* Summary */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Error Boundary Features</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <h3 className="font-semibold mb-2">✅ Implemented Features:</h3>
                        <ul className="space-y-1 text-gray-700">
                            <li>✓ Component-level error boundaries</li>
                            <li>✓ Section-level error boundaries</li>
                            <li>✓ Page-level error boundaries</li>
                            <li>✓ Async error handling</li>
                            <li>✓ Global error handlers</li>
                            <li>✓ Error logging and reporting</li>
                            <li>✓ Custom fallback UIs</li>
                            <li>✓ Error recovery (reset)</li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="font-semibold mb-2">🎯 Benefits:</h3>
                        <ul className="space-y-1 text-gray-700">
                            <li>✓ Prevents full app crashes</li>
                            <li>✓ User-friendly error messages</li>
                            <li>✓ Detailed error logging</li>
                            <li>✓ Easy error recovery</li>
                            <li>✓ Development debugging tools</li>
                            <li>✓ Production error tracking</li>
                            <li>✓ Isolated error containment</li>
                            <li>✓ Customizable error UIs</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
