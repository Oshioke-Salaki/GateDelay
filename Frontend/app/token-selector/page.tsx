"use client";
import { useState } from "react";
import TokenSelector, { Token } from "../../components/trade/TokenSelector";

const SAMPLE_TOKENS: Token[] = [
  {
    address: "0x1234567890123456789012345678901234567890",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    balance: 5000,
    allowance: 1000,
    icon: "💵",
  },
  {
    address: "0x0987654321098765432109876543210987654321",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    balance: 3500,
    allowance: 0,
    icon: "💴",
  },
  {
    address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
    balance: 2000,
    allowance: 2000,
    icon: "🔴",
  },
  {
    address: "0xfedcbafedcbafedcbafedcbafedcbafedcbafed",
    symbol: "STELLAR",
    name: "Stellar Lumens",
    decimals: 7,
    balance: 10000,
    allowance: 5000,
    icon: "⭐",
  },
];

export default function TokenSelectorPage() {
  const [selectedToken, setSelectedToken] = useState<Token>(SAMPLE_TOKENS[0]);
  const [isApproving, setIsApproving] = useState(false);

  const handleApprove = async (token: Token, amount: number) => {
    setIsApproving(true);
    try {
      // Simulate approval transaction
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setSelectedToken({
        ...token,
        allowance: amount,
      });
      console.log(`Approved ${amount} ${token.symbol}`);
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1
          className="text-3xl font-bold"
          style={{ color: "var(--foreground)" }}
        >
          Multi-Token Support
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Select and manage tokens for trading with approval flows
        </p>
      </div>

      <TokenSelector
        tokens={SAMPLE_TOKENS}
        selectedToken={selectedToken}
        onSelectToken={setSelectedToken}
        onApprove={handleApprove}
        isApproving={isApproving}
      />

      {/* Info Section */}
      <div
        className="rounded-lg p-4 space-y-3"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--foreground)" }}
        >
          How It Works
        </h2>
        <ul className="space-y-2 text-xs" style={{ color: "var(--muted)" }}>
          <li>• Select a token from the dropdown to view its details</li>
          <li>• Check your balance and current allowance</li>
          <li>• If allowance is insufficient, approve the token first</li>
          <li>• Enter the approval amount and confirm the transaction</li>
          <li>• Once approved, you can trade with that token</li>
        </ul>
      </div>
    </main>
  );
}
