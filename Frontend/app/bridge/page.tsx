import BridgeClient from "./BridgeClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bridge | GateDelay",
  description: "Move assets between networks using the best available bridge route.",
};

export default function BridgePage() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-start px-4 py-12">
      <BridgeClient />
    </main>
  );
}
