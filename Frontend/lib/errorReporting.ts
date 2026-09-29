"use client";

export interface ErrorReport {
  message: string;
  stack?: string;
  componentStack?: string;
  level: "error" | "warning" | "info";
  context?: Record<string, any>;
  timestamp: string;
  userAgent: string;
  url: string;
}

const STORAGE_KEY = "gate_delay_error_reports";
const MAX_ERRORS = 50;

class ErrorReporter {
  private errors: ErrorReport[] = [];
  private listeners: Set<(errors: ErrorReport[]) => void> = new Set();

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          this.errors = JSON.parse(stored);
        }
      } catch (e) {
        console.error("Failed to load error reports from localStorage", e);
      }
    }
  }

  getErrors(): ErrorReport[] {
    return this.errors;
  }

  getErrorsByLevel(level: "error" | "warning" | "info"): ErrorReport[] {
    return this.errors.filter((e) => e.level === level);
  }

  getRecentErrors(n: number): ErrorReport[] {
    return this.errors.slice(-n);
  }

  clearErrors(): void {
    this.errors = [];
    this.saveAndNotify();
  }

  exportErrors(): string {
    return JSON.stringify(this.errors, null, 2);
  }

  downloadErrors(): void {
    if (typeof window === "undefined") return;
    try {
      const json = this.exportErrors();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gatedelay-error-logs-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to download error logs", e);
    }
  }

  addReport(level: "error" | "warning" | "info", message: string, context?: any, errorStack?: string): void {
    const report: ErrorReport = {
      message,
      level,
      context,
      stack: errorStack,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "Server",
      url: typeof window !== "undefined" ? window.location.href : "Server",
    };

    this.errors = [report, ...this.errors].slice(0, MAX_ERRORS);
    this.saveAndNotify();
  }

  subscribe(listener: (errors: ErrorReport[]) => void): () => void {
    this.listeners.add(listener);
    // Emit initial value
    listener(this.errors);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private saveAndNotify(): void {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.errors));
      } catch (e) {
        console.error("Failed to save error reports to localStorage", e);
      }
    }
    this.listeners.forEach((listener) => listener(this.errors));
  }
}

export const errorReporter = new ErrorReporter();

export function reportError(error: Error | string | unknown, context?: any): void {
  let message = "Unknown error";
  let stack = "";

  if (error instanceof Error) {
    message = error.message;
    stack = error.stack || "";
  } else if (typeof error === "string") {
    message = error;
  } else {
    try {
      message = String(error);
    } catch (_) {}
  }

  errorReporter.addReport("error", message, context, stack);
}

export function reportWarning(message: string, context?: any): void {
  errorReporter.addReport("warning", message, context);
}

export function reportInfo(message: string, context?: any): void {
  errorReporter.addReport("info", message, context);
}
