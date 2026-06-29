"use client";
import DIDDisplay, { DIDInfo } from "../../components/identity/DIDDisplay";

const SAMPLE_DID: DIDInfo = {
  did: "did:stellar:GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJMUF6NS4LEGRAND5DANKQO7P2",
  verified: true,
  verificationStatus: "verified",
  claims: {
    name: "Alice Johnson",
    email: "alice@example.com",
    kyc: true,
    reputation: 92,
  },
  attestations: [
    {
      issuer: "Stellar Foundation",
      claim: "KYC Verified",
      date: "2026-01-15T10:00:00Z",
      verified: true,
    },
    {
      issuer: "GateDelay Protocol",
      claim: "Active Trader",
      date: "2026-02-20T14:30:00Z",
      verified: true,
    },
    {
      issuer: "Reputation Oracle",
      claim: "High Reputation Score",
      date: "2026-03-10T09:15:00Z",
      verified: true,
    },
  ],
  verificationLinks: [
    {
      label: "Stellar Expert",
      url: "https://stellar.expert/explorer/public/account/GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJMUF6NS4LEGRAND5DANKQO7P2",
    },
    {
      label: "View on Ledger",
      url: "https://stellar.expert",
    },
  ],
};

export default function IdentityPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1
          className="text-3xl font-bold"
          style={{ color: "var(--foreground)" }}
        >
          Decentralized Identity
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          View and manage your decentralized identity information
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <h2
            className="text-lg font-semibold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            Full View
          </h2>
          <DIDDisplay did={SAMPLE_DID} compact={false} />
        </div>

        <div>
          <h2
            className="text-lg font-semibold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            Compact View
          </h2>
          <DIDDisplay did={SAMPLE_DID} compact={true} />
        </div>
      </div>
    </main>
  );
}
