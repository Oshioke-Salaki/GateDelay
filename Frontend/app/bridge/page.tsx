import type { Metadata } from "next";
import BridgeClient from "./BridgeClient";

export const metadata: Metadata = {
  title: "Bridge | GateDelay",
  description: "Move assets between networks using the best available bridge route.",
};

export default function BridgePage() {
  return <BridgeClient />;
}
