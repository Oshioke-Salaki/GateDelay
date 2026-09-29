"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import confetti from "canvas-confetti";
import { CheckCircle, X, ExternalLink } from "lucide-react";

export interface SuccessAnimationProps {
  isOpen: boolean;
  onClose: () => void;
  tradeAmount: number;
  asset: string;
  txHash?: `0x${string}`;
  confirmationMessage?: string;
  customSuccessMessage?: string;
  autoDismissMs?: number; // if 0 or undefined, no auto dismiss
  ctaText?: string;
  onCtaClick?: () => void;
}

export default function SuccessAnimation({
  isOpen,
  onClose,
  tradeAmount,
  asset,
  txHash,
  confirmationMessage = "Trade confirmed on the network.",
  customSuccessMessage = "Trade Successful!",
  autoDismissMs,
  ctaText,
  onCtaClick,
}: SuccessAnimationProps) {
  const shouldReduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const triggerConfetti = useCallback(() => {
    if (shouldReduceMotion) return; // Respect reduced motion

    const duration = 2000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ["#22c55e", "#3b82f6", "#a855f7"]
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ["#22c55e", "#3b82f6", "#a855f7"]
      });

      if (Date.now() < end && isOpen) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, [shouldReduceMotion, isOpen]);

  useEffect(() => {
    if (isOpen) {
      triggerConfetti();
      
      if (autoDismissMs && autoDismissMs > 0) {
        const timer = setTimeout(() => {
          onClose();
        }, autoDismissMs);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, triggerConfetti, autoDismissMs, onClose]);

  if (!mounted) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="success-title"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 transition-colors z-10"
              aria-label="Close success dialog"
            >
              <X size={16} />
            </button>

            {/* Content */}
            <div className="p-6 pt-10 text-center flex flex-col items-center">
              <motion.div 
                initial={shouldReduceMotion ? false : { scale: 0.5, opacity: 0 }}
                animate={shouldReduceMotion ? false : { scale: 1, opacity: 1 }}
                transition={{ type: "spring", delay: 0.1, bounce: 0.5 }}
                className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4 text-emerald-500"
              >
                <CheckCircle size={32} />
              </motion.div>
              
              <h2 id="success-title" className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                {customSuccessMessage}
              </h2>
              
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 px-4">
                {confirmationMessage}
              </p>

              {/* Trade Details */}
              <div className="w-full bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4 mb-6 space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 font-medium uppercase text-xs tracking-wider">Asset</span>
                  <span className="font-semibold">{asset}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 font-medium uppercase text-xs tracking-wider">Amount</span>
                  <span className="font-semibold">${tradeAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                {txHash && (
                  <div className="flex justify-between items-center pt-3 border-t border-zinc-200 dark:border-zinc-700">
                    <span className="text-zinc-500 font-medium uppercase text-xs tracking-wider">Tx Hash</span>
                    <a
                      href={`https://etherscan.io/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-blue-500 hover:underline flex items-center gap-1"
                    >
                      {txHash.slice(0, 6)}...{txHash.slice(-4)}
                      <ExternalLink size={10} />
                    </a>
                  </div>
                )}
              </div>

              {/* Optional CTA */}
              {ctaText && onCtaClick && (
                <button
                  onClick={onCtaClick}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors"
                >
                  {ctaText}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
