"use client";
import Link from "next/link";
import DarkModeToggle from "./DarkModeToggle";
import WalletButton from "./WalletButton";

export default function Navbar() {
  return (
    <nav
      className="sticky top-0 z-40 flex items-center justify-between px-6 py-3"
      style={{ background: "var(--background)", borderBottom: "1px solid var(--border)" }}
    >
      <Link href="/" className="font-bold text-lg" style={{ color: "var(--foreground)" }}>
        GateDelay
      </Link>
      <div className="flex items-center gap-4">
        <Link href="/transactions" className="text-sm" style={{ color: "var(--muted)" }}>
          History
        </Link>
        <Link href="/settings" className="text-sm" style={{ color: "var(--muted)" }}>
          Settings
        </Link>
        <DarkModeToggle />
        <WalletButton />
      </div>
    </nav>
  );
}
