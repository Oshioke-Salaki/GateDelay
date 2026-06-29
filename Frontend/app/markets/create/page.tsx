"use client";
import CreateMarketForm from "../../../components/market/CreateMarketForm";
import dynamic from "next/dynamic";

const GasEstimator = dynamic(
  () => import("../../../components/gas/GasEstimator"),
  { ssr: false }
);

export default function CreateMarketPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-4">
      <CreateMarketForm />
      <GasEstimator
        gasLimit={300_000n}
        defaultSpeed="standard"
        className="max-w-xl mx-auto"
      />
    </main>
  );
}
