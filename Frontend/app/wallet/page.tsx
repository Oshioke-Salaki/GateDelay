import type { Metadata } from "next";
import WalletClient from "./WalletClient";

export const metadata: Metadata = {
  title: "Wallet | GateDelay",
  description: "Manage your wallet: scan QR codes to connect and initiate emergency withdrawals.",
};

export default function WalletPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          Wallet
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Connect via QR code, copy your address, or initiate an emergency withdrawal.
        </p>
      </div>
      <WalletClient />
    </main>
  );
}
