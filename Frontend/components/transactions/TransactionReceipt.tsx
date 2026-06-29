"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWaitForTransactionReceipt, useTransaction, useBlock } from "wagmi";
import { formatEther, formatUnits } from "viem";
import { format } from "date-fns";
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";

interface TransactionReceiptProps {
  hash: `0x${string}`;
  isOpen: boolean;
  onClose: () => void;
}

const pdfStyles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10 },
  header: { fontSize: 18, fontWeight: "bold", marginBottom: 20, textAlign: "center" },
  section: { marginBottom: 16 },
  label: { fontSize: 9, color: "#666", marginBottom: 4 },
  value: { fontSize: 11, fontWeight: "bold", marginBottom: 8 },
  divider: { borderBottom: "1px solid #ddd", marginVertical: 12 },
  footer: { marginTop: 20, fontSize: 8, color: "#999", textAlign: "center" },
});

export default function TransactionReceipt({ hash, isOpen, onClose }: TransactionReceiptProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: receipt } = useWaitForTransactionReceipt({ hash });
  const { data: tx } = useTransaction({ hash });
  const { data: block } = useBlock({ blockNumber: receipt?.blockNumber });

  if (!receipt || !tx) {
    return null;
  }

  const timestamp = block?.timestamp ? Number(block.timestamp) * 1000 : Date.now();
  const gasUsed = receipt.gasUsed;
  const effectiveGasPrice = receipt.effectiveGasPrice || tx.gasPrice || 0n;
  const totalFee = gasUsed * effectiveGasPrice;
  const explorerUrl = `https://etherscan.io/tx/${hash}`;

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: "Transaction Receipt",
        text: `Transaction ${hash}`,
        url: explorerUrl,
      });
    } else {
      navigator.clipboard.writeText(explorerUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const doc = (
        <Document>
          <Page size="A4" style={pdfStyles.page}>
            <Text style={pdfStyles.header}>Transaction Receipt</Text>
            
            <View style={pdfStyles.section}>
              <Text style={pdfStyles.label}>Transaction Hash</Text>
              <Text style={pdfStyles.value}>{hash}</Text>
            </View>

            <View style={pdfStyles.divider} />

            <View style={pdfStyles.section}>
              <Text style={pdfStyles.label}>Block Number</Text>
              <Text style={pdfStyles.value}>{receipt.blockNumber.toString()}</Text>
            </View>

            <View style={pdfStyles.section}>
              <Text style={pdfStyles.label}>Timestamp</Text>
              <Text style={pdfStyles.value}>{format(timestamp, "PPpp")}</Text>
            </View>

            <View style={pdfStyles.section}>
              <Text style={pdfStyles.label}>Status</Text>
              <Text style={pdfStyles.value}>{receipt.status === "success" ? "Success" : "Failed"}</Text>
            </View>

            <View style={pdfStyles.divider} />

            <View style={pdfStyles.section}>
              <Text style={pdfStyles.label}>From</Text>
              <Text style={pdfStyles.value}>{tx.from}</Text>
            </View>

            <View style={pdfStyles.section}>
              <Text style={pdfStyles.label}>To</Text>
              <Text style={pdfStyles.value}>{tx.to || "Contract Creation"}</Text>
            </View>

            <View style={pdfStyles.section}>
              <Text style={pdfStyles.label}>Value</Text>
              <Text style={pdfStyles.value}>{formatEther(tx.value)} ETH</Text>
            </View>

            <View style={pdfStyles.divider} />

            <View style={pdfStyles.section}>
              <Text style={pdfStyles.label}>Gas Used</Text>
              <Text style={pdfStyles.value}>{gasUsed.toString()}</Text>
            </View>

            <View style={pdfStyles.section}>
              <Text style={pdfStyles.label}>Gas Price</Text>
              <Text style={pdfStyles.value}>{formatUnits(effectiveGasPrice, 9)} Gwei</Text>
            </View>

            <View style={pdfStyles.section}>
              <Text style={pdfStyles.label}>Total Fee</Text>
              <Text style={pdfStyles.value}>{formatEther(totalFee)} ETH</Text>
            </View>

            <Text style={pdfStyles.footer}>
              Generated on {format(new Date(), "PPpp")} • GateDelay
            </Text>
          </Page>
        </Document>
      );

      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${hash.slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto print:shadow-none print:max-h-none"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-start justify-between mb-6 print:mb-4">
              <h2 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                Transaction Receipt
              </h2>
              <button
                onClick={onClose}
                className="text-2xl leading-none transition-colors print:hidden"
                style={{ color: "var(--muted)" }}
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <div className="text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
                    Transaction Hash
                  </div>
                  <div className="font-mono text-sm break-all" style={{ color: "var(--foreground)" }}>
                    {hash}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
                      Block Number
                    </div>
                    <div className="font-semibold" style={{ color: "var(--foreground)" }}>
                      {receipt.blockNumber.toString()}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
                      Timestamp
                    </div>
                    <div className="font-semibold" style={{ color: "var(--foreground)" }}>
                      {format(timestamp, "PPpp")}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
                    Status
                  </div>
                  <div
                    className="inline-block px-3 py-1 rounded-full text-sm font-semibold"
                    style={{
                      background: receipt.status === "success" ? "#22c55e22" : "#ef444422",
                      color: receipt.status === "success" ? "#22c55e" : "#ef4444",
                    }}
                  >
                    {receipt.status === "success" ? "✓ Success" : "✗ Failed"}
                  </div>
                </div>
              </div>

              <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
                <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
                  Addresses
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
                      From
                    </div>
                    <div className="font-mono text-sm break-all" style={{ color: "var(--foreground)" }}>
                      {tx.from}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
                      To
                    </div>
                    <div className="font-mono text-sm break-all" style={{ color: "var(--foreground)" }}>
                      {tx.to || "Contract Creation"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
                <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
                  Transaction Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
                      Value
                    </div>
                    <div className="font-semibold" style={{ color: "var(--foreground)" }}>
                      {formatEther(tx.value)} ETH
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
                      Gas Used
                    </div>
                    <div className="font-semibold" style={{ color: "var(--foreground)" }}>
                      {gasUsed.toString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
                      Gas Price
                    </div>
                    <div className="font-semibold" style={{ color: "var(--foreground)" }}>
                      {formatUnits(effectiveGasPrice, 9)} Gwei
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
                      Total Fee
                    </div>
                    <div className="font-semibold" style={{ color: "var(--foreground)" }}>
                      {formatEther(totalFee)} ETH
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 print:hidden" style={{ borderColor: "var(--border)" }}>
                <div className="flex flex-wrap gap-3">
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
                    style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)", color: "white" }}
                  >
                    View on Explorer
                  </a>
                  <button
                    onClick={handleShare}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
                    style={{ background: "var(--border)", color: "var(--foreground)" }}
                  >
                    {copied ? "✓ Copied" : "Share"}
                  </button>
                  <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                    style={{ background: "var(--border)", color: "var(--foreground)" }}
                  >
                    {isDownloading ? "Downloading..." : "Download PDF"}
                  </button>
                  <button
                    onClick={handlePrint}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
                    style={{ background: "var(--border)", color: "var(--foreground)" }}
                  >
                    Print
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
