"use client";

import dynamic from "next/dynamic";

const QRDisplay = dynamic(
  () => import("../../components/wallet/QRDisplay"),
  { ssr: false },
);

const EmergencyWithdrawal = dynamic(
  () => import("../../components/wallet/EmergencyWithdrawal"),
  { ssr: false },
);

const ImportWallet = dynamic(
  () => import("../../components/wallet/ImportWallet"),
  { ssr: false },
);

export default function WalletClient() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
      {/* QR display — left column */}
      <QRDisplay timeoutSeconds={300} />

      {/* Right column: import wallet + emergency withdrawal */}
      <div className="space-y-6">
        {/* Import Wallet */}
        <ImportWallet />

        {/* Emergency withdrawal */}
        <div
          className="rounded-2xl p-5"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: "var(--muted)" }}
          >
            Emergency actions
          </p>
          <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
            Use emergency withdrawal only when normal withdrawal channels are unavailable.
            This bypasses standard queues and uses elevated gas.
          </p>
          <EmergencyWithdrawal
            balance="1,250.00"
            tokenSymbol="USDC"
          />
        </div>
      </div>
    </div>
  );
}
