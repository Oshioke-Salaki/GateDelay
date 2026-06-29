"use client";

import { useCallback, useReducer, useRef } from "react";
import {
  ToastContext,
  type Toast,
  type ToastInput,
} from "../../hooks/useToast";
import { ToastContainer } from "./ui/Toast";

// ─── Reducer ──────────────────────────────────────────────────────────────────

type Action =
  | { type: "ADD"; toast: Toast }
  | { type: "DISMISS"; id: string }
  | { type: "DISMISS_ALL" };

const MAX_TOASTS = 5;

function reducer(state: Toast[], action: Action): Toast[] {
  switch (action.type) {
    case "ADD":
      return [action.toast, ...state].slice(0, MAX_TOASTS);
    case "DISMISS":
      return state.filter((t) => t.id !== action.id);
    case "DISMISS_ALL":
      return [];
    default:
      return state;
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = useReducer(reducer, []);
  const counterRef = useRef(0);

  const toast = useCallback((input: ToastInput): string => {
    const id = `toast-${++counterRef.current}-${Date.now()}`;
    const duration = input.duration !== undefined ? input.duration : 5000;
    dispatch({ type: "ADD", toast: { ...input, id, duration } });
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    dispatch({ type: "DISMISS", id });
  }, []);

  const dismissAll = useCallback(() => {
    dispatch({ type: "DISMISS_ALL" });
  }, []);

  const success = useCallback(
    (title: string, message?: string, opts?: Partial<ToastInput>) =>
      toast({ type: "success", title, message, ...opts }),
    [toast]
  );

  const error = useCallback(
    (title: string, message?: string, opts?: Partial<ToastInput>) =>
      toast({ type: "error", title, message, duration: 7000, ...opts }),
    [toast]
  );

  const warning = useCallback(
    (title: string, message?: string, opts?: Partial<ToastInput>) =>
      toast({ type: "warning", title, message, ...opts }),
    [toast]
  );

  const info = useCallback(
    (title: string, message?: string, opts?: Partial<ToastInput>) =>
      toast({ type: "info", title, message, ...opts }),
    [toast]
  );

  return (
    <ToastContext.Provider
      value={{ toasts, toast, dismiss, dismissAll, success, error, warning, info }}
    >
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}
