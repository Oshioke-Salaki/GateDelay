"use client";

import dynamic from "next/dynamic";

const BridgeInterface = dynamic(
  () => import("../../components/bridge/BridgeInterface"),
  { ssr: false }
);

export default function BridgeClient() {
  return <BridgeInterface />;
}
