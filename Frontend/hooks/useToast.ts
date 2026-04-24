"use client";

import { createContext, useContext } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  type: ToastType;
  /** Bold heading line */
  title?: string;
  /** Secondary body text */
  message?: string;
  /**
   * Auto-dismiss delay in ms.
   * Pass 0 to keep until manually dismissed.
   * Default: 5000 (errors default to 7000)
   */
  duration?: number;
  /** Optional inline action button */
  action?: ToastAction;
}

export type ToastInput = Omit<Toast, "id">;

// ─── Context value shape ──────────────────────────────────────────────────────

export interface ToastContextValue {
  toasts: Toast[];
  /** Add a toast and return its generated id */
  toast: (input: ToastInput) => string;
  /** Dismiss a specific toast by id */
  dismiss: (id: string) => void;
  /** Dismiss all toasts */
  dismissAll: () => void;
  // Convenience helpers
  success: (title: string, message?: string, opts?: Partial<ToastInput>) => string;
  error: (title: string, message?: string, opts?: Partial<ToastInput>) => string;
  warning: (title: string, message?: string, opts?: Partial<ToastInput>) => string;
  info: (title: string, message?: string, opts?: Partial<ToastInput>) => string;
}

// ─── Context (default is a no-op stub) ───────────────────────────────────────

export const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  toast: () => "",
  dismiss: () => {},
  dismissAll: () => {},
  success: () => "",
  error: () => "",
  warning: () => "",
  info: () => "",
});

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
