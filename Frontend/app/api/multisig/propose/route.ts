import { NextResponse } from "next/server";
import { proposeTransaction } from "@/lib/multisigStore";

export async function POST(req: Request) {
  try {
    const { walletId, txData, proposer } = await req.json();

    if (!walletId || !txData || !proposer) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: walletId, txData, proposer" },
        { status: 400 }
      );
    }

    const txId = await proposeTransaction(walletId, txData, proposer);
    return NextResponse.json({ success: true, data: { txId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
