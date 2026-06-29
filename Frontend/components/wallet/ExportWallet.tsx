"use client";

import React, { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useTransactionTracker, TrackedTransaction } from "../../hooks/useTransactionTracker";
import CryptoJS from "crypto-js";
import { Download, FileJson, FileSpreadsheet, Lock, AlertCircle, CheckCircle2, History, Loader2 } from "lucide-react";

type ExportFormat = "json" | "csv";

interface ExportHistoryRecord {
  id: string;
  timestamp: string;
  format: ExportFormat;
  status: "success" | "failure";
  error?: string;
}

const HISTORY_STORAGE_KEY = "gd_export_history";

export default function ExportWallet() {
  const { address, isConnected } = useAccount();
  const { transactions } = useTransactionTracker();
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [format, setFormat] = useState<ExportFormat>("json");
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [history, setHistory] = useState<ExportHistoryRecord[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      // Ignore
    }
  }, []);

  const saveHistory = (record: ExportHistoryRecord) => {
    try {
      const next = [record, ...history].slice(0, 10);
      setHistory(next);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      // Ignore
    }
  };

  const convertToCSV = (txs: TrackedTransaction[], userAddr: string) => {
    const header = "Hash,Description,Timestamp,WalletAddress\n";
    const rows = txs.map(tx => 
      `${tx.hash},"${tx.description.replace(/"/g, '""')}",${new Date(tx.timestamp).toISOString()},${userAddr}`
    ).join("\n");
    return header + rows;
  };

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!isConnected || !address) {
      setError("Wallet not connected");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsExporting(true);

    try {
      // Yield to UI thread to show loader
      await new Promise(resolve => setTimeout(resolve, 100));

      const metadata = {
        exportedAt: new Date().toISOString(),
        version: "1.0",
        address,
      };

      let rawData = "";
      if (format === "json") {
        rawData = JSON.stringify({ metadata, transactions }, null, 2);
      } else {
        rawData = convertToCSV(transactions, address);
      }

      // Encrypt
      let encryptedData = "";
      try {
        encryptedData = CryptoJS.AES.encrypt(rawData, password).toString();
      } catch (err) {
        throw new Error("Encryption failed");
      }

      // Create Blob & Download
      try {
        const blob = new Blob([encryptedData], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `gate_delay_wallet_export_${new Date().getTime()}.${format}.enc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (err) {
        throw new Error("Browser download API failed");
      }

      setSuccess(true);
      saveHistory({
        id: crypto.randomUUID?.() || Date.now().toString(),
        timestamp: new Date().toISOString(),
        format,
        status: "success",
      });
      
      // Clear passwords
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      saveHistory({
        id: crypto.randomUUID?.() || Date.now().toString(),
        timestamp: new Date().toISOString(),
        format,
        status: "failure",
        error: err.message || "Unknown error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl max-w-lg mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Download size={20} /> Export Wallet Data
        </h2>
        <p className="text-sm text-zinc-500 mt-1">
          Securely export your local transaction history and settings. Data will be encrypted with a password of your choice.
        </p>
      </div>

      <form onSubmit={handleExport} className="space-y-5">
        <div>
          <label className="block text-sm font-semibold mb-2">Export Format</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setFormat("json")}
              className={`flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 transition-colors ${
                format === "json" 
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold" 
                  : "border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              }`}
            >
              <FileJson size={18} /> JSON
            </button>
            <button
              type="button"
              onClick={() => setFormat("csv")}
              className={`flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 transition-colors ${
                format === "csv" 
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold" 
                  : "border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              }`}
            >
              <FileSpreadsheet size={18} /> CSV
            </button>
          </div>
        </div>

        <div className="space-y-3 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 font-semibold mb-2 text-sm">
            <Lock size={16} /> Encryption Password
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isExporting}
              required
              minLength={8}
              placeholder="Enter strong password..."
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isExporting}
              required
              minLength={8}
              placeholder="Confirm password..."
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:border-blue-500 transition-colors"
            />
          </div>
          <p className="text-xs text-zinc-500">
            This password is required to decrypt your exported file. Do not lose it!
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-sm flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {success && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-2">
            <CheckCircle2 size={16} /> Export successful! Check your downloads.
          </div>
        )}

        <button
          type="submit"
          disabled={isExporting || !isConnected || !password || !confirmPassword}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting ? (
            <><Loader2 size={18} className="animate-spin" /> Encrypting...</>
          ) : (
            <><Download size={18} /> Generate Export</>
          )}
        </button>
      </form>

      {history.length > 0 && (
        <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-4 text-zinc-700 dark:text-zinc-300">
            <History size={16} /> Export History
          </h3>
          <div className="space-y-2">
            {history.map((record) => (
              <div key={record.id} className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/30 text-xs">
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100 uppercase mr-2">{record.format}</span>
                  <span className="text-zinc-500">{new Date(record.timestamp).toLocaleString()}</span>
                </div>
                <div className={`flex items-center gap-1 ${record.status === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {record.status === 'success' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                  <span className="capitalize">{record.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
