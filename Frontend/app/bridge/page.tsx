import dynamic from "next/dynamic";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bridge | GateDelay",
  description: "Move assets between networks using the best available bridge route.",
};

// BridgeInterface uses wagmi hooks — must be client-only
const BridgeInterface = dynamic(
  () => import("../../components/bridge/BridgeInterface"),
  { ssr: false }
);

export default function BridgePage() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-start px-4 py-12">
      <BridgeInterface />
    </main>
  );
}
