"use client";

import dynamic from "next/dynamic";

const BridgeInterface = dynamic(
  () => import("../../components/bridge/BridgeInterface"),
  { ssr: false }
);

export default function BridgeClient() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-start px-4 py-12">
      <BridgeInterface />
    </main>
  );
}
